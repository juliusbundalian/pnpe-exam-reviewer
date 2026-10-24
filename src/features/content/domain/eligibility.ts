import { CatalogEntrySchema, SafeIntegerSchema, type CatalogEntry } from './catalog';
import { StudyScopeSchema, type StudyScope } from '../../study/domain/study';

/** No item cap: required unsupported content excludes the whole question. */
export function eligibleEntries(
  entries: readonly CatalogEntry[],
  scope: StudyScope,
  now: number,
): readonly CatalogEntry[] {
  const validScope = StudyScopeSchema.parse(scope);
  SafeIntegerSchema.parse(now);
  return entries
    .map((entry) => CatalogEntrySchema.parse(entry))
    .filter(
      (entry) =>
        entry.categoryId === validScope.categoryId &&
        (!validScope.subcategoryId || entry.subcategoryId === validScope.subcategoryId) &&
        entry.status === 'active' &&
        (!entry.expiresAt || Date.parse(entry.expiresAt) > now) &&
        entry.supportedKinds.every((kind) => kind === 'text' || kind === 'math'),
    );
}
