import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'references/**',
      '.superpowers/**',
      '.worktrees/**',
      'ios/**',
      'android/**',
      '.expo/**',
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
            { regex: '(^|/)tools(/|$)' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/(^|\\/)tools(\\/|$)/]',
          message: 'Mobile code must not load repository developer tools.',
        },
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
          selector: 'ImportExpression[source.value=/(^|\\/)tools(\\/|$)/]',
          message: 'Mobile code must not load repository developer tools.',
        },
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
            { regex: '(^|/)tools(/|$)' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/{domain,application,presentation}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/(^|\\/)tools(\\/|$)/]',
          message: 'Mobile code must not load repository developer tools.',
        },
        {
          selector: 'ImportExpression[source.value=/^firebase(-admin)?(\\/|$)/]',
          message: 'Mobile code must not load Admin or web Firebase SDKs.',
        },
        {
          selector: 'ImportExpression[source.value=/^@react-native-firebase\\//]',
          message: 'Native Firebase belongs in infrastructure adapters.',
        },
        {
          selector: 'ImportExpression[source.value=/(^|\\/)(data|tools)\\//]',
          message: 'Use domain ports instead of importing data adapters or developer tools.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: ['firebase-admin', 'firebase'],
          patterns: [
            { regex: '^firebase(-admin)?/' },
            { regex: '^@react-native-firebase/' },
            { regex: '(^|/)tools(/|$)' },
            { group: ['**/data/**'] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/{domain,application}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^(react|react-native|expo-router)$/]',
          message: 'Domain/application code cannot depend on UI packages.',
        },
        {
          selector: 'ImportExpression[source.value=/(^|\\/)tools(\\/|$)/]',
          message: 'Mobile code must not load repository developer tools.',
        },
        {
          selector: 'ImportExpression[source.value=/^firebase(-admin)?(\\/|$)/]',
          message: 'Mobile code must not load Admin or web Firebase SDKs.',
        },
        {
          selector: 'ImportExpression[source.value=/^@react-native-firebase\\//]',
          message: 'Native Firebase belongs in infrastructure adapters.',
        },
        {
          selector:
            'ImportExpression[source.value=/(^|\\/)(data|tools|presentation|components)\\//]',
          message: 'Domain/application code cannot depend on adapters or UI.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: ['firebase-admin', 'firebase', 'react', 'react-native', 'expo-router'],
          patterns: [
            { regex: '^firebase(-admin)?/' },
            { regex: '^@react-native-firebase/' },
            { regex: '(^|/)tools(/|$)' },
            { group: ['**/data/**', '**/presentation/**', '**/components/**'] },
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
