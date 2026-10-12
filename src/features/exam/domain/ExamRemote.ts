import type { OwnerContext } from '../../study/domain/study';
import type { ExamResult, ExamResultSummary } from './exam';

export interface ExamRemote {
  publish(owner: OwnerContext, result: ExamResult): Promise<void>;
  history(owner: OwnerContext): Promise<readonly ExamResultSummary[]>;
  result(owner: OwnerContext, attemptId: string): Promise<ExamResult>;
}
