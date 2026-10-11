import { z } from 'zod';
import { schemas } from '../../../core/config/schemas';
import {
  CatalogEntrySchema,
  GenerationSchema,
  SafeIntegerSchema,
} from '../../content/domain/catalog';
import { QuestionSchema } from '../../content/domain/question';
import { taxonomy } from '../../content/domain/taxonomy';
import { GeneratedIdSchema, OwnerContextSchema, StudyError } from '../../study/domain/study';

const choiceId = z.string().trim().min(1);
const examConfig = schemas.config.shape.mockExam;

export const ExamQuestionSchema = z
  .strictObject({
    entry: CatalogEntrySchema,
    question: QuestionSchema,
    choiceOrder: z.array(choiceId).min(2).readonly(),
    selectedChoiceId: choiceId.nullable(),
    flagged: z.boolean(),
  })
  .superRefine((item, ctx) => {
    const ids = item.question.choices.map((choice) => choice.id);
    if (
      item.entry.id !== item.question.id ||
      item.entry.version !== item.question.version ||
      item.entry.categoryId !== item.question.categoryId ||
      item.entry.subcategoryId !== item.question.subcategoryId
    ) {
      ctx.addIssue({ code: 'custom', message: 'Question does not match its catalog entry' });
    }
    if (
      item.entry.stimulus?.id !== item.question.stimulus?.id ||
      item.entry.stimulus?.version !== item.question.stimulus?.version
    ) {
      ctx.addIssue({ code: 'custom', message: 'Question is missing its frozen stimulus' });
    }
    if (
      item.choiceOrder.length !== ids.length ||
      new Set(item.choiceOrder).size !== ids.length ||
      item.choiceOrder.some((id) => !ids.includes(id))
    ) {
      ctx.addIssue({ code: 'custom', message: 'Choice order must be a complete permutation' });
    }
    if (item.selectedChoiceId !== null && !ids.includes(item.selectedChoiceId)) {
      ctx.addIssue({ code: 'custom', message: 'Selected choice is unknown' });
    }
  })
  .readonly();
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;

export const ExamAttemptSchema = z
  .strictObject({
    id: GeneratedIdSchema,
    uid: OwnerContextSchema.unwrap().shape.uid,
    deviceId: GeneratedIdSchema,
    generation: GenerationSchema,
    config: examConfig,
    startedAt: SafeIntegerSchema,
    deadlineAt: SafeIntegerSchema,
    lastEffectiveAt: SafeIntegerSchema,
    position: SafeIntegerSchema,
    questions: z.array(ExamQuestionSchema).min(1).readonly(),
    status: z.enum(['active', 'completed']),
  })
  .superRefine((attempt, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (attempt.deadlineAt !== attempt.startedAt + attempt.config.durationMinutes * 60_000) {
      issue('Deadline does not match frozen duration');
    }
    if (attempt.lastEffectiveAt < attempt.startedAt) issue('Observed time predates start');
    if (attempt.position >= attempt.questions.length) issue('Position outside exam');
    if (attempt.questions.length !== attempt.config.questionCount) issue('Incomplete exam');
    if (new Set(attempt.questions.map((item) => item.entry.id)).size !== attempt.questions.length) {
      issue('Duplicate question ID');
    }
    for (const category of taxonomy) {
      if (
        attempt.questions.filter((item) => item.entry.categoryId === category.id).length !==
        attempt.config.distribution[category.id]
      ) {
        issue(`Wrong quota for ${category.id}`);
      }
    }
  })
  .readonly();
export type ExamAttempt = z.infer<typeof ExamAttemptSchema>;

export const ExamChangeSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('answer'),
    ordinal: SafeIntegerSchema,
    choiceId: choiceId.nullable(),
  }),
  z.strictObject({ type: z.literal('flag'), ordinal: SafeIntegerSchema, flagged: z.boolean() }),
  z.strictObject({ type: z.literal('move'), ordinal: SafeIntegerSchema }),
]);
export type ExamChange = z.infer<typeof ExamChangeSchema>;

const ScoreSchema = z
  .strictObject({
    total: SafeIntegerSchema,
    correct: SafeIntegerSchema,
    incorrect: SafeIntegerSchema,
    unanswered: SafeIntegerSchema,
    percentage: z.number().min(0).max(100).nullable(),
    passed: z.boolean().nullable(),
  })
  .readonly();
export const ExamBreakdownSchema = z
  .strictObject({ ...ScoreSchema.unwrap().shape, id: z.string().min(1) })
  .readonly();
export type ExamBreakdown = z.infer<typeof ExamBreakdownSchema>;

export const ExamResultSchema = z
  .strictObject({
    attemptId: GeneratedIdSchema,
    uid: OwnerContextSchema.unwrap().shape.uid,
    deviceId: GeneratedIdSchema,
    generation: GenerationSchema,
    config: examConfig,
    startedAt: SafeIntegerSchema,
    deadlineAt: SafeIntegerSchema,
    endedAt: SafeIntegerSchema,
    durationUsedMs: SafeIntegerSchema,
    reason: z.enum(['manual', 'timeExpired']),
    overall: ScoreSchema,
    categories: z.array(ExamBreakdownSchema).readonly(),
    subcategories: z.array(ExamBreakdownSchema).readonly(),
    questions: z.array(ExamQuestionSchema).readonly(),
    syncState: z.enum(['pending', 'synced', 'failed']),
  })
  .readonly();
export type ExamResult = z.infer<typeof ExamResultSchema>;
export type ExamResultSummary = Omit<ExamResult, 'questions'>;

function checkedTime(value: number): number {
  if (!SafeIntegerSchema.safeParse(value).success) throw new StudyError('invalid-content');
  return value;
}

export function effectiveExamNow(
  attempt: ExamAttempt,
  wallNow: number,
  monotonicElapsedMs: number,
): number {
  checkedTime(wallNow);
  checkedTime(monotonicElapsedMs);
  const monotonicNow = checkedTime(attempt.lastEffectiveAt + monotonicElapsedMs);
  return Math.max(attempt.lastEffectiveAt, wallNow, monotonicNow);
}

function scoreGroup(items: readonly ExamQuestion[], threshold: number) {
  const total = items.length;
  const correct = items.filter(
    (item) => item.selectedChoiceId === item.question.correctChoiceId,
  ).length;
  const unanswered = items.filter((item) => item.selectedChoiceId === null).length;
  const incorrect = total - correct - unanswered;
  return {
    total,
    correct,
    incorrect,
    unanswered,
    percentage: total === 0 ? null : (correct * 100) / total,
    passed: total === 0 ? null : correct * 100 >= threshold * total,
  };
}

export function scoreExam(
  attempt: ExamAttempt,
  reason: 'manual' | 'timeExpired',
  endAt: number,
): ExamResult {
  const saved = ExamAttemptSchema.safeParse(attempt);
  if (!saved.success || endAt < attempt.startedAt) throw new StudyError('invalid-content');
  checkedTime(endAt);
  const effectiveReason = endAt >= attempt.deadlineAt ? 'timeExpired' : reason;
  const endedAt = effectiveReason === 'timeExpired' ? attempt.deadlineAt : endAt;
  const threshold = saved.data.config.passingPercentage;
  const result = {
    attemptId: saved.data.id,
    uid: saved.data.uid,
    deviceId: saved.data.deviceId,
    generation: saved.data.generation,
    config: saved.data.config,
    startedAt: saved.data.startedAt,
    deadlineAt: saved.data.deadlineAt,
    endedAt,
    durationUsedMs: Math.min(
      saved.data.config.durationMinutes * 60_000,
      Math.max(0, endedAt - saved.data.startedAt),
    ),
    reason: effectiveReason,
    overall: scoreGroup(saved.data.questions, threshold),
    categories: taxonomy.map((category) => ({
      id: category.id,
      ...scoreGroup(
        saved.data.questions.filter((item) => item.entry.categoryId === category.id),
        threshold,
      ),
    })),
    subcategories: taxonomy.flatMap((category) =>
      category.subcategories.map((subcategory) => ({
        id: subcategory.id,
        ...scoreGroup(
          saved.data.questions.filter((item) => item.entry.subcategoryId === subcategory.id),
          threshold,
        ),
      })),
    ),
    questions: saved.data.questions,
    syncState: 'pending' as const,
  };
  return ExamResultSchema.parse(result);
}
