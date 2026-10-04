import { planImport, applyImport } from '../../tools/questions/import-plan';
import { MemoryImportStore } from './memory-store';
import { testQuestion } from '../fixtures/content/question';

test('dry run performs no writes', async () => {
  const store = new MemoryImportStore();
  await planImport('demo-pnpe', [testQuestion()], store);
  expect(store.writes).toEqual([]);
});

test('wrong target confirmation rejects before writes', async () => {
  const store = new MemoryImportStore();
  const plan = await planImport('demo-pnpe', [testQuestion()], store);
  await expect(
    applyImport(plan, [testQuestion()], store, {
      projectId: 'other',
      manifestDigest: plan.manifestDigest,
    }),
  ).rejects.toThrow('target');
  expect(store.writes).toEqual([]);
});

async function apply(store: MemoryImportStore, questions = [testQuestion()]) {
  const plan = await planImport('demo-pnpe', questions, store);
  await applyImport(plan, questions, store, {
    projectId: 'demo-pnpe',
    manifestDigest: plan.manifestDigest,
  });
  return plan;
}
test('interrupted upload preserves head and resumes', async () => {
  const store = new MemoryImportStore({ head: { generation: 'previous', revision: 3 } });
  store.failShard = 'quantitativeReasoning-basicConcepts-0000';
  await expect(apply(store)).rejects.toThrow('Injected');
  expect(await store.readHead()).toEqual({ generation: 'previous', revision: 3 });
  store.failShard = undefined;
  const plan = await apply(store);
  expect(await store.readHead()).toEqual({ generation: plan.generation, revision: 4 });
});
test('competing manifest cannot replace newer head', async () => {
  const store = new MemoryImportStore();
  const questions = [testQuestion({ id: 'second' })];
  const stale = await planImport('demo-pnpe', questions, store);
  const winner = await apply(store);
  await expect(
    applyImport(stale, questions, store, {
      projectId: 'demo-pnpe',
      manifestDigest: stale.manifestDigest,
    }),
  ).rejects.toThrow('Head');
  expect((await store.readHead()).generation).toBe(winner.generation);
});
test('immutable revision conflict rejects dry run', async () => {
  const store = new MemoryImportStore({ revisions: [testQuestion()] });
  await expect(
    planImport('demo-pnpe', [testQuestion({ correctChoiceId: 'c1' })], store),
  ).rejects.toThrow('Immutable');
  expect(store.writes).toEqual([]);
});
test('oversized revision rejects before writes', async () => {
  const store = new MemoryImportStore();
  await expect(
    planImport(
      'demo-pnpe',
      [testQuestion({ prompt: [{ kind: 'text', text: 'é'.repeat(360000), marks: [] }] })],
      store,
    ),
  ).rejects.toThrow('700');
  expect(store.writes).toEqual([]);
});
test('changed input and tampered manifest reject before writes', async () => {
  const store = new MemoryImportStore();
  const plan = await planImport('demo-pnpe', [testQuestion()], store);
  const confirm = { projectId: 'demo-pnpe', manifestDigest: plan.manifestDigest };
  await expect(
    applyImport(plan, [testQuestion({ correctChoiceId: 'c1' })], store, confirm),
  ).rejects.toThrow('Input');
  await expect(
    applyImport({ ...plan, generation: 'tampered' }, [testQuestion()], store, confirm),
  ).rejects.toThrow('Manifest');
  expect(store.writes).toEqual([]);
});
test('identical reordered snapshot is deterministic and rerun has no writes', async () => {
  const store = new MemoryImportStore();
  const questions = [testQuestion(), testQuestion({ id: 'second' })];
  const a = await planImport('demo-pnpe', questions, store);
  const b = await planImport('demo-pnpe', [...questions].reverse(), store);
  expect(a).toEqual(b);
  await apply(store, questions);
  const head = await store.readHead();
  const writes = [...store.writes];
  await apply(store, questions);
  expect(await store.readHead()).toEqual(head);
  expect(store.writes).toEqual(writes);
});
test('catalog has exact counts and bounded metadata shards without prompts', async () => {
  const store = new MemoryImportStore();
  const questions = Array.from({ length: 201 }, (_, n) =>
    testQuestion({ id: `q-${String(n).padStart(3, '0')}` }),
  );
  const plan = await apply(store, questions);
  expect(plan.questionCount).toBe(201);
  expect(plan.categoryCounts).toEqual({ quantitativeReasoning: 201 });
  expect(plan.shardDigests).toHaveLength(2);
  const entries = await store.readShard(plan.generation, plan.shardDigests[0]!.id);
  expect(entries).toHaveLength(200);
  expect(entries[0]).not.toHaveProperty('prompt');
});
test('empty replacement rejects while empty initial import is a no-op', async () => {
  const store = new MemoryImportStore();
  await apply(store, []);
  expect(store.writes).toEqual([]);
  await apply(store);
  await expect(apply(store, [])).rejects.toThrow('Empty');
});
test('corrupt readback never publishes head', async () => {
  class CorruptStore extends MemoryImportStore {
    override async readShard() {
      return [];
    }
  }
  const store = new CorruptStore();
  await expect(apply(store)).rejects.toThrow('Shard');
  expect(await store.readHead()).toEqual({ generation: null, revision: 0 });
});
test('CAS detects a competing publication during shard upload', async () => {
  class RacingStore extends MemoryImportStore {
    override async writeShard(
      generation: string,
      id: string,
      entries: Parameters<MemoryImportStore['writeShard']>[2],
    ) {
      await super.writeShard(generation, id, entries);
      await super.publishHead(0, 'winner');
    }
  }
  const store = new RacingStore();
  await expect(apply(store)).rejects.toThrow('Head conflict');
  expect(await store.readHead()).toEqual({ generation: 'winner', revision: 1 });
});
test('corrupt revision readback never uploads catalog', async () => {
  class CorruptRevisionStore extends MemoryImportStore {
    override async createRevision(q: Parameters<MemoryImportStore['createRevision']>[0]) {
      await super.createRevision({ ...q, correctChoiceId: 'c1' });
    }
  }
  const store = new CorruptRevisionStore();
  await expect(apply(store)).rejects.toThrow('Revision readback');
  expect(await store.readHead()).toEqual({ generation: null, revision: 0 });
  expect(store.writes).toHaveLength(1);
});
test('higher versions retain old immutable revision and select exact new version', async () => {
  const store = new MemoryImportStore({ revisions: [testQuestion()] });
  const plan = await apply(store, [testQuestion({ version: 2, correctChoiceId: 'c1' })]);
  expect((await store.readRevision('fixture-percentage', 1))?.correctChoiceId).toBe('c2');
  expect((await store.readShard(plan.generation, plan.shardDigests[0]!.id))[0]?.version).toBe(2);
});
test('duplicate logical IDs and invalid schema fail before writes', async () => {
  const store = new MemoryImportStore();
  await expect(
    planImport('demo-pnpe', [testQuestion(), testQuestion({ version: 2 })], store),
  ).rejects.toThrow('Duplicate');
  await expect(
    planImport('demo-pnpe', [testQuestion({ correctChoiceId: 'unknown' })], store),
  ).rejects.toThrow();
  expect(store.writes).toEqual([]);
});
test('byte bound splits metadata before the entry count bound', async () => {
  const store = new MemoryImportStore();
  const questions = Array.from({ length: 180 }, (_, n) =>
    testQuestion({ id: `${String(n).padStart(3, '0')}-${'x'.repeat(4096)}` }),
  );
  const plan = await planImport('demo-pnpe', questions, store);
  expect(plan.shardDigests).toHaveLength(2);
  expect(plan.shardDigests[0]!.count).toBeLessThan(180);
  for (const shard of plan.shardDigests) expect(shard.bytes).toBeLessThanOrEqual(716800);
  expect(store.writes).toEqual([]);
});
test('no-op rejects head replaced during catalog verification', async () => {
  class RacingReadStore extends MemoryImportStore {
    race = false;
    override async readShard(generation: string, id: string) {
      const entries = await super.readShard(generation, id);
      if (this.race) {
        this.race = false;
        await super.publishHead((await super.readHead()).revision, 'other-generation');
      }
      return entries;
    }
  }
  const store = new RacingReadStore();
  await apply(store);
  store.race = true;
  await expect(apply(store)).rejects.toThrow('Head changed');
  expect(await store.readHead()).toEqual({ generation: 'other-generation', revision: 2 });
});
test('Unicode asset ordering uses canonical lexical order independent of locale', async () => {
  const asset = (id: string) => ({
    kind: 'image' as const,
    id,
    version: 1,
    uri: 'bundled://fixture.png',
    width: 1,
    height: 1,
    alt: 'Synthetic fixture',
  });
  const store = new MemoryImportStore();
  const plan = await apply(store, [testQuestion({ prompt: [asset('ä'), asset('z')] })]);
  const entries = await store.readShard(plan.generation, plan.shardDigests[0]!.id);
  expect(entries[0]?.assets.map((item) => item.id)).toEqual(['z', 'ä']);
});
