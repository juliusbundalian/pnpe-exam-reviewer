import { PassThrough } from 'node:stream';
import { runCli, type CliDependencies } from '../../tools/questions/cli';
import { MemoryImportStore } from './memory-store';
import { testQuestion } from '../fixtures/content/question';
import { planImport } from '../../tools/questions/import-plan';
import { safeGeneratedPath } from '../../tools/questions/source-workflow';

function createCliHarness() {
  const store = new MemoryImportStore();
  const output = new PassThrough();
  const error = new PassThrough();
  let stderr = '';
  error.on('data', (chunk) => {
    stderr += String(chunk);
  });
  const questions = [testQuestion()];
  const dependencies: CliDependencies = {
    input: new PassThrough(),
    output,
    error,
    registryLoader: async () => ({ 'synthetic-test-only:fixture:1': 'fixture-percentage' }),
    loadPublication: async () => questions,
    process: async () => ({ occurrences: 1 }),
    readManifest: async () => {
      throw new Error('Missing manifest');
    },
    writeManifest: async () => {},
    storeFactory: async (target) => ({ projectId: target.projectId, store }),
    emulatorHost: '127.0.0.1:8080',
  };
  return { store, dependencies, stderr: () => stderr };
}
test('import defaults to dry run with no remote mutations', async () => {
  const harness = createCliHarness();
  expect(await runCli(['import', '--project', 'demo-pnpe'], harness.dependencies)).toBe(0);
  expect(harness.store.writes).toEqual([]);
});
test('missing target fails before importing', async () => {
  const h = createCliHarness();
  expect(await runCli(['import'], h.dependencies)).toBe(1);
  expect(h.store.writes).toEqual([]);
});
test.each([
  ['--apply'],
  ['--apply', '--manifest', 'plan.json'],
  ['--apply', '--manifest', 'plan.json', '--confirm-digest', '0'.repeat(64)],
])('production apply is blocked when gates are omitted: %j', async (...flags) => {
  const h = createCliHarness();
  delete h.dependencies.emulatorHost;
  expect(await runCli(['import', '--project', 'production-target', ...flags], h.dependencies)).toBe(
    1,
  );
  expect(h.store.writes).toEqual([]);
});
test('validate fails on an unapproved hand-edited snapshot', async () => {
  const h = createCliHarness();
  h.dependencies.loadPublication = async () => {
    throw new Error('Published approval digest mismatch');
  };
  expect(await runCli(['validate'], h.dependencies)).toBe(1);
});
test('nonlocalhost emulator endpoint is rejected before access', async () => {
  const h = createCliHarness();
  h.dependencies.emulatorHost = 'example.com:8080';
  expect(await runCli(['import', '--project', 'demo-pnpe'], h.dependencies)).toBe(1);
});
test('store target mismatch rejects before any write', async () => {
  const h = createCliHarness();
  h.dependencies.storeFactory = async () => ({ projectId: 'other', store: h.store });
  expect(await runCli(['import', '--project', 'demo-pnpe'], h.dependencies)).toBe(1);
  expect(h.store.writes).toEqual([]);
});
test('explicit reviewed emulator manifest applies the approved fixture snapshot', async () => {
  const h = createCliHarness();
  const manifest = await planImport('demo-pnpe', [testQuestion()], h.store);
  h.dependencies.readManifest = async () => manifest;
  expect(
    await runCli(
      [
        'import',
        '--apply',
        '--project',
        'demo-pnpe',
        '--manifest',
        'fixture.json',
        '--confirm-digest',
        manifest.manifestDigest,
      ],
      h.dependencies,
    ),
  ).toBe(0);
  expect(await h.store.readHead()).toEqual({ generation: manifest.generation, revision: 1 });
});
test('wrong confirmation digest cannot apply a manifest', async () => {
  const h = createCliHarness();
  const manifest = await planImport('demo-pnpe', [testQuestion()], h.store);
  h.dependencies.readManifest = async () => manifest;
  expect(
    await runCli(
      [
        'import',
        '--apply',
        '--project',
        'demo-pnpe',
        '--manifest',
        'fixture.json',
        '--confirm-digest',
        '0'.repeat(64),
      ],
      h.dependencies,
    ),
  ).toBe(1);
  expect(h.store.writes).toEqual([]);
});
test('process refuses a source directory output', async () => {
  const h = createCliHarness();
  h.dependencies.process = async (output) => safeGeneratedPath(process.cwd(), output!);
  expect(await runCli(['process', '--output', 'references/generated.json'], h.dependencies)).toBe(
    1,
  );
});
