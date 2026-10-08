import type { ContentRepository } from '../../content/domain/ContentRepository';
import type { Question } from '../../content/domain/question';
import { validateRevision } from '../../content/domain/revisionValidation';
import type { StudyRepository } from '../../study/domain/StudyRepository';
import {
  StudyError,
  type OwnerContext,
  type OwnerGuard,
  type ReviewerSession,
} from '../../study/domain/study';
import type { ReviewerService } from './ReviewerService';

export type RenderedReceipt = { sessionId: string; ordinal: number; pageToken: string };
type Loaded = { session: ReviewerSession; ordinal: number; pageToken: string };
type Readable = Loaded & { question: Question };
export type ReviewerState =
  | { kind: 'idle' }
  | ({ kind: 'loading' } & {
      session: ReviewerSession | null;
      ordinal: number | null;
      pageToken: string;
    })
  | ({ kind: 'reading' | 'completed' } & Readable)
  | ({ kind: 'missing'; error: StudyError } & Loaded)
  | ({ kind: 'error'; error: StudyError; question?: Question } & {
      session: ReviewerSession | null;
      ordinal: number | null;
      pageToken: string;
    });

/** Page tokens represent one layout lifetime; only visible, current layouts count. */
export class ReviewerController {
  private state: ReviewerState = { kind: 'idle' };
  private listeners = new Set<() => void>();
  private owner: OwnerContext | null = null;
  private session: ReviewerSession | null = null;
  private token = 0;
  private disposed = false;
  private focused = false;
  private foreground = false;
  private layout: RenderedReceipt | null = null;
  private page: Readable | null = null;
  private retryAction: (() => Promise<void>) | null = null;
  private mutations: Promise<unknown> = Promise.resolve();
  private viewing = new Map<string, Promise<void>>();
  private prefetching = 0;
  private prefetched = new Set<string>();
  private prefetchWindow: number[] = [];

  constructor(
    private readonly service: ReviewerService,
    private readonly content: ContentRepository,
    private readonly study: StudyRepository,
    private readonly guard: OwnerGuard,
  ) {}
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  snapshot(): ReviewerState {
    if (this.owner && !this.guard.isCurrent(this.owner)) this.clear();
    return this.state;
  }
  private publish(state: ReviewerState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  private clear() {
    this.token++;
    this.owner = null;
    this.session = null;
    this.page = null;
    this.layout = null;
    this.retryAction = null;
    this.prefetchWindow = [];
    this.prefetched.clear();
    this.publish({ kind: 'idle' });
  }
  private current(owner: OwnerContext, token: number) {
    if (this.disposed || this.owner !== owner || token !== this.token) return false;
    if (!this.guard.isCurrent(owner)) {
      this.clear();
      return false;
    }
    return true;
  }
  private error(error: unknown): StudyError {
    return error instanceof StudyError ? error : new StudyError('invalid-content');
  }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.mutations.then(work);
    this.mutations = next.catch(() => undefined);
    return next;
  }
  async open(owner: OwnerContext, id: string): Promise<void> {
    if (this.disposed) return;
    this.clear();
    this.owner = owner;
    const token = ++this.token;
    this.publish({ kind: 'loading', session: null, ordinal: null, pageToken: String(token) });
    try {
      const session = await this.service.resume(owner, id);
      if (!this.current(owner, token)) return;
      this.session = session;
      await this.load(owner, session.position, token, false);
    } catch (error) {
      if (!this.current(owner, token)) return;
      this.retryAction = () => this.open(owner, id);
      this.publish({
        kind: 'error',
        error: this.error(error),
        session: null,
        ordinal: null,
        pageToken: String(token),
      });
    }
  }
  async move(ordinal: number): Promise<void> {
    const owner = this.owner,
      session = this.session;
    if (!owner || !session || this.disposed) return;
    const token = ++this.token;
    this.layout = null;
    this.page = null;
    if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= session.items.length) {
      this.retryAction = null;
      this.publish({
        kind: 'error',
        error: new StudyError('invalid-content'),
        session,
        ordinal: session.position,
        pageToken: String(token),
      });
      return;
    }
    await this.load(owner, ordinal, token, true);
  }
  private async load(owner: OwnerContext, ordinal: number, token: number, move: boolean) {
    const session = this.session;
    if (!session || !this.current(owner, token)) return;
    this.layout = null;
    this.page = null;
    this.retryAction = null;
    this.publish({ kind: 'loading', session, ordinal, pageToken: String(token) });
    // Fetches may finish out of order; personal mutations remain serialized.
    const fetched = this.content
      .question(owner, session.items[ordinal]!.entry)
      .then((question) => ({ question: validateRevision(question, session.items[ordinal]!.entry) }))
      .catch((error: unknown) => ({ error: this.error(error) }));
    if (move) {
      try {
        const updated = await this.serialize(async () => {
          if (!this.current(owner, token)) return null;
          return this.study.move(owner, session.id, ordinal);
        });
        if (
          updated &&
          this.owner === owner &&
          this.session?.id === updated.id &&
          updated.sequence >= this.session.sequence
        )
          this.session = updated;
      } catch (error) {
        if (!this.current(owner, token)) return;
        this.retryAction = () => this.move(ordinal);
        this.publish({
          kind: 'error',
          error: this.error(error),
          session: this.session,
          ordinal: this.session?.position ?? null,
          pageToken: String(token),
        });
        return;
      }
    }
    const result = await fetched;
    if (!this.current(owner, token) || !this.session) return;
    const loaded = { session: this.session, ordinal, pageToken: String(token) };
    if ('error' in result) {
      this.retryAction = () => this.reload(ordinal);
      this.publish({
        ...loaded,
        kind: result.error.code === 'network' ? 'missing' : 'error',
        error: result.error,
      });
      return;
    }
    this.page = { ...loaded, question: result.question };
    this.publish({
      ...this.page,
      kind: this.session.status === 'completed' ? 'completed' : 'reading',
    });
    this.prefetchWindow = [ordinal + 1, ordinal + 2].filter((n) => n < this.session!.items.length);
    this.prefetch(owner);
  }
  private async reload(ordinal: number) {
    if (!this.owner) return;
    await this.load(this.owner, ordinal, ++this.token, false);
  }
  private prefetch(owner: OwnerContext) {
    const session = this.session;
    if (!session || this.disposed || this.owner !== owner || !this.guard.isCurrent(owner)) return;
    while (this.prefetching < 2 && this.prefetchWindow.length) {
      const ordinal = this.prefetchWindow.shift()!;
      const key = `${session.id}:${ordinal}`;
      if (this.prefetched.has(key)) continue;
      this.prefetched.add(key);
      this.prefetching++;
      void this.content
        .question(owner, session.items[ordinal]!.entry)
        .catch(() => {
          this.prefetched.delete(key);
        })
        .finally(() => {
          this.prefetching--;
          this.prefetch(owner);
        });
    }
  }
  setVisibility(focused: boolean, foreground: boolean): void {
    this.focused = focused;
    this.foreground = foreground;
    if (this.owner && !this.guard.isCurrent(this.owner)) {
      this.clear();
      return;
    }
    if (focused && foreground && this.layout) void this.recordVisible(this.layout);
  }
  async rendered(receipt: RenderedReceipt): Promise<void> {
    if (!this.matches(receipt)) return;
    this.layout = receipt;
    await this.recordVisible(receipt);
  }
  private matches(receipt: RenderedReceipt) {
    return (
      !!this.owner &&
      this.current(this.owner, Number(receipt.pageToken)) &&
      !!this.page &&
      receipt.pageToken === this.page.pageToken &&
      receipt.sessionId === this.page.session.id &&
      receipt.ordinal === this.page.ordinal
    );
  }
  private recordVisible(receipt: RenderedReceipt): Promise<void> {
    if (
      !this.matches(receipt) ||
      !this.focused ||
      !this.foreground ||
      this.session!.viewedOrdinals.includes(receipt.ordinal)
    )
      return Promise.resolve();
    const key = `${receipt.sessionId}:${receipt.ordinal}:${receipt.pageToken}`;
    const pending = this.viewing.get(key);
    if (pending) return pending;
    const owner = this.owner!,
      token = this.token;
    const next = this.serialize(async () => {
      if (!this.matches(receipt) || !this.focused || !this.foreground) return;
      try {
        const updated = await this.study.recordView(owner, receipt.sessionId, receipt.ordinal);
        if (
          this.owner === owner &&
          this.session?.id === updated.id &&
          updated.sequence >= this.session.sequence
        )
          this.session = updated;
        if (!this.current(owner, token) || !this.page || !this.session) return;
        this.page = { ...this.page, session: this.session };
        this.retryAction = null;
        this.publish({
          ...this.page,
          kind: this.session.status === 'completed' ? 'completed' : 'reading',
        });
      } catch (error) {
        if (!this.current(owner, token) || !this.page) return;
        this.retryAction = () => this.recordVisible(receipt);
        this.publish({ ...this.page, kind: 'error', error: this.error(error) });
      }
    });
    this.viewing.set(key, next);
    void next.finally(() => this.viewing.delete(key)).catch(() => undefined);
    return next;
  }
  async retry(): Promise<void> {
    if (this.owner && this.guard.isCurrent(this.owner) && !this.disposed)
      await this.retryAction?.();
    else if (this.owner) this.clear();
  }
  dispose(): void {
    this.disposed = true;
    this.clear();
    this.listeners.clear();
  }
}
