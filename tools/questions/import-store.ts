import type { Question } from '../../src/features/content/domain/question';
import { z } from 'zod';
import { QuestionSchema } from '../../src/features/content/domain/question';
import { ContentBlockSchema } from '../../src/features/content/domain/content';
import { isTaxonomyPair } from '../../src/features/content/domain/taxonomy';
const reference = z
  .strictObject({ id: z.string().trim().min(1), version: z.number().int().positive() })
  .readonly();
export const CatalogEntrySchema = z
  .strictObject({
    id: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .refine((id) => Buffer.byteLength(id) <= 1500 && !/^__.*__$/.test(id)),
    version: z.number().int().positive(),
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
      .refine((kinds) => new Set(kinds).size === kinds.length)
      .readonly(),
    stimulus: reference.optional(),
    assets: z
      .array(
        z
          .strictObject({
            ...reference.unwrap().shape,
            uri: ContentBlockSchema.unwrap().options[2].shape.uri,
          })
          .readonly(),
      )
      .readonly(),
  })
  .refine((entry) => isTaxonomyPair(entry.categoryId, entry.subcategoryId), 'Invalid taxonomy pair')
  .readonly();
export const CatalogShardSchema = z.array(CatalogEntrySchema).min(1).max(200).readonly();
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;
export interface ImportHead {
  readonly generation: string | null;
  readonly revision: number;
}
/** Adapter paths: questions/{id}/versions/{version}, questionCatalogs/{generation}/shards/{id}, questionCatalogs/current.
 * Creates/shards must be immutable and idempotent; absent shard reads return [].
 * publishHead must atomically compare the revision and increment it exactly once.
 * Store target must be independently checked by the CLI against manifest.projectId.
 */
export interface ImportStore {
  readRevision(id: string, version: number): Promise<Question | null>;
  readHead(): Promise<ImportHead>;
  createRevision(question: Question): Promise<void>;
  writeShard(generation: string, id: string, entries: readonly CatalogEntry[]): Promise<void>;
  readShard(generation: string, id: string): Promise<readonly CatalogEntry[]>;
  publishHead(expectedRevision: number, generation: string): Promise<void>;
}
