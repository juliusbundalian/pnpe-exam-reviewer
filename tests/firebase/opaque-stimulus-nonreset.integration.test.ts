import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  setLogLevel,
} from 'firebase/firestore';
import { integrationEnvironment } from '../fixtures/integrationEnvironment';
import { studyEntry } from '../fixtures/study';

// This suite intentionally never clears Firestore. Every run owns unique disposable paths.
const target = integrationEnvironment(process.env);
const uid = `stimulus_${randomUUID().replaceAll('-', '')}`;
const session = (name: string) => `users/${uid}/reviewerSessions/${name}`;
const opaqueId = 'comprehensive:V:Passage 3 – Feng Shui';
let env: RulesTestEnvironment;
const db = () => env.authenticatedContext(uid).firestore();
const entry = (id: unknown, version: unknown = 1) => ({
  ...studyEntry({ id: 'question' }),
  stimulus: { id, version },
});
const root = () => ({
  uid,
  deviceId: 'device',
  sessionId: 'session',
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
const chunk = (entries: unknown[]) => ({
  uid,
  deviceId: 'device',
  sessionId: 'session',
  index: 0,
  items: entries.map((value, ordinal) => ({ ordinal, entry: value })),
  writtenAt: serverTimestamp(),
});
async function pin(value: unknown, qid: string) {
  const database = db(),
    path = `users/${uid}/bookmarks/${qid}`,
    batch = writeBatch(database);
  batch.set(doc(database, path), {
    uid,
    questionId: qid,
    entry: value,
    createdAt: Timestamp.fromMillis(100),
    updatedAt: Timestamp.fromMillis(200),
    deleted: false,
    serverRevision: 1,
    lastOperationId: 'op1',
    writtenAt: serverTimestamp(),
  });
  batch.set(doc(database, `${path}/operations/op1`), {
    uid,
    questionId: qid,
    operationId: 'op1',
    revision: 1,
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
afterAll(async () => {
  if (env) await env.cleanup();
});

test('opaque metadata writes retain maximum two-entry support and immutable owner-only personal records', async () => {
  const database = db(),
    path = session('session');
  await assertSucceeds(setDoc(doc(database, path), root()));
  const maximum = {
    ...entry('é'.repeat(750), Number.MAX_SAFE_INTEGER),
    id: 'q'.repeat(1500),
    version: Number.MAX_SAFE_INTEGER,
    categoryId: 'generalInformation',
    subcategoryId: 'currentEvents',
    isCurrentEvent: true,
    publishedAt: '2026-10-08T00:00:00.123456789+00:00',
    asOfDate: '2026-10-08',
    expiresAt: '2027-10-08T00:00:00.123456789+00:00',
  };
  const value = chunk([
    {
      ...maximum,
      id: 'r'.repeat(1500),
      stimulus: { id: opaqueId, version: Number.MAX_SAFE_INTEGER },
    },
    maximum,
  ]);
  await assertSucceeds(setDoc(doc(database, `${path}/manifest/0`), value));
  await assertFails(
    updateDoc(doc(database, `${path}/manifest/0`), { writtenAt: serverTimestamp() }),
  );
  await assertSucceeds(
    updateDoc(doc(database, path), { phase: 'ready', ready: true, writtenAt: serverTimestamp() }),
  );
  await assertSucceeds(
    setDoc(doc(database, `${path}/items/0`), {
      uid,
      deviceId: 'device',
      sessionId: 'session',
      ordinal: 0,
      entry: entry(opaqueId),
      viewed: true,
      writtenAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(pin(entry(opaqueId), 'question'));
  for (const other of [env.authenticatedContext(`${uid}_other`), env.unauthenticatedContext()]) {
    await assertFails(getDoc(doc(other.firestore(), `${path}/manifest/0`)));
    await assertFails(getDoc(doc(other.firestore(), `users/${uid}/bookmarks/question`)));
    await assertFails(setDoc(doc(other.firestore(), `${path}/manifest/0`), value));
  }
});

test('blank padded controlled oversized and malformed opaque references are denied in manifests and bookmarks', async () => {
  const path = session('negative');
  await assertSucceeds(setDoc(doc(db(), path), { ...root(), sessionId: 'negative' }));
  const invalid = [
    '',
    ' ',
    ' padded',
    'padded ',
    '\u00a0padded',
    'padded\uFEFF',
    'line\nbreak',
    'control\u0000',
    'control\u007f',
    'control\u0085',
    'line\u2028break',
    'a'.repeat(1501),
    'é'.repeat(751),
    '😀'.repeat(376),
    3,
    null,
  ];
  const values = [
    ...invalid.map((id) => entry(id)),
    entry(opaqueId, 0),
    entry(opaqueId, Number.MAX_SAFE_INTEGER + 1),
    { ...entry(opaqueId), stimulus: { id: opaqueId, version: 1, prompt: 'secret' } },
    { ...entry(opaqueId), answer: 'A' },
    { ...entry(opaqueId), id: 'unsafe:id' },
  ];
  for (const [index, value] of values.entries()) {
    await assertFails(
      setDoc(doc(db(), `${path}/manifest/0`), {
        ...chunk([entry(opaqueId), value]),
        sessionId: 'negative',
      }),
    );
    const qid = `negative_${index}`;
    await assertFails(pin(index === values.length - 1 ? value : { ...value, id: qid }, qid));
  }
  await assertFails(
    setDoc(doc(db(), `${path}/manifest/0`), {
      ...chunk([entry(opaqueId), entry(opaqueId), entry(opaqueId)]),
      sessionId: 'negative',
    }),
  );
});

test.each(['opaque/embedded identity', '__opaque__', '😀'.repeat(375), 'passage: a\u00a0b'])(
  'opaque identities preserve UTF-8 boundary and metadata-only meaning (%#)',
  async (id) => {
    const name = `valid_${randomUUID().replaceAll('-', '')}`,
      path = session(name);
    await assertSucceeds(setDoc(doc(db(), path), { ...root(), sessionId: name }));
    await assertSucceeds(
      setDoc(doc(db(), `${path}/manifest/0`), { ...chunk([entry(id)]), sessionId: name }),
    );
    const qid = name;
    await assertSucceeds(pin({ ...entry(id), id: qid }, qid));
  },
);
