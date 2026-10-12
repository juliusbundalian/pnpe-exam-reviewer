import { examProgress, mergeExamHistory } from '../../src/features/exam/application/examProgress';
import { examResult } from '../fixtures/exam';

test('no completed exams reports unavailable statistics', () => {
  expect(examProgress([])).toEqual({
    completed: 0,
    averagePercentage: null,
    highestPercentage: null,
  });
});

test('local and cloud retries count once and percentages are averaged per attempt', () => {
  const first = examResult();
  const second = {
    ...first,
    attemptId: 'second-attempt',
    overall: { ...first.overall, total: 50, correct: 40, unanswered: 10, percentage: 80 },
  };
  const merged = mergeExamHistory([first, second], [first, second]);
  expect(merged).toHaveLength(2);
  expect(examProgress(merged)).toEqual({
    completed: 2,
    averagePercentage: 40,
    highestPercentage: 80,
  });
});
