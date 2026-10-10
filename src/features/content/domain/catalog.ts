import { z } from 'zod';
import { jsonBytes, MAX_CONTENT_BYTES } from '../../../core/content/Fingerprint';
import { ContentBlockSchema } from './content';
import { QuestionSchema } from './question';
import { isTaxonomyPair } from './taxonomy';
import { StimulusRefSchema } from './stimulus';

/** Published question IDs retain their existing ASCII/1500-byte contract. */
export const SafeIdSchema = z
  .string()
  .min(1)
  .max(1500)
  .regex(/^[A-Za-z0-9_-]+$/)
  .refine((id) => !/^__.*__$/.test(id), 'Reserved document ID');
export const SafeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const VersionSchema = SafeIntegerSchema.min(1);
export const GenerationSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const QuestionRefSchema = z
  .strictObject({ id: SafeIdSchema, version: VersionSchema })
  .readonly();
export type QuestionRef = z.infer<typeof QuestionRefSchema>;

const AssetRefSchema = z
  .strictObject({
    ...QuestionRefSchema.unwrap().shape,
    uri: ContentBlockSchema.unwrap().options[2].shape.uri.pipe(z.string().max(MAX_CONTENT_BYTES)),
  })
  .readonly();
export const CatalogEntrySchema = z
  .strictObject({
    ...QuestionRefSchema.unwrap().shape,
    categoryId: QuestionSchema.unwrap().shape.categoryId,
    subcategoryId: QuestionSchema.unwrap().shape.subcategoryId,
    status: QuestionSchema.unwrap().shape.status,
    isCurrentEvent: z.boolean(),
    publishedAt: z.iso.datetime({ offset: true }).optional(),
    asOfDate: z.iso.date().optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
    supportedKinds: z
      .array(z.enum(['text', 'math', 'image', 'diagram', 'table']))
      .min(1)
      .max(5)
      .refine((kinds) => new Set(kinds).size === kinds.length, 'Duplicate content kind')
      .readonly(),
    stimulus: StimulusRefSchema.optional(),
    assets: z.array(AssetRefSchema).readonly(),
  })
  .superRefine((entry, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (!isTaxonomyPair(entry.categoryId, entry.subcategoryId)) issue('Invalid taxonomy pair');
    if (entry.subcategoryId === 'currentEvents' && !entry.isCurrentEvent)
      issue('Current-event safeguards required');
    if (entry.isCurrentEvent && (!entry.publishedAt || !entry.asOfDate || !entry.expiresAt))
      issue('Current-event dates required');
    if (
      entry.publishedAt &&
      entry.expiresAt &&
      Date.parse(entry.expiresAt) <= Date.parse(entry.publishedAt)
    )
      issue('Expiry must follow publication');
    const hasAssets = entry.supportedKinds.some((kind) => kind === 'image' || kind === 'diagram');
    if (hasAssets !== entry.assets.length > 0)
      issue('Asset references must agree with required kinds');
    const keys = entry.assets.map((asset) => `${asset.id}@${asset.version}`);
    if (new Set(keys).size !== keys.length) issue('Duplicate asset identity');
    if (jsonBytes(entry) > MAX_CONTENT_BYTES) issue('Catalog entry exceeds payload limit');
  })
  .readonly();
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export const CatalogShardSchema = z
  .array(CatalogEntrySchema)
  .min(1)
  .max(200)
  .refine(
    (entries) => new Set(entries.map((entry) => entry.id)).size === entries.length,
    'Duplicate logical ID',
  )
  .refine(
    (entries) => jsonBytes({ entries }) <= MAX_CONTENT_BYTES,
    'Catalog shard exceeds payload limit',
  )
  .readonly();

export const CatalogSnapshotSchema = z
  .strictObject({
    generation: GenerationSchema,
    revision: SafeIntegerSchema,
    validatedAt: SafeIntegerSchema,
    entries: z
      .array(CatalogEntrySchema)
      .refine(
        (entries) => new Set(entries.map((entry) => entry.id)).size === entries.length,
        'Duplicate logical ID',
      )
      .readonly(),
  })
  .readonly();
export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;
