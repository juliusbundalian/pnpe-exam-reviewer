import type { Readable, Writable } from 'node:stream';
import type { Question } from '../../src/features/content/domain/question';
import type { ImportStore } from './import-store';
import { applyImport, planImport } from './import-plan';
import type { IdentityRegistry } from './identity';
export interface CliDependencies {
  input: Readable;
  output: Writable;
  error: Writable;
  registryLoader: () => Promise<IdentityRegistry>;
  loadPublication: (registry: IdentityRegistry) => Promise<readonly Question[]>;
  process: (output?: string) => Promise<unknown>;
  readManifest: (file: string) => Promise<unknown>;
  writeManifest: (file: string, manifest: unknown) => Promise<void>;
  storeFactory: (target: {
    projectId: string;
    mode: 'emulator' | 'production';
    emulatorHost?: string;
  }) => Promise<{ projectId: string; store: ImportStore }>;
  emulatorHost?: string;
}
export function checkedTarget(projectId: string, emulatorHost?: string) {
  if (!/^[a-z][a-z0-9-]{3,62}$/.test(projectId)) throw new Error('Explicit valid project required');
  if (emulatorHost !== undefined) {
    if (projectId !== 'demo-pnpe') throw new Error('Emulator requires demo-pnpe');
    const match = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]+)$/.exec(emulatorHost);
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535)
      throw new Error('Emulator requires a localhost host:port');
  } else if (projectId.startsWith('demo-'))
    throw new Error('Demo project requires emulator endpoint');
  return {
    projectId,
    mode: emulatorHost === undefined ? ('production' as const) : ('emulator' as const),
    ...(emulatorHost === undefined ? {} : { emulatorHost }),
  };
}
export async function runCli(
  args: readonly string[],
  dependencies: CliDependencies,
): Promise<number> {
  try {
    const command = args[0];
    const flags = new Map<string, string | true>();
    const switches = new Set(['--apply', '--allow-production']);
    const values = new Set(['--project', '--manifest', '--confirm-digest', '--output']);
    for (let i = 1; i < args.length; i++) {
      const flag = args[i]!;
      if (flags.has(flag)) throw new Error('Duplicate flag');
      if (switches.has(flag)) flags.set(flag, true);
      else if (values.has(flag) && args[i + 1] && !args[i + 1]!.startsWith('--'))
        flags.set(flag, args[++i]!);
      else throw new Error(`Unknown or incomplete argument: ${flag}`);
    }
    const value = (key: string): string | undefined =>
      typeof flags.get(key) === 'string' ? (flags.get(key) as string) : undefined;
    if (command === 'process') {
      if ([...flags.keys()].some((key) => key !== '--output'))
        throw new Error('Unsupported process flags');
      dependencies.output.write(
        `${JSON.stringify(await dependencies.process(value('--output')))}\n`,
      );
    } else if (command === 'validate') {
      if (flags.size) throw new Error('Validate takes no flags');
      const questions = await dependencies.loadPublication(await dependencies.registryLoader());
      dependencies.output.write(`${JSON.stringify({ eligible: questions.length })}\n`);
    } else if (command === 'import') {
      if (flags.has('--output')) throw new Error('Import does not accept output');
      const target = checkedTarget(value('--project') ?? '', dependencies.emulatorHost);
      if (flags.has('--apply')) {
        if (!value('--manifest') || !value('--confirm-digest'))
          throw new Error('Apply requires manifest and confirm-digest');
        if (!target.emulatorHost && !flags.has('--allow-production'))
          throw new Error('Production apply requires allow-production');
      } else if (flags.has('--confirm-digest') || flags.has('--allow-production'))
        throw new Error('Apply flags require apply');
      const questions = await dependencies.loadPublication(await dependencies.registryLoader());
      const bound = await dependencies.storeFactory(target);
      if (bound.projectId !== target.projectId) throw new Error('Store target mismatch');
      if (flags.has('--apply')) {
        await applyImport(
          await dependencies.readManifest(value('--manifest')!),
          questions,
          bound.store,
          {
            projectId: target.projectId,
            manifestDigest: value('--confirm-digest')!,
          },
        );
        dependencies.output.write(`${JSON.stringify({ applied: questions.length })}\n`);
      } else {
        const manifest = await planImport(target.projectId, questions, bound.store);
        if (value('--manifest')) await dependencies.writeManifest(value('--manifest')!, manifest);
        dependencies.output.write(`${JSON.stringify(manifest, null, 2)}\n`);
      }
    } else throw new Error('Use process, validate, or import');
    return 0;
  } catch (error) {
    dependencies.error.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (require.main === module) {
  void (async () => {
    const { resolve } = await import('node:path');
    const workflow = await import('./source-workflow.js');
    const root = resolve(__dirname, '../..');
    process.exitCode = await runCli(process.argv.slice(2), {
      input: process.stdin,
      output: process.stdout,
      error: process.stderr,
      registryLoader: () => workflow.loadIdentityRegistry(root),
      loadPublication: (registry) => workflow.loadApprovedPublication(root, registry),
      process: (output) => workflow.processReferences(root, output),
      readManifest: workflow.readJson,
      writeManifest: (file, manifest) => workflow.writeGenerated(root, file, manifest),
      storeFactory: async (target) => {
        const { FirebaseImportStore } = await import('./firebase-import-store.js');
        const store = new FirebaseImportStore(target);
        return { projectId: store.projectId, store };
      },
      ...(process.env.FIRESTORE_EMULATOR_HOST === undefined
        ? {}
        : { emulatorHost: process.env.FIRESTORE_EMULATOR_HOST }),
    });
  })().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
