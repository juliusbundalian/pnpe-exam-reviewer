import { screen, waitFor, renderRouter, act } from 'expo-router/testing-library';
import { flushTransitions } from '../fixtures/auth-harness';
import { Slot } from 'expo-router';
import { initializeNativeFirebase } from '../../src/core/firebase/native';
import { parseFirebaseEnvironment } from '../../src/bootstrap/environment';
import { noOpAnalytics } from '../../src/core/analytics/AnalyticsService';
import { NativeAppProviders } from '../../src/bootstrap/AppProviders';
import { PublicBootstrapProvider } from '../../src/bootstrap/PublicBootstrapProvider';
import { MemoryKeyValueStore } from '../fixtures/config';
import { Platform } from 'react-native';
async function renderPublicHome(storage = new MemoryKeyValueStore()) {
  const result = renderRouter(
    {
      appDir: `${process.cwd()}/src/app`,
      overrides: {
        _layout: () => (
          <PublicBootstrapProvider storage={storage} environment={{ mode: 'unconfigured' }}>
            <NativeAppProviders>
              <Slot />
            </NativeAppProviders>
          </PublicBootstrapProvider>
        ),
      },
    },
    { initialUrl: '/' },
  );
  await act(flushTransitions);
  return result;
}

jest.mock('@react-native-firebase/app', () => ({
  getApp: () => {
    throw new Error('Native SDK must not load');
  },
}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => {
    throw new Error('Auth must not initialize');
  },
}));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => {
    throw new Error('Firestore must not initialize');
  },
}));

test('missing native configuration composes unavailable services and keeps Home public', async () => {
  const services = await initializeNativeFirebase({ mode: 'unconfigured' });
  expect(services).toMatchObject({ available: false, remoteConfigMode: 'unavailable' });
  await expect(services.remoteConfig.fetch()).rejects.toThrow(/unavailable/i);
  await renderPublicHome();
  expect(screen.getByRole('button', { name: 'Explore reviewers' })).toBeVisible();
});
test('initialization shares one infrastructure lifetime', () => {
  expect(initializeNativeFirebase({ mode: 'unconfigured' })).toBe(
    initializeNativeFirebase({ mode: 'unconfigured' }),
  );
});
test('no-op analytics emits no console output', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  noOpAnalytics.track({ name: 'public_home_opened' });
  expect(log).not.toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
  log.mockRestore();
  info.mockRestore();
});
test('emulator boundary rejects production namespace and missing or unsafe hosts', () => {
  expect(
    parseFirebaseEnvironment({
      mode: 'emulator',
      projectId: 'production-project',
      emulatorHost: '127.0.0.1',
    }),
  ).toEqual({ mode: 'unconfigured' });
  expect(parseFirebaseEnvironment({ mode: 'emulator', projectId: 'demo-pnpe' })).toEqual({
    mode: 'unconfigured',
  });
  expect(
    parseFirebaseEnvironment({
      mode: 'emulator',
      projectId: 'demo-pnpe',
      emulatorHost: 'https://example.com',
    }),
  ).toEqual({ mode: 'unconfigured' });
  expect(
    parseFirebaseEnvironment({
      mode: 'emulator',
      projectId: 'demo-pnpe',
      emulatorHost: '10.0.2.2',
    }),
  ).toEqual({ mode: 'emulator', projectId: 'demo-pnpe', emulatorHost: '10.0.2.2' });
});

test('public composition exposes storage recovery and keeps Home interactive', async () => {
  const storage = new MemoryKeyValueStore();
  storage.failReads = true;
  const rendered = await renderPublicHome(storage);
  expect(await screen.findByText(/saved settings are unavailable/i)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Explore reviewers' })).toBeVisible();
  rendered.unmount();
});

test('recovery remains readable when stored appearance is dark', async () => {
  const storage = new MemoryKeyValueStore();
  storage.get = async (key) => {
    if (key === 'pnpe.appearance') return '{"version":1,"appearance":"dark"}';
    throw new Error('unavailable');
  };
  const rendered = await renderPublicHome(storage);
  await screen.findByText(/saved settings are unavailable/i);
  await waitFor(() =>
    expect(screen.getByTestId('public-recovery-notice')).toHaveStyle({
      backgroundColor: '#101925',
    }),
  );
  expect(screen.getByText(/saved settings are unavailable/i)).toHaveStyle({ color: '#eef3fc' });
  rendered.unmount();
});

test('emulator services use the isolated SDK app and explicit local ports, never default app', async () => {
  const app = { name: 'pnpe-emulator', options: { projectId: 'demo-pnpe' } };
  const initializeApp = jest.fn(async () => app);
  const auth = { app };
  const firestore = { app };
  const connectAuthEmulator = jest.fn();
  const connectFirestoreEmulator = jest.fn();
  jest.doMock('@react-native-firebase/app', () => ({
    initializeApp,
    getApp: () => {
      throw new Error('Default app must never be used');
    },
  }));
  jest.doMock('@react-native-firebase/auth', () => ({
    getAuth: (selected: unknown) => {
      expect(selected).toBe(app);
      return auth;
    },
    connectAuthEmulator,
  }));
  jest.doMock('@react-native-firebase/firestore', () => ({
    getFirestore: (selected: unknown) => {
      expect(selected).toBe(app);
      return firestore;
    },
    connectFirestoreEmulator,
  }));
  await jest.isolateModulesAsync(async () => {
    const native = await import('../../src/core/firebase/native');
    const services = await native.initializeNativeFirebase({
      mode: 'emulator',
      projectId: 'demo-pnpe',
      emulatorHost: '10.0.2.2',
    });
    expect(services.remoteConfigMode).toBe('emulator-defaults-not-live');
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'demo-pnpe',
        appId: expect.stringMatching(/^1:1234567890:(ios|android):[a-f0-9]+$/),
      }),
      { name: 'pnpe-emulator', automaticDataCollectionEnabled: false },
    );
    expect(connectAuthEmulator).toHaveBeenCalledWith(auth, 'http://10.0.2.2:9099', {
      disableWarnings: true,
    });
    expect(connectFirestoreEmulator).toHaveBeenCalledWith(firestore, '10.0.2.2', 8080);
    expect(JSON.parse((await services.remoteConfig.fetch()).config).mockExam.questionCount).toBe(
      150,
    );
    await expect(
      native.initializeNativeFirebase({ mode: 'configured', projectId: 'another-project' }),
    ).rejects.toThrow(/cannot change/);
  });
});

test.each(['ios', 'android'] as const)(
  'emulator options pass installed JS validation and %s native metadata contract before creating isolated services',
  async (platform) => {
    const os = jest.replaceProperty(Platform, 'OS', platform);
    const createNativeApp = jest.fn(async (options: { apiKey: string; appId: string }) => {
      if (platform === 'ios') {
        // Native pods cannot execute in Jest. Mirror the installed FIRInstallations.m
        // validateAPIKey contract at the bridge; retain the real RNFirebase JS validator.
        if (!/^A[A-Za-z0-9_-]{38}$/.test(options.apiKey))
          throw new Error('I-FIS008000: API key must be 39 URL-safe characters starting with A');
        // FIRApp.m accepts v1 numeric-project:ios:hex64 IDs without checking the bundle hash.
        if (!/^1:[0-9]+:ios:[a-fA-F0-9]{1,16}$/.test(options.appId))
          throw new Error('Invalid iOS v1 app ID metadata');
      }
    });
    jest.doMock('@react-native-firebase/app/dist/module/internal/registry/nativeModule', () => ({
      getAppModule: () => ({ initializeApp: createNativeApp }),
    }));
    jest.doMock('@react-native-firebase/app', () => {
      const registry = jest.requireActual<{
        initializeApp: typeof import('@react-native-firebase/app').initializeApp;
      }>('@react-native-firebase/app/dist/module/internal/registry/app');
      return {
        initializeApp: registry.initializeApp,
        getApp: () => {
          throw new Error('Emulator services must never use the default app');
        },
      };
    });
    jest.doMock('@react-native-firebase/auth', () => ({
      getAuth: (app: unknown) => ({ app }),
      connectAuthEmulator: jest.fn(),
    }));
    jest.doMock('@react-native-firebase/firestore', () => ({
      getFirestore: (app: unknown) => ({ app }),
      connectFirestoreEmulator: jest.fn(),
    }));
    try {
      await jest.isolateModulesAsync(async () => {
        const native = await import('../../src/core/firebase/native');
        const services = await native.initializeNativeFirebase({
          mode: 'emulator',
          projectId: 'demo-pnpe',
          emulatorHost: '10.0.2.2',
        });
        expect(services).toMatchObject({
          available: true,
          auth: { app: { name: 'pnpe-emulator', options: { projectId: 'demo-pnpe' } } },
          firestore: { app: { name: 'pnpe-emulator', options: { projectId: 'demo-pnpe' } } },
          remoteConfigMode: 'emulator-defaults-not-live',
        });
        expect(createNativeApp).toHaveBeenCalledWith(
          expect.objectContaining({
            databaseURL: 'http://10.0.2.2:9000?ns=demo-pnpe',
            storageBucket: 'demo-pnpe.appspot.com',
          }),
          { name: 'pnpe-emulator', automaticDataCollectionEnabled: false },
        );
      });
    } finally {
      os.restore();
    }
  },
);

test('live Remote Config applies defaults and timeout and returns raw strings for repository validation', async () => {
  const app = { name: '[DEFAULT]', options: { projectId: 'owner-project' } };
  const config = {
    app,
    defaultConfig: {},
    settings: {},
    fetchTimeMillis: 0,
    lastFetchStatus: 'no-fetch-yet',
  };
  const raw: Record<string, string> = {
    app_info: '{malformed',
    data: '{"faq":[]}',
    config: '{"newField":true}',
  };
  const fetchAndActivate = jest.fn(async (selected: unknown) => {
    expect(selected).toBe(config);
    expect(config.settings).toMatchObject({ fetchTimeoutMillis: 5000 });
    expect(
      JSON.parse((config.defaultConfig as Record<string, string>).config!).mockExam
        .passingPercentage,
    ).toBe(75);
    return true;
  });
  jest.doMock('@react-native-firebase/remote-config', () => ({
    getRemoteConfig: () => config,
    fetchAndActivate,
    getValue: (_selected: unknown, key: string) => ({ asString: () => raw[key] }),
  }));
  await jest.isolateModulesAsync(async () => {
    const { NativeRemoteConfigService } =
      await import('../../src/core/firebase/NativeRemoteConfigService');
    const service = new NativeRemoteConfigService(
      app as Parameters<typeof import('@react-native-firebase/auth').getAuth>[0] & object,
    );
    await expect(service.fetch()).resolves.toEqual(raw);
    expect(fetchAndActivate).toHaveBeenCalledTimes(1);
  });
});

test.each([true, false])(
  'configured native initialization checks project before Auth/Firestore, match=%s',
  async (matches) => {
    const app = { name: '[DEFAULT]', options: { projectId: 'owner-project' } };
    const auth = { app };
    const firestore = { app };
    const getAuth = jest.fn(() => auth);
    const getFirestore = jest.fn(() => firestore);
    jest.doMock('@react-native-firebase/app', () => ({ getApp: () => app }));
    jest.doMock('@react-native-firebase/auth', () => ({ getAuth }));
    jest.doMock('@react-native-firebase/firestore', () => ({ getFirestore }));
    jest.doMock('@react-native-firebase/remote-config', () => ({
      getRemoteConfig: () => ({ app, defaultConfig: {}, settings: {} }),
    }));
    await jest.isolateModulesAsync(async () => {
      const native = await import('../../src/core/firebase/native');
      const result = native.initializeNativeFirebase({
        mode: 'configured',
        projectId: matches ? 'owner-project' : 'wrong-project',
      });
      if (matches) {
        await expect(result).resolves.toMatchObject({
          available: true,
          auth,
          firestore,
          remoteConfigMode: 'live',
        });
        expect(getAuth).toHaveBeenCalledWith(app);
        expect(getFirestore).toHaveBeenCalledWith(app);
      } else {
        await expect(result).rejects.toThrow('Firebase project does not match');
        expect(getAuth).not.toHaveBeenCalled();
        expect(getFirestore).not.toHaveBeenCalled();
      }
    });
  },
);

test.each([0, -1, 65536, 8180.5, '8180', null])(
  'emulator rejects invalid port override %p',
  (port) => {
    expect(
      parseFirebaseEnvironment({
        mode: 'emulator',
        projectId: 'demo-pnpe',
        emulatorHost: '127.0.0.1',
        firestorePort: port,
      }),
    ).toEqual({ mode: 'unconfigured' });
  },
);
test('explicit isolated study ports connect both SDK services to test endpoints', async () => {
  const app = { name: 'pnpe-emulator', options: { projectId: 'demo-pnpe' } };
  const connectAuthEmulator = jest.fn();
  const connectFirestoreEmulator = jest.fn();
  jest.doMock('@react-native-firebase/app', () => ({ initializeApp: async () => app }));
  jest.doMock('@react-native-firebase/auth', () => ({
    getAuth: () => 'auth',
    connectAuthEmulator,
  }));
  jest.doMock('@react-native-firebase/firestore', () => ({
    getFirestore: () => 'db',
    connectFirestoreEmulator,
  }));
  await jest.isolateModulesAsync(async () => {
    const native = await import('../../src/core/firebase/native');
    await native.initializeNativeFirebase(
      parseFirebaseEnvironment({
        mode: 'emulator',
        projectId: 'demo-pnpe',
        emulatorHost: '10.0.2.2',
        authPort: 9199,
        firestorePort: 8180,
      }),
    );
    expect(connectAuthEmulator).toHaveBeenCalledWith('auth', 'http://10.0.2.2:9199', {
      disableWarnings: true,
    });
    expect(connectFirestoreEmulator).toHaveBeenCalledWith('db', '10.0.2.2', 8180);
  });
});
