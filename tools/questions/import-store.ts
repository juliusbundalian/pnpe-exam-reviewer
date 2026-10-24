import type { Question } from '../../src/features/content/domain/question';
import type { CatalogEntry } from '../../src/features/content/domain/catalog';
export { CatalogEntrySchema, CatalogShardSchema } from '../../src/features/content/domain/catalog';
export type { CatalogEntry } from '../../src/features/content/domain/catalog';
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
