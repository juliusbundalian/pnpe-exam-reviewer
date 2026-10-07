import type { Auth } from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import type { Firestore } from '@react-native-firebase/firestore';
import { parseFirebaseEnvironment, type FirebaseEnvironment } from '../../bootstrap/environment';
import type { RemoteConfigService } from '../config/ConfigRepository';
import { defaults } from '../config/defaults';
import { NativeRemoteConfigService } from './NativeRemoteConfigService';

export type NativeServices =
  | {
      available: false;
      remoteConfigMode: 'unavailable';
      remoteConfig: RemoteConfigService;
    }
  | {
      available: true;
      auth: Auth;
      firestore: Firestore;
      remoteConfigMode: 'live' | 'emulator-defaults-not-live';
      remoteConfig: RemoteConfigService;
    };
let servicesPromise: Promise<NativeServices> | undefined;
let selectedEnvironment: string | undefined;

export function initializeNativeFirebase(input: FirebaseEnvironment): Promise<NativeServices> {
  const environment = parseFirebaseEnvironment(input);
  const key = JSON.stringify(environment);
  if (servicesPromise) {
    if (key !== selectedEnvironment)
      return Promise.reject(
        new Error('Firebase environment cannot change during this app lifetime.'),
      );
    return servicesPromise;
  }
  selectedEnvironment = key;
  servicesPromise = initialize(environment);
  return servicesPromise;
}
async function initialize(environment: FirebaseEnvironment): Promise<NativeServices> {
  if (environment.mode === 'unconfigured')
    return {
      available: false,
      remoteConfigMode: 'unavailable',
      remoteConfig: {
        fetch: async () => {
          throw new Error('Remote configuration is unavailable.');
        },
      },
    };
  const appSdk = await import('@react-native-firebase/app');
  // Never use the owner's default app in emulator mode. These public demo options
  // identify an isolated SDK app; they are not credentials or a signed-in user.
  const app =
    environment.mode === 'emulator'
      ? await appSdk.initializeApp(
          {
            projectId: 'demo-pnpe',
            appId: `1:1234567890:${Platform.OS === 'ios' ? 'ios' : 'android'}:0123456789abcdef`,
            // Synthetic demo metadata, not a credential: iOS Installations requires
            // 39 URL-safe characters starting with A even for emulator-only services.
            apiKey: 'A-demo-pnpe-emulator-only-0000000000000',
            messagingSenderId: '1234567890',
            // RNFirebase requires Database/Storage metadata for native app creation.
            // These services are unused; the URL and bucket identify only the demo project.
            databaseURL: `http://${environment.emulatorHost}:9000?ns=demo-pnpe`,
            storageBucket: 'demo-pnpe.appspot.com',
          },
          { name: 'pnpe-emulator', automaticDataCollectionEnabled: false },
        )
      : appSdk.getApp();
  if (app.options.projectId !== environment.projectId)
    throw new Error('Firebase project does not match the selected environment.');
  const [authSdk, firestoreSdk] = await Promise.all([
    import('@react-native-firebase/auth'),
    import('@react-native-firebase/firestore'),
  ]);
  const auth = authSdk.getAuth(app);
  const firestore = firestoreSdk.getFirestore(app);
  if (environment.mode === 'emulator') {
    authSdk.connectAuthEmulator(auth, `http://${environment.emulatorHost}:9099`, {
      disableWarnings: true,
    });
    firestoreSdk.connectFirestoreEmulator(firestore, environment.emulatorHost, 8080);
    return {
      available: true,
      auth,
      firestore,
      remoteConfigMode: 'emulator-defaults-not-live',
      remoteConfig: {
        fetch: async () => ({
          app_info: JSON.stringify(defaults.app_info),
          data: JSON.stringify(defaults.data),
          config: JSON.stringify(defaults.config),
        }),
      },
    };
  }
  return {
    available: true,
    auth,
    firestore,
    remoteConfigMode: 'live',
    remoteConfig: new NativeRemoteConfigService(app),
  };
}
