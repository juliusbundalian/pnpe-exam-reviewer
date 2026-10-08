export function integrationEnvironment(env: NodeJS.ProcessEnv): {
  projectId: 'demo-pnpe';
  firestoreHost: '127.0.0.1';
  firestorePort: 8180;
  authPort: 9199;
} {
  if (
    env.PNPE_ISOLATED_TESTS !== '1' ||
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
