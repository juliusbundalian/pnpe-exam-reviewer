import type { OwnerContext } from '../../study/domain/study';
import type { ExamAttempt, ExamChange, ExamResult } from './exam';

export interface ExamRepository {
  active(owner: OwnerContext): Promise<ExamAttempt | null>;
  create(
    owner: OwnerContext,
    candidate: ExamAttempt,
    beforeCommit?: () => void,
  ): Promise<ExamAttempt>;
  attempt(owner: OwnerContext, id: string): Promise<ExamAttempt | null>;
  change(
    owner: OwnerContext,
    id: string,
    change: ExamChange,
    now: number,
    effectiveNowAtCommit: () => number,
  ): Promise<ExamAttempt>;
  observeTime(owner: OwnerContext, id: string, now: number): Promise<ExamAttempt>;
  finalize(
    owner: OwnerContext,
    id: string,
    now: number,
    reason: 'manual' | 'timeExpired',
  ): Promise<ExamResult>;
  result(owner: OwnerContext, id: string): Promise<ExamResult | null>;
  history(owner: OwnerContext): Promise<readonly ExamResult[]>;
  pending(owner: OwnerContext): Promise<readonly ExamResult[]>;
  acknowledge(owner: OwnerContext, id: string): Promise<void>;
}
