import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  setLogLevel,
} from 'firebase/firestore';
import { integrationEnvironment } from '../fixtures/integrationEnvironment';
import { CloudManifestChunkSchema } from '../../src/features/study/data/cloudStudySchemas';
import { studyEntry } from '../fixtures/study';
const target = integrationEnvironment(process.env);
let env: RulesTestEnvironment;
const root = 'users/alice/reviewerSessions/device_session';
const pin = 'users/alice/bookmarks/question';
const db = () => env.authenticatedContext('alice').firestore();
const entry = () =>
  studyEntry({
    id: 'question',
    publishedAt: '2026-10-08T00:00:00Z',
    asOfDate: '2026-10-08',
    expiresAt: '2027-10-08T00:00:00Z',
  });
const rootData = () => ({
  uid: 'alice',
  deviceId: 'device',
  sessionId: 'device_session',
  scope: { categoryId: 'communicationSkills' },
  generation: 'a'.repeat(64),
  catalogValidatedAt: 100,
  createdAt: Timestamp.fromMillis(100),
  shuffleQuestions: true,
  manifestChunkCount: 1,
  itemCount: 2,
  publicationOperationId: 'publish',
  lastOperationId: 'publish',
  phase: 'preparing',
  ready: false,
  sequence: 0,
  position: 0,
  viewedCount: 0,
  status: 'active',
  writtenAt: serverTimestamp(),
});
const chunk = () => ({
  uid: 'alice',
  deviceId: 'device',
  sessionId: 'device_session',
  index: 0,
  items: [
    { ordinal: 0, entry: entry() },
    { ordinal: 1, entry: entry() },
  ],
  writtenAt: serverTimestamp(),
});
async function preparing() {
  await assertSucceeds(setDoc(doc(db(), root), rootData()));
}
async function ready() {
  await preparing();
  await setDoc(doc(db(), `${root}/manifest/0`), chunk());
  await updateDoc(doc(db(), root), { phase: 'ready', ready: true, writtenAt: serverTimestamp() });
}
async function bookmark(revision = 1, deleted = false, extra: Record<string, unknown> = {}) {
  const database = db(),
    oid = `op${revision}`;
  const batch = writeBatch(database);
  batch.set(doc(database, pin), {
    uid: 'alice',
    questionId: 'question',
    entry: entry(),
    createdAt: Timestamp.fromMillis(100),
    updatedAt: Timestamp.fromMillis(200),
    deleted,
    serverRevision: revision,
    lastOperationId: oid,
    writtenAt: serverTimestamp(),
    ...extra,
  });
  batch.set(doc(database, `${pin}/operations/${oid}`), {
    uid: 'alice',
    questionId: 'question',
    operationId: oid,
    revision,
    writtenAt: serverTimestamp(),
  });
  return batch.commit();
}
beforeAll(async () => {
  setLogLevel('error');
  env = await initializeTestEnvironment({
    projectId: target.projectId,
    firestore: {
      host: target.firestoreHost,
      port: target.firestorePort,
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
});
afterAll(async () => {
  if (env) {
    await env.clearFirestore();
    await env.cleanup();
  }
});

test('owner publishes the supported maximum full two-entry immutable metadata chunk', async () => {
  await preparing();
  const full = chunk();
  full.items = full.items.map(({ ordinal }) => ({
    ordinal,
    entry: studyEntry({
      id: `q${ordinal}_${'a'.repeat(1497)}`,
      stimulus: { id: 's'.repeat(1500), version: Number.MAX_SAFE_INTEGER },
      version: Number.MAX_SAFE_INTEGER,
      categoryId: 'generalInformation',
      subcategoryId: 'currentEvents',
      isCurrentEvent: true,
      publishedAt: '2026-10-08T00:00:00.123456789+00:00',
      expiresAt: '2027-10-08T00:00:00.123456789+00:00',
      asOfDate: '2026-10-08',
    }),
  }));
  expect(CloudManifestChunkSchema.safeParse({ ...full, writtenAt: 0 }).success).toBe(true);
  await assertSucceeds(setDoc(doc(db(), `${root}/manifest/0`), full));
  await assertFails(updateDoc(doc(db(), `${root}/manifest/0`), { writtenAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db(), `${root}/manifest/0`)));
});
test.each([0, 1])('malformed nested entry at position %i is rejected', async (index) => {
  await preparing();
  for (const bad of [
    { ...entry(), answer: 'A' },
    { ...entry(), version: 0 },
    { ...entry(), stimulus: { id: 'x', version: 1, prompt: 'secret' } },
    { ...entry(), categoryId: 'criticalThinking' },
    { ...entry(), supportedKinds: ['text', 'text'] },
    { ...entry(), supportedKinds: ['table'] },
    { ...entry(), assets: [{ id: 'asset', version: 1, uri: 'https://example.test/a' }] },
    { ...entry(), publishedAt: 3 },
    { ...entry(), asOfDate: '2026-99-44' },
  ]) {
    const value = chunk();
    value.items[index] = { ordinal: index, entry: bad as ReturnType<typeof entry> };
    await assertFails(setDoc(doc(db(), `${root}/manifest/0`), value));
  }
});
test('chunk count, index, ordinal, identity, keys and server-write bounds are enforced', async () => {
  await preparing();
  for (const fields of [
    { items: [] },
    { items: [...chunk().items, { ordinal: 2, entry: entry() }] },
    { index: 1 },
    { deviceId: 'other' },
    { uid: 'bob' },
    { sessionId: 'other' },
    { extra: 1 },
    { writtenAt: Timestamp.fromMillis(1) },
    {
      items: [
        { ordinal: 0, entry: entry() },
        { ordinal: 0, entry: entry() },
      ],
    },
    { items: [{ ordinal: 2, entry: entry() }] },
  ])
    await assertFails(setDoc(doc(db(), `${root}/manifest/0`), { ...chunk(), ...fields }));
  await assertFails(setDoc(doc(db(), `${root}/manifest/00`), chunk()));
  await setDoc(doc(db(), `${root}/manifest/0`), chunk());
  await updateDoc(doc(db(), root), { phase: 'ready', ready: true, writtenAt: serverTimestamp() });
  await assertFails(setDoc(doc(db(), `${root}/manifest/1`), { ...chunk(), index: 1 }));
});
test('root creation rejects ready marker and invalid fields before a preparing upload', async () => {
  for (const fields of [
    { phase: 'ready', ready: true },
    { sequence: 1 },
    { status: 'completed' },
    { itemCount: 0 },
    { catalogValidatedAt: 'today' },
    { createdAt: 100 },
    { writtenAt: Timestamp.fromMillis(1) },
    { scope: { categoryId: 'communicationSkills', subcategoryId: 'currentEvents' } },
    { uid: 'bob' },
    { sessionId: 'different' },
    { deviceId: 'x'.repeat(129) },
    { lastOperationId: '__reserved__' },
    { answer: 'secret' },
  ])
    await assertFails(setDoc(doc(db(), root), { ...rootData(), ...fields }));
  await assertSucceeds(setDoc(doc(db(), root), { ...rootData(), catalogValidatedAt: null }));
});
test('immutable root configuration and sequence cannot regress while saved completion can remain readable', async () => {
  await ready();
  for (const fields of [
    { uid: 'bob' },
    { deviceId: 'other' },
    { sessionId: 'other' },
    { scope: { categoryId: 'criticalThinking' } },
    { generation: 'b'.repeat(64) },
    { catalogValidatedAt: 101 },
    { createdAt: Timestamp.fromMillis(101) },
    { shuffleQuestions: false },
    { manifestChunkCount: 2 },
    { itemCount: 3 },
    { publicationOperationId: 'other' },
  ])
    await assertFails(
      updateDoc(doc(db(), root), {
        ...fields,
        sequence: 1,
        lastOperationId: 'state1',
        writtenAt: serverTimestamp(),
      }),
    );
  await assertSucceeds(
    updateDoc(doc(db(), root), {
      sequence: 1,
      position: 1,
      viewedCount: 1,
      lastOperationId: 'state1',
      writtenAt: serverTimestamp(),
    }),
  );
  for (const fields of [
    { sequence: 0 },
    { sequence: 1 },
    { viewedCount: 0 },
    { position: 2 },
    { status: 'completed' },
    { phase: 'preparing', ready: false },
    { extra: true },
  ])
    await assertFails(
      updateDoc(doc(db(), root), {
        sequence: 2,
        lastOperationId: 'state2',
        writtenAt: serverTimestamp(),
        ...fields,
      }),
    );
  await assertSucceeds(
    updateDoc(doc(db(), root), {
      sequence: 2,
      viewedCount: 2,
      status: 'completed',
      lastOperationId: 'state2',
      writtenAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(getDoc(doc(db(), root)));
  await assertFails(deleteDoc(doc(db(), root)));
});
test('viewed membership requires ready root and strict immutable bounded metadata', async () => {
  await preparing();
  const item = {
    uid: 'alice',
    deviceId: 'device',
    sessionId: 'device_session',
    ordinal: 0,
    entry: entry(),
    viewed: true,
    writtenAt: serverTimestamp(),
  };
  const path = `${root}/items/0`;
  await assertFails(setDoc(doc(db(), path), item));
  await updateDoc(doc(db(), root), { ready: true, phase: 'ready', writtenAt: serverTimestamp() });
  for (const fields of [
    { viewed: false },
    { ordinal: 2 },
    { deviceId: 'other' },
    { answer: 'A' },
    { entry: { ...entry(), prompt: 'secret' } },
  ])
    await assertFails(setDoc(doc(db(), path), { ...item, ...fields }));
  await assertSucceeds(setDoc(doc(db(), path), item));
  await assertFails(updateDoc(doc(db(), path), { writtenAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db(), path)));
});
test('bookmark revisions and immutable operation receipts must agree atomically; tombstones remain', async () => {
  await assertSucceeds(bookmark());
  await assertSucceeds(bookmark(2, true));
  await assertSucceeds(bookmark(3, false));
  expect((await getDoc(doc(db(), pin))).data()).toMatchObject({
    deleted: false,
    serverRevision: 3,
  });
  await assertFails(bookmark(5));
  await assertFails(bookmark(3));
  await assertFails(
    updateDoc(doc(db(), pin), {
      serverRevision: 4,
      lastOperationId: 'op4',
      writtenAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(db(), `${pin}/operations/op1`), { revision: 4, writtenAt: serverTimestamp() }),
  );
  await assertFails(deleteDoc(doc(db(), pin)));
  await assertFails(deleteDoc(doc(db(), `${pin}/operations/op1`)));
  await assertFails(
    setDoc(doc(db(), `${pin}/operations/forged`), {
      uid: 'alice',
      questionId: 'question',
      operationId: 'forged',
      revision: 4,
      writtenAt: serverTimestamp(),
    }),
  );
  await assertFails(bookmark(4, false, { entry: { ...entry(), answer: 'A' } }));
  await assertFails(bookmark(4, false, { updatedAt: Timestamp.fromMillis(50) }));
  await assertFails(bookmark(4, false, { unknown: 1 }));
});
test('only owner reads and queries every named personal collection and official writes stay denied', async () => {
  await ready();
  await bookmark();
  for (const path of [root, `${root}/manifest/0`, pin, `${pin}/operations/op1`]) {
    await assertSucceeds(getDoc(doc(db(), path)));
    for (const context of [env.authenticatedContext('bob'), env.unauthenticatedContext()]) {
      await assertFails(getDoc(doc(context.firestore(), path)));
      await assertFails(setDoc(doc(context.firestore(), path), {}));
    }
  }
  for (const path of [
    'users/alice/reviewerSessions',
    `${root}/manifest`,
    `${root}/items`,
    'users/alice/bookmarks',
    `${pin}/operations`,
  ]) {
    await assertSucceeds(getDocs(collection(db(), path)));
    await assertFails(getDocs(collection(env.authenticatedContext('bob').firestore(), path)));
  }
  for (const path of [
    'questionCatalogs/current',
    'questions/question/versions/1',
    `${root}/private/x`,
    `${pin}/private/x`,
  ])
    await assertFails(setDoc(doc(db(), path), { answer: 'A' }));
});
