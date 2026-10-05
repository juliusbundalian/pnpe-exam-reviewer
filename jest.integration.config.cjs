module.exports = {
  watchman: false,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/import/**/*.integration.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.tools.json' }] },
  testTimeout: 30000,
};
