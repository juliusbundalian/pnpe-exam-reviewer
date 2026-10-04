module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/references/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.tools.json' }] },
};
