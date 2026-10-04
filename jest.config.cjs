module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/content/**/*.test.ts', '<rootDir>/tests/import/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.tools.json' }] },
};
