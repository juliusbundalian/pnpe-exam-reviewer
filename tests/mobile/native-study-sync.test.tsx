import type { Auth } from '@react-native-firebase/auth';
import type { Firestore } from '@react-native-firebase/firestore';
import { createNativeStudySyncRemote } from '../../src/features/study/data/nativeStudySyncFacade';
import { owner, studyBookmark, studySession } from '../fixtures/study';

class MockTimestamp {
  constructor(private readonly millis: number) {}
  toMillis() {
    return this.millis;
  }
  static fromMillis(millis: number) {
    return new MockTimestamp(millis);
  }
  static fromSecondsNanoseconds(seconds: number, nanoseconds: number) {
    return new MockTimestamp(seconds * 1000 + nanoseconds / 1e6);
  }
}
const mockFirestore = { marker: 'existing-firestore' };
const mockAuth = { currentUser: { uid: owner.uid } };
const mockRunTransaction = jest.fn();
const mockGetDocsFromServer = jest.fn();
const mockServerTimestamp = () => ({ serverTimestamp: true });
jest.mock('@react-native-firebase/firestore', () => ({
  doc: (instance: unknown, path: string) => ({ instance, path }),
  collection: (instance: unknown, path: string) => ({ instance, path }),
  documentId: () => 'document-id',
  orderBy: (field: unknown) => ({ orderBy: field }),
  startAfter: (id: string) => ({ startAfter: id }),
  limit: (count: number) => ({ limit: count }),
  query: (reference: unknown, ...constraints: unknown[]) => ({ reference, constraints }),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  getDocsFromServer: (...args: unknown[]) => mockGetDocsFromServer(...args),
  serverTimestamp: () => mockServerTimestamp(),
  get Timestamp() {
    return MockTimestamp;
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = { uid: owner.uid };
});
test('native adapter reuses services and separates local timestamps from server transport time', async () => {
  const records = new Map<string, Record<string, unknown>>();
  mockRunTransaction.mockImplementation(async (instance, action) => {
    expect(instance).toBe(mockFirestore);
    return action({
      get: async (reference: { path: string }) => ({ data: () => records.get(reference.path) }),
      set: (reference: { path: string }, fields: Record<string, unknown>) => {
        records.set(reference.path, fields);
      },
    });
  });
  const remote = await createNativeStudySyncRemote(
    mockFirestore as unknown as Firestore,
    mockAuth as unknown as Auth,
    { isCurrent: () => true },
  );
  expect(await remote.writeBookmark(owner, studyBookmark(), 'op', 0)).toEqual({
    revision: 1,
    appliedOperationId: 'op',
  });
  const stored = records.get(`users/${owner.uid}/bookmarks/fixture-grammar`)!;
  expect(stored.createdAt).toBeInstanceOf(MockTimestamp);
  expect((stored.createdAt as MockTimestamp).toMillis()).toBe(100);
  expect(stored.writtenAt).toEqual({ serverTimestamp: true });
  mockGetDocsFromServer.mockResolvedValue({
    docs: [
      {
        id: 'fixture-grammar',
        data: () => ({ ...stored, writtenAt: MockTimestamp.fromMillis(900) }),
      },
    ],
  });
  expect(await remote.listBookmarks(owner)).toEqual([studyBookmark({ serverRevision: 1 })]);
  expect(mockGetDocsFromServer.mock.calls[0]).toEqual([
    {
      reference: { instance: mockFirestore, path: `users/${owner.uid}/bookmarks` },
      constraints: [{ orderBy: 'document-id' }, { limit: 50 }],
    },
  ]);
});
test('each native transaction retry checks observed auth before using changed credentials', async () => {
  let valid = true,
    writes = 0;
  mockRunTransaction.mockImplementation(async (_instance, action) => {
    const tx = {
      get: async () => ({ data: () => undefined }),
      set: () => {
        writes++;
      },
    };
    await action(tx);
    mockAuth.currentUser = { uid: 'bob' };
    valid = false;
    return action(tx);
  });
  const remote = await createNativeStudySyncRemote(
    mockFirestore as unknown as Firestore,
    mockAuth as unknown as Auth,
    { isCurrent: () => valid },
  );
  await expect(remote.writeBookmark(owner, studyBookmark(), 'op', 0)).rejects.toMatchObject({
    code: 'auth-required',
  });
  expect(writes).toBe(2); // only the first callback's bookmark + immutable receipt
});
test('owner change during native get prevents every transaction write', async () => {
  let writes = 0;
  mockRunTransaction.mockImplementation(async (_instance, action) =>
    action({
      get: async () => {
        mockAuth.currentUser = { uid: 'bob' };
        return { data: () => undefined };
      },
      set: () => {
        writes++;
      },
    }),
  );
  const remote = await createNativeStudySyncRemote(
    mockFirestore as unknown as Firestore,
    mockAuth as unknown as Auth,
    { isCurrent: () => true },
  );
  await expect(remote.writeBookmark(owner, studyBookmark(), 'op', 0)).rejects.toMatchObject({
    code: 'auth-required',
  });
  expect(writes).toBe(0);
});

test('nonaligned server nanoseconds decode for bookmark polling and immutable receipt replay', async () => {
  const writtenAt = MockTimestamp.fromSecondsNanoseconds(1, 1000);
  const stored = {
    ...studyBookmark({ serverRevision: 1 }),
    createdAt: MockTimestamp.fromMillis(100),
    updatedAt: MockTimestamp.fromMillis(100),
    lastOperationId: 'op',
    writtenAt,
  };
  mockGetDocsFromServer.mockResolvedValue({
    docs: [{ id: 'fixture-grammar', data: () => stored }],
  });
  let writes = 0;
  mockRunTransaction.mockImplementation(async (_instance, action) =>
    action({
      get: async () => ({
        data: () => ({
          uid: owner.uid,
          questionId: 'fixture-grammar',
          operationId: 'op',
          revision: 1,
          writtenAt,
        }),
      }),
      set: () => {
        writes++;
      },
    }),
  );
  const remote = await createNativeStudySyncRemote(
    mockFirestore as unknown as Firestore,
    mockAuth as unknown as Auth,
    { isCurrent: () => true },
  );
  expect(await remote.listBookmarks(owner)).toEqual([studyBookmark({ serverRevision: 1 })]);
  expect(await remote.writeBookmark(owner, studyBookmark(), 'op', 0)).toEqual({
    revision: 1,
    appliedOperationId: 'op',
  });
  expect(writes).toBe(0);
});

test('nonaligned server nanoseconds decode during preparing chunk and ready transactions', async () => {
  const records = new Map<string, Record<string, unknown>>();
  mockRunTransaction.mockImplementation(async (_instance, action) =>
    action({
      get: async (reference: { path: string }) => ({ data: () => records.get(reference.path) }),
      set: (reference: { path: string }, fields: Record<string, unknown>) => {
        records.set(reference.path, {
          ...fields,
          writtenAt: MockTimestamp.fromSecondsNanoseconds(2, 1234567),
        });
      },
    }),
  );
  const remote = await createNativeStudySyncRemote(
    mockFirestore as unknown as Firestore,
    mockAuth as unknown as Auth,
    { isCurrent: () => true },
  );
  await remote.publishSession(owner, studySession(), 'publish');
  await remote.writeSessionState(
    owner,
    studySession({ sequence: 1, viewedOrdinals: [0] }),
    'state',
  );
  expect(records.get(`users/${owner.uid}/reviewerSessions/${studySession().id}`)).toMatchObject({
    ready: true,
    sequence: 1,
    viewedCount: 1,
  });
});

test.each(['createdAt', 'updatedAt'] as const)(
  'fractional local %s remains invalid instead of being rounded',
  async (field) => {
    mockGetDocsFromServer.mockResolvedValue({
      docs: [
        {
          id: 'fixture-grammar',
          data: () => ({
            ...studyBookmark({ serverRevision: 1 }),
            createdAt: MockTimestamp.fromMillis(100),
            updatedAt: MockTimestamp.fromMillis(1000),
            lastOperationId: 'op',
            writtenAt: MockTimestamp.fromSecondsNanoseconds(1, 1000),
            [field]: MockTimestamp.fromSecondsNanoseconds(0, 100001000),
          }),
        },
      ],
    });
    const remote = await createNativeStudySyncRemote(
      mockFirestore as unknown as Firestore,
      mockAuth as unknown as Auth,
      { isCurrent: () => true },
    );
    await expect(remote.listBookmarks(owner)).rejects.toMatchObject({ code: 'invalid-content' });
  },
);
