import {
  FirebaseCategoryRepository,
  createCategorySdk,
} from '../../src/features/content/data/FirebaseCategoryRepository';

const asOf = '2026-10-05T00:00:00.000Z';
const clock = () => Date.parse('2026-10-05T01:00:00.000Z');
const known = { status: 'known', eligibleCount: 12, asOf };
const record = {
  categoryId: 'generalInformation',
  availability: known,
  subcategories: [{ subcategoryId: 'pnpHistory', availability: known }],
};
const repository = (data: readonly unknown[]) =>
  new FirebaseCategoryRepository({ listCategories: async () => data }, { clock });

test('missing and unavailable remote categories retain bundled structure with unknown availability', async () => {
  for (const repo of [
    repository([]),
    new FirebaseCategoryRepository(
      {
        listCategories: async () => {
          throw new Error('offline');
        },
      },
      { clock },
    ),
  ]) {
    const result = await repo.list();
    expect(result.map((item) => item.categoryId)).toEqual([
      'generalInformation',
      'communicationSkills',
      'quantitativeReasoning',
      'criticalThinking',
    ]);
    expect(result.map((item) => item.subcategories.length)).toEqual([5, 3, 3, 4]);
    expect(
      result.every(
        (item) =>
          item.availability.status === 'unknown' &&
          item.subcategories.every((child) => child.availability.status === 'unknown'),
      ),
    ).toBe(true);
  }
});
test('valid metadata supplies counts while absent subcategories stay unknown', async () => {
  const result = await repository([record]).list();
  expect(result[0]?.availability).toEqual(known);
  expect(result[0]?.subcategories[1]?.availability).toEqual(known);
  expect(result[0]?.subcategories[0]?.availability).toEqual({ status: 'unknown' });
});
test.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '12', NaN, Infinity])(
  'malformed count %p is unknown',
  async (count) => {
    const result = await repository([
      { ...record, availability: { ...known, eligibleCount: count } },
    ]).list();
    expect(result[0]?.availability).toEqual({ status: 'unknown' });
  },
);
test.each(['bad-date', '2026-10-01T00:00:00.000Z', '2026-10-06T00:00:00.000Z'])(
  'invalid expired or future timestamp %s is unknown',
  async (timestamp) => {
    const result = await repository([
      { ...record, availability: { ...known, asOf: timestamp } },
    ]).list();
    expect(result[0]?.availability).toEqual({ status: 'unknown' });
  },
);
test('unknown and incomplete metadata never invent zero', async () => {
  for (const availability of [{ status: 'unknown' }, {}, { status: 'known', eligibleCount: 0 }])
    expect((await repository([{ ...record, availability }]).list())[0]?.availability).toEqual({
      status: 'unknown',
    });
});
test('mismatched and duplicate IDs fall back safely', async () => {
  for (const data of [
    [{ ...record, categoryId: 'made-up' }],
    [record, record],
    [{ ...record, subcategories: [{ subcategoryId: 'grammar', availability: known }] }],
    [{ ...record, subcategories: [record.subcategories[0], record.subcategories[0]] }],
  ]) {
    const result = await repository(data).list();
    expect(result[0]?.availability).toEqual({ status: 'unknown' });
    expect(result[0]?.subcategories.every((item) => item.availability.status === 'unknown')).toBe(
      true,
    );
  }
});
test('injected maximum age and zero count are validated', async () => {
  const result = await new FirebaseCategoryRepository(
    { listCategories: async () => [{ ...record, availability: { ...known, eligibleCount: 0 } }] },
    { clock, metadataMaxAgeMs: 3600000 },
  ).list();
  expect(result[0]?.availability).toEqual({ ...known, eligibleCount: 0 });
});
test('category read facade validates document ID and reads only public metadata', async () => {
  const paths: string[] = [];
  const sdk = createCategorySdk({
    collection: (path) => {
      paths.push(path);
      return path;
    },
    getDocs: async () => ({ docs: [{ id: 'communicationSkills', data: () => record }] }),
  });
  const result = await new FirebaseCategoryRepository(sdk, { clock }).list();
  expect(result[0]?.availability).toEqual({ status: 'unknown' });
  expect(paths).toEqual(['categories']);
});
test('category read facade supplies valid remote metadata to browsing', async () => {
  const sdk = createCategorySdk({
    collection: (path) => path,
    getDocs: async () => ({ docs: [{ id: 'generalInformation', data: () => record }] }),
  });
  expect((await new FirebaseCategoryRepository(sdk, { clock }).list())[0]?.availability).toEqual(
    known,
  );
});
