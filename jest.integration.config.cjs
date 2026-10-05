module.exports = {
  // Keep dev-only compat registration on the pinned web SDK's app singleton.
  moduleNameMapper: {
    '^@firebase/app$': require.resolve('@firebase/app', {
      paths: [require.resolve('firebase/app')],
    }),
    '^@firebase/app-compat$': require.resolve('@firebase/app-compat', {
      paths: [require.resolve('firebase/compat/app')],
    }),
  },
  watchman: false,
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/import/**/*.integration.test.ts',
    '<rootDir>/tests/firebase/**/*.integration.test.ts',
  ],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.tools.json' }] },
  testTimeout: 30000,
};
