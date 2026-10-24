import { CachedContentRepository } from '../../src/features/content/data/CachedContentRepository';
import type { ContentRemote } from '../../src/features/content/domain/ContentRemote';
import type { ContentCache } from '../../src/features/content/domain/ContentRepository';
import { generation, owner as alice, studyEntry, studyQuestion } from '../fixtures/study';
import { StudyError } from '../../src/features/study/domain/study';

const head = { generation, revision: 2 };
const snapshot = { ...head, validatedAt: 10, entries: [studyEntry()] };
function setup() {
  const remote: jest.Mocked<ContentRemote> = {
    readHead: jest.fn(async () => head),
    listShards: jest.fn<
      ReturnType<ContentRemote['listShards']>,
      Parameters<ContentRemote['listShards']>
    >(async () => [{ id: 's001', entries: [studyEntry()] }]),
    revision: jest.fn<ReturnType<ContentRemote['revision']>, Parameters<ContentRemote['revision']>>(
      async () => studyQuestion(),
    ),
  };
  const cache: jest.Mocked<ContentCache> = {
    catalog: jest.fn(async () => snapshot),
    saveCatalog: jest.fn<
      ReturnType<ContentCache['saveCatalog']>,
      Parameters<ContentCache['saveCatalog']>
    >(async () => undefined),
    question: jest.fn<ReturnType<ContentCache['question']>, Parameters<ContentCache['question']>>(
      async () => null,
    ),
    saveQuestion: jest.fn<
      ReturnType<ContentCache['saveQuestion']>,
      Parameters<ContentCache['saveQuestion']>
    >(async () => undefined),
  };
  let current = true;
  const repository = new CachedContentRepository(
    remote,
    cache,
    { now: () => 100 },
    { isCurrent: () => current },
  );
  return {
    remote,
    cache,
    repository,
    switchOwner: () => {
      current = false;
    },
  };
}
test('multi-page discovery saves every shard only after matching final head', async () => {
  const { remote, cache, repository } = setup();
  remote.listShards
    .mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, i) => ({
        id: `s${String(i).padStart(3, '0')}`,
        entries: [studyEntry({ id: `q${i}` })],
      })),
    )
    .mockResolvedValueOnce([{ id: 's050', entries: [studyEntry({ id: 'q50' })] }]);
  const found = await repository.catalog(alice);
  expect(found.entries).toHaveLength(51);
  expect(found.validatedAt).toBe(100);
  expect(remote.listShards.mock.calls).toEqual([
    [generation, null, 50],
    [generation, 's049', 50],
  ]);
  expect(cache.saveCatalog).toHaveBeenCalledWith(found);
  expect(remote.readHead).toHaveBeenCalledTimes(2);
});
test('exact page size requires a final empty page', async () => {
  const { remote, repository } = setup();
  remote.listShards
    .mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, i) => ({
        id: `s${String(i).padStart(3, '0')}`,
        entries: [studyEntry({ id: `q${i}` })],
      })),
    )
    .mockResolvedValueOnce([]);
  expect((await repository.catalog(alice)).entries).toHaveLength(50);
  expect(remote.listShards).toHaveBeenLastCalledWith(generation, 's049', 50);
});
test.each([
  [
    'duplicate IDs',
    [
      { id: 'a', entries: [studyEntry()] },
      { id: 'b', entries: [studyEntry()] },
    ],
  ],
  [
    'nonascending cursor',
    [
      { id: 'b', entries: [studyEntry()] },
      { id: 'a', entries: [studyEntry({ id: 'q2' })] },
    ],
  ],
  ['unsafe shard', [{ id: '../a', entries: [studyEntry()] }]],
  ['malformed shard', [{ id: 'a', entries: [] }]],
  [
    'oversized shard',
    [
      {
        id: 'a',
        entries: Array.from({ length: 200 }, (_, i) =>
          studyEntry({
            id: `q${i}`,
            assets: [{ id: 'img', version: 1, uri: `https://example.com/${'x'.repeat(4000)}` }],
            supportedKinds: ['image'],
          }),
        ),
      },
    ],
  ],
])('rejects %s without publishing cache', async (_name, page) => {
  const { remote, cache, repository } = setup();
  remote.listShards.mockResolvedValue(page);
  await expect(repository.catalog(alice)).rejects.toMatchObject({ code: 'invalid-content' });
  expect(cache.saveCatalog).not.toHaveBeenCalled();
});
test('partial_catalog_is_never_saved', async () => {
  const { remote, cache, repository } = setup();
  remote.listShards
    .mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, i) => ({
        id: `s${String(i).padStart(3, '0')}`,
        entries: [studyEntry({ id: `q${i}` })],
      })),
    )
    .mockRejectedValueOnce(new StudyError('network'));
  expect(await repository.catalog(alice)).toEqual(snapshot);
  expect(cache.saveCatalog).not.toHaveBeenCalled();
});
test('permission_denial_does_not_use_cache', async () => {
  const { remote, cache, repository } = setup();
  remote.readHead.mockRejectedValue(new StudyError('permission-denied'));
  await expect(repository.catalog(alice)).rejects.toMatchObject({ code: 'permission-denied' });
  expect(cache.catalog).not.toHaveBeenCalled();
});
test('offline fallback retains complete catalog validation time', async () => {
  const { remote, repository } = setup();
  remote.readHead.mockRejectedValue(new StudyError('network'));
  expect((await repository.catalog(alice)).validatedAt).toBe(10);
});
test.each(['auth-required', 'invalid-content', 'conflict'] as const)(
  'does not hide %s with cached catalog',
  async (code) => {
    const { remote, cache, repository } = setup();
    remote.readHead.mockRejectedValue(new StudyError(code));
    await expect(repository.catalog(alice)).rejects.toMatchObject({ code });
    expect(cache.catalog).not.toHaveBeenCalled();
  },
);
test('changed head restarts without mixing generations', async () => {
  const { remote, cache, repository } = setup();
  const next = { generation: 'b'.repeat(64), revision: 3 };
  remote.readHead.mockResolvedValueOnce(head).mockResolvedValue(next);
  remote.listShards
    .mockResolvedValueOnce([{ id: 'a', entries: [studyEntry({ id: 'old' })] }])
    .mockResolvedValueOnce([{ id: 'a', entries: [studyEntry({ id: 'new' })] }]);
  expect(await repository.catalog(alice)).toMatchObject({
    ...next,
    entries: [studyEntry({ id: 'new' })],
  });
  expect(cache.saveCatalog).toHaveBeenCalledTimes(1);
});
test('head churn stops after three discovery attempts without publication', async () => {
  const { remote, cache, repository } = setup();
  let revision = 0;
  remote.readHead.mockImplementation(async () => ({ generation, revision: ++revision }));
  await expect(repository.catalog(alice)).rejects.toMatchObject({ code: 'conflict' });
  expect(remote.listShards).toHaveBeenCalledTimes(3);
  expect(cache.saveCatalog).not.toHaveBeenCalled();
});
test('fetches and caches only a revision agreeing with frozen entry', async () => {
  const { remote, cache, repository } = setup();
  expect(await repository.question(alice, studyEntry())).toEqual(studyQuestion());
  expect(remote.revision).toHaveBeenCalledWith({ id: 'fixture-grammar', version: 1 });
  expect(cache.saveQuestion).toHaveBeenCalledWith(studyEntry(), studyQuestion());
  remote.revision.mockResolvedValue(studyQuestion({ version: 2 }));
  cache.saveQuestion.mockClear();
  await expect(repository.question(alice, studyEntry())).rejects.toMatchObject({
    code: 'invalid-content',
  });
  expect(cache.saveQuestion).not.toHaveBeenCalled();
});
test('cached pinned revision is validated against entry before reuse', async () => {
  const { cache, remote, repository } = setup();
  cache.question.mockResolvedValue(studyQuestion());
  expect(await repository.question(alice, studyEntry())).toEqual(studyQuestion());
  expect(remote.revision).not.toHaveBeenCalled();
  await expect(
    repository.question(alice, studyEntry({ status: 'inactive' })),
  ).rejects.toMatchObject({ code: 'invalid-content' });
});
test('cache corruption is not hidden by a remote read', async () => {
  const { cache, remote, repository } = setup();
  cache.question.mockRejectedValue(new StudyError('storage-corrupt'));
  await expect(repository.question(alice, studyEntry())).rejects.toMatchObject({
    code: 'storage-corrupt',
  });
  expect(remote.revision).not.toHaveBeenCalled();
});
test('uncached offline revision remains unavailable', async () => {
  const { remote, repository } = setup();
  remote.revision.mockRejectedValue(new StudyError('network'));
  await expect(repository.question(alice, studyEntry())).rejects.toMatchObject({ code: 'network' });
});
test('stale owner remote result cannot publish catalog or revision', async () => {
  for (const kind of ['catalog', 'question'] as const) {
    const { remote, cache, repository, switchOwner } = setup();
    if (kind === 'catalog')
      remote.readHead.mockImplementation(async () => {
        switchOwner();
        return head;
      });
    else
      remote.revision.mockImplementation(async () => {
        switchOwner();
        return studyQuestion();
      });
    await expect(repository[kind](alice, studyEntry())).rejects.toMatchObject({
      code: 'auth-required',
    });
    expect(cache.saveCatalog).not.toHaveBeenCalled();
    expect(cache.saveQuestion).not.toHaveBeenCalled();
  }
});
test('explicit cached recovery reads complete snapshot without contacting remote', async () => {
  const { repository, remote } = setup();
  expect(await repository.cachedCatalog(alice)).toEqual(snapshot);
  expect(remote.readHead).not.toHaveBeenCalled();
  expect(remote.listShards).not.toHaveBeenCalled();
});
test('explicit cached recovery rejects absent, corrupt and stale owner cache results', async () => {
  const { repository, cache, switchOwner } = setup();
  cache.catalog.mockResolvedValueOnce(null);
  await expect(repository.cachedCatalog(alice)).rejects.toMatchObject({ code: 'network' });
  cache.catalog.mockRejectedValueOnce(new StudyError('storage-corrupt'));
  await expect(repository.cachedCatalog(alice)).rejects.toMatchObject({ code: 'storage-corrupt' });
  cache.catalog.mockImplementation(async () => {
    switchOwner();
    return snapshot;
  });
  await expect(repository.cachedCatalog(alice)).rejects.toMatchObject({ code: 'auth-required' });
});
test('an owner switch during cache publication rejects its async result', async () => {
  const { repository, cache, switchOwner } = setup();
  cache.saveCatalog.mockImplementation(async () => {
    switchOwner();
  });
  await expect(repository.catalog(alice)).rejects.toMatchObject({ code: 'auth-required' });
});
test('cursor must advance across pages', async () => {
  const { repository, remote, cache } = setup();
  remote.listShards
    .mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, i) => ({
        id: `s${String(i).padStart(3, '0')}`,
        entries: [studyEntry({ id: `q${i}` })],
      })),
    )
    .mockResolvedValueOnce([{ id: 's049', entries: [studyEntry({ id: 'another' })] }]);
  await expect(repository.catalog(alice)).rejects.toMatchObject({ code: 'invalid-content' });
  expect(cache.saveCatalog).not.toHaveBeenCalled();
});
test('malformed remote head rejects as safe content error without cache fallback', async () => {
  const { remote, repository, cache } = setup();
  remote.readHead.mockResolvedValue(null as unknown as { generation: string; revision: number });
  await expect(repository.catalog(alice)).rejects.toMatchObject({ code: 'invalid-content' });
  expect(cache.catalog).not.toHaveBeenCalled();
});
