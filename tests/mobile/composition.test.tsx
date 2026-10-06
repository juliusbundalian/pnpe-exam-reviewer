import { screen, fireEvent, act, renderRouter, within, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppProviders } from '../../src/bootstrap/AppProviders';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { createAppHarness } from '../fixtures/app-harness';
import { defaults } from '../../src/core/config/defaults';
import { deferred, flushTransitions } from '../fixtures/auth-harness';
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

async function renderDarkRecovery(h: ReturnType<typeof createAppHarness>) {
  const result = renderRouter(
    {
      appDir: `${process.cwd()}/src/app`,
      overrides: {
        _layout: () => (
          <ThemeProvider initialAppearance="dark">
            <AppProviders dependencies={h.dependencies}>
              <Stack screenOptions={{ headerShown: false }} />
            </AppProviders>
          </ThemeProvider>
        ),
      },
    },
    { initialUrl: '/' },
  );
  await act(flushTransitions);
  return result;
}

function expectRecoveryLayout(message: RegExp) {
  const notice = screen.getByTestId('app-recovery-notices');
  expect(notice).toHaveStyle({
    backgroundColor: '#101925',
    maxHeight: '40%',
    flexShrink: 1,
  });
  const safeArea = screen
    .UNSAFE_getAllByType(SafeAreaView)
    .find((view) => view.props.testID === 'app-recovery-notices');
  expect(safeArea?.props.edges).toEqual(['top', 'left', 'right']);
  const scroll = screen
    .UNSAFE_getAllByType(ScrollView)
    .find((view) => view.props.testID === 'app-recovery-notices-scroll');
  expect(scroll).toBeDefined();
  expect(StyleSheet.flatten(scroll?.props.contentContainerStyle)).toEqual(
    expect.objectContaining({ padding: 12, gap: 8 }),
  );
  expect(scroll?.props.keyboardShouldPersistTaps).toBe('handled');
  const alert = within(notice).getByRole('alert');
  expect(alert).toHaveTextContent(message);
  expect(alert).toHaveStyle({ color: '#eef3fc' });
  expect(alert.props.allowFontScaling).toBe(true);
  expect(alert.props.numberOfLines).toBeUndefined();
}

test('auth recovery has a themed safe-area scroll region and retry preserves public Home', async () => {
  const h = harness({ initialAuth: { status: 'recoveryRequired', previousUid: 'alice' } });
  await renderDarkRecovery(h);
  expectRecoveryLayout(/Authentication is unavailable/);
  expect(screen.getByRole('button', { name: 'Explore reviewers' })).toBeVisible();
  h.auth.state = { status: 'guest' };
  fireEvent.press(screen.getByRole('button', { name: 'Retry authentication' }));
  await waitFor(() => expect(screen.queryByTestId('app-recovery-notices')).toBeNull());
  expect(h.dependencies.coordinator.getSnapshot().auth.status).toBe('guest');
  expect(screen.getByRole('button', { name: 'Explore reviewers' })).toBeVisible();
});

test('profile recovery uses the same safe-area scroll region and retry saves the profile only', async () => {
  const h = harness({ profileFailure: true });
  await renderDarkRecovery(h);
  await act(async () => {
    await h.dependencies.registration.register('alice@example.test', 'Passw0rd!xx', 'Alice');
    await flushTransitions();
  });
  expectRecoveryLayout(/Your account is ready, but your profile could not be saved/);
  h.profiles.save.mockResolvedValueOnce(undefined);
  fireEvent.press(screen.getByRole('button', { name: 'Retry Profile Save' }));
  await waitFor(() => expect(screen.queryByTestId('app-recovery-notices')).toBeNull());
  expect(h.auth.register).toHaveBeenCalledTimes(1);
  expect(h.profiles.save).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Explore reviewers' })).toBeVisible();
});

test('healthy composition adds no recovery region or empty safe-area padding', async () => {
  const h = harness({});
  await renderDarkRecovery(h);
  expect(screen.queryByTestId('app-recovery-notices')).toBeNull();
  expect(screen.queryByTestId('app-recovery-notices-scroll')).toBeNull();
  expect(screen.getByRole('button', { name: 'Explore reviewers' })).toBeVisible();
});
