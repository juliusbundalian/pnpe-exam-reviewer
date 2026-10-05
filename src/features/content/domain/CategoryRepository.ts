import type { CategoryId, SubcategoryId } from './taxonomy';
/** Informational metadata only; never authorizes session eligibility. */
export type Availability =
  { status: 'known'; eligibleCount: number; asOf: string } | { status: 'unknown' };
export type CategoryOverview = {
  categoryId: CategoryId;
  availability: Availability;
  subcategories: readonly { subcategoryId: SubcategoryId; availability: Availability }[];
};
export interface CategoryRepository {
  list(): Promise<readonly CategoryOverview[]>;
}
