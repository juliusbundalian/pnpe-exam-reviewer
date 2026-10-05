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
  serverTimestamp,
  Timestamp,
  setLogLevel,
} from 'firebase/firestore';

let env: RulesTestEnvironment;
beforeAll(async () => {
  setLogLevel('error'); // Expected permission denials are asserted below.
  env = await initializeTestEnvironment({
    projectId: 'demo-pnpe',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const path of [
      'categories/generalInformation',
      'questions/q-one/versions/1',
      'questionCatalogs/current',
      'questionCatalogs/g-one/shards/s-one',
    ])
      await setDoc(doc(db, path), { value: true });
    for (const uid of ['alice', 'bob'])
      await setDoc(doc(db, `users/${uid}`), {
        displayName: uid,
        createdAt: Timestamp.fromMillis(1),
        updatedAt: Timestamp.fromMillis(1),
      });
  });
});
afterAll(async () => {
  if (env) {
    await env.clearFirestore();
    await env.cleanup();
  }
});

test('guest reads and queries public categories but cannot read official answers or catalogs', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'categories/generalInformation')));
  await assertSucceeds(getDocs(collection(db, 'categories')));
  for (const path of [
    'questions/q-one/versions/1',
    'questionCatalogs/current',
    'questionCatalogs/g-one/shards/s-one',
  ])
    await assertFails(getDoc(doc(db, path)));
  await assertFails(getDocs(collection(db, 'questions/q-one/versions')));
  await assertFails(getDocs(collection(db, 'questionCatalogs/g-one/shards')));
  await assertFails(setDoc(doc(db, 'categories/generalInformation'), { value: false }));
});
test('authenticated official reads and queries are read only', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertSucceeds(getDocs(collection(db, 'categories')));
  for (const path of [
    'questions/q-one/versions/1',
    'questionCatalogs/current',
    'questionCatalogs/g-one/shards/s-one',
  ]) {
    await assertSucceeds(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), { value: false }));
    await assertFails(deleteDoc(doc(db, path)));
  }
  for (const path of ['questions/q-one/versions', 'questionCatalogs/g-one/shards'])
    await assertSucceeds(getDocs(collection(db, path)));
  await assertFails(setDoc(doc(db, 'categories/generalInformation'), { value: false }));
});
test('only owner may read and update a profile with valid server timestamp', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertSucceeds(getDoc(doc(db, 'users/alice')));
  await assertSucceeds(
    updateDoc(doc(db, 'users/alice'), { displayName: 'Alice', updatedAt: serverTimestamp() }),
  );
  await assertFails(getDoc(doc(db, 'users/bob')));
  await assertFails(
    updateDoc(doc(db, 'users/bob'), { displayName: 'Alice', updatedAt: serverTimestamp() }),
  );
  await assertFails(getDocs(collection(db, 'users')));
  await assertFails(deleteDoc(doc(db, 'users/alice')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice')));
});
test('profile creation requires exact fields and both server timestamps', async () => {
  const db = env.authenticatedContext('new-user').firestore();
  const ref = doc(db, 'users/new-user');
  await assertFails(
    setDoc(ref, {
      displayName: 'New',
      createdAt: Timestamp.fromMillis(1),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(setDoc(ref, { displayName: 'New', updatedAt: serverTimestamp() }));
  const valid = { displayName: 'New', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertFails(setDoc(ref, { ...valid, admin: true }));
  await assertFails(setDoc(ref, { ...valid, email: 'forged@example.test' }));
  await assertFails(setDoc(ref, { ...valid, updatedAt: 'today' }));
  await assertFails(setDoc(doc(db, 'users/not-owner'), valid));
  await assertSucceeds(
    setDoc(ref, { displayName: 'New', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
  );
});
test('profile rejects added fields, bad names, changed creation time and client update timestamps', async () => {
  const ref = doc(env.authenticatedContext('alice').firestore(), 'users/alice');
  for (const fields of [
    { admin: true },
    { displayName: 1 },
    { displayName: '' },
    { displayName: '   ' },
    { displayName: 'x'.repeat(101) },
    { createdAt: serverTimestamp() },
    { updatedAt: Timestamp.fromMillis(1) },
  ])
    await assertFails(updateDoc(ref, { updatedAt: serverTimestamp(), ...fields }));
  await assertSucceeds(
    updateDoc(ref, { displayName: 'x'.repeat(100), updatedAt: serverTimestamp() }),
  );
  await assertSucceeds(
    updateDoc(ref, { displayName: 'Alice\nSmith', updatedAt: serverTimestamp() }),
  );
});
test('unimplemented paths and all profile subcollections remain denied', async () => {
  const db = env.authenticatedContext('alice').firestore();
  for (const path of [
    'users/alice/sessions/s-one',
    'users/alice/preferences/p-one',
    'sessions/s-one',
    'questions/q-one',
    'questions/q-one/private/p-one',
    'questionCatalogs/g-one',
    'categories/generalInformation/private/p-one',
    'unknown/u-one',
  ]) {
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), { value: true }));
  }
});
