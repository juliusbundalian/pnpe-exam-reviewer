import { studyCloudBackend as backend } from '../fixtures/studyCloudSdk';
import { FirebaseStudySyncRemote } from '../../src/features/study/data/FirebaseStudySyncRemote';
import {
  CloudSessionRootSchema,
  CloudManifestChunkSchema,
  CloudBookmarkSchema,
} from '../../src/features/study/data/cloudStudySchemas';
import { jsonBytes } from '../../src/core/content/Fingerprint';
import { owner, studySession, studyEntry, studyBookmark } from '../fixtures/study';

const root = `users/${owner.uid}/reviewerSessions/${studySession().id}`;
const bookmarkPath = `users/${owner.uid}/bookmarks/fixture-grammar`;

test('replayed_bookmark_operation_keeps_revision even after another operation', async () => {
  const { remote, documents } = backend();
  const first = await remote.writeBookmark(owner, studyBookmark(), 'op-one', 0);
  await remote.writeBookmark(owner, studyBookmark({ deleted: true }), 'op-two', 1);
  const second = await remote.writeBookmark(owner, studyBookmark(), 'op-one', 0);
  expect(second.revision).toEqual(first.revision);
  expect(documents.get(bookmarkPath)).toMatchObject({ deleted: true, serverRevision: 2 });
});
test('CAS conflict uses revision rather than clocks and downloads tombstones', async () => {
  const { remote } = backend();
  await remote.writeBookmark(owner, studyBookmark({ updatedAt: 900 }), 'first', 0);
  await expect(
    remote.writeBookmark(owner, studyBookmark({ updatedAt: 100 }), 'second', 0),
  ).rejects.toMatchObject({ code: 'conflict', remote: { serverRevision: 1 } });
  await remote.writeBookmark(owner, studyBookmark({ deleted: true }), 'second', 1);
  expect(await remote.listBookmarks(owner)).toEqual([
    studyBookmark({ deleted: true, serverRevision: 2 }),
  ]);
});
test('publication prepares then uploads bounded immutable chunks and only then publishes ready', async () => {
  const { remote, documents, writes } = backend();
  const session = studySession({
    catalogValidatedAt: 75,
    items: Array.from({ length: 205 }, (_, ordinal) => ({
      ordinal,
      entry: studyEntry({ id: `q-${ordinal}` }),
    })),
  });
  await remote.publishSession(owner, session, 'publish');
  expect(documents.get(root)).toMatchObject({
    ready: true,
    phase: 'ready',
    itemCount: 205,
    manifestChunkCount: 3,
    catalogValidatedAt: 75,
    createdAt: 100,
  });
  expect(writes[0]).toBe(root);
  expect(writes.at(-1)).toBe(root);
  const chunks = [...documents]
    .filter(([path]) => path.includes('/manifest/'))
    .map(([, data]) => CloudManifestChunkSchema.parse(data));
  expect(chunks.map((chunk) => chunk.items.length)).toEqual([100, 100, 5]);
  expect(chunks.every((chunk) => jsonBytes(chunk) <= 64 * 1024)).toBe(true);
  const count = writes.length;
  await remote.publishSession(owner, session, 'publish');
  expect(writes.length).toBe(count);
  await expect(
    remote.publishSession(owner, { ...session, catalogValidatedAt: 99 }, 'publish'),
  ).rejects.toMatchObject({ code: 'invalid-content' });
});
test('UTF8 byte bound flushes chunks before count limit and accepts established long question IDs', async () => {
  const { remote, documents } = backend();
  const session = studySession({
    items: Array.from({ length: 90 }, (_, ordinal) => ({
      ordinal,
      entry: studyEntry({ id: `q${ordinal}_${'a'.repeat(1490)}` }),
    })),
  });
  await remote.publishSession(owner, session, 'publish');
  const chunks = [...documents]
    .filter(([path]) => path.includes('/manifest/'))
    .map(([, data]) => CloudManifestChunkSchema.parse(data));
  expect(chunks.length).toBeGreaterThan(2);
  expect(chunks.every((chunk) => jsonBytes(chunk) <= 65536 && chunk.items.length <= 100)).toBe(
    true,
  );
});
test('owner switch after preparing leaves incomplete manifest unready', async () => {
  const { remote, documents, setBeforeCommit, switchOwner } = backend();
  let calls = 0;
  setBeforeCommit(() => {
    if (++calls === 2) switchOwner();
  });
  await expect(remote.publishSession(owner, studySession(), 'publish')).rejects.toMatchObject({
    code: 'auth-required',
  });
  expect(documents.get(root)).toMatchObject({ ready: false, phase: 'preparing' });
  expect([...documents.keys()].filter((path) => path.includes('/manifest/'))).toEqual([]);
});
test('out of order state never regresses sequence and viewed ordinal membership is idempotent', async () => {
  const { remote, documents, writes } = backend();
  await remote.publishSession(owner, studySession(), 'publish');
  await remote.writeSessionState(
    owner,
    studySession({ sequence: 2, position: 1, viewedOrdinals: [0] }),
    'state-two',
  );
  await remote.writeSessionState(
    owner,
    studySession({ sequence: 1, position: 0, viewedOrdinals: [0] }),
    'state-one',
  );
  expect(documents.get(root)).toMatchObject({ sequence: 2, position: 1, viewedCount: 1 });
  expect(documents.get(`${root}/items/0`)).toMatchObject({
    ordinal: 0,
    viewed: true,
    entry: { id: 'fixture-grammar' },
  });
  const count = writes.length;
  await remote.writeSessionState(
    owner,
    studySession({ sequence: 2, position: 1, viewedOrdinals: [0] }),
    'state-two',
  );
  expect(writes.length).toBe(count);
});
test('strict cloud documents reject content payloads oversized documents and unsafe generated IDs', () => {
  expect(
    CloudBookmarkSchema.safeParse({ ...studyBookmark(), lastOperationId: 'x'.repeat(129) }).success,
  ).toBe(false);
  expect(
    CloudBookmarkSchema.safeParse({ ...studyBookmark(), lastOperationId: 'op', answer: 'A' })
      .success,
  ).toBe(false);
  expect(CloudSessionRootSchema.safeParse({ prompt: 'secret' }).success).toBe(false);
  expect(
    CloudManifestChunkSchema.safeParse({
      items: Array.from({ length: 101 }, (_, ordinal) => ({ ordinal, entry: studyEntry() })),
    }).success,
  ).toBe(false);
});

test('state cannot change frozen metadata or write mismatched pinned items', async () => {
  const { remote, documents } = backend();
  await remote.publishSession(owner, studySession({ catalogValidatedAt: 75 }), 'publish');
  await expect(
    remote.writeSessionState(owner, studySession({ sequence: 1, catalogValidatedAt: 90 }), 'state'),
  ).rejects.toMatchObject({ code: 'invalid-content' });
  await expect(
    remote.writeSessionState(
      owner,
      studySession({
        sequence: 1,
        catalogValidatedAt: 75,
        viewedOrdinals: [0],
        items: [{ ordinal: 0, entry: studyEntry({ version: 2 }) }, studySession().items[1]!],
      }),
      'state',
    ),
  ).rejects.toMatchObject({ code: 'invalid-content' });
  expect(documents.has(`${root}/items/0`)).toBe(false);
});
test('partial upload resumes safely and publishes ready only after every chunk', async () => {
  const { sdk, remote, documents, setBeforeCommit } = backend();
  let calls = 0;
  setBeforeCommit(() => {
    if (++calls === 3) throw { code: 'unavailable' };
  });
  const session = studySession({
    items: Array.from({ length: 101 }, (_, ordinal) => ({
      ordinal,
      entry: studyEntry({ id: `q-${ordinal}` }),
    })),
  });
  await expect(remote.publishSession(owner, session, 'publish')).rejects.toMatchObject({
    code: 'network',
  });
  expect(documents.get(root)).toMatchObject({ ready: false, manifestChunkCount: 2 });
  expect(documents.has(`${root}/manifest/0`)).toBe(true);
  expect(documents.has(`${root}/manifest/1`)).toBe(false);
  setBeforeCommit(() => {});
  const restarted = new FirebaseStudySyncRemote(sdk, { isCurrent: () => true });
  await restarted.publishSession(owner, session, 'publish');
  expect(documents.get(root)).toMatchObject({ ready: true });
  expect(documents.has(`${root}/manifest/1`)).toBe(true);
});
test('oversized single-entry manifest fails before preparing and generated operation IDs stay bounded', async () => {
  const { remote, documents } = backend();
  const entry = studyEntry({
    supportedKinds: ['image'],
    assets: [{ id: 'asset', version: 1, uri: `https://example.test/${'a'.repeat(70000)}` }],
  });
  await expect(
    remote.publishSession(owner, studySession({ items: [{ ordinal: 0, entry }] }), 'publish'),
  ).rejects.toMatchObject({ code: 'invalid-content' });
  expect(documents.size).toBe(0);
  await expect(
    remote.writeBookmark(owner, studyBookmark(), 'x'.repeat(129), 0),
  ).rejects.toMatchObject({ code: 'invalid-content' });
});
test('bookmark polling pages beyond fifty rows including tombstones', async () => {
  const { remote } = backend();
  for (let i = 0; i < 51; i++)
    await remote.writeBookmark(
      owner,
      studyBookmark({
        questionId: `q-${String(i).padStart(2, '0')}`,
        entry: studyEntry({ id: `q-${String(i).padStart(2, '0')}` }),
        deleted: true,
      }),
      `op-${i}`,
      0,
    );
  const bookmarks = await remote.listBookmarks(owner);
  expect(bookmarks).toHaveLength(51);
  expect(bookmarks.at(-1)).toMatchObject({ questionId: 'q-50', deleted: true });
});
test('publication rejects progressed sessions', async () => {
  const { remote, documents } = backend();
  await expect(
    remote.publishSession(owner, studySession({ sequence: 1, viewedOrdinals: [0] }), 'publish'),
  ).rejects.toMatchObject({ code: 'invalid-content' });
  expect(documents.size).toBe(0);
});
test('preparing roots reject progressed state', async () => {
  const { remote, documents } = backend();
  await remote.publishSession(owner, studySession(), 'publish');
  const existing = documents.get(root) as Record<string, unknown>;
  expect(
    CloudSessionRootSchema.safeParse({ ...existing, ready: false, phase: 'preparing', sequence: 1 })
      .success,
  ).toBe(false);
});
