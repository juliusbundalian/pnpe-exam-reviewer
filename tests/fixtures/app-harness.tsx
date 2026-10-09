import { Stack } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { AppProviders } from '../../src/bootstrap/AppProviders';
import { createAppDependencies, composeNativeApp } from '../../src/bootstrap/composition';
import type { NativeServices } from '../../src/core/firebase/native';
import { ConfigRepository, type ConfigModels } from '../../src/core/config/ConfigRepository';
import { defaults } from '../../src/core/config/defaults';
import { FirebaseCategoryRepository } from '../../src/features/content/data/FirebaseCategoryRepository';
import type { AuthState } from '../../src/features/auth/domain/AuthenticationRepository';
import {
  authUser,
  FakeAuthenticationRepository,
  MemoryIntentStore,
  flushTransitions,
} from './auth-harness';
export function createAppHarness({
  initialAuth = { status: 'guest' },
  config = defaults,
  profileFailure = false,
  nativeServices,
  study,
}: {
  initialAuth?: AuthState;
  config?: ConfigModels;
  profileFailure?: boolean;
  nativeServices?: () => Promise<NativeServices>;
  study?: import('../../src/bootstrap/composition').AppPorts['study'];
} = {}) {
  const storage = new MemoryIntentStore();
  const auth = new FakeAuthenticationRepository(initialAuth);
  auth.signIn.mockImplementation(async () => {
    const user = authUser('alice');
    auth.emit({ status: 'authenticated', user });
    return user;
  });
  auth.register.mockImplementation(async () => {
    const user = authUser('alice');
    auth.emit({ status: 'authenticated', user });
    return user;
  });
  const profiles = {
    get: jest.fn(async (uid: string) => {
      if (!uid) throw new Error('missing uid');
      return { displayName: 'Alice' };
    }),
    save: jest.fn(async (uid: string, profile: { displayName: string }) => {
      if (!uid || !profile.displayName || profileFailure) throw new Error('offline');
    }),
  };
  const repository = new ConfigRepository(
    {
      fetch: async () => ({
        app_info: JSON.stringify(config.app_info),
        config: JSON.stringify(config.config),
        data: JSON.stringify(config.data),
      }),
    },
    storage,
  );
  const dependencies = nativeServices
    ? composeNativeApp({ config: repository, safeStorage: storage, nativeServices })
    : createAppDependencies({
        auth,
        ...(study ? { study } : {}),
        storage,
        profiles,
        config: repository,
        categories: new FirebaseCategoryRepository({ listCategories: async () => [] }),
      });
  const events: string[] = [];
  const bind = dependencies.bindNavigation;
  dependencies.bindNavigation = (handlers) =>
    bind({
      resume: async (action, user, id) => {
        events.push(action.type);
        await handlers.resume(action, user, id);
      },
      returnTo: (origin) => {
        events.push(`return:${origin.type}`);
        handlers.returnTo(origin);
      },
    });
  return {
    dependencies,
    auth,
    profiles,
    events,
    async render(initialUrl = '/') {
      await repository.refresh();
      const result = renderRouter(
        {
          appDir: `${process.cwd()}/src/app`,
          overrides: {
            _layout: () => (
              <ThemeProvider storage={storage}>
                <AppProviders dependencies={dependencies}>
                  <Stack screenOptions={{ headerShown: false }} />
                </AppProviders>
              </ThemeProvider>
            ),
          },
        },
        { initialUrl },
      );
      await act(flushTransitions);
      return result;
    },
    async authenticate(uid: string) {
      await act(async () => {
        auth.emit({ status: 'authenticated', user: authUser(uid) });
        await flushTransitions();
      });
    },
    async emit(state: AuthState) {
      await act(async () => {
        auth.emit(state);
        await flushTransitions();
      });
    },
    dispose() {
      dependencies.dispose();
    },
  };
}
