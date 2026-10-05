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
          patterns: ['firebase-admin', 'firebase-admin/*', 'firebase', 'firebase/*', '**/tools/**'],
        },
      ],
    },
  },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' } },
);
