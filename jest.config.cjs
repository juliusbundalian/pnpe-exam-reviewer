module.exports = {
  watchman: false,
  testEnvironment: 'node',
  testPathIgnorePatterns: ['\\.integration\\.test\\.ts$'],
  testMatch: [
    '<rootDir>/tests/content/**/*.test.ts',
    '<rootDir>/tests/import/**/*.test.ts',
    '<rootDir>/tests/application/**/*.test.ts',
  ],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.tools.json' }] },
};
