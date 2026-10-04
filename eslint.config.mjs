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
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' } },
);
