import type { ExpoConfig } from 'expo/config';
import { version } from './package.json';

const config: ExpoConfig = {
  name: 'PNPE Exam Reviewer',
  slug: 'pnpe-exam-reviewer',
  version,
  scheme: 'pnpe',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: 'com.pnpe.exam.reviewer', supportsTablet: true },
  android: { package: 'com.pnpe.exam.reviewer' },
  plugins: ['expo-router', 'expo-dev-client', 'expo-splash-screen', 'expo-status-bar'],
};

export default config;
