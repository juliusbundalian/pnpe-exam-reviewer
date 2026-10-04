import type { Question } from '../../src/features/content/domain/question';
export interface CatalogEntry {
  readonly id: string;
  readonly version: number;
  readonly categoryId: Question['categoryId'];
  readonly subcategoryId: Question['subcategoryId'];
  readonly status: Question['status'];
  readonly isCurrentEvent: boolean;
  readonly publishedAt?: string;
  readonly asOfDate?: string;
  readonly expiresAt?: string;
  readonly supportedKinds: readonly string[];
  readonly stimulus?: { readonly id: string; readonly version: number };
  readonly assets: readonly {
    readonly id: string;
    readonly version: number;
    readonly uri: string;
  }[];
}
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
