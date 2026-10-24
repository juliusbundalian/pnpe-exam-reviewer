import {
  FirebaseContentRemote,
  type ContentReadSdk,
} from '../../src/features/content/data/FirebaseContentRemote';
import { generation, studyQuestion, studyEntry } from '../fixtures/study';
function setup() {
  const sdk: jest.Mocked<ContentReadSdk> = {
    readDocument: jest.fn<
      ReturnType<ContentReadSdk['readDocument']>,
      Parameters<ContentReadSdk['readDocument']>
    >(async () => ({ generation, revision: 2 })),
    readPage: jest.fn<
      ReturnType<ContentReadSdk['readPage']>,
      Parameters<ContentReadSdk['readPage']>
    >(async () => [{ id: 's1', data: { entries: [studyEntry()] } }]),
  };
  return { sdk, remote: new FirebaseContentRemote(sdk) };
}
test('server read contract uses named head, generation shards and individual revision paths', async () => {
  const { sdk, remote } = setup();
  expect(await remote.readHead()).toEqual({ generation, revision: 2 });
  expect(sdk.readDocument).toHaveBeenCalledWith('questionCatalogs/current');
  expect(await remote.listShards(generation, 's0', 50)).toEqual([
    { id: 's1', entries: [studyEntry()] },
  ]);
  expect(sdk.readPage).toHaveBeenCalledWith(`questionCatalogs/${generation}/shards`, 's0', 50);
  sdk.readDocument.mockResolvedValue(studyQuestion());
  expect(await remote.revision({ id: 'q1', version: 3 })).toEqual(studyQuestion());
  expect(sdk.readDocument).toHaveBeenLastCalledWith('questions/q1/versions/3');
});
test.each([
  null,
  { generation: '../bad', revision: 2 },
  { generation, revision: -1 },
  { generation, revision: 2, extra: true },
])('rejects malformed head %j', async (raw) => {
  const { sdk, remote } = setup();
  sdk.readDocument.mockResolvedValue(raw);
  await expect(remote.readHead()).rejects.toMatchObject({ code: 'invalid-content' });
});
test.each([
  'permission-denied',
  'unauthenticated',
  'unavailable',
  'deadline-exceeded',
  'internal',
  'not-found',
])('maps SDK %s safely', async (code) => {
  const { sdk, remote } = setup();
  sdk.readDocument.mockRejectedValue({ code: `firestore/${code}`, message: 'secret SDK data' });
  const expected =
    code === 'permission-denied'
      ? code
      : code === 'unauthenticated'
        ? 'auth-required'
        : ['unavailable', 'deadline-exceeded'].includes(code)
          ? 'network'
          : 'invalid-content';
  await expect(remote.readHead()).rejects.toMatchObject({ code: expected });
  await expect(remote.readHead()).rejects.not.toThrow('secret SDK data');
});
test('unsafe paths reject before any SDK read', async () => {
  const { sdk, remote } = setup();
  await expect(remote.listShards('../bad', null, 50)).rejects.toMatchObject({
    code: 'invalid-content',
  });
  await expect(remote.listShards(generation, 'bad/path', 50)).rejects.toMatchObject({
    code: 'invalid-content',
  });
  await expect(remote.listShards(generation, null, 51)).rejects.toMatchObject({
    code: 'invalid-content',
  });
  await expect(remote.revision({ id: '../q', version: 1 })).rejects.toMatchObject({
    code: 'invalid-content',
  });
  expect(sdk.readPage).not.toHaveBeenCalled();
  expect(sdk.readDocument).not.toHaveBeenCalled();
});
test('rejects malformed or oversized raw shard envelope before dropping fields', async () => {
  const { sdk, remote } = setup();
  for (const data of [
    { entries: [studyEntry()], extra: true },
    { entries: [studyEntry()], padding: 'x'.repeat(700 * 1024) },
  ]) {
    sdk.readPage.mockResolvedValue([{ id: 's1', data }]);
    await expect(remote.listShards(generation, null, 50)).rejects.toMatchObject({
      code: 'invalid-content',
    });
  }
});
