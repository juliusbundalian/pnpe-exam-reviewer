import type { ExamRepository } from '../domain/ExamRepository';
import type { ExamRemote } from '../domain/ExamRemote';
import {
  OwnerContextSchema,
  StudyError,
  type OwnerContext,
  type OwnerGuard,
} from '../../study/domain/study';

type Outbox = Pick<ExamRepository, 'pending' | 'acknowledge'>;
export type ExamSyncStatus = Readonly<{
  syncing: boolean;
  pendingCount: number;
  recovery: 'network' | 'permission-denied' | 'invalid-content' | null;
}>;

export class ExamSyncWorker {
  private generation = 0;
  private running: Promise<void> | null = null;
  private requested = false;
  private statusValue: ExamSyncStatus = { syncing: false, pendingCount: 0, recovery: null };
  private listeners = new Set<(status: ExamSyncStatus) => void>();

  constructor(
    private readonly repository: Outbox,
    private readonly remote: ExamRemote,
    private readonly guard: OwnerGuard,
  ) {}
  status(): ExamSyncStatus {
    return this.statusValue;
  }
  subscribe(listener: (status: ExamSyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.statusValue);
    return () => this.listeners.delete(listener);
  }
  private emit(value: ExamSyncStatus): void {
    this.statusValue = Object.freeze(value);
    for (const listener of this.listeners) listener(this.statusValue);
  }
  stop(): void {
    this.generation += 1;
    this.requested = false;
    this.emit({ syncing: false, pendingCount: 0, recovery: null });
  }
  flush(owner: OwnerContext): Promise<void> {
    if (!OwnerContextSchema.safeParse(owner).success || !this.guard.isCurrent(owner))
      return Promise.reject(new StudyError('auth-required'));
    this.requested = true;
    if (this.running) return this.running;
    const generation = this.generation;
    this.running = this.drain(owner, generation).finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private check(owner: OwnerContext, generation: number): void {
    if (this.generation !== generation || !this.guard.isCurrent(owner))
      throw new StudyError('auth-required');
  }
  private async drain(owner: OwnerContext, generation: number): Promise<void> {
    while (this.requested) {
      this.requested = false;
      this.check(owner, generation);
      const pending = await this.repository.pending(owner);
      this.check(owner, generation);
      this.emit({ syncing: true, pendingCount: pending.length, recovery: null });
      for (const result of pending) {
        try {
          this.check(owner, generation);
          await this.remote.publish(owner, result);
          this.check(owner, generation);
          await this.repository.acknowledge(owner, result.attemptId);
          this.check(owner, generation);
        } catch (error) {
          this.check(owner, generation);
          if (error instanceof StudyError && error.code === 'network') {
            this.emit({ syncing: false, pendingCount: pending.length, recovery: 'network' });
            return;
          }
          this.emit({
            syncing: false,
            pendingCount: pending.length,
            recovery:
              error instanceof StudyError && error.code === 'permission-denied'
                ? 'permission-denied'
                : 'invalid-content',
          });
          throw error;
        }
      }
      this.emit({ syncing: false, pendingCount: 0, recovery: null });
    }
  }
}
