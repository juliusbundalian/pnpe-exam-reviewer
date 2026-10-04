import type { Question } from '../../src/features/content/domain/question';
import { canonicalJson } from '../../tools/questions/editorial';
import type { CatalogEntry, ImportHead, ImportStore } from '../../tools/questions/import-store';

export class MemoryImportStore implements ImportStore {
  readonly writes: string[] = [];
  failShard: string | undefined;
  private readonly revisions = new Map<string, Question>();
  private readonly shards = new Map<string, readonly CatalogEntry[]>();
  private head: ImportHead;
  constructor(
    seed: {
      revisions?: readonly Question[];
      head?: ImportHead;
      shards?: readonly { generation: string; id: string; entries: readonly CatalogEntry[] }[];
    } = {},
  ) {
    this.head = structuredClone(seed.head ?? { generation: null, revision: 0 });
    for (const q of seed.revisions ?? [])
      this.revisions.set(`${q.id}@${q.version}`, structuredClone(q));
    for (const s of seed.shards ?? [])
      this.shards.set(`${s.generation}/${s.id}`, structuredClone(s.entries));
  }
  async readRevision(id: string, version: number) {
    return structuredClone(this.revisions.get(`${id}@${version}`) ?? null);
  }
  async readHead() {
    return structuredClone(this.head);
  }
  async createRevision(q: Question) {
    const key = `${q.id}@${q.version}`;
    const prior = this.revisions.get(key);
    if (prior && canonicalJson(prior) !== canonicalJson(q))
      throw new Error('Immutable revision conflict');
    if (!prior) {
      this.revisions.set(key, structuredClone(q));
      this.writes.push(`revision:${key}`);
    }
  }
  async writeShard(generation: string, id: string, entries: readonly CatalogEntry[]) {
    if (this.failShard === id) throw new Error('Injected shard failure');
    const key = `${generation}/${id}`;
    const prior = this.shards.get(key);
    if (prior && canonicalJson(prior) !== canonicalJson(entries))
      throw new Error('Immutable shard conflict');
    if (!prior) {
      this.shards.set(key, structuredClone(entries));
      this.writes.push(`shard:${key}`);
    }
  }
  async readShard(generation: string, id: string) {
    return structuredClone(this.shards.get(`${generation}/${id}`) ?? []);
  }
  async publishHead(expectedRevision: number, generation: string) {
    if (this.head.revision !== expectedRevision) throw new Error('Head conflict');
    this.head = { generation, revision: expectedRevision + 1 };
    this.writes.push('head');
  }
}
