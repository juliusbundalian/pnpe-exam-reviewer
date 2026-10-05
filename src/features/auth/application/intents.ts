import { z } from 'zod';
import { isTaxonomyPair, taxonomy } from '../../content/domain/taxonomy';

export const INTENT_LIFETIME_MS = 30 * 60 * 1000;
const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const categoryId = z.enum(taxonomy.map((category) => category.id));
const subcategoryId = z.string().min(1).max(128);
const validPair = (value: {
  categoryId?: string | undefined;
  subcategoryId?: string | undefined;
}) =>
  value.subcategoryId === undefined ||
  (value.categoryId !== undefined && isTaxonomyPair(value.categoryId, value.subcategoryId));

export const protectedActionSchema = z.discriminatedUnion('type', [
  z
    .strictObject({
      type: z.literal('startReviewer'),
      categoryId,
      subcategoryId: subcategoryId.optional(),
    })
    .refine(validPair),
  z.strictObject({ type: z.literal('startMockExam') }),
  z.strictObject({ type: z.literal('openProgress') }),
  z.strictObject({ type: z.literal('openBookmarks') }),
  z.strictObject({ type: z.literal('openHistory') }),
  z.strictObject({ type: z.literal('openProfile') }),
  z.strictObject({
    type: z.literal('openAttempt'),
    attemptId: identifier,
    requiredOwnerUid: z
      .string()
      .min(1)
      .max(128)
      .refine((uid) => uid.trim() === uid),
  }),
  z.strictObject({ type: z.literal('setBookmark'), questionId: identifier, saved: z.boolean() }),
]);

export const safeOriginSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('home') }),
  z.strictObject({ type: z.literal('mockOverview') }),
  z.strictObject({ type: z.literal('menu') }),
  z.strictObject({ type: z.literal('appearance') }),
  z.strictObject({ type: z.literal('about') }),
  z.strictObject({ type: z.literal('privacyPolicy') }),
  z.strictObject({ type: z.literal('terms') }),
  z
    .strictObject({
      type: z.literal('reviewerOverview'),
      categoryId: categoryId.optional(),
      subcategoryId: subcategoryId.optional(),
    })
    .refine(validPair),
]);

export const pendingIntentSchema = z
  .strictObject({
    id: identifier,
    action: protectedActionSchema,
    origin: safeOriginSchema,
    createdAtMs: z.number().int().nonnegative().safe(),
    expiresAtMs: z.number().int().nonnegative().safe(),
  })
  .refine((intent) => intent.expiresAtMs - intent.createdAtMs === INTENT_LIFETIME_MS);
export const intentCacheSchema = z.strictObject({
  version: z.literal(1),
  intent: pendingIntentSchema,
});

export type ProtectedAction = z.infer<typeof protectedActionSchema>;
export type SafeOrigin = z.infer<typeof safeOriginSchema>;
export type PendingIntent = z.infer<typeof pendingIntentSchema>;

export function requiresOwner(
  action: ProtectedAction,
): action is Extract<ProtectedAction, { type: 'openAttempt' }> {
  return action.type === 'openAttempt';
}
