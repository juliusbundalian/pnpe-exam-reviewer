import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';

function findForbiddenImports(root: string, forbidden: string[]): string[] {
  const violations: string[] = [];
  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(file);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const local = relative(root, file).replaceAll('\\', '/');
      const adapter = local.startsWith('core/firebase/') || /^features\/[^/]+\/data\//.test(local);
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function inspect(node: ts.Node) {
        const dependency =
          ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
            ? node.moduleSpecifier
            : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
              ? node.arguments[0]
              : undefined;
        if (dependency && ts.isStringLiteralLike(dependency)) {
          const name = dependency.text;
          const resolved = relative(resolve(root, '..'), resolve(directory, name)).replaceAll(
            '\\',
            '/',
          );
          if (
            forbidden.some(
              (prefix) =>
                name === prefix ||
                name.startsWith(`${prefix}/`) ||
                (name.startsWith('.') &&
                  (resolved === prefix || resolved.startsWith(`${prefix}/`))),
            ) ||
            (!adapter && name.startsWith('@react-native-firebase/'))
          ) {
            violations.push(`${local}: ${name}`);
          }
        }
        ts.forEachChild(node, inspect);
      }
      inspect(source);
    }
  }
  walk(root);
  return violations;
}

test('boundary scanner catches imports, exports and dynamic imports but ignores comments', () => {
  const root = mkdtempSync(join(tmpdir(), 'pnpe-boundaries-'));
  try {
    mkdirSync(join(root, 'features/auth/presentation'), { recursive: true });
    writeFileSync(
      join(root, 'features/auth/presentation/Example.tsx'),
      `
      // import ignored from 'firebase-admin';
      const text = "import ignored from 'tools/questions'";
      import type { Auth } from '@react-native-firebase/auth';
      export { value } from 'firebase-admin/app';
      const tool = import('../../../../tools/questions/cli');
    `,
    );
    expect(findForbiddenImports(root, ['firebase-admin', 'tools/questions'])).toHaveLength(3);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test('mobile source never imports Admin SDK or question tooling; native SDK stays in adapters', () => {
  expect(findForbiddenImports('src', ['firebase-admin', 'firebase', 'tools/questions'])).toEqual(
    [],
  );
});

test.each([
  ['src/features/auth/domain/Example.ts', '../data/FirebaseAuthenticationRepository'],
  ['src/features/auth/application/Example.ts', '../presentation/SignInScreen'],
  ['src/features/auth/presentation/Example.tsx', '../data/FirebaseAuthenticationRepository'],
])('ESLint rejects layer violations in %s', (filePath, dependency) => {
  const run = spawnSync(
    process.execPath,
    [
      'node_modules/eslint/bin/eslint.js',
      '--stdin',
      '--stdin-filename',
      filePath,
      '--format',
      'json',
    ],
    { input: `export { value } from '${dependency}';`, encoding: 'utf8' },
  );
  const [result] = JSON.parse(run.stdout) as { messages: { ruleId: string }[] }[];
  expect(result?.messages.some((message) => message.ruleId === 'no-restricted-imports')).toBe(true);
});

test('native analytics collection is deactivated and every collection flag is false', () => {
  const config = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
    'react-native': Record<string, boolean>;
  };
  expect(config['react-native'].analytics_collection_deactivated).toBe(true);
  for (const [key, enabled] of Object.entries(config['react-native'])) {
    if (key !== 'analytics_collection_deactivated') expect(enabled).toBe(false);
  }
});

test('ESLint rejects dynamic data imports in presentation', () => {
  const run = spawnSync(
    process.execPath,
    [
      'node_modules/eslint/bin/eslint.js',
      '--stdin',
      '--stdin-filename',
      'src/features/auth/presentation/Example.tsx',
      '--format',
      'json',
    ],
    { input: "void import('../data/FirebaseAuthenticationRepository');", encoding: 'utf8' },
  );
  const [result] = JSON.parse(run.stdout) as { messages: { ruleId: string }[] }[];
  expect(result?.messages.some((message) => message.ruleId === 'no-restricted-syntax')).toBe(true);
});
