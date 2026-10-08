import type { Clock } from '../../../core/clock/Clock';
import type { StudyRepository } from '../domain/StudyRepository';
import type { StudySyncRemote } from '../domain/StudySyncRemote';
import {
  BookmarkConflictError,
  OwnerContextSchema,
  ReviewerSessionSchema,
  StudyError,
  type OwnerContext,
  type OwnerGuard,
  type StudyErrorCode,
  type StudyOperation,
} from '../domain/study';

export type StudySyncStatus = Readonly<{
  pendingCount: number;
  syncing: boolean;
  recovery: StudyErrorCode | null;
}>;
function recordKey(operation: StudyOperation) {
  return `${operation.kind === 'bookmarkState' ? 'bookmark' : 'session'}:${operation.recordId}`;
}

/** Device-scoped backup only. Local SQLite remains the session continuation source. */
export class StudySyncWorker {
  private owner: OwnerContext | null = null;
  private generation = 0;
  private requested = false;
  private explicitRequested = false;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;
  private status: StudySyncStatus = { pendingCount: 0, syncing: false, recovery: null };
  private readonly listeners = new Set<(status: StudySyncStatus) => void>();
  constructor(
    private readonly repository: StudyRepository,
    private readonly remote: StudySyncRemote,
    private readonly clock: Clock,
    private readonly guard: OwnerGuard,
  ) {}
  start(owner: OwnerContext): void {
    this.stop();
    this.owner = OwnerContextSchema.parse(owner);
    this.paused = false;
    this.requested = true;
    this.scheduleFlush();
  }
  wake(): void {
    if (!this.owner) return;
    this.clearTimer();
    this.paused = false;
    this.requested = true;
    this.explicitRequested = true;
    this.scheduleFlush();
  }
  stop(): void {
    this.generation++;
    this.owner = null;
    this.requested = false;
    this.explicitRequested = false;
    this.paused = false;
    this.clearTimer();
    this.emit({ pendingCount: 0, syncing: false, recovery: null });
  }
  subscribe(listener: (status: StudySyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(status: StudySyncStatus) {
    this.status = Object.freeze({ ...status });
    for (const listener of this.listeners) listener(this.status);
  }
  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private scheduleFlush() {
    void Promise.resolve().then(() => this.flush());
  }
  private check(owner: OwnerContext, generation: number) {
    if (this.generation !== generation || !this.owner || !this.guard.isCurrent(owner))
      throw new StudyError('auth-required');
  }
  /** Due-only drain. Call wake first for an immediate foreground/manual attempt. */
  flush(): Promise<void> {
    if (this.running) return this.running;
    if (!this.owner || this.paused) return Promise.resolve();
    this.requested = true;
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async drain() {
    while (this.requested && this.owner) {
      if (this.paused && !this.explicitRequested) break;
      this.paused = false;
      this.requested = false;
      const explicit = this.explicitRequested;
      this.explicitRequested = false;
      const owner = this.owner,
        generation = this.generation;
      let recovery: StudyErrorCode | null = null;
      this.clearTimer();
      this.emit({ ...this.status, syncing: true, recovery: null });
      try {
        this.check(owner, generation);
        try {
          const downloaded = await this.remote.listBookmarks(owner);
          this.check(owner, generation);
          for (const bookmark of downloaded) {
            this.check(owner, generation);
            await this.repository.mergeRemoteBookmark(owner, bookmark);
            this.check(owner, generation);
          }
        } catch (error) {
          this.check(owner, generation);
          if (!(error instanceof StudyError) || error.code !== 'network') throw error;
          recovery = 'network';
        }
        const blocked = new Set<string>();
        let rebases = 0;
        for (;;) {
          this.check(owner, generation);
          const pending = await this.repository.pending(
            owner,
            explicit ? Number.MAX_SAFE_INTEGER : this.clock.now(),
          );
          this.check(owner, generation);
          const operation = pending.find((candidate) => !blocked.has(recordKey(candidate)));
          if (!operation) break;
          try {
            const revision = await this.upload(owner, generation, operation);
            this.check(owner, generation);
            await this.repository.acknowledge(owner, operation.id, revision);
            this.check(owner, generation);
          } catch (error) {
            this.check(owner, generation);
            if (error instanceof BookmarkConflictError && operation.kind === 'bookmarkState') {
              if (
                error.remote.uid !== owner.uid ||
                error.remote.questionId !== operation.recordId ||
                error.remote.serverRevision <= operation.baseRevision
              )
                throw new StudyError('invalid-content');
              if (rebases < 3) {
                this.check(owner, generation);
                await this.repository.rebaseBookmark(
                  owner,
                  operation.id,
                  error.remote.serverRevision,
                );
                this.check(owner, generation);
                rebases++;
              }
              if (rebases >= 3) {
                blocked.add(recordKey(operation));
                recovery = 'conflict';
              }
              continue;
            }
            const mapped = error instanceof StudyError ? error : new StudyError('network');
            recovery = mapped.code;
            if (mapped.code === 'permission-denied' || mapped.code === 'auth-required') {
              this.paused = true;
              break;
            }
            blocked.add(recordKey(operation));
            if (mapped.code === 'network') {
              this.check(owner, generation);
              const delay = Math.min(60000, 1000 * 2 ** Math.min(operation.attempts, 6));
              await this.repository.retry(owner, operation.id, this.clock.now() + delay);
              this.check(owner, generation);
            }
          }
        }
      } catch (error) {
        if (this.generation !== generation || !this.owner) continue;
        recovery = error instanceof StudyError ? error.code : 'network';
        if (recovery === 'auth-required' || recovery === 'permission-denied') this.paused = true;
      }
      if (this.generation !== generation || !this.owner) continue;
      try {
        this.check(owner, generation);
        const all = await this.repository.pending(owner, Number.MAX_SAFE_INTEGER);
        this.check(owner, generation);
        this.emit({ pendingCount: all.length, syncing: false, recovery });
        if (!this.paused) {
          const records = new Set<string>();
          const earliest = all
            .filter((operation) => {
              const key = recordKey(operation);
              if (records.has(key)) return false;
              records.add(key);
              return true;
            })
            .filter((operation) => operation.nextAttemptAt > this.clock.now())
            .reduce((next, operation) => Math.min(next, operation.nextAttemptAt), Infinity);
          if (Number.isFinite(earliest)) {
            this.timer = setTimeout(
              () => {
                this.timer = null;
                if (
                  this.generation === generation &&
                  this.owner &&
                  this.guard.isCurrent(owner) &&
                  !this.paused
                ) {
                  this.requested = true;
                  this.scheduleFlush();
                }
              },
              Math.min(60000, Math.max(1, earliest - this.clock.now())),
            );
          }
        }
      } catch (error) {
        if (this.generation === generation && this.owner)
          this.emit({
            ...this.status,
            syncing: false,
            recovery: error instanceof StudyError ? error.code : 'storage-unavailable',
          });
      }
    }
  }
  private async upload(
    owner: OwnerContext,
    generation: number,
    operation: StudyOperation,
  ): Promise<number | undefined> {
    this.check(owner, generation);
    switch (operation.kind) {
      case 'publishSession':
        this.check(owner, generation);
        await this.remote.publishSession(owner, operation.session, operation.id);
        return undefined;
      case 'sessionState': {
        const saved = await this.repository.session(owner, operation.recordId);
        this.check(owner, generation);
        if (!saved) throw new StudyError('storage-corrupt');
        const session = ReviewerSessionSchema.parse({ ...saved, ...operation.state });
        this.check(owner, generation);
        await this.remote.writeSessionState(owner, session, operation.id);
        return undefined;
      }
      case 'bookmarkState': {
        this.check(owner, generation);
        const acknowledgement = await this.remote.writeBookmark(
          owner,
          operation.bookmark,
          operation.id,
          operation.baseRevision,
        );
        this.check(owner, generation);
        if (
          acknowledgement.appliedOperationId !== operation.id ||
          !Number.isSafeInteger(acknowledgement.revision) ||
          acknowledgement.revision <= operation.baseRevision
        )
          throw new StudyError('invalid-content');
        return acknowledgement.revision;
      }
    }
  }
}
