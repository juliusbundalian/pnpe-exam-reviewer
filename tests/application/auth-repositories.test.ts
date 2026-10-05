import {
  FirebaseAuthenticationRepository,
  type AuthenticationSdk,
} from '../../src/features/auth/data/FirebaseAuthenticationRepository';
import {
  createProfileSdk,
  FirebaseProfileRepository,
  type ProfileSdk,
  type ProfileModularSdk,
} from '../../src/features/auth/data/FirebaseProfileRepository';
import type { AuthState } from '../../src/features/auth/domain/AuthenticationRepository';

const user = { uid: 'owner', email: 'user@example.test', displayName: null };
function authAdapterHarness(error?: unknown) {
  let next: ((value: unknown) => void) | undefined;
  let failed: ((error: unknown) => void) | undefined;
  let registrations = 0;
  const sdk: AuthenticationSdk = {
    onAuthStateChanged: (listener, onError) => {
      next = listener;
      failed = onError;
      return () => {
        next = undefined;
        failed = undefined;
      };
    },
    signInWithEmailAndPassword: async () => {
      if (error) throw error;
      return { user };
    },
    createUserWithEmailAndPassword: async () => {
      registrations++;
      return { user };
    },
    sendPasswordResetEmail: async () => {
      if (error) throw error;
    },
    signOut: async () => {},
  };
  const repo = new FirebaseAuthenticationRepository(sdk);
  const observed: AuthState[] = [];
  const unsubscribe = repo.observe((state) => observed.push(state));
  return {
    repo,
    observed,
    unsubscribe,
    emit: (value: unknown) => next?.(value),
    fail: () => failed?.({ code: 'auth/network-request-failed' }),
    registrations: () => registrations,
  };
}

test.each([
  ['auth/network-request-failed', 'network'],
  ['auth/invalid-credential', 'invalid-credentials'],
  ['auth/wrong-password', 'invalid-credentials'],
  ['auth/user-not-found', 'invalid-credentials'],
  ['auth/too-many-requests', 'rate-limited'],
  ['auth/weak-password', 'weak-password'],
  ['auth/user-disabled', 'account-disabled'],
  ['unexpected', 'authentication-unavailable'],
])('maps %s to safe %s without signing out', async (code, expected) => {
  const h = authAdapterHarness({ code, message: 'SECRET SDK DETAIL' });
  await expect(h.repo.signIn('user@example.test', 'password')).rejects.toMatchObject({
    code: expected,
  });
  await expect(h.repo.signIn('user@example.test', 'password')).rejects.not.toMatchObject({
    message: 'SECRET SDK DETAIL',
  });
  expect(h.observed).not.toContainEqual({ status: 'guest' });
});
test('observation distinguishes resolving, guest, authentication and recovery; unsubscribes', () => {
  const h = authAdapterHarness();
  h.emit(null);
  h.emit({ ...user, token: 'secret' });
  h.fail();
  expect(h.observed).toEqual([
    { status: 'resolving' },
    { status: 'guest' },
    { status: 'authenticated', user },
    { status: 'recoveryRequired', previousUid: 'owner' },
  ]);
  h.unsubscribe();
  h.emit(null);
  expect(h.observed).toHaveLength(4);
});
test('malformed auth data enters recovery instead of treating it as signed out', () => {
  const h = authAdapterHarness();
  h.emit({ uid: 4 });
  expect(h.observed.at(-1)).toEqual({ status: 'recoveryRequired', previousUid: null });
});
test('password reset has neutral completion for missing accounts', async () => {
  await expect(
    authAdapterHarness({ code: 'auth/user-not-found' }).repo.requestPasswordReset(
      'absent@example.test',
    ),
  ).resolves.toBeUndefined();
});
function profileHarness(initial: unknown = null) {
  let document = initial;
  let rejectWrite = false;
  const writes: unknown[] = [];
  const sdk: ProfileSdk = {
    get: async () => document,
    save: async (uid, data) => {
      if (rejectWrite) throw { code: 'firestore/unavailable' };
      writes.push({ uid, ...data });
      document = data;
    },
  };
  return {
    repo: new FirebaseProfileRepository(sdk),
    writes,
    fail: (value: boolean) => {
      rejectWrite = value;
    },
  };
}
test('registration survives failed profile persistence and profile-only retry', async () => {
  const auth = authAdapterHarness();
  const profile = profileHarness();
  const registered = await auth.repo.register('user@example.test', 'password');
  profile.fail(true);
  await expect(profile.repo.save(registered.uid, { displayName: 'Owner' })).rejects.toMatchObject({
    code: 'network',
  });
  profile.fail(false);
  await profile.repo.save(registered.uid, { displayName: ' Owner ' });
  expect(registered).toEqual(user);
  expect(auth.registrations()).toBe(1);
  expect(profile.writes).toEqual([{ uid: 'owner', displayName: 'Owner' }]);
});
test('profile read returns only displayName and excludes persisted email', async () => {
  await expect(
    profileHarness({
      displayName: 'Owner',
      email: 'forged',
      createdAt: {},
      updatedAt: {},
    }).repo.get('owner'),
  ).resolves.toEqual({ displayName: 'Owner' });
  await expect(profileHarness().repo.get('owner')).resolves.toBeNull();
  await expect(profileHarness({ displayName: 3 }).repo.get('owner')).rejects.toMatchObject({
    code: 'invalid-profile',
  });
});
test.each(['', ' ', 'x'.repeat(101)])(
  'rejects invalid profile displayName',
  async (displayName) => {
    await expect(profileHarness().repo.save('owner', { displayName })).rejects.toMatchObject({
      code: 'invalid-profile',
    });
  },
);
test.each(['', 'users/other', '.', '..'])('rejects unsafe profile uid %s', async (uid) => {
  await expect(profileHarness().repo.get(uid)).rejects.toMatchObject({ code: 'invalid-profile' });
});
test('transactional profile creation stamps timestamps; updates preserve createdAt and exclude email', async () => {
  const documents = new Map<string, Record<string, unknown>>();
  let time = 0;
  const sdk: ProfileModularSdk<string> = {
    doc: (collection, uid) => `${collection}/${uid}`,
    getDoc: async (ref) => ({ exists: () => documents.has(ref), data: () => documents.get(ref) }),
    serverTimestamp: () => ({ serverTime: ++time }),
    runTransaction: async (action) =>
      action({
        get: async (ref) => sdk.getDoc(ref),
        set: (ref, fields) => {
          documents.set(ref, fields);
        },
        update: (ref, fields) => {
          documents.set(ref, { ...documents.get(ref), ...fields });
        },
      }),
  };
  const repo = new FirebaseProfileRepository(createProfileSdk(sdk));
  await repo.save('owner', { displayName: 'First' });
  expect(documents.get('users/owner')).toEqual({
    displayName: 'First',
    updatedAt: { serverTime: 1 },
    createdAt: { serverTime: 2 },
  });
  await repo.save('owner', { displayName: 'Second' });
  expect(documents.get('users/owner')).toEqual({
    displayName: 'Second',
    updatedAt: { serverTime: 3 },
    createdAt: { serverTime: 2 },
  });
  await expect(repo.get('owner')).resolves.toEqual({ displayName: 'Second' });
});
