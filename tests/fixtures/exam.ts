import {
  CatalogSnapshotSchema,
  type CatalogSnapshot,
} from '../../src/features/content/domain/catalog';
import { taxonomy, type CategoryId } from '../../src/features/content/domain/taxonomy';
import { studyEntry } from './study';

const counts: Record<CategoryId, number> = {
  generalInformation: 134,
  communicationSkills: 276,
  quantitativeReasoning: 41,
  criticalThinking: 78,
};

export function examCatalog(): CatalogSnapshot {
  const entries = taxonomy.flatMap((category) => {
    const subcategories = category.subcategories.filter((item) => item.id !== 'currentEvents');
    return Array.from({ length: counts[category.id] }, (_, index) =>
      studyEntry({
        id: `${category.id}-${index}`,
        categoryId: category.id,
        subcategoryId: subcategories[index % subcategories.length].id,
        stimulus:
          category.id === 'communicationSkills' && index < 2
            ? { id: 'shared-passage', version: 1 }
            : undefined,
      }),
    );
  });
  return CatalogSnapshotSchema.parse({
    generation: 'a'.repeat(64),
    revision: 2,
    validatedAt: 100,
    entries,
  });
}
