import {
  OwnerContextSchema,
  StudyScopeSchema,
  ReviewerSessionSchema,
  BookmarkSchema,
  StudyOperationSchema,
  BookmarkConflictError,
  StudyError,
} from '../../src/features/study/domain/study';
import { canonicalJson, jsonBytes } from '../../src/core/content/Fingerprint';
import { owner, studySession, studyBookmark, studyEntry } from '../fixtures/study';

test('owner and scope schemas reject unsafe or unresolved identities and invalid taxonomy', () => {
  expect(OwnerContextSchema.parse(owner)).toEqual(owner);
  for (const change of [
    { uid: '' },
    { uid: '../other' },
    { deviceId: 'd'.repeat(129) },
    { epoch: -1 },
    { epoch: NaN },
    { extra: true },
  ])
    expect(OwnerContextSchema.safeParse({ ...owner, ...change }).success).toBe(false);
  expect(
    StudyScopeSchema.safeParse({ categoryId: 'generalInformation', subcategoryId: 'grammar' })
      .success,
  ).toBe(false);
});

test('session schema protects frozen manifests, positions, viewed membership and completion', () => {
  expect(ReviewerSessionSchema.parse(studySession()).items.map((i) => i.entry.id)).toEqual([
    'fixture-grammar',
    'fixture-second',
  ]);
  for (const change of [
    { position: 2 },
    { position: -1 },
    { sequence: -1 },
    { sequence: 1.5 },
    { sequence: Infinity },
    { items: [] },
    {
      items: [
        { ordinal: 0, entry: studyEntry() },
        { ordinal: 0, entry: studyEntry({ id: 'second' }) },
      ],
    },
    { items: [{ ordinal: 1, entry: studyEntry() }] },
    {
      items: [
        { ordinal: 0, entry: studyEntry() },
        { ordinal: 1, entry: studyEntry({ version: 2 }) },
      ],
    },
    { viewedOrdinals: [0, 0] },
    { viewedOrdinals: [2] },
    { viewedOrdinals: [-1] },
    { status: 'completed' },
    { viewedOrdinals: [0, 1], status: 'active' },
    { scope: { categoryId: 'generalInformation' } },
    { extra: true },
  ])
    expect(ReviewerSessionSchema.safeParse({ ...studySession(), ...change }).success).toBe(false);
  expect(
    ReviewerSessionSchema.safeParse(studySession({ viewedOrdinals: [1, 0], status: 'completed' }))
      .success,
  ).toBe(true);
  expect(ReviewerSessionSchema.safeParse(studySession({ status: 'archived' })).success).toBe(true);
});

test('bookmark schema retains tombstones while enforcing pinned identity and timestamp order', () => {
  expect(BookmarkSchema.parse(studyBookmark({ deleted: true })).deleted).toBe(true);
  for (const change of [
    { questionId: 'other' },
    { uid: '' },
    { updatedAt: 99 },
    { createdAt: -1 },
    { serverRevision: -1 },
    { extra: true },
  ])
    expect(BookmarkSchema.safeParse({ ...studyBookmark(), ...change }).success).toBe(false);
});

const common = {
  id: 'operation-1',
  uid: owner.uid,
  deviceId: owner.deviceId,
  recordId: 'fixture-device_session',
  localSequence: 0,
  createdAt: 100,
  attempts: 0,
  nextAttemptAt: 100,
};
test('outbox discriminated payloads enforce owner, record and local sequence agreement', () => {
  const publish = { ...common, kind: 'publishSession', session: studySession() };
  const state = {
    ...common,
    kind: 'sessionState',
    state: { sequence: 0, position: 0, status: 'active', viewedOrdinals: [] },
  };
  const bookmark = {
    ...common,
    kind: 'bookmarkState',
    recordId: 'fixture-grammar',
    bookmark: studyBookmark(),
    baseRevision: 0,
  };
  for (const operation of [publish, state, bookmark]) {
    expect(StudyOperationSchema.safeParse(operation).success).toBe(true);
    for (const change of [
      { id: '../bad' },
      { localSequence: -1 },
      { attempts: 0.5 },
      { nextAttemptAt: Infinity },
      { extra: true },
    ])
      expect(StudyOperationSchema.safeParse({ ...operation, ...change }).success).toBe(false);
  }
  for (const change of [
    { uid: 'other' },
    { deviceId: 'other' },
    { recordId: 'other' },
    { localSequence: 1 },
  ])
    expect(StudyOperationSchema.safeParse({ ...publish, ...change }).success).toBe(false);
  expect(
    StudyOperationSchema.safeParse({ ...state, state: { ...state.state, sequence: 1 } }).success,
  ).toBe(false);
  expect(
    StudyOperationSchema.safeParse({ ...state, state: { ...state.state, viewedOrdinals: [0, 0] } })
      .success,
  ).toBe(false);
  for (const change of [{ uid: 'other' }, { recordId: 'other' }, { baseRevision: 1 }])
    expect(StudyOperationSchema.safeParse({ ...bookmark, ...change }).success).toBe(false);
});

test('conflict errors carry validated bookmark state and fixed user-facing messages', () => {
  const error = new BookmarkConflictError(studyBookmark({ serverRevision: 2 }));
  expect(error).toBeInstanceOf(StudyError);
  expect(error.code).toBe('conflict');
  expect(error.remote.serverRevision).toBe(2);
  expect(() => new BookmarkConflictError({ ...studyBookmark(), secret: 'SDK detail' })).toThrow();
  expect(new StudyError('network').message).toBe(
    'You appear to be offline. Please try again when connected.',
  );
});

test('malformed remote conflict state becomes a safe content error', () => {
  try {
    new BookmarkConflictError({ uid: 'raw SDK detail' });
    throw new Error('Expected rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(StudyError);
    expect((error as StudyError).code).toBe('invalid-content');
    expect((error as Error).message).toBe('This question could not be loaded. Please try again.');
  }
});

test('canonical JSON preserves array order, sorts nested keys and rejects values that cannot fingerprint safely', () => {
  expect(canonicalJson({ z: [{ b: 2, a: '😀' }], a: 1, omitted: undefined })).toBe(
    '{"a":1,"z":[{"a":"😀","b":2}]}',
  );
  expect(canonicalJson([2, 1])).toBe('[2,1]');
  for (const input of [
    undefined,
    NaN,
    { bad: Infinity },
    [undefined],
    Array(1),
    new Date(),
    () => 1,
  ])
    expect(() => canonicalJson(input)).toThrow();
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  expect(() => canonicalJson(cyclic)).toThrow();
});

test('payload byte size counts UTF-8 characters instead of JavaScript code units', () => {
  expect(jsonBytes({ text: 'é😀' })).toBe(17);
});
