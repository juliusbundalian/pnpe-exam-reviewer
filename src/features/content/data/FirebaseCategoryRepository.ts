import type {
  Availability,
  CategoryOverview,
  CategoryRepository,
} from '../domain/CategoryRepository';
import { taxonomy, isTaxonomyPair } from '../domain/taxonomy';
export interface CategorySdk {
  listCategories(): Promise<readonly unknown[]>;
}
export interface CategoryReadSdk<Reference> {
  collection(path: 'categories'): Reference;
  getDocs(reference: Reference): Promise<{ docs: readonly { id: string; data(): unknown }[] }>;
}
export function createCategorySdk<Reference>(sdk: CategoryReadSdk<Reference>): CategorySdk {
  return {
    listCategories: async () => {
      const snapshot = await sdk.getDocs(sdk.collection('categories'));
      return snapshot.docs.map((document) => {
        const data = document.data();
        return object(data) && data.categoryId === document.id ? data : null;
      });
    },
  };
}
export interface CategoryMetadataPolicy {
  clock?: () => number;
  metadataMaxAgeMs?: number;
}
export const DEFAULT_METADATA_MAX_AGE_MS = 24 * 60 * 60 * 1000;
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function availability(value: unknown, now: number, maxAge: number): Availability {
  if (
    !object(value) ||
    value.status !== 'known' ||
    Object.keys(value).some((key) => !['status', 'eligibleCount', 'asOf'].includes(key)) ||
    typeof value.eligibleCount !== 'number' ||
    !Number.isSafeInteger(value.eligibleCount) ||
    value.eligibleCount < 0 ||
    typeof value.asOf !== 'string'
  )
    return { status: 'unknown' };
  const timestamp = Date.parse(value.asOf);
  if (
    !Number.isFinite(timestamp) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.asOf) ||
    new Date(timestamp).toISOString().replace('.000Z', 'Z') !== value.asOf.replace('.000Z', 'Z') ||
    !Number.isFinite(now) ||
    !Number.isFinite(maxAge) ||
    maxAge < 0 ||
    timestamp > now ||
    now - timestamp > maxAge
  )
    return { status: 'unknown' };
  return { status: 'known', eligibleCount: value.eligibleCount, asOf: value.asOf };
}
export class FirebaseCategoryRepository implements CategoryRepository {
  constructor(
    private readonly sdk: CategorySdk,
    private readonly policy: CategoryMetadataPolicy = {},
  ) {}
  async list(): Promise<readonly CategoryOverview[]> {
    let records: readonly unknown[] = [];
    try {
      records = await this.sdk.listCategories();
    } catch {
      /* Public browsing retains bundled structure offline. */
    }
    const now = (this.policy.clock ?? Date.now)();
    const maxAge = this.policy.metadataMaxAgeMs ?? DEFAULT_METADATA_MAX_AGE_MS;
    return taxonomy.map((category) => {
      const matches = records.filter((value) => object(value) && value.categoryId === category.id);
      const record = matches.length === 1 ? matches[0] : undefined;
      const children =
        object(record) && Array.isArray(record.subcategories)
          ? (record.subcategories as unknown[])
          : [];
      const ids = new Set<string>();
      const valid =
        object(record) &&
        Array.isArray(record.subcategories) &&
        children.every((child) => {
          if (
            !object(child) ||
            typeof child.subcategoryId !== 'string' ||
            !isTaxonomyPair(category.id, child.subcategoryId) ||
            ids.has(child.subcategoryId)
          )
            return false;
          ids.add(child.subcategoryId);
          return true;
        });
      return {
        categoryId: category.id,
        availability: availability(valid ? record.availability : undefined, now, maxAge),
        subcategories: category.subcategories.map((child) => {
          const remote = valid
            ? children.find((value) => object(value) && value.subcategoryId === child.id)
            : undefined;
          return {
            subcategoryId: child.id,
            availability: availability(
              object(remote) ? remote.availability : undefined,
              now,
              maxAge,
            ),
          };
        }),
      };
    });
  }
}
