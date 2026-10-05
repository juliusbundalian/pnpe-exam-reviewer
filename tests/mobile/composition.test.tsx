import { screen, fireEvent, act } from 'expo-router/testing-library';
import { createAppHarness } from '../fixtures/app-harness';
import { defaults } from '../../src/core/config/defaults';
import { deferred } from '../fixtures/auth-harness';
import type { NativeServices } from '../../src/core/firebase/native';
const harnesses: ReturnType<typeof createAppHarness>[] = [];
function harness(options: Parameters<typeof createAppHarness>[0]) {
  const h = createAppHarness(options);
  harnesses.push(h);
  return h;
}
afterEach(() => {
  harnesses.splice(0).forEach((h) => h.dispose());
});
test('never-settling native composition cannot block actual Home or bundled taxonomy', async () => {
  const native = deferred<NativeServices>();
  const h = harness({ nativeServices: () => native.promise });
  await h.render('/');
  expect(await screen.findByText('Explore reviewers')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Explore reviewers' }));
  expect(await screen.findByRole('button', { name: 'General Information' })).toBeVisible();
  expect(screen.queryByText('Sign in to continue')).toBeNull();
});
test('unconfigured native services remain unavailable instead of inventing guest authentication', async () => {
  const h = harness({
    nativeServices: async () => ({
      available: false,
      remoteConfigMode: 'unavailable',
      remoteConfig: {
        fetch: async () => {
          throw new Error('unavailable');
        },
      },
    }),
  });
  await h.render('/menu');
  expect(await screen.findByText(/Authentication is currently unavailable/)).toBeVisible();
  expect(h.dependencies.coordinator.getSnapshot().auth.status).toBe('recoveryRequired');
  expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
});
test('Home observes validated config changes instead of hardcoded presentation counts', async () => {
  const config = {
    ...defaults,
    config: { ...defaults.config, mockExam: { ...defaults.config.mockExam } },
  };
  const h = harness({ config });
  await h.render('/');
  expect(await screen.findByText(/150 questions · 180 minutes/)).toBeVisible();
  config.config.mockExam.durationMinutes = 90;
  await act(async () => {
    await h.dependencies.config.refresh();
  });
  expect(await screen.findByText(/150 questions · 90 minutes/)).toBeVisible();
});
