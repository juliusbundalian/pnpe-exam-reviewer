import { z } from 'zod';
import { jsonBytes } from '../../../core/content/Fingerprint';
import { SafeIntegerSchema } from '../../content/domain/catalog';
import { GeneratedIdSchema } from '../../study/domain/study';
import { ExamQuestionSchema, ExamResultSchema } from '../domain/exam';

export const MAX_EXAM_DOCUMENT_BYTES = 900 * 1024;
export const CloudExamSummarySchema = ExamResultSchema.unwrap()
  .omit({ questions: true, syncState: true })
  .readonly();
export type CloudExamSummary = z.infer<typeof CloudExamSummarySchema>;

const bounded = <T extends z.ZodType>(schema: T) =>
  schema.refine((value) => jsonBytes(value) <= MAX_EXAM_DOCUMENT_BYTES, 'Exam document too large');

export const CloudExamRootSchema = bounded(
  z
    .strictObject({
      uid: GeneratedIdSchema,
      deviceId: GeneratedIdSchema,
      attemptId: GeneratedIdSchema,
      itemCount: SafeIntegerSchema.min(1).max(1000),
      phase: z.enum(['preparing', 'ready']),
      summary: CloudExamSummarySchema,
      writtenAt: SafeIntegerSchema,
    })
    .superRefine((root, ctx) => {
      if (
        root.summary.uid !== root.uid ||
        root.summary.deviceId !== root.deviceId ||
        root.summary.attemptId !== root.attemptId ||
        root.summary.config.questionCount !== root.itemCount ||
        root.summary.overall.total !== root.itemCount
      ) {
        ctx.addIssue({ code: 'custom', message: 'Root identity and count mismatch' });
      }
    }),
).readonly();
export type CloudExamRoot = z.infer<typeof CloudExamRootSchema>;

export const CloudExamItemSchema = bounded(
  z.strictObject({
    uid: GeneratedIdSchema,
    deviceId: GeneratedIdSchema,
    attemptId: GeneratedIdSchema,
    ordinal: SafeIntegerSchema,
    item: ExamQuestionSchema,
    writtenAt: SafeIntegerSchema,
  }),
).readonly();
export type CloudExamItem = z.infer<typeof CloudExamItemSchema>;
