import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaults } from '../../src/core/config/defaults';
import { migrateStudyDatabase } from '../../src/core/storage/sqlite/studyMigrations';
import type { SqlDatabase } from '../../src/core/storage/sqlite/SqlDatabase';
import type { ContentRepository } from '../../src/features/content/domain/ContentRepository';
import type { CatalogEntry } from '../../src/features/content/domain/catalog';
import { SqliteExamRepository } from '../../src/features/exam/data/SqliteExamRepository';
import { ExamService } from '../../src/features/exam/application/ExamService';
import { selectExamEntries } from '../../src/features/exam/domain/selection';
import { StudyError, type OwnerContext } from '../../src/features/study/domain/study';
import { testQuestion } from '../fixtures/content/question';
import { examCatalog } from '../fixtures/exam';
import { nodeSqlDatabase } from '../fixtures/nodeSqlDatabase';

const owner: OwnerContext = { uid: 'alice', deviceId: 'device', epoch: 1 };
const catalog = examCatalog();
const random = { next: () => 0 };
const config = defaults.config.mockExam;
const selected = selectExamEntries(catalog, config, 1_000, random);
const lastSelectedId = selected[149]!.id;
let dir: string;
let db: SqlDatabase;
let repository: SqliteExamRepository;
let service: ExamService;
let wall: number;
let monotonic: number;
let allowed: boolean;
let content: ContentRepository;

function questionFor(entry: CatalogEntry) {
  return testQuestion({
    id: entry.id,
    version: entry.version,
    categoryId: entry.categoryId,
    subcategoryId: entry.subcategoryId,
    prompt: [
      { kind: 'text', text: `Frozen prompt ${entry.id}`, marks: [] },
      { kind: 'math', expression: '1 + 1', accessibleText: 'one plus one' },
    ],
    stimulus: entry.stimulus
      ? { ...entry.stimulus, blocks: [{ kind: 'text', text: 'Frozen shared passage', marks: [] }] }
      : undefined,
  });
}

function makeService() {
  return new ExamService(
    repository,
    content,
    { now: () => wall },
    random,
    { nextId: () => 'attempt-one' },
    { isCurrent: (candidate) => JSON.stringify(candidate) === JSON.stringify(owner) },
    () => allowed,
    { now: () => monotonic },
  );
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'exam-service-'));
  db = nodeSqlDatabase(join(dir, 'exam.db'));
  await migrateStudyDatabase(db);
  repository = new SqliteExamRepository(db, {
    isCurrent: (candidate) => JSON.stringify(candidate) === JSON.stringify(owner),
  });
  wall = 1_000;
  monotonic = 0;
  allowed = true;
  content = {
    cachedCatalog: async () => catalog,
    catalog: async () => catalog,
    question: async (_owner, entry) => questionFor(entry),
  };
  service = makeService();
});
afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('preflight_fetch_failure_has_no_attempt', async () => {
  content.question = async (_owner, entry) => {
    if (entry.id === lastSelectedId) throw new StudyError('network');
    return questionFor(entry);
  };
  await expect(service.start(owner, config)).rejects.toMatchObject({ code: 'network' });
  expect(await repository.active(owner)).toBeNull();
  expect(await db.all('SELECT COUNT(*) AS count FROM exam_attempts')).toEqual([{ count: 0 }]);
});

test('preflight_freezes_context and fixed choice order without its passage neighbor', async () => {
  const smallConfig = {
    ...config,
    questionCount: 4,
    shuffleQuestions: false,
    distribution: {
      generalInformation: 1,
      communicationSkills: 1,
      quantitativeReasoning: 1,
      criticalThinking: 1,
    },
  };
  const attempt = await service.start(owner, smallConfig);
  const shared = attempt.questions.filter((item) => item.entry.stimulus?.id === 'shared-passage');
  expect(shared).toHaveLength(1);
  expect(shared[0]?.question.stimulus?.blocks).toEqual([
    { kind: 'text', text: 'Frozen shared passage', marks: [] },
  ]);
  expect(attempt.questions[0]?.choiceOrder).toEqual(['c1', 'c2']);
  content.question = async (_owner, entry) =>
    questionFor({ ...entry, id: `changed-${entry.id}` } as CatalogEntry);
  expect((await service.resume(owner, attempt.id)).questions[0]?.question.prompt).toEqual(
    attempt.questions[0]?.question.prompt,
  );
  expect((await service.resume(owner, attempt.id)).config).toEqual(smallConfig);
});

test('shuffles only questions whose choice policy allows it', async () => {
  const first = selected[0]!.id;
  content.question = async (_owner, entry) =>
    testQuestion({
      ...questionFor(entry),
      choiceOrderPolicy: entry.id === first ? 'shuffle' : 'fixed',
    });
  const attempt = await service.start(owner, config);
  expect(attempt.questions[0]?.choiceOrder).toEqual(['c2', 'c1']);
  expect(attempt.questions[1]?.choiceOrder).toEqual(['c1', 'c2']);
});

test('repeated Start while the last question is pending resolves one attempt', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  content.question = async (_owner, entry) => {
    if (entry.id === lastSelectedId) await gate;
    return questionFor(entry);
  };
  const first = service.start(owner, config);
  const second = service.start(owner, config);
  release();
  const [a, b] = await Promise.all([first, second]);
  expect(a.id).toBe(b.id);
  expect(await db.all('SELECT COUNT(*) AS count FROM exam_attempts')).toEqual([{ count: 1 }]);
});

test('rechecks the new-start gate at durable commit', async () => {
  content.question = async (_owner, entry) => {
    if (entry.id === lastSelectedId) allowed = false;
    return questionFor(entry);
  };
  await expect(service.start(owner, config)).rejects.toMatchObject({ code: 'permission-denied' });
  expect(await repository.active(owner)).toBeNull();
});

test('a saved active exam survives a blocked second Start', async () => {
  const attempt = await service.start(owner, config);
  allowed = false;
  expect((await service.start(owner, { ...config, durationMinutes: 1 })).id).toBe(attempt.id);
  expect((await repository.active(owner))?.config.durationMinutes).toBe(180);
});

test('a monotonic observation prevents wall rollback and expiry finalizes before an answer', async () => {
  const attempt = await service.start(owner, config);
  wall += 60_000;
  monotonic += 60_000;
  expect(await service.remaining(owner, attempt.id)).toBe(179 * 60_000);
  wall = 1_000;
  expect(await service.remaining(owner, attempt.id)).toBe(179 * 60_000);
  wall = attempt.deadlineAt;
  await expect(
    service.change(owner, attempt.id, { type: 'answer', ordinal: 0, choiceId: 'c2' }),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect((await repository.result(owner, attempt.id))?.reason).toBe('timeExpired');
});

test('idle countdown observation survives service restart and wall-clock rollback', async () => {
  const attempt = await service.start(owner, config);
  monotonic += 60_000;
  expect(await service.remaining(owner, attempt.id)).toBe(179 * 60_000);
  expect((await repository.attempt(owner, attempt.id))?.lastEffectiveAt).toBe(61_000);
  wall = 1_000;
  monotonic = 0;
  service = makeService();
  expect(await service.remaining(owner, attempt.id)).toBe(179 * 60_000);
});

test('queued pre-deadline answer is rejected when transaction commits after expiry', async () => {
  const attempt = await service.start(owner, config);
  let release!: () => void;
  let entered!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const originalChange = repository.change.bind(repository);
  repository.change = ((...args: Parameters<typeof repository.change>) => {
    entered();
    return held.then(() => originalChange(...args));
  }) as typeof repository.change;
  const answer = service.change(owner, attempt.id, { type: 'answer', ordinal: 0, choiceId: 'c2' });
  await started;
  wall = attempt.deadlineAt;
  monotonic = attempt.deadlineAt - attempt.startedAt;
  release();
  await expect(answer).rejects.toMatchObject({ code: 'conflict' });
  expect((await repository.attempt(owner, attempt.id))?.questions[0]?.selectedChoiceId).toBeNull();
});

test('deadline overrides manual submission reason', async () => {
  const attempt = await service.start(owner, config);
  wall = attempt.deadlineAt;
  monotonic = attempt.deadlineAt - attempt.startedAt;
  const result = await service.submit(owner, attempt.id, 'manual');
  expect(result.reason).toBe('timeExpired');
  expect(result.endedAt).toBe(attempt.deadlineAt);
});
