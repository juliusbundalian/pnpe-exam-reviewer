import { defaults } from '../../src/core/config/defaults';
import { selectExamEntries } from '../../src/features/exam/domain/selection';
import {
  ExamAttemptSchema,
  effectiveExamNow,
  scoreExam,
  type ExamAttempt,
} from '../../src/features/exam/domain/exam';
import { testQuestion } from '../fixtures/content/question';
import { examCatalog } from '../fixtures/exam';

const start = 100_000;
const deadline = start + 180 * 60_000;

function attemptWith(outcomes: {
  correct: number;
  incorrect: number;
  unanswered: number;
}): ExamAttempt {
  if (outcomes.correct + outcomes.incorrect + outcomes.unanswered !== 150)
    throw new Error('fixture');
  const entries = selectExamEntries(examCatalog(), defaults.config.mockExam, 1_000, {
    next: () => 0,
  });
  return ExamAttemptSchema.parse({
    id: 'exam-one',
    uid: 'alice',
    deviceId: 'device-one',
    generation: 'a'.repeat(64),
    config: defaults.config.mockExam,
    startedAt: start,
    deadlineAt: deadline,
    lastEffectiveAt: start,
    position: 0,
    status: 'active',
    questions: entries.map((entry, ordinal) => ({
      entry,
      question: testQuestion({
        id: entry.id,
        version: entry.version,
        categoryId: entry.categoryId,
        subcategoryId: entry.subcategoryId,
        stimulus: entry.stimulus
          ? {
              ...entry.stimulus,
              blocks: [{ kind: 'text', text: 'Shared passage', marks: [] }],
            }
          : undefined,
      }),
      choiceOrder: ['c1', 'c2'],
      selectedChoiceId:
        ordinal < outcomes.correct
          ? 'c2'
          : ordinal < outcomes.correct + outcomes.incorrect
            ? 'c1'
            : null,
      flagged: false,
    })),
  });
}

test('scores correct, incorrect and unanswered against all 150 questions without rounding the pass decision', () => {
  const result = scoreExam(
    attemptWith({ correct: 112, incorrect: 1, unanswered: 37 }),
    'manual',
    start + 1_000,
  );
  expect(result.overall).toMatchObject({
    total: 150,
    correct: 112,
    incorrect: 1,
    unanswered: 37,
    passed: false,
  });
  expect(result.overall.percentage).toBeCloseTo(74.6666666667);
  expect(result.questions).toHaveLength(150);
});

test('breakdowns add to the overall total and keep actual category and subcategory IDs', () => {
  const result = scoreExam(
    attemptWith({ correct: 100, incorrect: 25, unanswered: 25 }),
    'manual',
    start,
  );
  expect(result.categories.map((item) => [item.id, item.total])).toEqual([
    ['generalInformation', 35],
    ['communicationSkills', 40],
    ['quantitativeReasoning', 25],
    ['criticalThinking', 50],
  ]);
  expect(result.subcategories.reduce((total, item) => total + item.total, 0)).toBe(150);
  expect(result.categories.reduce((total, item) => total + item.correct, 0)).toBe(100);
});

test('expiry caps the effective end and time used at the original deadline', () => {
  const result = scoreExam(
    attemptWith({ correct: 150, incorrect: 0, unanswered: 0 }),
    'timeExpired',
    deadline + 90_000,
  );
  expect(result.endedAt).toBe(deadline);
  expect(result.durationUsedMs).toBe(180 * 60_000);
  expect(result.reason).toBe('timeExpired');
});

test('wall-clock rollback cannot increase remaining time after an observed time', () => {
  const attempt = {
    ...attemptWith({ correct: 0, incorrect: 0, unanswered: 150 }),
    lastEffectiveAt: start + 60_000,
  };
  expect(effectiveExamNow(attempt, attempt.lastEffectiveAt - 60_000, 0)).toBe(
    attempt.lastEffectiveAt,
  );
  expect(effectiveExamNow(attempt, start, 30_000)).toBe(start + 90_000);
});

test('expiry_wins_open_confirmation', () => {
  const attempt = attemptWith({ correct: 112, incorrect: 1, unanswered: 37 });
  const result = scoreExam(attempt, 'manual', deadline);
  expect(result.reason).toBe('timeExpired');
  expect(result.endedAt).toBe(deadline);
});

test('rejects a saved choice order that omits a choice ID', () => {
  const attempt = attemptWith({ correct: 0, incorrect: 0, unanswered: 150 });
  const questions = [...attempt.questions];
  questions[0] = { ...questions[0]!, choiceOrder: ['c1', 'c1'] };
  expect(ExamAttemptSchema.safeParse({ ...attempt, questions }).success).toBe(false);
});
