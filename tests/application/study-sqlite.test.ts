import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeSqlDatabase } from '../fixtures/nodeSqlDatabase';
import { SqliteStudyRepository } from '../../src/features/study/data/SqliteStudyRepository';
import { migrateStudyDatabase } from '../../src/core/storage/sqlite/studyMigrations';
import type { SqlDatabase } from '../../src/core/storage/sqlite/SqlDatabase';
import { owner as alice, studySession, studyEntry, studyBookmark } from '../fixtures/study';
import type { OwnerContext } from '../../src/features/study/domain/study';

const bob = { ...alice, uid: 'bob' };
const clock = { now: () => 200 };
let dir: string, db: SqlDatabase, repository: SqliteStudyRepository, current: OwnerContext;
let identity = 0;
function repo(database: SqlDatabase) {
  return new SqliteStudyRepository(
    database,
    clock,
    { nextId: () => `id-${++identity}` },
    {
      isCurrent: (candidate) =>
        candidate.uid === current.uid &&
        candidate.epoch === current.epoch &&
        candidate.deviceId === current.deviceId,
    },
  );
}
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'study-sql-'));
  current = alice;
  identity = 0;
  db = nodeSqlDatabase(join(dir, 'study.db'));
  await migrateStudyDatabase(db);
  repository = repo(db);
});
afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('committed_view_survives_reopen_before_ack', async () => {
  const saved = studySession();
  await repository.replaceActive(alice, saved);
  await repository.recordView(alice, saved.id, 0);
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  await migrateStudyDatabase(db);
  const reopened = repo(db);
  expect((await reopened.session(alice, saved.id))?.viewedOrdinals).toEqual([0]);
  expect(await reopened.pending(alice, clock.now())).toHaveLength(2);
  await reopened.setBookmark(alice, studyEntry(), false);
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  repository = repo(db);
  expect((await repository.session(alice, saved.id))?.items.map((item) => item.entry.id)).toEqual([
    'fixture-grammar',
    'fixture-second',
  ]);
  expect((await repository.listBookmarks(alice))[0]?.deleted).toBe(false);
});
test('failed_outbox_insert_rolls_back_view', async () => {
  await repository.replaceActive(alice, studySession());
  await db.run(
    "CREATE TRIGGER reject_outbox BEFORE INSERT ON study_outbox BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
  );
  await expect(repository.recordView(alice, studySession().id, 0)).rejects.toMatchObject({
    code: 'storage-unavailable',
  });
  expect((await repository.active(alice))?.viewedOrdinals).toEqual([]);
  expect(await repository.pending(alice, clock.now())).toHaveLength(1);
});
test('repeated view counts once and all viewed completes the current resumable session', async () => {
  await repository.replaceActive(alice, studySession());
  await Promise.all([
    repository.recordView(alice, studySession().id, 0),
    repository.recordView(alice, studySession().id, 0),
  ]);
  expect((await repository.active(alice))?.sequence).toBe(1);
  expect(await repository.pending(alice, clock.now())).toHaveLength(2);
  await repository.move(alice, studySession().id, 1);
  await repository.recordView(alice, studySession().id, 1);
  expect(await repository.active(alice)).toMatchObject({
    status: 'completed',
    position: 1,
    viewedOrdinals: [0, 1],
    sequence: 3,
  });
});
test('replacement archives atomically and repeated creation does not reset saved work', async () => {
  await repository.replaceActive(alice, studySession());
  await repository.recordView(alice, studySession().id, 0);
  await repository.replaceActive(alice, studySession());
  expect((await repository.active(alice))?.viewedOrdinals).toEqual([0]);
  await db.run(
    "CREATE TRIGGER reject_new BEFORE INSERT ON reviewer_items WHEN NEW.session_id = 'new-session' BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
  );
  await expect(
    repository.replaceActive(alice, studySession({ id: 'new-session' })),
  ).rejects.toMatchObject({ code: 'storage-unavailable' });
  expect((await repository.active(alice))?.id).toBe(studySession().id);
  await db.run('DROP TRIGGER reject_new');
  await repository.replaceActive(alice, studySession({ id: 'new-session' }));
  expect((await repository.session(alice, studySession().id))?.status).toBe('archived');
  expect((await repository.active(alice))?.id).toBe('new-session');
  expect((await repository.pending(alice, 200)).map((op) => op.kind)).toEqual([
    'publishSession',
    'sessionState',
    'sessionState',
    'publishSession',
  ]);
});
test('owner and device keys isolate sessions, bookmarks and operations', async () => {
  await repository.replaceActive(alice, studySession());
  await repository.setBookmark(alice, studyEntry(), false);
  current = bob;
  expect(await repository.active(bob)).toBeNull();
  expect(await repository.listBookmarks(bob)).toEqual([]);
  expect(await repository.pending(bob, 200)).toEqual([]);
  await repository.replaceActive(bob, studySession({ uid: bob.uid }));
  current = { ...alice, deviceId: 'other-device' };
  expect(await repository.active(current)).toBeNull();
  expect(await repository.listBookmarks(current)).toEqual([]);
  current = alice;
  expect((await repository.active(alice))?.uid).toBe(alice.uid);
});
test('owner switch before actual commit rolls back state and outbox', async () => {
  await repository.replaceActive(alice, studySession());
  const wrapped: SqlDatabase = {
    ...db,
    exclusive: (work, beforeCommit) =>
      db.exclusive(work, () => {
        current = bob;
        beforeCommit?.();
      }),
  };
  await expect(repo(wrapped).recordView(alice, studySession().id, 0)).rejects.toMatchObject({
    code: 'auth-required',
  });
  current = alice;
  expect((await repository.active(alice))?.viewedOrdinals).toEqual([]);
  expect(await repository.pending(alice, 200)).toHaveLength(1);
});
test('late owner-bound reads are discarded', async () => {
  await repository.replaceActive(alice, studySession());
  const wrapped: SqlDatabase = {
    ...db,
    exclusive: async (work, guard) => {
      const value = await db.exclusive(work, guard);
      current = bob;
      return value;
    },
  };
  await expect(repo(wrapped).active(alice)).rejects.toMatchObject({ code: 'auth-required' });
});
test('bookmark tombstone, earlier acknowledgement and CAS rebase preserve latest desired state on reopen', async () => {
  await repository.setBookmark(alice, studyEntry(), false);
  const first = (await repository.pending(alice, 200))[0]!;
  await repository.setBookmark(alice, studyEntry({ version: 2 }), true);
  await repository.acknowledge(alice, first.id, 4);
  const remaining = (await repository.pending(alice, 200))[0]!;
  expect(remaining).toMatchObject({
    kind: 'bookmarkState',
    baseRevision: 4,
    bookmark: { deleted: true, entry: { version: 2 }, serverRevision: 4 },
  });
  await repository.rebaseBookmark(alice, remaining.id, 7);
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  repository = repo(db);
  expect((await repository.listBookmarks(alice))[0]).toMatchObject({
    deleted: true,
    serverRevision: 7,
    entry: { version: 2 },
  });
  expect((await repository.pending(alice, 200))[0]).toMatchObject({
    baseRevision: 7,
    bookmark: { serverRevision: 7 },
  });
  await repository.mergeRemoteBookmark(alice, studyBookmark({ deleted: false, serverRevision: 8 }));
  expect((await repository.listBookmarks(alice))[0]?.deleted).toBe(true);
  await repository.retry(alice, remaining.id, 500);
  expect(await repository.pending(alice, 200)).toEqual([]);
  expect((await repository.pending(alice, 500))[0]?.attempts).toBe(1);
  await repository.acknowledge(alice, remaining.id, 8);
  expect(await repository.pending(alice, 500)).toEqual([]);
  expect((await repository.listBookmarks(alice))[0]?.deleted).toBe(true);
});
test('device identity is transactionally stable across instances and reopen', async () => {
  expect(await Promise.all([repository.deviceIdentity(), repo(db).deviceIdentity()])).toEqual([
    'id-1',
    'id-1',
  ]);
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  expect(await repo(db).deviceIdentity()).toBe('id-1');
});
test('future schema and failed migration retain user data and report recovery', async () => {
  await db.run('CREATE TABLE user_sentinel (value TEXT)');
  await db.run('INSERT INTO user_sentinel VALUES (?)', ['keep']);
  await db.run('PRAGMA user_version = 99');
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  await expect(migrateStudyDatabase(db)).rejects.toMatchObject({ code: 'storage-corrupt' });
  expect(await db.all('SELECT value FROM user_sentinel')).toEqual([{ value: 'keep' }]);
  await db.run('PRAGMA user_version = 0');
  // Existing migration tables force a real statement error, not an injected callback error.
  await expect(migrateStudyDatabase(db)).rejects.toMatchObject({ code: 'storage-unavailable' });
  expect(await db.all('PRAGMA user_version')).toEqual([{ user_version: 0 }]);
  expect(await db.all('SELECT value FROM user_sentinel')).toEqual([{ value: 'keep' }]);
});
test('stored corrupt JSON and unsafe state never escape as SDK errors', async () => {
  await repository.replaceActive(alice, studySession());
  await db.run('UPDATE reviewer_items SET entry_json = ?', ['{broken']);
  await expect(repository.active(alice)).rejects.toMatchObject({ code: 'storage-corrupt' });
});
test('foreign keys apply to transaction writes', async () => {
  await expect(
    db.exclusive((tx) =>
      tx.run(
        'INSERT INTO reviewer_views (uid, device_id, session_id, ordinal) VALUES (?, ?, ?, ?)',
        [alice.uid, alice.deviceId, 'missing', 0],
      ),
    ),
  ).rejects.toThrow();
});
test('owner switch before acknowledgement commit retains pending operation and bookmark state', async () => {
  await repository.setBookmark(alice, studyEntry(), false);
  const operation = (await repository.pending(alice, 200))[0]!;
  const wrapped: SqlDatabase = {
    ...db,
    exclusive: (work, beforeCommit) =>
      db.exclusive(work, () => {
        current = bob;
        beforeCommit?.();
      }),
  };
  await expect(repo(wrapped).acknowledge(alice, operation.id, 5)).rejects.toMatchObject({
    code: 'auth-required',
  });
  current = alice;
  expect(await repository.pending(alice, 200)).toHaveLength(1);
  expect((await repository.listBookmarks(alice))[0]?.serverRevision).toBe(0);
});
test('retry blocks later operations for the same record while unrelated records remain due', async () => {
  await repository.setBookmark(alice, studyEntry(), false);
  const first = (await repository.pending(alice, 200))[0]!;
  await repository.setBookmark(alice, studyEntry(), true);
  await repository.setBookmark(alice, studyEntry({ id: 'other' }), false);
  await repository.retry(alice, first.id, 500);
  expect((await repository.pending(alice, 200)).map((op) => op.recordId)).toEqual(['other']);
  expect((await repository.pending(alice, 500)).map((op) => op.localSequence)).toEqual([1, 2, 1]);
});
test('remote tombstones merge only without pending desired state and never regress revisions', async () => {
  await repository.mergeRemoteBookmark(alice, studyBookmark({ deleted: true, serverRevision: 4 }));
  await repository.mergeRemoteBookmark(alice, studyBookmark({ deleted: false, serverRevision: 3 }));
  expect((await repository.listBookmarks(alice))[0]).toMatchObject({
    deleted: true,
    serverRevision: 4,
  });
});
test('rebase SQL failure rolls back both local and all pending compare-and-set bases', async () => {
  await repository.setBookmark(alice, studyEntry(), false);
  await repository.setBookmark(alice, studyEntry(), true);
  const operation = (await repository.pending(alice, 200))[0]!;
  await db.run(
    "CREATE TRIGGER fail_rebase BEFORE UPDATE ON study_outbox BEGIN SELECT RAISE(ABORT, 'forced'); END",
  );
  await expect(repository.rebaseBookmark(alice, operation.id, 8)).rejects.toMatchObject({
    code: 'storage-unavailable',
  });
  expect((await repository.listBookmarks(alice))[0]).toMatchObject({
    deleted: true,
    serverRevision: 0,
  });
  expect(
    (await repository.pending(alice, 200)).map((op) =>
      op.kind === 'bookmarkState' ? op.baseRevision : -1,
    ),
  ).toEqual([0, 0]);
});
test('outside writes cannot join and be lost with a failing transaction', async () => {
  await db.run('CREATE TABLE transaction_probe (value TEXT)');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const failed = db.exclusive(async (tx) => {
    await tx.run('INSERT INTO transaction_probe VALUES (?)', ['rolled-back']);
    started();
    await gate;
    throw new Error('abort');
  });
  const rejection = expect(failed).rejects.toThrow('abort');
  await ready;
  const outside = db.run('INSERT INTO transaction_probe VALUES (?)', ['retained']);
  release();
  await rejection;
  await outside;
  expect(await db.all('SELECT value FROM transaction_probe')).toEqual([{ value: 'retained' }]);
});

test('version-one legacy session migration retains manifest position views and publication outbox', async () => {
  await repository.replaceActive(alice, studySession());
  await repository.move(alice, studySession().id, 1);
  await repository.recordView(alice, studySession().id, 0);
  // Simulate a real version-one file and its original publication DTO.
  const row = (
    await db.all('SELECT operation_id, operation_json FROM study_outbox WHERE local_sequence = 0')
  )[0]!;
  const raw = JSON.parse(String(row.operation_json));
  delete raw.session.catalogValidatedAt;
  await db.run('UPDATE study_outbox SET operation_json = ? WHERE operation_id = ?', [
    JSON.stringify(raw),
    String(row.operation_id),
  ]);
  await db.run('ALTER TABLE reviewer_sessions DROP COLUMN catalog_validated_at');
  await db.run('PRAGMA user_version = 1');
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  repository = repo(db);
  await migrateStudyDatabase(db);
  expect(await repository.active(alice)).toMatchObject({
    catalogValidatedAt: null,
    position: 1,
    viewedOrdinals: [0],
  });
  expect((await repository.active(alice))?.items.map((item) => item.entry.id)).toEqual([
    'fixture-grammar',
    'fixture-second',
  ]);
  expect(await repository.pending(alice, 200)).toHaveLength(3);
  expect((await repository.pending(alice, 200))[0]).toMatchObject({
    kind: 'publishSession',
    session: { catalogValidatedAt: null },
  });
});

test('version-two migration failure after adding a column rolls back without clearing legacy records', async () => {
  await repository.replaceActive(alice, studySession());
  await db.run('ALTER TABLE reviewer_sessions DROP COLUMN catalog_validated_at');
  await db.run('PRAGMA user_version = 1');
  const failing: SqlDatabase = {
    ...db,
    exclusive: (work, guard) =>
      db.exclusive(
        (tx) =>
          work({
            ...tx,
            run: async (sql, params) => {
              if (sql === 'PRAGMA user_version = 2')
                throw new Error('forced migration failure after ALTER');
              return tx.run(sql, params);
            },
          }),
        guard,
      ),
  };
  await expect(migrateStudyDatabase(failing)).rejects.toMatchObject({
    code: 'storage-unavailable',
  });
  expect(await db.all('PRAGMA user_version')).toEqual([{ user_version: 1 }]);
  expect(
    (await db.all('PRAGMA table_info(reviewer_sessions)')).some(
      (row) => row.name === 'catalog_validated_at',
    ),
  ).toBe(false);
  expect(await db.all('SELECT position, status FROM reviewer_sessions')).toEqual([
    { position: 0, status: 'active' },
  ]);
  expect(await db.all('SELECT COUNT(*) AS count FROM reviewer_items')).toEqual([{ count: 2 }]);
  expect(await db.all('SELECT COUNT(*) AS count FROM study_outbox')).toEqual([{ count: 1 }]);
  await migrateStudyDatabase(db);
  expect((await repository.active(alice))?.catalogValidatedAt).toBeNull();
});

test('known catalog validation time survives reopen and cannot change under the same session identity', async () => {
  await repository.replaceActive(alice, studySession({ catalogValidatedAt: 75 }));
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  repository = repo(db);
  await migrateStudyDatabase(db);
  expect((await repository.active(alice))?.catalogValidatedAt).toBe(75);
  await expect(
    repository.replaceActive(alice, studySession({ catalogValidatedAt: 90 })),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect((await repository.active(alice))?.catalogValidatedAt).toBe(75);
  expect((await repository.pending(alice, 200))[0]).toMatchObject({
    kind: 'publishSession',
    session: { catalogValidatedAt: 75 },
  });
});
