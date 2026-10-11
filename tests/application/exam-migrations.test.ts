import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateStudyDatabase } from '../../src/core/storage/sqlite/studyMigrations';
import type { SqlDatabase } from '../../src/core/storage/sqlite/SqlDatabase';
import { dropExamTablesForLegacyFixture, nodeSqlDatabase } from '../fixtures/nodeSqlDatabase';

let dir: string;
let db: SqlDatabase;

async function readExistingStudyRows(database: SqlDatabase) {
  return {
    sessions: await database.all(
      'SELECT * FROM reviewer_sessions ORDER BY uid, device_id, session_id',
    ),
    bookmarks: await database.all('SELECT * FROM bookmarks ORDER BY uid, device_id, question_id'),
    operations: await database.all(
      'SELECT * FROM study_outbox ORDER BY uid, device_id, operation_id',
    ),
  };
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'exam-migration-'));
  db = nodeSqlDatabase(join(dir, 'study.db'));
  await migrateStudyDatabase(db);
  await dropExamTablesForLegacyFixture(db);
  await db.run('PRAGMA user_version = 3');
  await db.run(
    'INSERT INTO reviewer_sessions(uid,device_id,session_id,scope_json,generation,created_at,shuffle_questions,position,sequence,status,catalog_validated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ['alice', 'device', 'session', '{}', 'a'.repeat(64), 100, 0, 0, 0, 'active', 100],
  );
  await db.run(
    'INSERT INTO bookmarks(uid,device_id,question_id,bookmark_json,local_sequence) VALUES (?,?,?,?,?)',
    ['alice', 'device', 'question', '{}', 1],
  );
  await db.run(
    'INSERT INTO study_outbox(uid,device_id,operation_id,record_id,local_sequence,created_at,next_attempt_at,operation_json) VALUES (?,?,?,?,?,?,?,?)',
    ['alice', 'device', 'operation', 'session', 1, 100, 100, '{}'],
  );
});
afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('upgrades version 3 without changing reviewer rows and survives reopen', async () => {
  const before = await readExistingStudyRows(db);
  await migrateStudyDatabase(db);
  expect((await db.all('PRAGMA user_version'))[0]?.user_version).toBe(4);
  expect(await readExistingStudyRows(db)).toEqual(before);
  const tables = (await db.all("SELECT name FROM sqlite_master WHERE type='table'")).map(
    (row) => row.name,
  );
  expect(tables).toEqual(
    expect.arrayContaining(['exam_attempts', 'exam_questions', 'exam_results', 'exam_outbox']),
  );
  const indexes = (await db.all("SELECT name FROM sqlite_master WHERE type='index'")).map(
    (row) => row.name,
  );
  expect(indexes).toEqual(expect.arrayContaining(['exam_one_active', 'exam_one_terminal_outbox']));
  expect(await db.all('PRAGMA quick_check')).toEqual([{ quick_check: 'ok' }]);
  expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  await migrateStudyDatabase(db);
  expect(await readExistingStudyRows(db)).toEqual(before);
  expect((await db.all('PRAGMA user_version'))[0]?.user_version).toBe(4);
});

test('rejects a future version without changing old rows', async () => {
  const before = await readExistingStudyRows(db);
  await db.run('PRAGMA user_version = 5');
  await expect(migrateStudyDatabase(db)).rejects.toMatchObject({ code: 'storage-corrupt' });
  expect(await readExistingStudyRows(db)).toEqual(before);
  expect((await db.all('PRAGMA user_version'))[0]?.user_version).toBe(5);
});
