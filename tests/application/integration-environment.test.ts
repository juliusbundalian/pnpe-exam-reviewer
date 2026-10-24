import { integrationEnvironment } from '../fixtures/integrationEnvironment';

const isolated = {
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199',
  PNPE_ISOLATED_TESTS: '1',
};

test('rejects_live_and_missing_endpoints', () => {
  expect(() =>
    integrationEnvironment({
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199',
      PNPE_ISOLATED_TESTS: '1',
    }),
  ).toThrow();
  for (const unsafe of [
    {},
    { ...isolated, FIRESTORE_EMULATOR_HOST: undefined },
    { ...isolated, FIREBASE_AUTH_EMULATOR_HOST: undefined },
    { ...isolated, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
    { ...isolated, FIRESTORE_EMULATOR_HOST: 'remote.example:8180' },
    { ...isolated, FIREBASE_AUTH_EMULATOR_HOST: 'remote.example:9199' },
    { ...isolated, FIRESTORE_EMULATOR_HOST: 'localhost:8180' },
    { ...isolated, FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9199' },
    { ...isolated, PNPE_ISOLATED_TESTS: undefined },
    { ...isolated, PNPE_ISOLATED_TESTS: '0' },
  ]) {
    expect(() => integrationEnvironment(unsafe)).toThrow();
  }
});

test('accepts_only_explicit_isolated_endpoints', () => {
  expect(integrationEnvironment(isolated)).toEqual({
    projectId: 'demo-pnpe',
    firestoreHost: '127.0.0.1',
    firestorePort: 8180,
    authPort: 9199,
  });
});

test('exam profile accepts only its separate 8280/9299 ports and explicit flag', () => {
  const exam = {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8280',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9299',
    PNPE_EXAM_TESTS: '1',
  };
  expect(integrationEnvironment(exam, 'exam')).toMatchObject({
    firestorePort: 8280,
    authPort: 9299,
  });
  expect(integrationEnvironment(exam)).toMatchObject({ firestorePort: 8280, authPort: 9299 });
  expect(() => integrationEnvironment(isolated, 'exam')).toThrow();
  expect(() => integrationEnvironment({ ...exam, PNPE_EXAM_TESTS: '0' }, 'exam')).toThrow();
  expect(() =>
    integrationEnvironment({ ...exam, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180' }, 'exam'),
  ).toThrow();
});
