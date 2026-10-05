import { INTENT_STORAGE_KEY } from '../../src/features/auth/application/AuthenticationCoordinator';
import type { ProtectedAction, SafeOrigin } from '../../src/features/auth/application/intents';
import {
  authUser,
  createAuthHarness,
  deferred,
  flushTransitions,
  MemoryIntentStore,
} from '../fixtures/auth-harness';

test('Maybe Later preserves the origin and removes the intent', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'startMockExam' }, { type: 'mockOverview' });
  expect(h.coordinator.getSnapshot().promptOpen).toBe(true);
  await h.coordinator.cancel();
  expect(h.store.values.size).toBe(0);
  expect(h.returnTo).toHaveBeenCalledWith({ type: 'mockOverview' });
  expect(h.resume).not.toHaveBeenCalled();
});

test('duplicate authenticated callbacks consume only one stable operation ID', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'startMockExam' }, { type: 'mockOverview' });
  const id = h.coordinator.getSnapshot().pendingIntent?.id;
  expect(id).toEqual(expect.any(String));
  await h.emitAuthenticated('user-a');
  await h.emitAuthenticated('user-a');
  expect(h.resume).toHaveBeenCalledTimes(1);
  expect(h.resume).toHaveBeenCalledWith(
    { type: 'startMockExam' },
    expect.objectContaining({ uid: 'user-a' }),
    id,
  );
  expect(h.store.values.has(INTENT_STORAGE_KEY)).toBe(false);
});

test('resolving waits without opening Login and cancel remains available', async () => {
  const h = createAuthHarness({ state: { status: 'resolving' } });
  await h.coordinator.requireAuthentication({ type: 'openProgress' }, { type: 'home' });
  expect(h.coordinator.getSnapshot()).toMatchObject({
    auth: { status: 'resolving' },
    promptOpen: false,
    screen: 'none',
    pendingIntent: { action: { type: 'openProgress' } },
  });
  await h.coordinator.cancel();
  await h.emitAuthenticated('user-a');
  expect(h.resume).not.toHaveBeenCalled();
});

test('switching auth forms and a reset round trip retains the protected intent', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'openBookmarks' }, { type: 'home' });
  const id = h.coordinator.getSnapshot().pendingIntent?.id;
  h.coordinator.chooseSignIn();
  expect(h.coordinator.getSnapshot().screen).toBe('signIn');
  h.coordinator.choosePasswordReset();
  expect(h.coordinator.getSnapshot().screen).toBe('passwordReset');
  h.coordinator.chooseRegistration();
  expect(h.coordinator.getSnapshot().screen).toBe('registration');
  h.coordinator.chooseSignIn();
  expect(h.coordinator.getSnapshot().pendingIntent?.id).toBe(id);
});

test('voluntary Menu sign in returns to Menu with no protected effect', async () => {
  const h = createAuthHarness();
  await flushTransitions();
  h.coordinator.beginSignIn({ type: 'menu' });
  expect(h.coordinator.getSnapshot()).toMatchObject({ screen: 'signIn', pendingIntent: null });
  await h.emitAuthenticated('user-a');
  expect(h.returnTo).toHaveBeenCalledWith({ type: 'menu' });
  expect(h.resume).not.toHaveBeenCalled();
});

test.each([
  { type: 'unknown' },
  { type: 'setBookmark', questionId: '../secret', saved: true },
  { type: 'openAttempt', attemptId: '', requiredOwnerUid: 'user-a' },
  { type: 'startReviewer', categoryId: 'generalInformation', subcategoryId: 'grammar' },
])('invalid protected action %j fails without saving or navigation', async (action) => {
  const h = createAuthHarness();
  await expect(
    h.coordinator.requireAuthentication(action as ProtectedAction, { type: 'home' }),
  ).rejects.toMatchObject({ code: 'authentication-unavailable' });
  expect(h.store.values.size).toBe(0);
  expect(h.resume).not.toHaveBeenCalled();
});

test.each([
  { type: 'https://unsafe.test' },
  { type: 'home', url: 'https://unsafe.test' },
  { type: 'reviewerOverview', subcategoryId: 'grammar' },
])('invalid origin %j cannot enter navigation', async (origin) => {
  const h = createAuthHarness();
  await expect(
    h.coordinator.requireAuthentication({ type: 'openProfile' }, origin as SafeOrigin),
  ).rejects.toMatchObject({ code: 'authentication-unavailable' });
  expect(h.returnTo).not.toHaveBeenCalled();
});

test('30-minute expiry clears and returns to the safe origin without resuming', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'startMockExam' }, { type: 'mockOverview' });
  h.clock.value = 1_801_000;
  await h.emitAuthenticated('user-a');
  expect(h.resume).not.toHaveBeenCalled();
  expect(h.returnTo).toHaveBeenCalledWith({ type: 'mockOverview' });
  expect(h.store.values.size).toBe(0);
});

test('repeated taps while pending preserve the first operation and origin', async () => {
  const h = createAuthHarness();
  await Promise.all([
    h.coordinator.requireAuthentication({ type: 'startMockExam' }, { type: 'mockOverview' }),
    h.coordinator.requireAuthentication({ type: 'openProgress' }, { type: 'home' }),
  ]);
  expect(h.store.set).toHaveBeenCalledTimes(1);
  await h.emitAuthenticated('user-a');
  expect(h.resume).toHaveBeenCalledWith(
    { type: 'startMockExam' },
    expect.objectContaining({ uid: 'user-a' }),
    expect.any(String),
  );
});

function cachedAttempt() {
  const store = new MemoryIntentStore();
  store.values.set(
    INTENT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      intent: {
        id: 'stable-operation-7',
        action: { type: 'openAttempt', attemptId: 'attempt-7', requiredOwnerUid: 'user-a' },
        origin: { type: 'home' },
        createdAtMs: 1000,
        expiresAtMs: 1_801_000,
      },
    }),
  );
  return store;
}

test('same-account restoration consumes the original stable operation ID', async () => {
  const h = createAuthHarness({
    store: cachedAttempt(),
    state: { status: 'authenticated', user: authUser('user-a') },
  });
  await flushTransitions();
  expect(h.resume).toHaveBeenCalledWith(
    { type: 'openAttempt', attemptId: 'attempt-7', requiredOwnerUid: 'user-a' },
    expect.objectContaining({ uid: 'user-a' }),
    'stable-operation-7',
  );
  expect(h.store.values.size).toBe(0);
});

test('different-user restoration drops an owner-bound attempt and returns Home', async () => {
  const h = createAuthHarness({
    store: cachedAttempt(),
    state: { status: 'authenticated', user: authUser('user-b') },
  });
  await flushTransitions();
  expect(h.resume).not.toHaveBeenCalled();
  expect(h.returnTo).toHaveBeenCalledWith({ type: 'home' });
  expect(h.store.values.size).toBe(0);
});

test.each(['broken-json', '{"version":2}', '{"version":1,"intent":{"id":"bad"}}'])(
  'corrupted cache %s is removed without opening auth or resuming',
  async (cache) => {
    const store = new MemoryIntentStore();
    store.values.set(INTENT_STORAGE_KEY, cache);
    const h = createAuthHarness({ store });
    await flushTransitions();
    expect(store.values.size).toBe(0);
    expect(h.coordinator.getSnapshot()).toMatchObject({
      promptOpen: false,
      screen: 'none',
      pendingIntent: null,
    });
    expect(h.resume).not.toHaveBeenCalled();
  },
);

test('failed persistence exposes memory-only recovery and can safely continue', async () => {
  const h = createAuthHarness();
  h.store.set.mockRejectedValueOnce(new Error('storage failed'));
  await h.coordinator.requireAuthentication({ type: 'openHistory' }, { type: 'home' });
  expect(h.coordinator.getSnapshot()).toMatchObject({
    persistence: 'memoryOnly',
    promptOpen: true,
    recoveryMessage: expect.any(String),
  });
  await h.emitAuthenticated('user-a');
  expect(h.resume).toHaveBeenCalledTimes(1);
});

test('failed cache removal retains intent for retry and prevents duplicate durable consumption', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'openHistory' }, { type: 'home' });
  h.store.remove.mockRejectedValueOnce(new Error('cannot clear'));
  await h.emitAuthenticated('user-a');
  expect(h.resume).not.toHaveBeenCalled();
  expect(h.coordinator.getSnapshot()).toMatchObject({
    pendingIntent: { action: { type: 'openHistory' } },
    recoveryMessage: expect.any(String),
  });
  await h.coordinator.retry();
  expect(h.resume).toHaveBeenCalledTimes(1);
});

test('repository recovery state never pretends the user is a guest', async () => {
  const h = createAuthHarness({ state: { status: 'recoveryRequired', previousUid: 'user-a' } });
  await h.coordinator.requireAuthentication({ type: 'openProfile' }, { type: 'home' });
  expect(h.coordinator.getSnapshot()).toMatchObject({
    auth: { status: 'recoveryRequired' },
    screen: 'none',
    promptOpen: false,
    recoveryMessage: expect.any(String),
  });
  h.coordinator.chooseSignIn();
  expect(h.coordinator.getSnapshot().screen).toBe('none');
});

test('logout invalidates an authenticated callback before blocking removal finishes', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'startMockExam' }, { type: 'mockOverview' });
  const removal = deferred<void>();
  h.store.remove.mockImplementationOnce(() => removal.promise);
  h.repository.emit({ status: 'authenticated', user: authUser('user-a') });
  await flushTransitions();
  const logout = h.coordinator.signOut();
  removal.resolve();
  await logout;
  await flushTransitions();
  expect(h.resume).not.toHaveBeenCalled();
  expect(h.repository.signOut).toHaveBeenCalledTimes(1);
});

test('dispose invalidates a callback already waiting for cache removal', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'openProfile' }, { type: 'home' });
  const removal = deferred<void>();
  h.store.remove.mockImplementationOnce(() => removal.promise);
  h.repository.emit({ status: 'authenticated', user: authUser('user-a') });
  await flushTransitions();
  h.coordinator.dispose();
  removal.resolve();
  await flushTransitions();
  expect(h.resume).not.toHaveBeenCalled();
});

test('account change invalidates an in-flight callback even before the transition queue advances', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'openProfile' }, { type: 'home' });
  const removal = deferred<void>();
  h.store.remove.mockImplementationOnce(() => removal.promise);
  h.repository.emit({ status: 'authenticated', user: authUser('user-a') });
  await flushTransitions();
  h.repository.emit({ status: 'authenticated', user: authUser('user-b') });
  removal.resolve();
  await flushTransitions();
  expect(h.resume).not.toHaveBeenCalled();
});

test('cancellation remains immediate when persistence hangs and a late write is cleaned', async () => {
  jest.useFakeTimers();
  try {
    const h = createAuthHarness();
    const write = deferred<void>();
    h.store.set.mockImplementationOnce(async (key, value) => {
      await write.promise;
      h.store.values.set(key, value);
    });
    const requiring = h.coordinator.requireAuthentication(
      { type: 'startMockExam' },
      { type: 'mockOverview' },
    );
    await flushTransitions();
    const cancellation = h.coordinator.cancel();
    expect(h.coordinator.getSnapshot().pendingIntent).toBeNull();
    expect(h.returnTo).toHaveBeenCalledWith({ type: 'mockOverview' });
    await jest.advanceTimersByTimeAsync(5000);
    await cancellation;
    await requiring;
    write.resolve();
    await flushTransitions();
    expect(h.store.values.size).toBe(0);
    expect(h.resume).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test('authenticated repeated taps consume once and leave no replayable cache', async () => {
  const h = createAuthHarness({ state: { status: 'authenticated', user: authUser('user-a') } });
  await Promise.all([
    h.coordinator.requireAuthentication({ type: 'openProgress' }, { type: 'home' }),
    h.coordinator.requireAuthentication({ type: 'openProgress' }, { type: 'home' }),
  ]);
  expect(h.resume).toHaveBeenCalledTimes(1);
  expect(h.store.values.size).toBe(0);
});

test('cancel retry clears an old durable intent after the first removal fails', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'openProgress' }, { type: 'home' });
  h.store.remove.mockRejectedValueOnce(new Error('disk failure'));
  await h.coordinator.cancel();
  expect(h.coordinator.getSnapshot().recoveryMessage).toEqual(expect.any(String));
  await h.coordinator.retry();
  expect(h.store.values.size).toBe(0);
  expect(h.resume).not.toHaveBeenCalled();
});

test('retry saves a memory-only pending request without replacing its operation ID', async () => {
  const h = createAuthHarness();
  h.store.set.mockRejectedValueOnce(new Error('disk failure'));
  await h.coordinator.requireAuthentication({ type: 'openProgress' }, { type: 'home' });
  const id = h.coordinator.getSnapshot().pendingIntent?.id;
  await h.coordinator.retry();
  expect(h.coordinator.getSnapshot()).toMatchObject({
    persistence: 'saved',
    pendingIntent: { id },
    recoveryMessage: null,
  });
  expect(h.store.values.size).toBe(1);
});

test('voluntary registration requested while resolving waits then opens only after guest resolution', async () => {
  const h = createAuthHarness({ state: { status: 'resolving' } });
  h.coordinator.beginRegistration({ type: 'menu' });
  expect(h.coordinator.getSnapshot().screen).toBe('none');
  h.repository.emit({ status: 'guest' });
  await flushTransitions();
  expect(h.coordinator.getSnapshot()).toMatchObject({
    screen: 'registration',
    origin: { type: 'menu' },
    pendingIntent: null,
  });
});

test('callback rejection consumes once, reports recovery, and does not poison later requests', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'openHistory' }, { type: 'home' });
  h.resume.mockRejectedValueOnce(new Error('handler failure'));
  await h.emitAuthenticated('user-a');
  expect(h.coordinator.getSnapshot().recoveryMessage).toEqual(expect.any(String));
  await h.emitAuthenticated('user-a');
  expect(h.resume).toHaveBeenCalledTimes(1);
  await h.coordinator.requireAuthentication({ type: 'openProgress' }, { type: 'home' });
  expect(h.resume).toHaveBeenCalledTimes(2);
  expect(h.store.values.size).toBe(0);
});

test('failed read can be retried to restore the stable operation', async () => {
  const store = cachedAttempt();
  store.get.mockRejectedValueOnce(new Error('read failure'));
  const h = createAuthHarness({
    store,
    state: { status: 'authenticated', user: authUser('user-a') },
  });
  await flushTransitions();
  expect(h.resume).not.toHaveBeenCalled();
  expect(h.coordinator.getSnapshot().recoveryMessage).toEqual(expect.any(String));
  await h.coordinator.retry();
  expect(h.resume).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'openAttempt' }),
    expect.objectContaining({ uid: 'user-a' }),
    'stable-operation-7',
  );
});

test('failed sign out exposes recovery instead of reporting guest', async () => {
  const h = createAuthHarness({ state: { status: 'authenticated', user: authUser('user-a') } });
  h.repository.signOut.mockRejectedValueOnce(new Error('offline'));
  await h.coordinator.signOut();
  expect(h.coordinator.getSnapshot()).toMatchObject({
    auth: { status: 'recoveryRequired' },
    recoveryMessage: expect.any(String),
  });
});

test('a detached auth observer cannot resume after logout', async () => {
  const h = createAuthHarness();
  const oldObserver = [...h.repository.listeners][0];
  await h.coordinator.requireAuthentication({ type: 'openProfile' }, { type: 'home' });
  await h.coordinator.signOut();
  oldObserver?.({ status: 'authenticated', user: authUser('user-a') });
  await flushTransitions();
  expect(h.coordinator.getSnapshot().auth.status).toBe('guest');
  expect(h.resume).not.toHaveBeenCalled();
});

test('account changes through repository recovery still invalidate the previous account request', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'openProfile' }, { type: 'home' });
  const removal = deferred<void>();
  h.store.remove.mockImplementationOnce(() => removal.promise);
  h.repository.emit({ status: 'authenticated', user: authUser('user-a') });
  await flushTransitions();
  h.repository.emit({ status: 'recoveryRequired', previousUid: 'user-a' });
  h.repository.emit({ status: 'authenticated', user: authUser('user-b') });
  removal.resolve();
  await flushTransitions();
  expect(h.resume).not.toHaveBeenCalled();
  expect(h.coordinator.getSnapshot().pendingIntent).toBeNull();
});

test('a failed sign in leaves the selected form and intent available for another attempt', async () => {
  const h = createAuthHarness();
  await h.coordinator.requireAuthentication({ type: 'openBookmarks' }, { type: 'home' });
  h.coordinator.chooseSignIn();
  const id = h.coordinator.getSnapshot().pendingIntent?.id;
  h.repository.signIn.mockRejectedValueOnce(new Error('invalid credentials'));
  await expect(h.repository.signIn()).rejects.toThrow('invalid credentials');
  expect(h.coordinator.getSnapshot()).toMatchObject({ screen: 'signIn', pendingIntent: { id } });
  await h.emitAuthenticated('user-a');
  expect(h.resume).toHaveBeenCalledWith(
    { type: 'openBookmarks' },
    expect.objectContaining({ uid: 'user-a' }),
    id,
  );
});

test.each(['beginSignIn', 'beginRegistration'] as const)(
  '%s during delayed restoration removes the superseded intent across restart',
  async (entry) => {
    const store = cachedAttempt();
    const read = deferred<string | null>();
    store.get.mockImplementationOnce(() => read.promise);
    const h = createAuthHarness({ store });
    await flushTransitions();
    h.coordinator[entry]({ type: 'menu' });
    read.resolve(store.values.get(INTENT_STORAGE_KEY) ?? null);
    await h.emitAuthenticated('user-a');
    expect(h.returnTo).toHaveBeenCalledWith({ type: 'menu' });
    h.coordinator.dispose();
    const restarted = createAuthHarness({
      store,
      state: { status: 'authenticated', user: authUser('user-a') },
    });
    await flushTransitions();
    expect(restarted.resume).not.toHaveBeenCalled();
    expect(store.values.size).toBe(0);
  },
);

test('account change during delayed restoration clears the unseen intent across restart', async () => {
  const store = cachedAttempt();
  const read = deferred<string | null>();
  store.get.mockImplementationOnce(() => read.promise);
  const h = createAuthHarness({
    store,
    state: { status: 'authenticated', user: authUser('user-a') },
  });
  await flushTransitions();
  h.repository.emit({ status: 'authenticated', user: authUser('user-b') });
  read.resolve(store.values.get(INTENT_STORAGE_KEY) ?? null);
  await flushTransitions();
  h.coordinator.dispose();
  const restarted = createAuthHarness({
    store,
    state: { status: 'authenticated', user: authUser('user-a') },
  });
  await flushTransitions();
  expect(restarted.resume).not.toHaveBeenCalled();
  expect(store.values.size).toBe(0);
});

test.each(['none', 'signIn', 'registration', 'passwordReset'] as const)(
  'resolving suspends %s presentation then restores the guest selection',
  async (screen) => {
    const h = createAuthHarness();
    await h.coordinator.requireAuthentication({ type: 'openProfile' }, { type: 'home' });
    if (screen === 'signIn') h.coordinator.chooseSignIn();
    if (screen === 'registration') h.coordinator.chooseRegistration();
    if (screen === 'passwordReset') h.coordinator.choosePasswordReset();
    const id = h.coordinator.getSnapshot().pendingIntent?.id;
    h.repository.emit({ status: 'resolving' });
    expect(h.coordinator.getSnapshot()).toMatchObject({
      promptOpen: false,
      screen: 'none',
      pendingIntent: { id },
    });
    h.repository.emit({ status: 'guest' });
    await flushTransitions();
    expect(h.coordinator.getSnapshot()).toMatchObject({
      promptOpen: screen === 'none',
      screen,
      pendingIntent: { id },
    });
  },
);
