import { schemas, type ConfigModels } from '../../../core/config/schemas';
import type { RandomSource } from '../../../core/random/RandomSource';
import {
  CatalogSnapshotSchema,
  SafeIntegerSchema,
  type CatalogEntry,
  type CatalogSnapshot,
} from '../../content/domain/catalog';
import { eligibleEntries } from '../../content/domain/eligibility';
import { taxonomy } from '../../content/domain/taxonomy';
import { StudyError } from '../../study/domain/study';

export type ExamConfig = ConfigModels['config']['mockExam'];

function shuffle<T>(items: T[], random: RandomSource): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const draw = random.next();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
      throw new StudyError('invalid-content');
    }
    const other = Math.floor(draw * (index + 1));
    const value = items[index]!;
    items[index] = items[other]!;
    items[other] = value;
  }
}

export function selectExamEntries(
  catalog: CatalogSnapshot,
  config: ExamConfig,
  now: number,
  random: RandomSource,
): readonly CatalogEntry[] {
  const parsedCatalog = CatalogSnapshotSchema.safeParse(catalog);
  const parsedConfig = schemas.config.shape.mockExam.safeParse(config);
  if (
    !parsedCatalog.success ||
    !parsedConfig.success ||
    !SafeIntegerSchema.safeParse(now).success
  ) {
    throw new StudyError('invalid-content');
  }

  const selected: CatalogEntry[] = [];
  for (const category of taxonomy) {
    const quota = parsedConfig.data.distribution[category.id];
    const eligible = eligibleEntries(parsedCatalog.data.entries, { categoryId: category.id }, now);
    if (eligible.length < quota) throw new StudyError('empty-scope');

    const buckets = category.subcategories
      .map((subcategory) => eligible.filter((entry) => entry.subcategoryId === subcategory.id))
      .filter((bucket) => bucket.length > 0)
      .map((bucket) => [...bucket]);
    if (parsedConfig.data.shuffleQuestions) {
      for (const bucket of buckets) shuffle(bucket, random);
    }
    const categorySelected: CatalogEntry[] = [];
    while (categorySelected.length < quota) {
      let progressed = false;
      for (const bucket of buckets) {
        if (categorySelected.length === quota) break;
        const entry = bucket.shift();
        if (entry) {
          categorySelected.push(entry);
          progressed = true;
        }
      }
      if (!progressed) throw new StudyError('empty-scope');
    }
    if (parsedConfig.data.shuffleQuestions) shuffle(categorySelected, random);
    selected.push(...categorySelected);
  }
  if (parsedConfig.data.shuffleQuestions) shuffle(selected, random);
  return selected;
}
