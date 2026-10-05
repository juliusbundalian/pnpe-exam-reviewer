import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'references/**',
      '.superpowers/**',
      '.worktrees/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['firebase-admin', 'firebase'],
          patterns: [
            { regex: '^firebase-admin/' },
            { regex: '^firebase/' },
            { group: ['**/tools/**'] },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^firebase(-admin)?(\\/|$)/]',
          message: 'Mobile code must not load Admin or web Firebase SDKs.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/core/firebase/**', 'src/features/**/data/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^firebase(-admin)?(\\/|$)/]',
          message: 'Mobile code must not load Admin or web Firebase SDKs.',
        },
        {
          selector: 'ImportExpression[source.value=/^@react-native-firebase\\//]',
          message: 'Native Firebase belongs in infrastructure adapters.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: ['firebase-admin', 'firebase'],
          patterns: [
            { regex: '^firebase-admin/' },
            { regex: '^firebase/' },
            { regex: '^@react-native-firebase/' },
            { group: ['**/tools/**'] },
          ],
        },
      ],
    },
  },
  {
    files: ['plugins/*.cjs', 'jest.mobile.config.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' } },
);
