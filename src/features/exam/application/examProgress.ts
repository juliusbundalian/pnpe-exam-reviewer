import type { ExamResultSummary } from '../domain/exam';

/** Local rows win because they remain readable when cloud synchronization is pending. */
export function mergeExamHistory(
  local: readonly ExamResultSummary[],
  remote: readonly ExamResultSummary[],
): readonly ExamResultSummary[] {
  const unique = new Map<string, ExamResultSummary>();
  for (const result of remote) unique.set(result.attemptId, result);
  for (const result of local) unique.set(result.attemptId, result);
  return [...unique.values()].sort((a, b) => b.endedAt - a.endedAt);
}

export function examProgress(results: readonly ExamResultSummary[]): {
  completed: number;
  averagePercentage: number | null;
  highestPercentage: number | null;
} {
  const unique = new Map(results.map((result) => [result.attemptId, result]));
  const percentages = [...unique.values()]
    .map((result) => result.overall.percentage)
    .filter((percentage): percentage is number => percentage !== null);
  return {
    completed: unique.size,
    averagePercentage: percentages.length
      ? percentages.reduce((total, percentage) => total + percentage, 0) / percentages.length
      : null,
    highestPercentage: percentages.length ? Math.max(...percentages) : null,
  };
}
