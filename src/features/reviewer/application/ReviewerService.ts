import type { Clock } from '../../../core/clock/Clock';
import type { IdentitySource } from '../../../core/identity/IdentitySource';
import type { RandomSource } from '../../../core/random/RandomSource';
import type { ContentRepository } from '../../content/domain/ContentRepository';
import { CatalogSnapshotSchema, SafeIntegerSchema } from '../../content/domain/catalog';
import { eligibleEntries } from '../../content/domain/eligibility';
import { validateRevision } from '../../content/domain/revisionValidation';
import type { StudyRepository } from '../../study/domain/StudyRepository';
import {
  OwnerContextSchema,
  ReviewerSessionSchema,
  StudyError,
  StudyScopeSchema,
  type OwnerContext,
  type OwnerGuard,
  type ReviewerSession,
  type StudyScope,
} from '../../study/domain/study';

export type CatalogSource = 'server' | 'cached';
export type PreparedReviewer =
  { kind: 'ready'; session: ReviewerSession } | { kind: 'existing'; session: ReviewerSession };

/** Only confirmed replacement enters replace; prepare never archives saved work. */
export class ReviewerService {
  private queue: Promise<unknown> = Promise.resolve();
  private replacements = new Map<string, Promise<ReviewerSession>>();
  constructor(
    private readonly study: StudyRepository,
    private readonly content: ContentRepository,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly identity: IdentitySource,
    private readonly guard: OwnerGuard,
  ) {}

  private check(owner: OwnerContext) {
    if (!OwnerContextSchema.safeParse(owner).success || !this.guard.isCurrent(owner))
      throw new StudyError('auth-required');
  }
  private serialized<T>(owner: OwnerContext, work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      this.check(owner);
      return work();
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
  prepare(
    owner: OwnerContext,
    scope: StudyScope,
    shuffleQuestions: boolean,
    source: CatalogSource = 'server',
  ): Promise<PreparedReviewer> {
    return this.serialized(owner, async () => {
      const existing = await this.study.active(owner);
      this.check(owner);
      if (existing) return { kind: 'existing', session: existing };
      return { kind: 'ready', session: await this.create(owner, scope, shuffleQuestions, source) };
    });
  }
  replace(
    owner: OwnerContext,
    scope: StudyScope,
    shuffleQuestions: boolean,
    source: CatalogSource = 'server',
  ): Promise<ReviewerSession> {
    const key = JSON.stringify([owner, scope, shuffleQuestions, source]);
    const pending = this.replacements.get(key);
    if (pending) return pending;
    const next = this.serialized(owner, () => this.create(owner, scope, shuffleQuestions, source));
    this.replacements.set(key, next);
    void next.finally(() => this.replacements.delete(key)).catch(() => undefined);
    return next;
  }
  async resume(owner: OwnerContext, id: string): Promise<ReviewerSession> {
    this.check(owner);
    const session = await this.study.session(owner, id);
    this.check(owner);
    if (!session || session.status === 'archived') throw new StudyError('invalid-content');
    return session;
  }
  private async create(
    owner: OwnerContext,
    scope: StudyScope,
    shuffleQuestions: boolean,
    source: CatalogSource,
  ): Promise<ReviewerSession> {
    const parsedScope = StudyScopeSchema.safeParse(scope);
    if (
      !parsedScope.success ||
      typeof shuffleQuestions !== 'boolean' ||
      (source !== 'server' && source !== 'cached')
    )
      throw new StudyError('invalid-content');
    const raw = await (source === 'cached'
      ? this.content.cachedCatalog(owner)
      : this.content.catalog(owner));
    this.check(owner);
    const parsed = CatalogSnapshotSchema.safeParse(raw);
    if (!parsed.success) throw new StudyError('invalid-content');
    const now = this.clock.now();
    if (!SafeIntegerSchema.safeParse(now).success) throw new StudyError('invalid-content');
    const entries = [...eligibleEntries(parsed.data.entries, parsedScope.data, now)];
    if (!entries.length) throw new StudyError('empty-scope');
    if (shuffleQuestions)
      for (let i = entries.length - 1; i > 0; i--) {
        const value = this.random.next();
        if (!Number.isFinite(value) || value < 0 || value >= 1)
          throw new StudyError('invalid-content');
        const j = Math.floor(value * (i + 1));
        [entries[i], entries[j]] = [entries[j]!, entries[i]!];
      }
    const first = entries[0]!;
    const question = await this.content.question(owner, first);
    this.check(owner);
    validateRevision(question, first);
    const session = ReviewerSessionSchema.safeParse({
      id: this.identity.nextId(),
      uid: owner.uid,
      deviceId: owner.deviceId,
      scope: parsedScope.data,
      generation: parsed.data.generation,
      catalogValidatedAt: parsed.data.validatedAt,
      createdAt: now,
      shuffleQuestions,
      items: entries.map((entry, ordinal) => ({ entry, ordinal })),
      position: 0,
      viewedOrdinals: [],
      sequence: 0,
      status: 'active',
    });
    if (!session.success) throw new StudyError('invalid-content');
    this.check(owner);
    await this.study.replaceActive(owner, session.data);
    this.check(owner);
    return session.data;
  }
}
