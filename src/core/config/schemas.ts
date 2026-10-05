import { z } from 'zod';
import type { CategoryId } from '../../features/content/domain/taxonomy';
import { AppError } from '../errors/AppError';

const text = (max: number) => z.string().max(max);
const nonemptyText = (max: number) => text(max).refine((value) => value.trim().length > 0);
const httpsOrEmpty = z.union([
  z.literal(''),
  z.url().refine((value) => new URL(value).protocol === 'https:'),
]);
const version = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  )
  .max(100);
const timestamp = z.iso.datetime({ offset: true });
const entry = z.object({
  id: nonemptyText(300),
  title: nonemptyText(300),
  body: nonemptyText(10000),
});
const announcement = entry
  .extend({ publishedAt: timestamp.optional(), expiresAt: timestamp.optional() })
  .refine(
    (value) =>
      !value.expiresAt ||
      (!!value.publishedAt && Date.parse(value.expiresAt) > Date.parse(value.publishedAt)),
  );
const uniqueArray = <T extends z.ZodType<{ id: string }>>(schema: T) =>
  z
    .array(schema)
    .max(100)
    .refine((values) => new Set(values.map((value) => value.id)).size === values.length);
const count = z.number().int().positive().max(1000);
const distributionShape = {
  generalInformation: count,
  communicationSkills: count,
  quantitativeReasoning: count,
  criticalThinking: count,
} satisfies Record<CategoryId, typeof count>;

export const schemas = {
  app_info: z.object({
    appName: nonemptyText(300),
    latestVersion: version,
    minimumSupportedVersion: version,
    maintenanceMode: z.boolean(),
    maintenanceMessage: text(10000),
    supportEmail: z.union([z.literal(''), z.email().max(300)]),
    privacyPolicyUrl: httpsOrEmpty,
    termsUrl: httpsOrEmpty,
  }),
  data: z.object({
    announcements: uniqueArray(announcement),
    studyTips: uniqueArray(entry),
    faq: uniqueArray(
      z.object({ id: nonemptyText(300), question: nonemptyText(300), answer: nonemptyText(10000) }),
    ),
    reviewerInstructions: uniqueArray(entry),
    examInformation: uniqueArray(entry),
  }),
  config: z.object({
    mockExam: z
      .object({
        durationMinutes: z.number().int().positive().max(1440),
        questionCount: count,
        passingPercentage: z.number().min(0).max(100),
        shuffleQuestions: z.boolean(),
        shuffleAnswers: z.boolean(),
        distribution: z.strictObject(distributionShape),
      })
      .refine(
        (exam) =>
          Object.values(exam.distribution).reduce((a, b) => a + b, 0) === exam.questionCount,
      ),
    reviewer: z.object({ shuffleQuestions: z.boolean() }),
    features: z.object({ bookmarks: z.boolean(), progress: z.boolean(), examHistory: z.boolean() }),
  }),
};

export type ConfigKey = keyof typeof schemas;
export type ConfigModels = { [K in ConfigKey]: z.infer<(typeof schemas)[K]> };
export type Announcement = z.infer<typeof announcement>;

// Count UTF-8 bytes without Node Buffer or a platform TextEncoder dependency.
export function isBoundedPayload(raw: string, maximumBytes = 256 * 1024): boolean {
  let bytes = 0;
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes > maximumBytes) return false;
  }
  return true;
}

export function parseParameter<K extends ConfigKey>(key: K, raw: string): ConfigModels[K] {
  try {
    if (!isBoundedPayload(raw)) throw new AppError('invalid-config');
    const input: unknown = JSON.parse(raw);
    const result = schemas[key].safeParse(input);
    if (!result.success) throw new AppError('invalid-config');
    return result.data as ConfigModels[K];
  } catch {
    throw new AppError('invalid-config');
  }
}

export function isAnnouncementVisible(value: Announcement, now: Date): boolean {
  return (
    (!value.publishedAt || Date.parse(value.publishedAt) <= now.getTime()) &&
    (!value.expiresAt || now.getTime() < Date.parse(value.expiresAt))
  );
}
