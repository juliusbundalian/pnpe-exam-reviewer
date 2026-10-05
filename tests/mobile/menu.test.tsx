import { screen, fireEvent, act, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';
import { createAppHarness } from '../fixtures/app-harness';
import { authUser, deferred, flushTransitions } from '../fixtures/auth-harness';
import { defaults } from '../../src/core/config/defaults';
const harnesses: ReturnType<typeof createAppHarness>[] = [];
function harness(options: Parameters<typeof createAppHarness>[0] = {}) {
  const h = createAppHarness(options);
  harnesses.push(h);
  return h;
}
afterEach(() => {
  harnesses.splice(0).forEach((h) => h.dispose());
  jest.restoreAllMocks();
});
test('Menu reacts to sign in and sign out using one repository listener', async () => {
  const h = harness();
  await h.render('/menu');
  expect(h.auth.listeners.size).toBe(1);
  await h.authenticate('alice');
  expect(await screen.findByText('alice@example.test')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Sign Out' }));
  expect(await screen.findByRole('button', { name: 'Sign In' })).toBeVisible();
  expect(h.auth.listeners.size).toBe(1);
});
test('profile read errors can be retried and account changes reject stale data', async () => {
  const h = harness({ initialAuth: { status: 'authenticated', user: authUser('alice') } });
  h.profiles.get.mockRejectedValueOnce(new Error('offline'));
  await h.render('/profile');
  expect(await screen.findByText('Your profile could not be loaded.')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Alice')).toBeVisible();
  const old = deferred<{ displayName: string }>();
  h.profiles.get.mockImplementationOnce(() => old.promise);
  await h.authenticate('bob');
  expect(screen.queryByText('Alice')).toBeNull();
  await h.authenticate('carol');
  await act(async () => {
    old.resolve({ displayName: 'Stale Bob' });
    await flushTransitions();
  });
  expect(screen.queryByText('Stale Bob')).toBeNull();
  expect(screen.getByText('carol@example.test')).toBeVisible();
});
test('registration profile failure remains visible after auth navigation; retry saves profile only', async () => {
  const h = harness({ profileFailure: true });
  const result = await h.render('/menu');
  fireEvent.press(screen.getByRole('button', { name: 'Create Account' }));
  await waitFor(() => expect(result.getPathname()).toBe('/auth/register'));
  await act(async () => {
    await h.dependencies.registration.register('alice@example.test', 'Passw0rd!xx', 'Alice');
    await flushTransitions();
  });
  await waitFor(() => expect(result.getPathname()).toBe('/menu'));
  expect(await screen.findByText(/your profile could not be saved/)).toBeVisible();
  h.profiles.save.mockResolvedValueOnce(undefined);
  fireEvent.press(screen.getByRole('button', { name: 'Retry Profile Save' }));
  await waitFor(() => expect(screen.queryByText(/your profile could not be saved/)).toBeNull());
  expect(h.auth.register).toHaveBeenCalledTimes(1);
  expect(h.profiles.save).toHaveBeenCalledTimes(2);
});
test('legal browser failure offers Retry and empty URLs remain honestly unavailable', async () => {
  const h = harness({
    config: {
      ...defaults,
      app_info: { ...defaults.app_info, termsUrl: 'https://example.test/terms' },
    },
  });
  const open = jest
    .spyOn(Linking, 'openURL')
    .mockRejectedValueOnce(new Error('no browser'))
    .mockResolvedValueOnce(true);
  await h.render('/terms');
  fireEvent.press(screen.getByRole('button', { name: 'Open Terms' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.queryByText(/browser could not open/)).toBeNull());
  expect(open).toHaveBeenCalledTimes(2);
});
test('unconfigured legal content has no launch action', async () => {
  const h = harness();
  await h.render('/privacy');
  expect(await screen.findByText('This legal content is currently unavailable.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Open Privacy Policy' })).toBeNull();
});
test('maintenance preserves Home and browsing but disables new starts', async () => {
  const h = harness({
    config: {
      ...defaults,
      app_info: {
        ...defaults.app_info,
        maintenanceMode: true,
        maintenanceMessage: 'Maintenance in progress',
      },
    },
  });
  await h.render('/');
  expect(await screen.findByText('Explore reviewers')).toBeVisible();
  expect(screen.getByText('Maintenance in progress')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Start Mock Exam' })).toBeDisabled();
  fireEvent.press(screen.getAllByRole('button', { name: 'Mock Exam' })[0]!);
  expect(await screen.findByRole('button', { name: 'Start Mock Exam' })).toBeDisabled();
});
test('unsupported version blocks starts but leaves category browsing available', async () => {
  const h = harness({
    config: { ...defaults, app_info: { ...defaults.app_info, minimumSupportedVersion: '1.0.0' } },
  });
  await h.render('/review/generalInformation');
  expect(screen.getByRole('button', { name: 'Start Reviewer' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'PNP History' })).toBeEnabled();
});
test('auth failure is recovery, never guest or an unsolicited login', async () => {
  const h = harness({ initialAuth: { status: 'recoveryRequired', previousUid: 'alice' } });
  await h.render('/');
  expect(await screen.findByText('Explore reviewers')).toBeVisible();
  expect(screen.queryByText('Sign in to continue')).toBeNull();
  fireEvent.press(screen.getAllByRole('button', { name: 'Progress' })[0]!);
  await act(flushTransitions);
  expect(screen.queryByText('Sign in to continue')).toBeNull();
  expect(h.dependencies.coordinator.getSnapshot().auth.status).toBe('recoveryRequired');
});
