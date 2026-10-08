import { z } from 'zod';
import { jsonBytes } from '../../../core/content/Fingerprint';
import { SafeIntegerSchema, SafeIdSchema, GenerationSchema } from '../../content/domain/catalog';
import {
  BookmarkSchema,
  GeneratedIdSchema,
  ManifestItemSchema,
  SessionStatusSchema,
  StudyScopeSchema,
} from '../domain/study';

export const MAX_STUDY_DOCUMENT_BYTES = 64 * 1024;
export const MAX_MANIFEST_CHUNK_ITEMS = 100;
// DTO times are milliseconds. Native transport maps local times to Timestamp,
// and replaces writtenAt with serverTimestamp on every newly written document.
const identity = {
  uid: GeneratedIdSchema,
  deviceId: GeneratedIdSchema,
  sessionId: GeneratedIdSchema,
};
// Reserve the largest decoded transport time, so serverTimestamp resolution
// cannot push a document that fitted before upload beyond the canonical bound.
const bounded = <T extends z.ZodType>(schema: T) =>
  schema.refine(
    (value) =>
      jsonBytes({ ...(value as object), writtenAt: Number.MAX_SAFE_INTEGER }) <=
      MAX_STUDY_DOCUMENT_BYTES,
    'Study document exceeds byte limit',
  );
export const CloudSessionRootSchema = bounded(
  z
    .strictObject({
      ...identity,
      scope: StudyScopeSchema,
      generation: GenerationSchema,
      catalogValidatedAt: SafeIntegerSchema.nullable(),
      createdAt: SafeIntegerSchema,
      shuffleQuestions: z.boolean(),
      manifestChunkCount: SafeIntegerSchema.min(1),
      itemCount: SafeIntegerSchema.min(1),
      publicationOperationId: GeneratedIdSchema,
      lastOperationId: GeneratedIdSchema,
      phase: z.enum(['preparing', 'ready']),
      ready: z.boolean(),
      sequence: SafeIntegerSchema,
      position: SafeIntegerSchema,
      viewedCount: SafeIntegerSchema,
      status: SessionStatusSchema,
      writtenAt: SafeIntegerSchema,
    })
    .superRefine((root, ctx) => {
      if (
        root.phase === 'preparing' &&
        (root.sequence !== 0 ||
          root.position !== 0 ||
          root.viewedCount !== 0 ||
          root.status !== 'active' ||
          root.lastOperationId !== root.publicationOperationId)
      )
        ctx.addIssue({ code: 'custom', message: 'Preparing sessions must have initial state' });
      if (
        root.ready !== (root.phase === 'ready') ||
        root.position >= root.itemCount ||
        root.viewedCount > root.itemCount ||
        root.manifestChunkCount > root.itemCount
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid session bounds/phase' });
      if (
        (root.status === 'completed' && root.viewedCount !== root.itemCount) ||
        (root.status === 'active' && root.viewedCount === root.itemCount)
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid completion state' });
    }),
).readonly();
export type CloudSessionRoot = z.infer<typeof CloudSessionRootSchema>;
export const CloudManifestChunkSchema = bounded(
  z
    .strictObject({
      ...identity,
      index: SafeIntegerSchema,
      items: z.array(ManifestItemSchema).min(1).max(MAX_MANIFEST_CHUNK_ITEMS).readonly(),
      writtenAt: SafeIntegerSchema,
    })
    .refine(
      (chunk) =>
        chunk.items.every(
          (item, index) => index === 0 || item.ordinal === chunk.items[index - 1]!.ordinal + 1,
        ),
      'Noncontiguous chunk',
    ),
).readonly();
export type CloudManifestChunk = z.infer<typeof CloudManifestChunkSchema>;
export const CloudViewedItemSchema = bounded(
  z.strictObject({
    ...identity,
    ...ManifestItemSchema.unwrap().shape,
    viewed: z.literal(true),
    writtenAt: SafeIntegerSchema,
  }),
).readonly();
export const CloudBookmarkSchema = bounded(
  z
    .strictObject({
      ...BookmarkSchema.unwrap().shape,
      lastOperationId: GeneratedIdSchema,
      writtenAt: SafeIntegerSchema,
    })
    .refine(
      (bookmark) =>
        bookmark.questionId === bookmark.entry.id && bookmark.updatedAt >= bookmark.createdAt,
      'Invalid bookmark identity/time',
    ),
).readonly();
export const CloudBookmarkReceiptSchema = bounded(
  z.strictObject({
    uid: GeneratedIdSchema,
    questionId: SafeIdSchema,
    operationId: GeneratedIdSchema,
    revision: SafeIntegerSchema.min(1),
    writtenAt: SafeIntegerSchema,
  }),
).readonly();
