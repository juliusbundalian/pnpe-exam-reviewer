import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaults } from '../../src/core/config/defaults';
import { migrateStudyDatabase } from '../../src/core/storage/sqlite/studyMigrations';
import type { SqlDatabase } from '../../src/core/storage/sqlite/SqlDatabase';
import { SqliteExamRepository } from '../../src/features/exam/data/SqliteExamRepository';
import { ExamAttemptSchema, type ExamAttempt } from '../../src/features/exam/domain/exam';
import { selectExamEntries } from '../../src/features/exam/domain/selection';
import type { OwnerContext } from '../../src/features/study/domain/study';
import { testQuestion } from '../fixtures/content/question';
import { examCatalog } from '../fixtures/exam';
import { nodeSqlDatabase } from '../fixtures/nodeSqlDatabase';

const alice: OwnerContext = { uid: 'alice', deviceId: 'one', epoch: 1 };
const bob: OwnerContext = { uid: 'bob', deviceId: 'one', epoch: 1 };
const aliceOtherDevice: OwnerContext = { ...alice, deviceId: 'two' };
const start = 1_000;
const deadline = start + defaults.config.mockExam.durationMinutes * 60_000;
let dir: string;
let db: SqlDatabase;
let current: OwnerContext;
let repo: SqliteExamRepository;

function repository(database: SqlDatabase) {
  return new SqliteExamRepository(database, {
    isCurrent: (owner) =>
      owner.uid === current.uid &&
      owner.deviceId === current.deviceId &&
      owner.epoch === current.epoch,
  });
}

function candidate(owner = alice, id = 'exam-one'): ExamAttempt {
  const entries = selectExamEntries(examCatalog(), defaults.config.mockExam, start, {
    next: () => 0,
  });
  return ExamAttemptSchema.parse({
    id,
    uid: owner.uid,
    deviceId: owner.deviceId,
    generation: 'a'.repeat(64),
    config: defaults.config.mockExam,
    startedAt: start,
    deadlineAt: deadline,
    lastEffectiveAt: start,
    position: 0,
    status: 'active',
    questions: entries.map((entry) => ({
      entry,
      question: testQuestion({
        id: entry.id,
        version: entry.version,
        categoryId: entry.categoryId,
        subcategoryId: entry.subcategoryId,
        stimulus: entry.stimulus
          ? { ...entry.stimulus, blocks: [{ kind: 'text', text: 'Shared', marks: [] }] }
          : undefined,
      }),
      choiceOrder: ['c1', 'c2'],
      selectedChoiceId: null,
      flagged: false,
    })),
  });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'exam-repo-'));
  db = nodeSqlDatabase(join(dir, 'exam.db'));
  await migrateStudyDatabase(db);
  current = alice;
  repo = repository(db);
});
afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('activation_rolls_back_on_last_question_failure', async () => {
  await repo.create(alice, candidate());
  current = bob;
  await db.run(
    "CREATE TRIGGER reject_last_exam_question BEFORE INSERT ON exam_questions WHEN NEW.ordinal = 149 BEGIN SELECT RAISE(ABORT, 'forced'); END",
  );
  await expect(repo.create(bob, candidate(bob, 'exam-two'))).rejects.toMatchObject({
    code: 'storage-unavailable',
  });
  expect(await repo.active(bob)).toBeNull();
  expect(
    await db.all('SELECT COUNT(*) AS count FROM exam_questions WHERE uid = ?', ['bob']),
  ).toEqual([{ count: 0 }]);
  current = alice;
  expect((await repo.active(alice))?.id).toBe('exam-one');
  expect(await db.all('PRAGMA quick_check')).toEqual([{ quick_check: 'ok' }]);
});

test('late_answer_rejected_inside_transaction', async () => {
  await repo.create(alice, candidate());
  await expect(
    repo.change(
      alice,
      'exam-one',
      { type: 'answer', ordinal: 0, choiceId: 'c2' },
      deadline,
      () => deadline,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect((await repo.active(alice))?.questions[0]?.selectedChoiceId).toBeNull();
  await expect(
    repo.change(
      alice,
      'exam-one',
      { type: 'answer', ordinal: 0, choiceId: 'c2' },
      start + 1,
      () => deadline,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect((await repo.active(alice))?.questions[0]?.selectedChoiceId).toBeNull();
});

test('terminal_retry_is_idempotent', async () => {
  await repo.create(alice, candidate());
  await repo.change(
    alice,
    'exam-one',
    { type: 'answer', ordinal: 0, choiceId: 'c2' },
    start + 1,
    () => start + 1,
  );
  const result = await repo.finalize(alice, 'exam-one', deadline, 'timeExpired');
  expect(await repo.finalize(alice, 'exam-one', deadline + 1, 'manual')).toEqual(result);
  expect(result.overall).toMatchObject({ correct: 1, unanswered: 149 });
  expect(await repo.pending(alice)).toHaveLength(1);
  expect(await repo.history(alice)).toHaveLength(1);
  expect(await db.all('SELECT COUNT(*) AS count FROM exam_outbox')).toEqual([{ count: 1 }]);
  await expect(
    repo.change(
      alice,
      'exam-one',
      { type: 'answer', ordinal: 1, choiceId: 'c2' },
      deadline + 1,
      () => deadline + 1,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
});

test('exam_owner_device_isolation', async () => {
  await repo.create(alice, candidate());
  current = aliceOtherDevice;
  expect(await repo.active(aliceOtherDevice)).toBeNull();
  expect(await repo.attempt(aliceOtherDevice, 'exam-one')).toBeNull();
  current = bob;
  expect(await repo.active(bob)).toBeNull();
  expect(await repo.result(bob, 'exam-one')).toBeNull();
  await expect(repo.active(alice)).rejects.toMatchObject({ code: 'auth-required' });
});

test('answer clearing, flagging and cursor survive a database reopen', async () => {
  await repo.create(alice, candidate());
  await repo.change(
    alice,
    'exam-one',
    { type: 'answer', ordinal: 0, choiceId: 'c2' },
    start + 1,
    () => start + 1,
  );
  await repo.change(
    alice,
    'exam-one',
    { type: 'flag', ordinal: 0, flagged: true },
    start + 2,
    () => start + 2,
  );
  await repo.change(
    alice,
    'exam-one',
    { type: 'answer', ordinal: 0, choiceId: null },
    start + 3,
    () => start + 3,
  );
  await repo.change(alice, 'exam-one', { type: 'move', ordinal: 1 }, start + 4, () => start + 4);
  await db.close();
  db = nodeSqlDatabase(join(dir, 'exam.db'));
  repo = repository(db);
  expect(await repo.active(alice)).toMatchObject({ position: 1, lastEffectiveAt: start + 4 });
  expect((await repo.active(alice))?.questions[0]).toMatchObject({
    selectedChoiceId: null,
    flagged: true,
  });
  expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
});

test('invalid persisted question JSON is rejected as storage corruption', async () => {
  await repo.create(alice, candidate());
  await db.run('UPDATE exam_questions SET question_json = ? WHERE uid = ? AND ordinal = 149', [
    '{broken',
    'alice',
  ]);
  await expect(repo.active(alice)).rejects.toMatchObject({ code: 'storage-corrupt' });
});

test('duplicate Start returns the existing active exam', async () => {
  await repo.create(alice, candidate());
  expect((await repo.create(alice, candidate(alice, 'other-exam'))).id).toBe('exam-one');
  expect(await db.all('SELECT COUNT(*) AS count FROM exam_attempts')).toEqual([{ count: 1 }]);
});

test('a new-start gate rollback leaves no active exam but does not block resuming an existing one', async () => {
  await expect(
    repo.create(alice, candidate(), () => {
      throw new Error('maintenance');
    }),
  ).rejects.toMatchObject({ code: 'storage-unavailable' });
  expect(await repo.active(alice)).toBeNull();
  await repo.create(alice, candidate());
  expect(
    (
      await repo.create(alice, candidate(alice, 'other-exam'), () => {
        throw new Error('maintenance');
      })
    ).id,
  ).toBe('exam-one');
});

test('observing time never moves a saved deadline backward', async () => {
  await repo.create(alice, candidate());
  expect((await repo.observeTime(alice, 'exam-one', start + 90_000)).lastEffectiveAt).toBe(
    start + 90_000,
  );
  expect((await repo.observeTime(alice, 'exam-one', start + 1)).lastEffectiveAt).toBe(
    start + 90_000,
  );
});

test('acknowledgement removes only the outbox row and retains the local result', async () => {
  await repo.create(alice, candidate());
  await repo.finalize(alice, 'exam-one', start + 1, 'manual');
  await repo.acknowledge(alice, 'exam-one');
  expect(await repo.pending(alice)).toEqual([]);
  expect(await repo.result(alice, 'exam-one')).toMatchObject({
    attemptId: 'exam-one',
    syncState: 'synced',
  });
});

test('rejects a stored result that claims a different owner', async () => {
  await repo.create(alice, candidate());
  await repo.finalize(alice, 'exam-one', start + 1, 'manual');
  const row = (await db.all('SELECT result_json FROM exam_results'))[0]!;
  const payload = JSON.parse(String(row.result_json));
  payload.uid = 'bob';
  await db.run('UPDATE exam_results SET result_json = ?', [JSON.stringify(payload)]);
  await expect(repo.result(alice, 'exam-one')).rejects.toMatchObject({ code: 'storage-corrupt' });
});
