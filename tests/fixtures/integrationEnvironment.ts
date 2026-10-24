export function integrationEnvironment(
  env: NodeJS.ProcessEnv,
  requested?: 'study' | 'exam',
): {
  projectId: 'demo-pnpe';
  firestoreHost: '127.0.0.1';
  firestorePort: 8180 | 8280;
  authPort: 9199 | 9299;
} {
  const profile = requested ?? (env.PNPE_EXAM_TESTS === '1' ? 'exam' : 'study');
  if (profile === 'exam') {
    if (
      env.PNPE_EXAM_TESTS !== '1' ||
      env.PNPE_ISOLATED_TESTS === '1' ||
      env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8280' ||
      env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9299'
    ) {
      throw new Error('Run test:exam-emulator with Firestore 8280 and Auth 9299');
    }
    return {
      projectId: 'demo-pnpe',
      firestoreHost: '127.0.0.1',
      firestorePort: 8280,
      authPort: 9299,
    };
  }
  if (
    env.PNPE_ISOLATED_TESTS !== '1' ||
    env.PNPE_EXAM_TESTS === '1' ||
    env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180' ||
    env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9199'
  ) {
    throw new Error('Run test:emulator with explicitly isolated Firestore 8180 and Auth 9199');
  }
  return {
    projectId: 'demo-pnpe',
    firestoreHost: '127.0.0.1',
    firestorePort: 8180,
    authPort: 9199,
  };
}
