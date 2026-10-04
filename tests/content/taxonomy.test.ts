import { taxonomy, isTaxonomyPair } from '../../src/features/content/domain/taxonomy';

test('fifteen subcategories, without historical-trivia aliases', () => {
  expect(taxonomy).toHaveLength(4);
  expect(
    taxonomy.flatMap<(typeof taxonomy)[number]['subcategories'][number]>(
      (category) => category.subcategories,
    ),
  ).toHaveLength(15);
  expect(isTaxonomyPair('communicationSkills', 'grammar')).toBe(true);
  expect(isTaxonomyPair('generalInformation', 'grammar')).toBe(false);
  expect(isTaxonomyPair('generalInformation', 'philippineHistory')).toBe(false);
});
