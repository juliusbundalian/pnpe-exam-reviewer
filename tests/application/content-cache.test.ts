import { nodeSqlDatabase, nodeFingerprint } from '../fixtures/nodeSqlDatabase';
import { migrateStudyDatabase } from '../../src/core/storage/sqlite/studyMigrations';
import { SqliteContentCache } from '../../src/features/content/data/SqliteContentCache';
import { SqliteStudyRepository } from '../../src/features/study/data/SqliteStudyRepository';
import { generation, owner, studyEntry, studyQuestion, studySession } from '../fixtures/study';
import type { SqlDatabase } from '../../src/core/storage/sqlite/SqlDatabase';
let db: SqlDatabase, cache: SqliteContentCache;
const snapshot = () => ({ generation, revision: 2, validatedAt: 100, entries: [studyEntry()] });
beforeEach(async () => {
  db = nodeSqlDatabase(':memory:');
  await migrateStudyDatabase(db);
  cache = new SqliteContentCache(db, nodeFingerprint);
});
afterEach(async () => {
  await db.close();
});
test('complete catalog and immutable revision roundtrip', async () => {
  expect(await cache.catalog()).toBeNull();
  expect(await cache.question(studyEntry())).toBeNull();
  await cache.saveCatalog(snapshot());
  await cache.saveQuestion(studyEntry(), studyQuestion());
  expect(await cache.catalog()).toEqual(snapshot());
  expect(await cache.question(studyEntry())).toEqual(studyQuestion());
});
test('incomplete or malformed catalog never replaces the usable generation', async () => {
  await cache.saveCatalog(snapshot());
  await expect(
    cache.saveCatalog({ ...snapshot(), entries: [studyEntry(), studyEntry()] }),
  ).rejects.toMatchObject({ code: 'invalid-content' });
  await db.run('DELETE FROM catalog_items');
  await expect(cache.catalog()).rejects.toMatchObject({ code: 'storage-corrupt' });
});
test('immutable catalog and revision conflicts retain original data', async () => {
  await cache.saveCatalog(snapshot());
  await cache.saveQuestion(studyEntry(), studyQuestion());
  await expect(
    cache.saveCatalog({ ...snapshot(), entries: [studyEntry({ version: 2 })] }),
  ).rejects.toMatchObject({ code: 'conflict' });
  await expect(
    cache.saveQuestion(studyEntry(), studyQuestion({ correctChoiceId: 'c1' })),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect((await cache.question(studyEntry()))?.correctChoiceId).toBe('c2');
});
test.each(['payload_json', 'fingerprint'])(
  'cached question %s corruption is reported',
  async (column) => {
    await cache.saveQuestion(studyEntry(), studyQuestion());
    await db.run(`UPDATE question_revisions SET ${column} = ?`, ['broken']);
    await expect(cache.question(studyEntry())).rejects.toMatchObject({ code: 'storage-corrupt' });
  },
);
test('eviction preserves current/completed sessions, bookmarks and pending publication revisions', async () => {
  let id = 0;
  const repo = new SqliteStudyRepository(
    db,
    { now: () => 100 },
    { nextId: () => `op-${++id}` },
    { isCurrent: () => true },
  );
  for (const name of ['fixture-grammar', 'fixture-second', 'pinned', 'unused'])
    await cache.saveQuestion(studyEntry({ id: name }), studyQuestion({ id: name }));
  await cache.saveCatalog(snapshot());
  await repo.replaceActive(owner, studySession());
  await repo.setBookmark(owner, studyEntry({ id: 'pinned' }), false);
  await cache.evictUnreferenced();
  expect(await cache.question(studyEntry({ id: 'unused' }))).toBeNull();
  expect(await cache.question(studyEntry())).not.toBeNull();
  expect(await cache.question(studyEntry({ id: 'pinned' }))).not.toBeNull();
  await repo.replaceActive(
    owner,
    studySession({
      id: 'replacement',
      items: [{ ordinal: 0, entry: studyEntry({ id: 'pinned' }) }],
    }),
  );
  await cache.evictUnreferenced();
  expect(await cache.question(studyEntry({ id: 'fixture-second' }))).not.toBeNull();
  expect(await repo.pending(owner, 100)).toHaveLength(4);
});
test('a failed catalog item insertion rolls back the entire new generation', async () => {
  await cache.saveCatalog(snapshot());
  await db.run(
    "CREATE TRIGGER fail_catalog BEFORE INSERT ON catalog_items WHEN NEW.ordinal = 1 BEGIN SELECT RAISE(ABORT, 'incomplete'); END",
  );
  await expect(
    cache.saveCatalog({
      generation: 'b'.repeat(64),
      revision: 3,
      validatedAt: 200,
      entries: [studyEntry(), studyEntry({ id: 'second' })],
    }),
  ).rejects.toMatchObject({ code: 'storage-unavailable' });
  expect(await cache.catalog()).toEqual(snapshot());
  expect(await db.all('SELECT count(*) AS count FROM catalogs')).toEqual([{ count: 1 }]);
});
test('valid-looking catalog payload tampering is detected by its fingerprint', async () => {
  await cache.saveCatalog(snapshot());
  await db.run('UPDATE catalog_items SET entry_json = ?', [
    JSON.stringify(studyEntry({ version: 2 })),
  ]);
  await expect(cache.catalog()).rejects.toMatchObject({ code: 'storage-corrupt' });
});
test('pending archived session state retains cached revisions after publication acknowledgement', async () => {
  let id = 0;
  const repo = new SqliteStudyRepository(
    db,
    { now: () => 100 },
    { nextId: () => `op-${++id}` },
    { isCurrent: () => true },
  );
  await cache.saveQuestion(studyEntry(), studyQuestion());
  await repo.replaceActive(owner, studySession());
  await repo.acknowledge(owner, (await repo.pending(owner, 100))[0]!.id);
  await repo.recordView(owner, studySession().id, 0);
  await repo.recordView(owner, studySession().id, 1);
  await cache.evictUnreferenced();
  expect(await cache.question(studyEntry())).not.toBeNull();
  await repo.replaceActive(
    owner,
    studySession({ id: 'next', items: [{ ordinal: 0, entry: studyEntry({ id: 'other' }) }] }),
  );
  await cache.evictUnreferenced();
  expect(await cache.question(studyEntry())).not.toBeNull();
});
test('a republished immutable generation accepts newer head revision and validation time', async () => {
  await cache.saveCatalog(snapshot());
  await cache.saveCatalog({ ...snapshot(), revision: 4, validatedAt: 300 });
  await cache.saveCatalog({ ...snapshot(), revision: 2, validatedAt: 100 });
  expect(await cache.catalog()).toMatchObject({ revision: 4, validatedAt: 300 });
});
test('shared stimulus identity rejects different blocks across question revisions atomically', async () => {
  await cache.saveQuestion(studyEntry(), studyQuestion());
  const second = studyQuestion({
    id: 'second',
    stimulus: {
      id: 'fixture-passage',
      version: 1,
      blocks: [{ kind: 'text', text: 'Conflicting passage.', marks: [] }],
    },
  });
  await expect(cache.saveQuestion(studyEntry({ id: 'second' }), second)).rejects.toMatchObject({
    code: 'conflict',
  });
  expect(await cache.question({ id: 'second', version: 1 })).toBeNull();
  expect(await cache.question(studyEntry())).toEqual(studyQuestion());
  await cache.saveQuestion(studyEntry({ id: 'second' }), studyQuestion({ id: 'second' }));
  expect(await cache.question({ id: 'second', version: 1 })).not.toBeNull();
});
