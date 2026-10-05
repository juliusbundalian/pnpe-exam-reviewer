import type { Question } from '../../src/features/content/domain/question';

export type EvaluationClock = () => Date;
export const productionClock: EvaluationClock = () => new Date();
export function eligibilityIssues(question: Question, now: Date): string[] {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid eligibility clock');
  const issues: string[] = [];
  if (question.status !== 'active') issues.push('PUBLICATION_INACTIVE');
  if (question.expiresAt && Date.parse(question.expiresAt) <= now.getTime())
    issues.push('PUBLICATION_EXPIRED');
  return issues;
}
