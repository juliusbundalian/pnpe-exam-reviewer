import { SqliteStudyRepository } from '../../src/features/study/data/SqliteStudyRepository';
import { ReviewerService } from '../../src/features/reviewer/application/ReviewerService';
import {
  ReviewerController,
  type RenderedReceipt,
} from '../../src/features/reviewer/application/ReviewerController';
import { StudyError } from '../../src/features/study/domain/study';
import type { Question } from '../../src/features/content/domain/question';
import { owner as alice, studyQuestion } from '../fixtures/study';
import { reviewerHarness, deferred } from '../fixtures/reviewer';

let h: Awaited<ReturnType<typeof reviewerHarness>>, controller: ReviewerController, id: string;
beforeEach(async () => {
  h = await reviewerHarness();
  const service = new ReviewerService(
    h.study,
    h.content,
    h.clock,
    { next: () => 0 },
    h.identity,
    h.guard,
  );
  id = (await service.prepare(alice, { categoryId: 'communicationSkills' }, false)).session.id;
  controller = new ReviewerController(service, h.content, h.study, h.guard);
});
afterEach(async () => {
  controller.dispose();
  await h.db.close();
});
function receipt(): RenderedReceipt {
  const state = controller.snapshot();
  if (state.kind !== 'reading' && state.kind !== 'completed')
    throw new Error('Expected readable state');
  return { sessionId: state.session.id, ordinal: state.ordinal, pageToken: state.pageToken };
}
async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('idle then reading includes complete original choices and prefetched pages do not count', async () => {
  expect(controller.snapshot()).toEqual({ kind: 'idle' });
  await controller.open(alice, id);
  await flush();
  expect(controller.snapshot()).toMatchObject({
    kind: 'reading',
    ordinal: 0,
    question: {
      correctChoiceId: studyQuestion().correctChoiceId,
      choices: studyQuestion().choices,
    },
  });
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
  expect(jest.mocked(h.content.question).mock.calls.map((call) => call[1].id)).toEqual([
    'question-0',
    'question-0',
    'question-1',
    'question-2',
  ]);
});
test('hidden layout followed by foreground focus records exactly one durable view without new layout', async () => {
  await controller.open(alice, id);
  await controller.rendered(receipt());
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
  controller.setVisibility(true, false);
  await flush();
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
  controller.setVisibility(true, true);
  await flush();
  await controller.rendered(receipt());
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([0]);
  expect((await h.study.active(alice))?.sequence).toBe(1);
});
test('rapid next previous discards late fetch and delayed prior receipt', async () => {
  await controller.open(alice, id);
  const previous = receipt();
  const gate = deferred<Question>();
  jest
    .mocked(h.content.question)
    .mockImplementation(async (_, entry) =>
      entry.id === 'question-1' ? gate.promise : studyQuestion({ id: entry.id }),
    );
  const next = controller.move(1);
  await flush();
  expect((await h.study.active(alice))?.position).toBe(1);
  const back = controller.move(0);
  await back;
  gate.resolve(studyQuestion({ id: 'question-1' }));
  await next;
  controller.setVisibility(true, true);
  await controller.rendered(previous);
  expect(controller.snapshot()).toMatchObject({
    kind: 'reading',
    ordinal: 0,
    question: { id: 'question-0' },
  });
  expect((await h.study.active(alice))?.position).toBe(0);
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
  await controller.rendered(receipt());
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([0]);
});
test('offline missing page retains intended saved position and frozen count; retry restores it', async () => {
  jest.mocked(h.content.question).mockImplementation(async (_, entry) => {
    if (entry.id === 'question-1') throw new StudyError('network');
    return studyQuestion({ id: entry.id });
  });
  await controller.open(alice, id);
  await controller.move(1);
  expect(controller.snapshot()).toMatchObject({
    kind: 'missing',
    ordinal: 1,
    session: { position: 1, items: expect.any(Array) },
    error: { code: 'network' },
  });
  expect((await h.study.active(alice))?.items).toHaveLength(3);
  jest
    .mocked(h.content.question)
    .mockImplementation(async (_, entry) => studyQuestion({ id: entry.id }));
  await controller.retry();
  expect(controller.snapshot()).toMatchObject({ kind: 'reading', ordinal: 1 });
});
test('failed durable move keeps persisted position and offers actionable storage retry', async () => {
  await controller.open(alice, id);
  await h.db.run(
    "CREATE TRIGGER fail_move BEFORE UPDATE ON reviewer_sessions BEGIN SELECT RAISE(ABORT, 'forced'); END",
  );
  await controller.move(1);
  expect(controller.snapshot()).toMatchObject({
    kind: 'error',
    ordinal: 0,
    session: { position: 0 },
    error: { code: 'storage-unavailable' },
  });
  expect((await h.study.active(alice))?.position).toBe(0);
  await h.db.run('DROP TRIGGER fail_move');
  await controller.retry();
  expect(controller.snapshot()).toMatchObject({
    kind: 'reading',
    ordinal: 1,
    session: { position: 1 },
  });
});
test('completion retains current question and supports previous navigation', async () => {
  controller.setVisibility(true, true);
  await controller.open(alice, id);
  for (let n = 0; n < 3; n++) {
    if (n) await controller.move(n);
    await controller.rendered(receipt());
  }
  expect(controller.snapshot()).toMatchObject({
    kind: 'completed',
    ordinal: 2,
    question: { id: 'question-2' },
    session: { viewedOrdinals: [0, 1, 2] },
  });
  await controller.move(1);
  expect(controller.snapshot()).toMatchObject({
    kind: 'completed',
    ordinal: 1,
    question: { id: 'question-1' },
  });
});
test('epoch changes during mutation roll back and discard personal reactive state', async () => {
  await controller.open(alice, id);
  controller.setVisibility(true, true);
  const original = h.study.recordView.bind(h.study);
  jest.spyOn(h.study, 'recordView').mockImplementation(async (...args) => {
    h.switchOwner({ ...alice, epoch: 2 });
    return original(...args);
  });
  await controller.rendered(receipt());
  expect(controller.snapshot()).toEqual({ kind: 'idle' });
  h.switchOwner(alice);
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
});
test('disposed or superseded open cannot publish late personal results or receipts', async () => {
  const gate = deferred<Question>();
  jest.mocked(h.content.question).mockReturnValue(gate.promise);
  const opening = controller.open(alice, id);
  await flush();
  controller.dispose();
  gate.resolve(studyQuestion({ id: 'question-0' }));
  await opening;
  expect(controller.snapshot()).toEqual({ kind: 'idle' });
  await controller.rendered({ sessionId: id, ordinal: 0, pageToken: 'unknown' });
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
});

test('permission and invalid revision errors never claim an offline missing page', async () => {
  for (const failure of [new StudyError('permission-denied'), new Error('sensitive SDK message')]) {
    jest.mocked(h.content.question).mockRejectedValue(failure);
    await controller.open(alice, id);
    expect(controller.snapshot()).toMatchObject({
      kind: 'error',
      ordinal: 0,
      error: { code: failure instanceof StudyError ? 'permission-denied' : 'invalid-content' },
    });
    expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
  }
});
test('failed view save retains readable content and retry counts only when visible', async () => {
  await controller.open(alice, id);
  controller.setVisibility(true, true);
  const layout = receipt();
  await h.db.run(
    "CREATE TRIGGER fail_view BEFORE INSERT ON reviewer_views BEGIN SELECT RAISE(ABORT, 'forced'); END",
  );
  await controller.rendered(layout);
  expect(controller.snapshot()).toMatchObject({
    kind: 'error',
    question: { id: 'question-0' },
    error: { code: 'storage-unavailable' },
  });
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
  await h.db.run('DROP TRIGGER fail_view');
  controller.setVisibility(false, true);
  await controller.retry();
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
  controller.setVisibility(true, true);
  await flush();
  expect(controller.snapshot()).toMatchObject({
    kind: 'reading',
    session: { viewedOrdinals: [0] },
  });
});
test('wrong session ordinal or prefetched-page receipts are excluded despite current token', async () => {
  await controller.open(alice, id);
  controller.setVisibility(true, true);
  const layout = receipt();
  await controller.rendered({ ...layout, sessionId: 'other-session' });
  await controller.rendered({ ...layout, ordinal: 1 });
  await controller.rendered({ ...layout, pageToken: `0${layout.pageToken}` });
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
});
test('subscribers observe changes and unsubscribe stops notifications', async () => {
  const observations: string[] = [];
  const unsubscribe = controller.subscribe(() => observations.push(controller.snapshot().kind));
  await controller.open(alice, id);
  expect(observations).toContain('reading');
  unsubscribe();
  const count = observations.length;
  await controller.move(1);
  expect(observations).toHaveLength(count);
});
test('late question retrieval after owner change clears personal state', async () => {
  const gate = deferred<Question>();
  jest.mocked(h.content.question).mockReturnValue(gate.promise);
  const pending = controller.open(alice, id);
  await flush();
  h.switchOwner({ ...alice, uid: 'bob', epoch: 2 });
  gate.resolve(studyQuestion({ id: 'question-0' }));
  await pending;
  expect(controller.snapshot()).toEqual({ kind: 'idle' });
  h.switchOwner(alice);
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
});
test('prefetch has at most two outstanding requests and follows the latest window', async () => {
  const s = new ReviewerService(
    h.study,
    h.content,
    h.clock,
    { next: () => 0 },
    h.identity,
    h.guard,
  );
  h.catalog.entries = Array.from({ length: 6 }, (_, n) => ({
    ...h.catalog.entries[0]!,
    id: `question-${n}`,
  }));
  id = (await s.replace(alice, { categoryId: 'communicationSkills' }, false)).id;
  const gates = new Map([1, 2, 4, 5].map((n) => [n, deferred<Question>()]));
  jest
    .mocked(h.content.question)
    .mockClear()
    .mockImplementation(async (_, entry) => {
      const n = Number(entry.id.split('-')[1]);
      return gates.get(n)?.promise ?? studyQuestion({ id: entry.id });
    });
  await controller.open(alice, id);
  await controller.move(3);
  expect(jest.mocked(h.content.question).mock.calls.map((call) => call[1].id)).toEqual([
    'question-0',
    'question-1',
    'question-2',
    'question-3',
  ]);
  gates.get(1)!.resolve(studyQuestion({ id: 'question-1' }));
  await flush();
  expect(jest.mocked(h.content.question).mock.calls.map((call) => call[1].id)).toEqual([
    'question-0',
    'question-1',
    'question-2',
    'question-3',
    'question-4',
  ]);
  gates.get(2)!.resolve(studyQuestion({ id: 'question-2' }));
  await flush();
  gates.get(4)!.resolve(studyQuestion({ id: 'question-4' }));
  gates.get(5)!.resolve(studyQuestion({ id: 'question-5' }));
  await flush();
  expect((await h.study.active(alice))?.viewedOrdinals).toEqual([]);
});

test('new owner epoch receipt is not swallowed by an older pending view of the same session item', async () => {
  controller.setVisibility(true, true);
  await controller.open(alice, id);
  const gate = deferred<void>();
  const original = h.study.recordView.bind(h.study);
  jest.spyOn(h.study, 'recordView').mockImplementationOnce(async (...args) => {
    await gate.promise;
    return original(...args);
  });
  const oldView = controller.rendered(receipt());
  await flush();
  const current = { ...alice, epoch: 2 };
  h.switchOwner(current);
  await controller.open(current, id);
  const newView = controller.rendered(receipt());
  gate.resolve();
  await Promise.all([oldView, newView]);
  expect((await h.study.active(current))?.viewedOrdinals).toEqual([0]);
  expect(controller.snapshot()).toMatchObject({
    kind: 'reading',
    session: { viewedOrdinals: [0] },
  });
});

test('epoch change immediately before SQL move commit rolls back position and outbox', async () => {
  await controller.open(alice, id);
  const guarded = new SqliteStudyRepository(
    {
      ...h.db,
      exclusive: (work, guard) =>
        h.db.exclusive(work, () => {
          h.switchOwner({ ...alice, epoch: 2 });
          guard?.();
        }),
    },
    h.clock,
    h.identity,
    h.guard,
  );
  jest.spyOn(h.study, 'move').mockImplementation((...args) => guarded.move(...args));
  await controller.move(1);
  expect(controller.snapshot()).toEqual({ kind: 'idle' });
  h.switchOwner(alice);
  expect((await h.study.active(alice))?.position).toBe(0);
  expect(await h.study.pending(alice, 1000)).toHaveLength(1);
});

test('two old-owner prefetch releases resume current window without exceeding two requests', async () => {
  const old = [deferred<Question>(), deferred<Question>()];
  const fresh = [deferred<Question>(), deferred<Question>()];
  const current = { ...alice, epoch: 2 };
  let outstanding = 0,
    maximum = 0;
  const requests: string[] = [];
  jest.mocked(h.content.question).mockImplementation(async (candidate, entry) => {
    if (entry.id === 'question-0') return studyQuestion({ id: entry.id });
    const index = Number(entry.id.slice(-1)) - 1;
    requests.push(`${candidate.epoch}:${entry.id}`);
    maximum = Math.max(maximum, ++outstanding);
    try {
      return await (candidate.epoch === alice.epoch ? old : fresh)[index]!.promise;
    } finally {
      outstanding--;
    }
  });
  await controller.open(alice, id);
  h.switchOwner(current);
  await controller.open(current, id);
  const visible = controller.snapshot();
  expect(requests).toEqual(['1:question-1', '1:question-2']);
  old[0]!.resolve(studyQuestion({ id: 'question-1' }));
  await flush();
  expect(requests).toEqual(['1:question-1', '1:question-2', '2:question-1']);
  old[1]!.resolve(studyQuestion({ id: 'question-2' }));
  await flush();
  expect(requests).toEqual(['1:question-1', '1:question-2', '2:question-1', '2:question-2']);
  fresh[0]!.resolve(studyQuestion({ id: 'question-1' }));
  fresh[1]!.resolve(studyQuestion({ id: 'question-2' }));
  await flush();
  expect(maximum).toBe(2);
  expect(controller.snapshot()).toEqual(visible);
  expect((await h.study.active(current))?.viewedOrdinals).toEqual([]);
});
