import type { OwnerContext } from '../../study/domain/study';
import type { CatalogEntry, CatalogSnapshot, QuestionRef } from './catalog';
import type { Question } from './question';

export interface ContentRepository {
  /** Explicit recovery choice; never contacts the remote or accepts partial catalogs. */
  cachedCatalog(owner: OwnerContext): Promise<CatalogSnapshot>;
  catalog(owner: OwnerContext): Promise<CatalogSnapshot>;
  question(owner: OwnerContext, entry: CatalogEntry): Promise<Question>;
}

/** Content-only cache. Adapter reads validate fingerprints and immutable identity. */
export interface ContentCache {
  catalog(): Promise<CatalogSnapshot | null>;
  saveCatalog(snapshot: CatalogSnapshot): Promise<void>;
  question(ref: QuestionRef): Promise<Question | null>;
  saveQuestion(entry: CatalogEntry, question: Question): Promise<void>;
}
