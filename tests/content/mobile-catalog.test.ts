import {
  CatalogEntrySchema,
  CatalogShardSchema,
  CatalogSnapshotSchema,
} from '../../src/features/content/domain/catalog';
import { CatalogShardSchema as ToolShard } from '../../tools/questions/import-store';
import { eligibleEntries } from '../../src/features/content/domain/eligibility';
import { studyEntry, generation } from '../fixtures/study';

test('stored DTOs parse through mobile and importer boundaries with unchanged metadata', () => {
  // Raw stored DTOs are independent of the validator under test.
  const stored = [
    {
      id: 'fixture-stored',
      version: 3,
      categoryId: 'communicationSkills',
      subcategoryId: 'readingComprehension',
      status: 'active',
      isCurrentEvent: false,
      supportedKinds: ['math', 'text'],
      stimulus: { id: 'fixture-passage', version: 2 },
      assets: [],
    },
    {
      id: 'fixture-event',
      version: 1,
      categoryId: 'generalInformation',
      subcategoryId: 'currentEvents',
      status: 'active',
      isCurrentEvent: true,
      publishedAt: '2026-10-01T00:00:00Z',
      asOfDate: '2026-10-01',
      expiresAt: '2026-11-01T00:00:00Z',
      supportedKinds: ['text'],
      assets: [],
    },
  ];
  expect(CatalogShardSchema.parse(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  expect(ToolShard.parse(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  expect(
    CatalogSnapshotSchema.parse({ generation, revision: 2, validatedAt: 100, entries: stored })
      .entries,
  ).toHaveLength(2);
});

test.each([
  { id: 'bad/id' },
  { id: '__reserved__' },
  { id: 'a'.repeat(1501) },
  { id: '' },
  { categoryId: 'generalInformation' },
  { version: 0 },
  { version: Number.MAX_SAFE_INTEGER + 1 },
  { supportedKinds: ['text', 'text'] },
  { supportedKinds: ['unknown'] },
  { expiresAt: 'invalid' },
  { extra: true },
  { supportedKinds: ['image'], assets: [] },
  { assets: [{ id: 'asset', version: 1, uri: 'https://example.com/a' }] },
  { categoryId: 'generalInformation', subcategoryId: 'currentEvents' },
  { isCurrentEvent: true },
  {
    isCurrentEvent: true,
    publishedAt: '2026-10-08T00:00:00Z',
    asOfDate: '2026-10-08',
    expiresAt: '2026-10-08T00:00:00Z',
  },
])('both content boundaries reject malformed stored metadata (%#)', (change) => {
  const raw = { ...studyEntry(), ...change };
  expect(CatalogEntrySchema.safeParse(raw).success).toBe(false);
  expect(ToolShard.safeParse([raw]).success).toBe(false);
});

test('shards enforce their transport bounds and reject duplicate identities', () => {
  const entry = studyEntry();
  expect(CatalogShardSchema.safeParse([]).success).toBe(false);
  expect(CatalogShardSchema.safeParse([entry, entry]).success).toBe(false);
  expect(
    CatalogShardSchema.safeParse(
      Array.from({ length: 201 }, (_, index) => ({ ...entry, id: `fixture-${index}` })),
    ).success,
  ).toBe(false);
  // Long but safe published question IDs remain valid; generated IDs use separate bounds.
  expect(CatalogEntrySchema.safeParse({ ...entry, id: 'a'.repeat(1500) }).success).toBe(true);
});

test('eligible catalog selection has no session question cap', () => {
  const entries = Array.from({ length: 276 }, (_, index) => studyEntry({ id: `fixture-${index}` }));
  expect(eligibleEntries(entries, { categoryId: 'communicationSkills' }, 100)).toHaveLength(276);
});

test('complete snapshots reject duplicate logical IDs and malformed head/validation metadata', () => {
  const raw = { generation, revision: 2, validatedAt: 100, entries: [studyEntry()] };
  for (const change of [
    { entries: [studyEntry(), studyEntry({ version: 2 })] },
    { generation: '../bad' },
    { revision: -1 },
    { validatedAt: Infinity },
    { extra: true },
  ]) {
    expect(CatalogSnapshotSchema.safeParse({ ...raw, ...change }).success).toBe(false);
  }
});

test('eligibility includes all supported scoped items while excluding inactive, expired and required unsupported blocks', () => {
  const now = Date.parse('2026-10-08T00:00:00Z');
  const entries = [
    studyEntry(),
    studyEntry({ id: 'expired', expiresAt: '2026-10-08T00:00:00Z' }),
    studyEntry({ id: 'inactive', status: 'inactive' }),
    studyEntry({ id: 'table', supportedKinds: ['text', 'table'] }),
    studyEntry({
      id: 'image',
      supportedKinds: ['text', 'image'],
      assets: [{ id: 'asset', version: 1, uri: 'https://example.com/a' }],
    }),
    studyEntry({
      id: 'diagram',
      supportedKinds: ['diagram'],
      assets: [{ id: 'asset', version: 1, uri: 'https://example.com/a' }],
    }),
    studyEntry({ id: 'vocabulary', subcategoryId: 'vocabulary' }),
    studyEntry({ id: 'math', categoryId: 'quantitativeReasoning', subcategoryId: 'basicConcepts' }),
  ];
  expect(
    eligibleEntries(entries, { categoryId: 'communicationSkills' }, now).map((e) => e.id),
  ).toEqual(['fixture-grammar', 'vocabulary']);
  expect(
    eligibleEntries(
      entries,
      { categoryId: 'communicationSkills', subcategoryId: 'grammar' },
      now,
    ).map((e) => e.id),
  ).toEqual(['fixture-grammar']);
  expect(() => eligibleEntries(entries, { categoryId: 'communicationSkills' }, NaN)).toThrow();
  expect(() =>
    eligibleEntries(entries, { categoryId: 'generalInformation', subcategoryId: 'grammar' }, now),
  ).toThrow();
});

test('current-event catalog dates protect new sessions at the injected expiry boundary', () => {
  const event = studyEntry({
    id: 'event',
    categoryId: 'generalInformation',
    subcategoryId: 'currentEvents',
    isCurrentEvent: true,
    publishedAt: '2026-10-01T00:00:00Z',
    asOfDate: '2026-10-01',
    expiresAt: '2026-10-08T00:00:00Z',
  });
  expect(
    eligibleEntries(
      [event],
      { categoryId: 'generalInformation' },
      Date.parse(event.expiresAt!) - 1,
    ),
  ).toHaveLength(1);
  expect(
    eligibleEntries([event], { categoryId: 'generalInformation' }, Date.parse(event.expiresAt!)),
  ).toEqual([]);
});
