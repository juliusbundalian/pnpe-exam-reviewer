import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, setLogLevel } from 'firebase/firestore';
import { integrationEnvironment } from '../fixtures/integrationEnvironment';
import { examResult } from '../fixtures/exam';
import {
  CloudExamItemSchema,
  CloudExamRootSchema,
} from '../../src/features/exam/data/cloudExamSchemas';
import { canonicalJson } from '../../src/core/content/Fingerprint';

const target = integrationEnvironment(process.env);
let env: RulesTestEnvironment;
const path = 'users/alice/examAttempts/exam-fixture';
const result = examResult();
const questions = result.questions;
const summary = Object.fromEntries(
  Object.entries(result).filter(([key]) => key !== 'questions' && key !== 'syncState'),
);
const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const rootData = () => ({
  uid: 'alice',
  deviceId: 'device-one',
  attemptId: 'exam-fixture',
  itemCount: 150,
  phase: 'preparing',
  summary,
  writtenAt: serverTimestamp(),
});
const itemData = (ordinal = 0) => ({
  uid: 'alice',
  deviceId: 'device-one',
  attemptId: 'exam-fixture',
  ordinal,
  item: JSON.parse(canonicalJson(questions[ordinal])),
  writtenAt: serverTimestamp(),
});

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

test('owner can publish bounded terminal metadata and another UID cannot read or write it', async () => {
  expect(CloudExamRootSchema.safeParse({ ...rootData(), writtenAt: 0 }).success).toBe(true);
  await assertSucceeds(setDoc(doc(alice(), path), rootData()));
  await assertSucceeds(getDoc(doc(alice(), path)));
  await assertFails(getDoc(doc(bob(), path)));
  await assertFails(setDoc(doc(bob(), path), rootData()));
});

test('immutable summary and item reject overwrite while ready transition stays bounded', async () => {
  await assertSucceeds(setDoc(doc(alice(), path), rootData()));
  expect(CloudExamItemSchema.safeParse({ ...itemData(), writtenAt: 0 }).success).toBe(true);
  await assertSucceeds(setDoc(doc(alice(), `${path}/items/0`), itemData()));
  await assertFails(
    updateDoc(doc(alice(), path), { 'summary.overall.correct': 1, writtenAt: serverTimestamp() }),
  );
  await assertFails(updateDoc(doc(alice(), `${path}/items/0`), { flagged: true }));
  await assertSucceeds(
    updateDoc(doc(alice(), path), { phase: 'ready', writtenAt: serverTimestamp() }),
  );
  await assertFails(setDoc(doc(alice(), `${path}/items/1`), itemData(1)));
});

test('invalid item ownership and ordinal are denied', async () => {
  await assertSucceeds(setDoc(doc(alice(), path), rootData()));
  await assertFails(setDoc(doc(alice(), `${path}/items/0`), { ...itemData(), uid: 'bob' }));
  await assertFails(setDoc(doc(alice(), `${path}/items/2`), itemData(1)));
  await assertFails(setDoc(doc(bob(), `${path}/items/0`), itemData()));
});
