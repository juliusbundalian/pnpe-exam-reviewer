import { studyCloudBackend } from '../fixtures/studyCloudSdk';
import { StudySyncWorker } from '../../src/features/study/application/StudySyncWorker';
import { BookmarkService } from '../../src/features/bookmarks/application/BookmarkService';
import { owner, studyEntry, studySession, studyBookmark } from '../fixtures/study';
import { deferred, reviewerHarness } from '../fixtures/reviewer';
import { StudyError } from '../../src/features/study/domain/study';

let h: Awaited<ReturnType<typeof reviewerHarness>>;
let bookmarks: BookmarkService;
beforeEach(async () => {
  h = await reviewerHarness();
  bookmarks = new BookmarkService(h.study, h.content, h.guard);
});
afterEach(async () => {
  await h.db.close();
});

test('persists a pinned revision and tombstones removal; restoring retains the original pin', async () => {
  const entry = studyEntry();
  await bookmarks.toggle(owner, entry);
  expect(await bookmarks.list(owner)).toEqual([expect.objectContaining({ entry, deleted: false })]);
  await bookmarks.toggle(owner, studyEntry({ version: 2 }));
  expect(await bookmarks.list(owner)).toEqual([]);
  expect(await h.study.listBookmarks(owner)).toEqual([
    expect.objectContaining({ entry, deleted: true }),
  ]);
  await bookmarks.toggle(owner, studyEntry({ version: 3 }));
  expect(await bookmarks.open(owner, entry.id)).toMatchObject({ id: entry.id, version: 1 });
  expect(await bookmarks.list(owner)).toEqual([
    expect.objectContaining({ entry, createdAt: 1000 }),
  ]);
});

test('rapid toggles persist in invocation order with durable desired operations', async () => {
  const results = await Promise.all(
    Array.from({ length: 5 }, () => bookmarks.toggle(owner, studyEntry())),
  );
  expect(results.map((item) => item.deleted)).toEqual([false, true, false, true, false]);
  expect((await h.study.pending(owner, 1000)).map((op) => op.localSequence)).toEqual([
    1, 2, 3, 4, 5,
  ]);
});

test('failed outbox insert rolls back bookmark removal and the next toggle can retry', async () => {
  await bookmarks.toggle(owner, studyEntry());
  const before = await h.study.listBookmarks(owner);
  const pending = await h.study.pending(owner, 1000);
  await h.db.run(
    "CREATE TEMP TRIGGER fail_bookmark BEFORE INSERT ON study_outbox BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
  );
  await expect(bookmarks.toggle(owner, studyEntry())).rejects.toMatchObject({
    code: 'storage-unavailable',
  });
  expect(await h.study.listBookmarks(owner)).toEqual(before);
  expect(await h.study.pending(owner, 1000)).toEqual(pending);
  await h.db.run('DROP TRIGGER fail_bookmark');
  expect((await bookmarks.toggle(owner, studyEntry())).deleted).toBe(true);
});

test('opening_bookmark_does_not_change_reviewer', async () => {
  const alice = owner;
  const entry = studyEntry();
  const { study, clock } = h;
  await study.replaceActive(alice, studySession());
  await bookmarks.toggle(alice, entry);
  const before = await study.active(alice);
  const beforePending = await study.pending(alice, clock.now());
  await bookmarks.open(alice, entry.id);
  expect(await study.active(alice)).toEqual(before);
  expect(await study.pending(alice, clock.now())).toEqual(beforePending);
});

test('opening with no Reviewer never creates a session; missing content preserves its bookmark', async () => {
  await bookmarks.toggle(owner, studyEntry());
  const pending = await h.study.pending(owner, 1000);
  jest.spyOn(h.content, 'question').mockRejectedValueOnce(new StudyError('network'));
  await expect(bookmarks.open(owner, 'fixture-grammar')).rejects.toMatchObject({ code: 'network' });
  expect(await bookmarks.list(owner)).toHaveLength(1);
  await bookmarks.open(owner, 'fixture-grammar');
  expect(await h.study.active(owner)).toBeNull();
  expect(await h.study.pending(owner, 1000)).toEqual(pending);
});

test('another owner cannot open a saved pin and a stale owner cannot access it', async () => {
  await bookmarks.toggle(owner, studyEntry());
  const bob = { ...owner, uid: 'bob', epoch: 2 };
  h.switchOwner(bob);
  await expect(bookmarks.open(owner, 'fixture-grammar')).rejects.toMatchObject({
    code: 'auth-required',
  });
  expect(await bookmarks.list(bob)).toEqual([]);
  await expect(bookmarks.open(bob, 'fixture-grammar')).rejects.toMatchObject({
    code: 'invalid-content',
  });
});

test('owner change while reading rejects delayed personal content', async () => {
  await bookmarks.toggle(owner, studyEntry());
  const page = deferred<Awaited<ReturnType<typeof h.content.question>>>();
  jest.spyOn(h.content, 'question').mockReturnValueOnce(page.promise);
  const read = bookmarks.open(owner, 'fixture-grammar');
  await new Promise((resolve) => setImmediate(resolve));
  h.switchOwner({ ...owner, epoch: 2 });
  page.resolve(await h.content.question({ ...owner, epoch: 2 }, studyEntry()));
  await expect(read).rejects.toMatchObject({ code: 'auth-required' });
});

test('new catalog never replaces a saved revision and malformed fetched revisions reject', async () => {
  await bookmarks.toggle(owner, studyEntry());
  h.catalog.entries = [studyEntry({ version: 7 })];
  expect((await bookmarks.open(owner, 'fixture-grammar')).version).toBe(1);
  jest
    .spyOn(h.content, 'question')
    .mockResolvedValueOnce({ ...(await h.content.question(owner, studyEntry())), version: 7 });
  await expect(bookmarks.open(owner, 'fixture-grammar')).rejects.toMatchObject({
    code: 'invalid-content',
  });
  expect((await bookmarks.list(owner))[0]?.entry.version).toBe(1);
});

test('pending includes delayed durable retries and clears only after acknowledgement', async () => {
  await bookmarks.toggle(owner, studyEntry());
  const operation = (await h.study.pending(owner, 1000))[0]!;
  await h.study.retry(owner, operation.id, 9999999);
  expect(await bookmarks.pending(owner)).toEqual(['fixture-grammar']);
  await h.study.acknowledge(owner, operation.id, 1);
  expect(await bookmarks.pending(owner)).toEqual([]);
});

test('disabled gate at queued execution rejects mutation while reads remain available', async () => {
  await bookmarks.toggle(owner, studyEntry());
  let enabled = true;
  bookmarks = new BookmarkService(h.study, h.content, h.guard, () => enabled);
  const pending = await h.study.pending(owner, 1000);
  const toggle = bookmarks.toggle(owner, studyEntry());
  enabled = false;
  await expect(toggle).rejects.toMatchObject({ code: 'permission-denied' });
  expect(await h.study.pending(owner, 1000)).toEqual(pending);
  expect(await bookmarks.list(owner)).toHaveLength(1);
  expect((await bookmarks.open(owner, 'fixture-grammar')).version).toBe(1);
});

test('stale queued epoch cannot mutate or block a current epoch toggle', async () => {
  const stale = bookmarks.toggle(owner, studyEntry());
  const current = { ...owner, epoch: 2 };
  h.switchOwner(current);
  const fresh = bookmarks.toggle(current, studyEntry());
  await expect(stale).rejects.toMatchObject({ code: 'auth-required' });
  expect((await fresh).deleted).toBe(false);
  expect(await bookmarks.pending(current)).toEqual(['fixture-grammar']);
});

test('gate changing during the row read appends no mutation', async () => {
  await bookmarks.toggle(owner, studyEntry());
  let enabled = true;
  bookmarks = new BookmarkService(h.study, h.content, h.guard, () => enabled);
  const rows = await h.study.listBookmarks(owner);
  const delayed = deferred<typeof rows>();
  const pending = await h.study.pending(owner, 1000);
  jest.spyOn(h.study, 'listBookmarks').mockReturnValueOnce(delayed.promise);
  const toggle = bookmarks.toggle(owner, studyEntry());
  await new Promise((resolve) => setImmediate(resolve));
  enabled = false;
  delayed.resolve(rows);
  await expect(toggle).rejects.toMatchObject({ code: 'permission-denied' });
  expect(await h.study.pending(owner, 1000)).toEqual(pending);
  expect(await h.study.listBookmarks(owner)).toEqual(rows);
});

test('permission errors opening content remain recovery errors and preserve saved state', async () => {
  await bookmarks.toggle(owner, studyEntry());
  jest.spyOn(h.content, 'question').mockRejectedValueOnce(new StudyError('permission-denied'));
  await expect(bookmarks.open(owner, 'fixture-grammar')).rejects.toMatchObject({
    code: 'permission-denied',
  });
  expect(await bookmarks.list(owner)).toHaveLength(1);
});

test('gate disabled while the bookmark transaction waits behind SQLite changes no durable state', async () => {
  await bookmarks.toggle(owner, studyEntry());
  const before = await h.study.listBookmarks(owner);
  const beforePending = await h.study.pending(owner, 1000);
  let enabled = true;
  bookmarks = new BookmarkService(h.study, h.content, h.guard, () => enabled);
  const release = deferred<void>();
  const blockerEntered = deferred<void>();
  const mutationQueued = deferred<void>();
  const list = h.study.listBookmarks.bind(h.study);
  const set = h.study.setBookmark.bind(h.study);
  let blocker!: Promise<void>;
  jest.spyOn(h.study, 'listBookmarks').mockImplementationOnce(async (candidate) => {
    const rows = await list(candidate);
    // The actual SQL read completes before an unrelated transaction takes the connection.
    blocker = h.db.exclusive(async () => {
      blockerEntered.resolve();
      await release.promise;
    });
    return rows;
  });
  jest.spyOn(h.study, 'setBookmark').mockImplementation((...args) => {
    const result = set(...args);
    mutationQueued.resolve();
    return result;
  });
  const toggle = bookmarks.toggle(owner, studyEntry());
  await Promise.all([blockerEntered.promise, mutationQueued.promise]);
  enabled = false;
  release.resolve();
  await blocker;
  await expect(toggle).rejects.toMatchObject({ code: 'permission-denied' });
  expect(await h.study.listBookmarks(owner)).toEqual(before);
  expect(await h.study.pending(owner, 1000)).toEqual(beforePending);
});

test('gate disabled after SQL writes but before commit rolls back bookmark and outbox together', async () => {
  await bookmarks.toggle(owner, studyEntry());
  const before = await h.study.listBookmarks(owner);
  const beforePending = await h.study.pending(owner, 1000);
  let enabled = true;
  bookmarks = new BookmarkService(h.study, h.content, h.guard, () => enabled);
  const release = deferred<void>();
  const inserted = deferred<void>();
  const exclusive = h.db.exclusive.bind(h.db);
  jest.spyOn(h.db, 'exclusive').mockImplementation((work, beforeCommit) =>
    exclusive(
      (tx) =>
        work({
          ...tx,
          run: async (sql, params) => {
            const result = await tx.run(sql, params);
            if (sql.startsWith('INSERT INTO study_outbox')) {
              inserted.resolve();
              await release.promise;
            }
            return result;
          },
        }),
      beforeCommit,
    ),
  );
  const toggle = bookmarks.toggle(owner, studyEntry());
  await inserted.promise;
  enabled = false;
  release.resolve();
  await expect(toggle).rejects.toMatchObject({ code: 'permission-denied' });
  expect(await h.study.listBookmarks(owner)).toEqual(before);
  expect(await h.study.pending(owner, 1000)).toEqual(beforePending);
});

test('explicit saved intent preserves the original pin across background merges', async () => {
  await h.study.mergeRemoteBookmark(owner, studyBookmark({ serverRevision: 1 }));
  await bookmarks.setSaved(owner, studyEntry({ version: 2 }), true);
  expect(await bookmarks.list(owner)).toEqual([
    expect.objectContaining({ entry: studyEntry(), deleted: false }),
  ]);
  expect((await h.study.pending(owner, 1000))[0]).toMatchObject({
    bookmark: { entry: studyEntry(), deleted: false },
  });
});

test.each([false, true])(
  'explicit intent survives cross-device sync merge (initial saved %s)',
  async (initiallySaved) => {
    const cloud = studyCloudBackend(h.guard);
    const original = studyBookmark({ deleted: !initiallySaved });
    await cloud.remote.writeBookmark(owner, original, 'device-one', 0);
    const worker = new StudySyncWorker(h.study, cloud.remote, h.clock, h.guard);
    try {
      worker.start(owner);
      await worker.flush();
      const displayedSaved = (await bookmarks.list(owner)).length > 0;
      expect(displayedSaved).toBe(initiallySaved);
      await cloud.remote.writeBookmark(
        owner,
        { ...original, deleted: initiallySaved, serverRevision: 1 },
        'device-two',
        1,
      );
      worker.wake();
      await worker.flush();
      await bookmarks.setSaved(owner, studyEntry({ version: 2 }), !displayedSaved);
      expect((await h.study.pending(owner, 1000))[0]).toMatchObject({
        bookmark: { deleted: initiallySaved, entry: studyEntry() },
      });
      await worker.flush();
      expect(await cloud.remote.listBookmarks(owner)).toEqual([
        expect.objectContaining({
          deleted: initiallySaved,
          entry: studyEntry(),
          serverRevision: 3,
        }),
      ]);
    } finally {
      worker.stop();
    }
  },
);
