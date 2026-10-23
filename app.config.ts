/// <reference types="node" />
import type { ExpoConfig } from 'expo/config';
import { version } from './package.json';
import { existsSync } from 'node:fs';

const iosFile = process.env.GOOGLE_SERVICES_IOS ?? '';
const androidFile = process.env.GOOGLE_SERVICES_ANDROID ?? '';
// Both platforms must be explicitly configured. No native configure call is
// inserted into public-only builds, where no default Firebase app exists.
const configured = Boolean(
  iosFile && androidFile && existsSync(iosFile) && existsSync(androidFile),
);

const config: ExpoConfig = {
  name: 'PNPE Exam Reviewer',
  slug: 'pnpe-exam-reviewer',
  version,
  icon: './assets/icon.png',
  scheme: 'pnpe',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.pnpe.exam.reviewer',
    supportsTablet: true,
    ...(configured ? { googleServicesFile: iosFile } : {}),
  },
  android: {
    package: 'com.pnpe.exam.reviewer',
    versionCode: 3,
    ...(configured ? { googleServicesFile: androidFile } : {}),
  },
  extra: {
    firebase: configured
      ? {
          mode: process.env.EXPO_PUBLIC_FIREBASE_MODE ?? 'configured',
          projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
          emulatorHost: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
          ...(process.env.EXPO_PUBLIC_FIREBASE_AUTH_PORT === undefined
            ? {}
            : { authPort: Number(process.env.EXPO_PUBLIC_FIREBASE_AUTH_PORT) }),
          ...(process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_PORT === undefined
            ? {}
            : { firestorePort: Number(process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_PORT) }),
        }
      : { mode: 'unconfigured' },
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-splash-screen',
    'expo-status-bar',
    'expo-sqlite',
    ...(configured
      ? ([
          ['@react-native-firebase/app', { ios: { disableSPM: true } }],
          '@react-native-firebase/auth',
        ] as NonNullable<ExpoConfig['plugins']>)
      : ['./plugins/withFirebaseCocoaPods.cjs']),
    [
      '@react-native-firebase/analytics',
      { ios: { withoutAdIdSupport: true, googleAppMeasurementOnDeviceConversion: false } },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
          forceStaticLinking: [
            'RNFBApp',
            'RNFBAuth',
            'RNFBFirestore',
            'RNFBRemoteConfig',
            'RNFBAnalytics',
          ],
        },
      },
    ],
  ],
};

export default config;
