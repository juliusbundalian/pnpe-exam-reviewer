import { FirebaseImportStore } from '../../tools/questions/firebase-import-store';
import { applyImport, planImport } from '../../tools/questions/import-plan';
import { testQuestion } from '../fixtures/content/question';
import type { ImportStore } from '../../tools/questions/import-store';
import { integrationEnvironment } from '../fixtures/integrationEnvironment';

const target = integrationEnvironment(process.env);
const host = `${target.firestoreHost}:${target.firestorePort}`;
const store = new FirebaseImportStore({
  projectId: target.projectId,
  mode: 'emulator',
  emulatorHost: host,
});
beforeEach(async () => {
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${target.projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw new Error('Emulator reset failed');
});
async function apply(target: ImportStore, questions = [testQuestion()]) {
  const manifest = await planImport('demo-pnpe', questions, target);
  await applyImport(manifest, questions, target, {
    projectId: 'demo-pnpe',
    manifestDigest: manifest.manifestDigest,
  });
  return manifest;
}
test('interrupted staging keeps prior head and immutable revisions resume', async () => {
  const previous = await apply(store);
  const next = testQuestion({ version: 2 });
  const interrupted: ImportStore = {
    readRevision: store.readRevision.bind(store),
    readHead: store.readHead.bind(store),
    createRevision: store.createRevision.bind(store),
    readShard: store.readShard.bind(store),
    publishHead: store.publishHead.bind(store),
    writeShard: async () => {
      throw new Error('Interrupted shard upload');
    },
  };
  await expect(apply(interrupted, [next])).rejects.toThrow('Interrupted');
  expect(await store.readHead()).toEqual({ generation: previous.generation, revision: 1 });
  expect(await store.readRevision(next.id, 2)).toEqual(next);
  const resumed = await apply(store, [next]);
  expect(await store.readHead()).toEqual({ generation: resumed.generation, revision: 2 });
  expect(await store.readRevision(next.id, 1)).toEqual(testQuestion());
  expect(await store.readShard(previous.generation, previous.shardDigests[0]!.id)).toHaveLength(1);
});
test('identical retry is a no-op with unchanged head revision', async () => {
  const manifest = await apply(store);
  await apply(store);
  expect(await store.readHead()).toEqual({ generation: manifest.generation, revision: 1 });
});
test('stale manifest and competing CAS cannot replace newer head', async () => {
  const next = testQuestion({ id: 'another' });
  const stale = await planImport('demo-pnpe', [next], store);
  const winner = await apply(store);
  await expect(
    applyImport(stale, [next], store, {
      projectId: 'demo-pnpe',
      manifestDigest: stale.manifestDigest,
    }),
  ).rejects.toThrow('Head');
  await expect(store.publishHead(0, stale.generation)).rejects.toThrow('head');
  expect(await store.readHead()).toEqual({ generation: winner.generation, revision: 1 });
});
test('immutable create retries compare bytes and reject changed content', async () => {
  await store.createRevision(testQuestion());
  await store.createRevision(testQuestion());
  await expect(store.createRevision(testQuestion({ correctChoiceId: 'c1' }))).rejects.toThrow(
    'Immutable',
  );
  expect(await store.readRevision(testQuestion().id, 1)).toEqual(testQuestion());
});
test('immutable shards compare existing metadata without overwriting it', async () => {
  const manifest = await apply(store);
  const shard = manifest.shardDigests[0]!;
  const entries = await store.readShard(manifest.generation, shard.id);
  await store.writeShard(manifest.generation, shard.id, entries);
  await expect(
    store.writeShard(manifest.generation, shard.id, [{ ...entries[0]!, status: 'archived' }]),
  ).rejects.toThrow('Immutable');
  expect(await store.readShard(manifest.generation, shard.id)).toEqual(entries);
});
test('deny-all rules reject unauthenticated client reads and writes', async () => {
  const url = `http://${host}/v1/projects/${target.projectId}/databases/(default)/documents/questions/client`;
  expect((await fetch(url)).status).toBe(403);
  expect(
    (
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { value: { stringValue: 'forbidden' } } }),
      })
    ).status,
  ).toBe(403);
});
