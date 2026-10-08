import type { Firestore } from '@react-native-firebase/firestore';
import { createNativeContentRemote } from '../../src/features/content/data/nativeContentFacade';
import { generation, studyEntry, studyQuestion } from '../fixtures/study';

const mockFirestore = { marker: 'existing-instance' };
const mockGetDocFromServer = jest.fn();
const mockGetDocsFromServer = jest.fn();
jest.mock('@react-native-firebase/firestore', () => ({
  doc: (instance: unknown, path: string) => ({ instance, path }),
  collection: (instance: unknown, path: string) => ({ instance, path }),
  documentId: () => 'document-id',
  orderBy: (field: unknown) => ({ orderBy: field }),
  startAfter: (id: string) => ({ startAfter: id }),
  limit: (count: number) => ({ limit: count }),
  query: (reference: unknown, ...constraints: unknown[]) => ({ reference, constraints }),
  getDocFromServer: (...args: unknown[]) => mockGetDocFromServer(...args),
  getDocsFromServer: (...args: unknown[]) => mockGetDocsFromServer(...args),
  getDoc: () => {
    throw new Error('default-source read forbidden');
  },
  getDocs: () => {
    throw new Error('default-source read forbidden');
  },
}));
test('native content facade uses existing instance, server source and document-ID cursor query', async () => {
  const remote = await createNativeContentRemote(mockFirestore as unknown as Firestore);
  mockGetDocFromServer
    .mockResolvedValueOnce({ data: () => ({ generation, revision: 2 }) })
    .mockResolvedValueOnce({ data: () => studyQuestion() });
  mockGetDocsFromServer.mockResolvedValue({
    docs: [{ id: 's1', data: () => ({ entries: [studyEntry()] }) }],
  });
  expect(await remote.readHead()).toEqual({ generation, revision: 2 });
  expect(await remote.listShards(generation, null, 50)).toEqual([
    { id: 's1', entries: [studyEntry()] },
  ]);
  await remote.listShards(generation, 's1', 50);
  expect(mockGetDocsFromServer.mock.calls).toEqual([
    [
      {
        reference: { instance: mockFirestore, path: `questionCatalogs/${generation}/shards` },
        constraints: [{ orderBy: 'document-id' }, { limit: 50 }],
      },
    ],
    [
      {
        reference: { instance: mockFirestore, path: `questionCatalogs/${generation}/shards` },
        constraints: [{ orderBy: 'document-id' }, { startAfter: 's1' }, { limit: 50 }],
      },
    ],
  ]);
  expect(await remote.revision({ id: 'fixture-grammar', version: 1 })).toEqual(studyQuestion());
  expect(mockGetDocFromServer.mock.calls).toEqual([
    [{ instance: mockFirestore, path: 'questionCatalogs/current' }],
    [{ instance: mockFirestore, path: 'questions/fixture-grammar/versions/1' }],
  ]);
});
