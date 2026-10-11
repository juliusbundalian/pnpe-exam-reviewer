import { defaults } from '../../src/core/config/defaults';
import type { CatalogEntry } from '../../src/features/content/domain/catalog';
import { selectExamEntries } from '../../src/features/exam/domain/selection';
import { examCatalog } from '../fixtures/exam';

const now = 1_000;
const zero = { next: () => 0 };

function countByCategory(entries: readonly CatalogEntry[]) {
  return entries.reduce(
    (counts, entry) => {
      counts[entry.categoryId] += 1;
      return counts;
    },
    {
      generalInformation: 0,
      communicationSkills: 0,
      quantitativeReasoning: 0,
      criticalThinking: 0,
    },
  );
}

test('selects 150 unique eligible questions with exact default quotas', () => {
  const selected = selectExamEntries(examCatalog(), defaults.config.mockExam, now, zero);
  expect(selected).toHaveLength(150);
  expect(new Set(selected.map((entry) => entry.id)).size).toBe(150);
  expect(countByCategory(selected)).toEqual({
    generalInformation: 35,
    communicationSkills: 40,
    quantitativeReasoning: 25,
    criticalThinking: 50,
  });
});

test('selects_shared_stimulus_without_neighbor', () => {
  const catalog = examCatalog();
  const selected = selectExamEntries(
    catalog,
    {
      ...defaults.config.mockExam,
      questionCount: 4,
      shuffleQuestions: false,
      distribution: {
        generalInformation: 1,
        communicationSkills: 1,
        quantitativeReasoning: 1,
        criticalThinking: 1,
      },
    },
    now,
    zero,
  );
  const shared = selected.filter((entry) => entry.stimulus?.id === 'shared-passage');
  expect(shared).toHaveLength(1);
  expect(shared[0]?.stimulus).toEqual({ id: 'shared-passage', version: 1 });
  expect(catalog.entries.filter((entry) => entry.stimulus?.id === 'shared-passage')).toHaveLength(
    2,
  );
});

test('rejects a category shortage without shrinking the quota', () => {
  const catalog = examCatalog();
  const entries = catalog.entries.filter((entry) => entry.categoryId !== 'quantitativeReasoning');
  expect(() =>
    selectExamEntries({ ...catalog, entries }, defaults.config.mockExam, now, zero),
  ).toThrow(expect.objectContaining({ code: 'empty-scope' }));
});

test('rejects a quota sum that differs from question count', () => {
  const config = { ...defaults.config.mockExam, questionCount: 149 };
  expect(() => selectExamEntries(examCatalog(), config, now, zero)).toThrow(
    expect.objectContaining({ code: 'invalid-content' }),
  );
});

test.each([NaN, Infinity, -0.1, 1])('rejects invalid random draw %s', (draw) => {
  expect(() =>
    selectExamEntries(examCatalog(), defaults.config.mockExam, now, { next: () => draw }),
  ).toThrow(expect.objectContaining({ code: 'invalid-content' }));
});

test('shuffles using the largest valid draw below one', () => {
  const selected = selectExamEntries(examCatalog(), defaults.config.mockExam, now, {
    next: () => 1 - Number.EPSILON,
  });
  expect(selected).toHaveLength(150);
});

test('allocates across uneven subcategories and keeps stable order when shuffle is disabled', () => {
  const original = examCatalog();
  const catalog = {
    ...original,
    entries: original.entries.map((entry) =>
      entry.categoryId !== 'generalInformation' || entry.id === 'generalInformation-0'
        ? entry
        : {
            ...entry,
            subcategoryId:
              Number(entry.id.split('-')[1]) % 2 === 0 ? 'pnpHistory' : 'criminalJusticeSystem',
          },
    ),
  };
  const config = {
    ...defaults.config.mockExam,
    questionCount: 9,
    shuffleQuestions: false,
    distribution: {
      generalInformation: 6,
      communicationSkills: 1,
      quantitativeReasoning: 1,
      criticalThinking: 1,
    },
  };
  const selected = selectExamEntries(catalog, config, now, zero);
  expect(selected.slice(0, 6).map((entry) => entry.subcategoryId)).toEqual([
    'constitutionAndLaws',
    'pnpHistory',
    'criminalJusticeSystem',
    'pnpHistory',
    'criminalJusticeSystem',
    'pnpHistory',
  ]);
  expect(selectExamEntries(catalog, config, now, zero)).toEqual(selected);
  expect(selected[0]).not.toBe(catalog.entries[0]);
});
