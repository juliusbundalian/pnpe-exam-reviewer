import { RegistrationController } from '../../src/features/auth/application/RegistrationController';
import { AppError } from '../../src/core/errors/AppError';
import { FakeAuthenticationRepository, authUser, deferred } from '../fixtures/auth-harness';

function harness() {
  const auth = new FakeAuthenticationRepository({ status: 'guest' });
  const profiles = { get: jest.fn(async () => null), save: jest.fn(async () => {}) };
  const controller = new RegistrationController(auth, profiles);
  controller.synchronizeAuth({ status: 'guest' });
  return { auth, profiles, controller };
}
test('account creation survives observer navigation and failed profile save retries only profile', async () => {
  const { auth, profiles, controller } = harness();
  auth.register.mockImplementation(async () => {
    controller.synchronizeAuth({ status: 'authenticated', user: authUser('user-a') });
    return authUser('user-a');
  });
  profiles.save.mockRejectedValueOnce(new AppError('profile-unavailable'));
  await controller.register('person@example.test', ' secret ', 'Person');
  expect(controller.getSnapshot()).toMatchObject({
    status: 'profileRecovery',
    user: { uid: 'user-a' },
    displayName: 'Person',
  });
  expect(controller.getSnapshot().message).toContain('profile');
  await controller.retryProfile();
  expect(controller.getSnapshot()).toMatchObject({ status: 'complete', message: null });
  expect(profiles.save).toHaveBeenNthCalledWith(2, 'user-a', { displayName: 'Person' });
  expect(auth.register).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(controller.getSnapshot())).not.toContain('secret');
  controller.dispose();
});
test.each(['guest', 'other-account'] as const)(
  'account transition to %s invalidates recovery',
  async (transition) => {
    const { profiles, controller } = harness();
    profiles.save.mockRejectedValueOnce(new Error('raw SDK details'));
    await controller.register('person@example.test', 'secret', 'Person');
    controller.synchronizeAuth(
      transition === 'guest'
        ? { status: 'guest' }
        : { status: 'authenticated', user: authUser('user-b') },
    );
    await controller.retryProfile();
    expect(controller.getSnapshot().status).toBe('idle');
    expect(profiles.save).toHaveBeenCalledTimes(1);
    controller.dispose();
  },
);
test('late registration result after logout cannot save a profile or restore recovery', async () => {
  const { auth, profiles, controller } = harness();
  const request = deferred<ReturnType<typeof authUser>>();
  auth.register.mockImplementation(() => request.promise);
  const work = controller.register('person@example.test', 'secret', 'Person');
  controller.synchronizeAuth({ status: 'authenticated', user: authUser('user-a') });
  controller.synchronizeAuth({ status: 'guest' });
  request.resolve(authUser('user-a'));
  await work;
  expect(profiles.save).not.toHaveBeenCalled();
  expect(controller.getSnapshot().status).toBe('idle');
  controller.dispose();
});
test('guest observation during pending registration invalidates late completion', async () => {
  const { auth, profiles, controller } = harness();
  const request = deferred<ReturnType<typeof authUser>>();
  auth.register.mockImplementation(() => request.promise);
  const work = controller.register('person@example.test', 'secret', 'Person');
  controller.synchronizeAuth({ status: 'guest' });
  request.resolve(authUser('user-a'));
  await work;
  expect(profiles.save).not.toHaveBeenCalled();
  expect(controller.getSnapshot().status).toBe('idle');
  controller.dispose();
});
test('concurrent submission cannot create two accounts and failed auth remains retryable', async () => {
  const { auth, controller } = harness();
  const request = deferred<ReturnType<typeof authUser>>();
  auth.register.mockImplementationOnce(() => request.promise);
  const work = controller.register('person@example.test', 'secret', 'Person');
  await controller.register('person@example.test', 'secret', 'Person');
  expect(auth.register).toHaveBeenCalledTimes(1);
  request.reject(new AppError('network'));
  await expect(work).rejects.toThrow(AppError);
  expect(controller.getSnapshot().status).toBe('idle');
  await controller.register('person@example.test', 'secret', 'Person');
  expect(controller.getSnapshot().status).toBe('complete');
  controller.dispose();
});
