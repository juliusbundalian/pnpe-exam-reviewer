import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { BookmarksScreen } from '../../src/features/bookmarks/presentation/BookmarksScreen';
import { studyBookmark } from '../fixtures/study';
import { StudyError, type Bookmark } from '../../src/features/study/domain/study';
import { AppState, type AppStateStatus } from 'react-native';
import {
  composeStudyDependencies,
  type AuthOwnerSource,
} from '../../src/bootstrap/studyComposition';
import type { NativeServices } from '../../src/core/firebase/native';
import { nodeSqlDatabase } from '../fixtures/nodeSqlDatabase';
import { migrateStudyDatabase } from '../../src/core/storage/sqlite/studyMigrations';
import {
  studyEntry,
  studyQuestion as mockQuestion,
  generation as mockGeneration,
} from '../fixtures/study';
import type { SqlDatabase } from '../../src/core/storage/sqlite/SqlDatabase';
import { deferred } from '../fixtures/auth-harness';
import { defaults } from '../../src/core/config/defaults';

const mockEntry = studyEntry;
let mockDb: SqlDatabase;
let mockOpen: Promise<SqlDatabase>;
let mockIds = 0;
let mockWrites: string[] = [];
let mockBookmarks: Bookmark[] = [];
let mockDownloads = 0;
let mockDownloadFailure: StudyError | null = null;
let mockDownloadWait: Promise<void> | null = null;
const mockWakeListeners = new Set<(state: AppStateStatus) => void>();
jest.mock('../../src/core/storage/sqlite/nativeSqlDatabase', () => ({
  openNativeStudyDatabase: () => mockOpen,
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => `id-${++mockIds}`,
  getRandomValues: (value: Uint32Array) => value,
  digestStringAsync: async (_algorithm: unknown, value: string) => value,
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
}));
jest.mock('../../src/features/content/data/nativeContentFacade', () => ({
  createNativeContentRemote: async () => ({
    readHead: async () => ({ generation: mockGeneration, revision: 1 }),
    listShards: async () => [{ id: 'shard', entries: [mockEntry()] }],
    revision: async () => mockQuestion(),
  }),
}));
jest.mock('../../src/features/study/data/nativeStudySyncFacade', () => ({
  createNativeStudySyncRemote: async () => ({
    publishSession: async () => {
      mockWrites.push('session');
    },
    writeSessionState: async () => {
      mockWrites.push('state');
    },
    writeBookmark: async (_owner: unknown, _bookmark: unknown, id: string, base: number) => {
      mockWrites.push('bookmark');
      return { revision: base + 1, appliedOperationId: id };
    },
    listBookmarks: async () => {
      mockDownloads++;
      await mockDownloadWait;
      if (mockDownloadFailure) throw mockDownloadFailure;
      return mockBookmarks;
    },
  }),
}));
jest.mock('../../src/features/exam/data/nativeExamFacade', () => ({
  createNativeExamRemote: async () => ({
    publish: async () => {},
    history: async () => [],
    result: async () => {
      throw new Error('No remote exam');
    },
  }),
}));
beforeEach(async () => {
  mockDb = nodeSqlDatabase(':memory:');
  await migrateStudyDatabase(mockDb);
  mockOpen = Promise.resolve(mockDb);
  mockIds = 0;
  mockWrites = [];
  mockBookmarks = [];
  mockDownloads = 0;
  mockDownloadFailure = null;
  mockDownloadWait = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') mockWakeListeners.add(listener);
    return {
      remove: () => {
        mockWakeListeners.delete(listener);
      },
    };
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  mockWakeListeners.clear();
});
const native = {
  available: true,
  auth: {},
  firestore: {},
  remoteConfigMode: 'emulator-defaults-not-live',
  remoteConfig: { fetch: async () => ({}) },
} as NativeServices;
function source() {
  let current: { uid: string; epoch: number } | null = { uid: 'alice', epoch: 1 };
  let bookmarks = true,
    starts = true;
  const owner: AuthOwnerSource = {
    current: () => current,
    bookmarksEnabled: () => bookmarks,
    startAllowed: () => starts,
  };
  return {
    owner,
    switch() {
      current = { uid: 'bob', epoch: 2 };
    },
    disable() {
      bookmarks = false;
      starts = false;
    },
  };
}
test('native lazy graph reuses durable installation identity, flushes local mutations and owns foreground disposal', async () => {
  await mockDb.run('INSERT INTO device_identity (singleton, device_id) VALUES (1, ?)', [
    'persisted-device',
  ]);
  const auth = source();
  const study = await composeStudyDependencies(native, auth.owner);
  const wake = jest.spyOn(study.sync, 'wake');
  const flush = jest.spyOn(study.sync, 'flush');
  expect(study.owner).toEqual({ uid: 'alice', epoch: 1, deviceId: 'persisted-device' });
  const created = await study.reviewer.prepare(
    study.owner,
    { categoryId: 'communicationSkills' },
    false,
  );
  expect(created.kind).toBe('ready');
  await study.sync.flush();
  expect(mockWrites).toContain('session');
  expect(flush).toHaveBeenCalled();
  expect(wake).not.toHaveBeenCalled();
  await study.bookmarks.toggle(study.owner, studyEntry());
  await study.sync.flush();
  expect(mockWrites).toContain('bookmark');
  mockWakeListeners.forEach((listener) => listener('active'));
  expect(wake).toHaveBeenCalledTimes(1);
  auth.disable();
  await expect(study.bookmarks.toggle(study.owner, studyEntry())).rejects.toMatchObject({
    code: 'permission-denied',
  });
  await expect(
    study.reviewer.replace(study.owner, { categoryId: 'communicationSkills' }, false),
  ).rejects.toMatchObject({ code: 'permission-denied' });
  study.dispose();
  expect(mockWakeListeners.size).toBe(0);
  expect(study.guard.isCurrent(study.owner)).toBe(false);
});

test('protected composition wires exam storage and checks the live new-start gate', async () => {
  const auth = source();
  const study = await composeStudyDependencies(native, auth.owner);
  expect(await study.examRepository.active(study.owner)).toBeNull();
  expect(study.examSync.status().pendingCount).toBe(0);
  auth.disable();
  await expect(study.exam.start(study.owner, defaults.config.mockExam)).rejects.toMatchObject({
    code: 'permission-denied',
  });
  expect(await study.examRepository.active(study.owner)).toBeNull();
  study.dispose();
});
test('auth change while native storage opens rejects the old composition and closes its connection', async () => {
  const gate = deferred<SqlDatabase>();
  mockOpen = gate.promise;
  const auth = source();
  const promise = composeStudyDependencies(native, auth.owner);
  const rejected = expect(promise).rejects.toMatchObject({ code: 'auth-required' });
  auth.switch();
  gate.resolve(mockDb);
  await rejected;
  await expect(mockDb.all('SELECT 1')).rejects.toBeDefined();
});

test.each(['queued', 'precommit'] as const)(
  'maintenance changed at %s prevents activation and retains prior session plus outbox',
  async (boundary) => {
    const auth = source();
    const study = await composeStudyDependencies(native, auth.owner);
    const prepared = await study.reviewer.prepare(
      study.owner,
      { categoryId: 'communicationSkills' },
      false,
    );
    await study.sync.flush();
    study.sync.stop();
    const previous = await study.repository.active(study.owner);
    const before = await study.repository.pending(study.owner, Number.MAX_SAFE_INTEGER);
    const entered = deferred<void>(),
      release = deferred<void>();
    let held = Promise.resolve();
    const exclusive = mockDb.exclusive.bind(mockDb);
    if (boundary === 'queued') {
      held = mockDb.exclusive(async () => {
        entered.resolve();
        await release.promise;
      });
      await entered.promise;
    } else {
      let inserts = 0;
      mockDb.exclusive = (work, check) =>
        exclusive(
          (tx) =>
            work({
              ...tx,
              run: async (sql, params) => {
                const result = await tx.run(sql, params);
                if (sql.startsWith('INSERT INTO study_outbox') && ++inserts === 2) {
                  entered.resolve();
                  await release.promise;
                }
                return result;
              },
            }),
          check,
        );
    }
    const replacement = study.repository.replaceActive(study.owner, {
      ...prepared.session,
      id: 'replacement',
    });
    const rejected = expect(replacement).rejects.toMatchObject({ code: 'permission-denied' });
    if (boundary === 'precommit') await entered.promise;
    auth.disable();
    release.resolve();
    await held;
    await rejected;
    mockDb.exclusive = exclusive;
    expect(await study.repository.active(study.owner)).toEqual(previous);
    expect(await study.repository.session(study.owner, 'replacement')).toBeNull();
    expect(await study.repository.pending(study.owner, Number.MAX_SAFE_INTEGER)).toEqual(before);
    expect(await study.reviewer.resume(study.owner, prepared.session.id)).toEqual(previous);
    study.dispose();
  },
);

test('user Refresh awaits a new owner-bound cloud download then reloads local bookmarks', async () => {
  mockBookmarks = [studyBookmark({ uid: 'alice', serverRevision: 1 })];
  const auth = source();
  const study = await composeStudyDependencies(native, auth.owner);
  await study.sync.flush();
  render(
    <ThemeProvider>
      <BookmarksScreen service={study.bookmarks} owner={study.owner} onBack={() => {}} />
    </ThemeProvider>,
  );
  await screen.findByRole('button', { name: 'Remove fixture-grammar' });
  const before = mockDownloads;
  mockBookmarks = [studyBookmark({ uid: 'alice', serverRevision: 2, deleted: true })];
  fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByText('No bookmarks yet.');
  expect(mockDownloads).toBeGreaterThan(before);
  expect(await study.repository.listBookmarks(study.owner)).toEqual(mockBookmarks);
  study.dispose();
});

test('offline Refresh leaves local bookmarks usable and permission recovery is retryable', async () => {
  mockBookmarks = [studyBookmark({ uid: 'alice', serverRevision: 1 })];
  const auth = source();
  const study = await composeStudyDependencies(native, auth.owner);
  await study.sync.flush();
  render(
    <ThemeProvider>
      <BookmarksScreen service={study.bookmarks} owner={study.owner} onBack={() => {}} />
    </ThemeProvider>,
  );
  await screen.findByRole('button', { name: 'Remove fixture-grammar' });
  mockDownloadFailure = new StudyError('network');
  fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Open fixture-grammar' })).toBeEnabled(),
  );
  mockDownloadFailure = new StudyError('permission-denied');
  fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByText(mockDownloadFailure.message);
  expect(screen.getByRole('button', { name: 'Open fixture-grammar' })).toBeDisabled();
  mockDownloadFailure = null;
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Open fixture-grammar' })).toBeEnabled(),
  );
  study.dispose();
});

test('owner change during Refresh discards downloaded personal state', async () => {
  const auth = source();
  const study = await composeStudyDependencies(native, auth.owner);
  await study.sync.flush();
  const release = deferred<void>();
  mockDownloadWait = release.promise;
  mockBookmarks = [studyBookmark({ uid: 'alice', serverRevision: 1 })];
  const before = mockDownloads;
  const refresh = study.bookmarks.refresh(study.owner);
  const rejected = expect(refresh).rejects.toMatchObject({ code: 'auth-required' });
  await waitFor(() => expect(mockDownloads).toBeGreaterThan(before));
  auth.switch();
  release.resolve();
  await rejected;
  expect(await mockDb.all('SELECT * FROM bookmarks')).toEqual([]);
  study.dispose();
});
