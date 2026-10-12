import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { integrationEnvironment } from '../../tests/fixtures/integrationEnvironment';

async function assertPortFree(host: string, port: number): Promise<void> {
  await new Promise<void>((accept, reject) => {
    const server = createServer();
    server.once('error', (error) => {
      reject(new Error(`Exam emulator port ${host}:${port} is unavailable`, { cause: error }));
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close((error) => (error ? reject(error) : accept()));
    });
  });
}

async function main(): Promise<void> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PNPE_ISOLATED_TESTS: undefined,
    PNPE_EXAM_TESTS: '1',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8280',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9299',
  };
  const target = integrationEnvironment(env, 'exam');
  for (const port of [target.firestorePort, target.authPort, 4640, 4740, 9350]) {
    await assertPortFree(target.firestoreHost, port);
  }
  const root = resolve(__dirname, '../..');
  const child = spawn(
    process.execPath,
    [
      resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js'),
      'emulators:exec',
      '--only',
      'auth,firestore',
      '--config',
      'firebase.exam-tests.json',
      '--project',
      target.projectId,
      './node_modules/.bin/jest --config jest.integration.config.cjs --runInBand',
    ],
    { cwd: root, env, stdio: 'inherit' },
  );
  child.once('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.once('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
