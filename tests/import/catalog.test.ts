import { FirebaseImportStore } from '../../tools/questions/firebase-import-store';
import { CatalogShardSchema } from '../../tools/questions/import-store';

let remote: unknown;
jest.mock('firebase-admin/firestore', () => ({
  Firestore: class {
    doc() {
      return { get: async () => ({ exists: true, get: () => remote }) };
    }
  },
}));
test.each(
  [
    [{ id: 'q' }],
    Array.from({ length: 201 }, () => ({})),
    [{ version: 0, categoryId: 'invented' }],
  ].map((entries) => [entries]),
)('remote malformed catalog elements fail at the adapter boundary (%#)', async (entries) => {
  remote = entries;
  const store = new FirebaseImportStore({
    projectId: 'demo-pnpe',
    mode: 'emulator',
    emulatorHost: 'localhost:8080',
  });
  await expect(store.readShard('0'.repeat(64), 'shard')).rejects.toThrow();
});
test('catalog schemas validate taxonomy, kinds, dates and references independently', () => {
  const entry = {
    id: 'q',
    version: 1,
    categoryId: 'quantitativeReasoning',
    subcategoryId: 'basicConcepts',
    status: 'active',
    isCurrentEvent: false,
    supportedKinds: ['text'],
    assets: [],
  };
  expect(CatalogShardSchema.safeParse([entry]).success).toBe(true);
  for (const change of [
    { categoryId: 'generalInformation' },
    { version: 0 },
    { stimulus: { id: '', version: 1 } },
    { assets: [{ id: 'a', version: 1, uri: 'http://example.com/a' }] },
    { supportedKinds: ['unknown'] },
    { expiresAt: 'unknown' },
  ])
    expect(CatalogShardSchema.safeParse([{ ...entry, ...change }]).success).toBe(false);
});
