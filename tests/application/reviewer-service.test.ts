import { ReviewerService } from '../../src/features/reviewer/application/ReviewerService';
import { StudyError, ReviewerSessionSchema } from '../../src/features/study/domain/study';
import { reviewerHarness, deferred } from '../fixtures/reviewer';
import { owner as alice, studyEntry, studyQuestion, studySession } from '../fixtures/study';
import type { Question } from '../../src/features/content/domain/question';

let h: Awaited<ReturnType<typeof reviewerHarness>>;
const scope = { categoryId: 'communicationSkills' } as const;
const service = (random = { next: () => 0 }) =>
  new ReviewerService(h.study, h.content, h.clock, random, h.identity, h.guard);
beforeEach(async () => {
  h = await reviewerHarness();
});
afterEach(async () => {
  await h.db.close();
});

test('reviewer_has_no_count_cap', async () => {
  h.catalog.entries = Array.from({ length: 276 }, (_, n) => studyEntry({ id: `question-${n}` }));
  const result = await service().prepare(alice, scope, false);
  expect(result.kind).toBe('ready');
  expect(result.session.items).toHaveLength(276);
  expect(result.session.viewedOrdinals).toEqual([]);
  expect(await h.study.active(alice)).toMatchObject({ catalogValidatedAt: 500, createdAt: 1000 });
  expect((await h.study.pending(alice, 1000))[0]).toMatchObject({
    kind: 'publishSession',
    session: { catalogValidatedAt: 500 },
  });
});
test('subcategory filter excludes inactive unsupported and expired entries without editing choices', async () => {
  h.catalog.entries = [
    studyEntry(),
    studyEntry({ id: 'reading', subcategoryId: 'readingComprehension' }),
    studyEntry({ id: 'inactive', status: 'inactive' }),
    studyEntry({ id: 'table', supportedKinds: ['table'] }),
    studyEntry({ id: 'expired', expiresAt: '1970-01-01T00:00:00.900Z' }),
  ];
  const s = service();
  const result = await s.prepare(alice, { ...scope, subcategoryId: 'grammar' }, false);
  expect(result.session.items.map((item) => item.entry.id)).toEqual(['fixture-grammar']);
  const question = await h.content.question(alice, result.session.items[0]!.entry);
  expect(question.choices.map((choice) => choice.id)).toEqual(
    studyQuestion().choices.map((choice) => choice.id),
  );
});
test('Fisher-Yates is applied once and repeated simultaneous starts return existing frozen order', async () => {
  const random = { next: jest.fn(() => 0) };
  const s = service(random);
  const [first, repeated] = await Promise.all([
    s.prepare(alice, scope, true),
    s.prepare(alice, scope, true),
  ]);
  expect(first.session.items.map((item) => item.entry.id)).toEqual([
    'question-1',
    'question-2',
    'question-0',
  ]);
  expect(repeated.kind).toBe('existing');
  expect(repeated.session.id).toBe(first.session.id);
  expect(random.next).toHaveBeenCalledTimes(2);
  expect(await h.study.pending(alice, 1000)).toHaveLength(1);
});
test('same or different scope offers existing and cancellation leaves its state untouched', async () => {
  const s = service();
  const first = await s.prepare(alice, scope, false);
  await h.study.recordView(alice, first.session.id, 0);
  for (const selected of [scope, { categoryId: 'quantitativeReasoning' } as const]) {
    const existing = await s.prepare(alice, selected, true);
    expect(existing).toMatchObject({
      kind: 'existing',
      session: { id: first.session.id, viewedOrdinals: [0] },
    });
  }
  expect((await h.study.active(alice))?.status).toBe('active');
});
test('empty scope and failed first question never activate a session', async () => {
  await expect(
    service().prepare(alice, { categoryId: 'quantitativeReasoning' }, false),
  ).rejects.toMatchObject({ code: 'empty-scope' });
  jest.mocked(h.content.question).mockRejectedValue(new StudyError('network'));
  await expect(service().prepare(alice, scope, false)).rejects.toMatchObject({ code: 'network' });
  expect(await h.study.active(alice)).toBeNull();
  expect(await h.study.pending(alice, 1000)).toEqual([]);
});
test('failed initial page and failed replacement commit preserve old session and operations', async () => {
  const s = service();
  const old = (await s.prepare(alice, scope, false)).session;
  jest.mocked(h.content.question).mockRejectedValueOnce(new StudyError('network'));
  await expect(s.replace(alice, scope, false)).rejects.toMatchObject({ code: 'network' });
  await h.db.run(
    "CREATE TRIGGER fail_new BEFORE INSERT ON reviewer_items BEGIN SELECT RAISE(ABORT, 'forced'); END",
  );
  await expect(s.replace(alice, scope, true)).rejects.toMatchObject({
    code: 'storage-unavailable',
  });
  expect(await h.study.active(alice)).toEqual(old);
  expect(await h.study.pending(alice, 1000)).toHaveLength(1);
});
test('explicit cached source avoids server discovery and preserves validation time', async () => {
  jest.mocked(h.content.catalog).mockRejectedValue(new StudyError('conflict'));
  const ready = await service().prepare(alice, scope, false, 'cached');
  expect(ready.session).toMatchObject({ catalogValidatedAt: 500 });
  expect(h.content.catalog).not.toHaveBeenCalled();
});
test('resume freezes revision order and expiry and accepts completed sessions', async () => {
  const s = service();
  const original = (await s.prepare(alice, scope, false)).session;
  h.catalog.entries = [studyEntry({ id: 'replacement', version: 9 })];
  h.setTime(999999999);
  for (let n = 0; n < 3; n++) await h.study.recordView(alice, original.id, n);
  const resumed = await s.resume(alice, original.id);
  expect(resumed.items.map((item) => [item.entry.id, item.entry.version])).toEqual([
    ['question-0', 1],
    ['question-1', 1],
    ['question-2', 1],
  ]);
  expect(resumed.status).toBe('completed');
  expect((await s.prepare(alice, scope, false)).kind).toBe('existing');
});
test('owner epoch change during first-page retrieval prevents activation', async () => {
  const gate = deferred<Question>();
  jest.mocked(h.content.question).mockReturnValue(gate.promise);
  const pending = service().prepare(alice, scope, false);
  // Wait until initial revision request is in flight.
  while (!jest.mocked(h.content.question).mock.calls.length)
    await new Promise((resolve) => setImmediate(resolve));
  h.switchOwner({ ...alice, epoch: 2 });
  gate.resolve(studyQuestion({ id: 'question-0' }));
  await expect(pending).rejects.toMatchObject({ code: 'auth-required' });
  h.switchOwner(alice);
  expect(await h.study.active(alice)).toBeNull();
});
test('legacy session schema defaults unknown validation date rather than creation date', () => {
  expect(
    ReviewerSessionSchema.parse(
      Object.fromEntries(
        Object.entries(studySession()).filter(([key]) => key !== 'catalogValidatedAt'),
      ),
    ),
  ).toMatchObject({ catalogValidatedAt: null });
});

test('simultaneous confirmed replacement deduplicates intent and archives only after ready', async () => {
  const s = service();
  const old = (await s.prepare(alice, scope, false)).session;
  const gate = deferred<Question>();
  jest.mocked(h.content.question).mockReturnValueOnce(gate.promise);
  const first = s.replace(alice, scope, false),
    second = s.replace(alice, scope, false);
  await new Promise((resolve) => setImmediate(resolve));
  expect((await h.study.active(alice))?.id).toBe(old.id);
  gate.resolve(studyQuestion({ id: 'question-0' }));
  const [a, b] = await Promise.all([first, second]);
  expect(a.id).toBe(b.id);
  expect((await h.study.session(alice, old.id))?.status).toBe('archived');
  expect((await h.study.pending(alice, 1000)).map((op) => op.kind)).toEqual([
    'publishSession',
    'sessionState',
    'publishSession',
  ]);
});
test('expired frozen entry resumes unchanged while a new session excludes it', async () => {
  h.catalog.entries = [studyEntry({ id: 'question-0', expiresAt: '1970-01-01T00:00:02.000Z' })];
  jest
    .mocked(h.content.question)
    .mockResolvedValue(studyQuestion({ id: 'question-0', expiresAt: '1970-01-01T00:00:02.000Z' }));
  const s = service(),
    initial = (await s.prepare(alice, scope, false)).session;
  h.setTime(3000);
  expect((await s.resume(alice, initial.id)).items[0]?.entry.expiresAt).toBe(
    '1970-01-01T00:00:02.000Z',
  );
  await expect(s.replace(alice, scope, false)).rejects.toMatchObject({ code: 'empty-scope' });
  expect((await h.study.active(alice))?.id).toBe(initial.id);
});
test('wrong first revision blocks activation with a safe error', async () => {
  jest.mocked(h.content.question).mockResolvedValue(studyQuestion({ id: 'other-question' }));
  await expect(service().prepare(alice, scope, false)).rejects.toMatchObject({
    code: 'invalid-content',
  });
  expect(await h.study.active(alice)).toBeNull();
});
test('invalid random or clock cannot freeze malformed configuration', async () => {
  await expect(service({ next: () => 1 }).prepare(alice, scope, true)).rejects.toMatchObject({
    code: 'invalid-content',
  });
  h.setTime(NaN);
  await expect(service().prepare(alice, scope, false)).rejects.toMatchObject({
    code: 'invalid-content',
  });
  expect(await h.study.active(alice)).toBeNull();
});

test('confirmed explicit cached replacement freezes its own snapshot validation time', async () => {
  const s = service();
  const prior = (await s.prepare(alice, scope, false)).session;
  jest.mocked(h.content.catalog).mockRejectedValue(new StudyError('conflict'));
  jest.mocked(h.content.cachedCatalog).mockResolvedValue({ ...h.catalog, validatedAt: 123 });
  const replacement = await s.replace(alice, scope, false, 'cached');
  expect(replacement.catalogValidatedAt).toBe(123);
  expect((await h.study.session(alice, prior.id))?.catalogValidatedAt).toBe(500);
  expect((await h.study.session(alice, prior.id))?.status).toBe('archived');
});
