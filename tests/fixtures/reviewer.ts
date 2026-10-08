import { nodeSqlDatabase } from './nodeSqlDatabase';
import { migrateStudyDatabase } from '../../src/core/storage/sqlite/studyMigrations';
import { SqliteStudyRepository } from '../../src/features/study/data/SqliteStudyRepository';
import type { ContentRepository } from '../../src/features/content/domain/ContentRepository';
import type { CatalogSnapshot } from '../../src/features/content/domain/catalog';
import { generation, owner, studyEntry, studyQuestion } from './study';
import type { OwnerContext } from '../../src/features/study/domain/study';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export async function reviewerHarness(count = 3) {
  const db = nodeSqlDatabase(':memory:');
  await migrateStudyDatabase(db);
  let current: OwnerContext = owner;
  let now = 1000,
    id = 0;
  const guard = {
    isCurrent: (candidate: OwnerContext) =>
      candidate.uid === current.uid &&
      candidate.deviceId === current.deviceId &&
      candidate.epoch === current.epoch,
  };
  const clock = { now: () => now };
  const identity = { nextId: () => `reviewer-${++id}` };
  const study = new SqliteStudyRepository(db, clock, identity, guard);
  const catalog: { -readonly [K in keyof CatalogSnapshot]: CatalogSnapshot[K] } = {
    generation,
    revision: 1,
    validatedAt: 500,
    entries: Array.from({ length: count }, (_, n) => studyEntry({ id: `question-${n}` })),
  };
  const content: ContentRepository = {
    catalog: jest
      .fn<ReturnType<ContentRepository['catalog']>, Parameters<ContentRepository['catalog']>>()
      .mockResolvedValue(catalog),
    cachedCatalog: jest
      .fn<
        ReturnType<ContentRepository['cachedCatalog']>,
        Parameters<ContentRepository['cachedCatalog']>
      >()
      .mockResolvedValue(catalog),
    question: jest.fn<
      ReturnType<ContentRepository['question']>,
      Parameters<ContentRepository['question']>
    >(async (_, entry) => studyQuestion({ id: entry.id, version: entry.version })),
  };
  return {
    db,
    study,
    content,
    catalog,
    clock,
    identity,
    guard,
    switchOwner: (value: OwnerContext) => {
      current = value;
    },
    setTime: (value: number) => {
      now = value;
    },
  };
}
