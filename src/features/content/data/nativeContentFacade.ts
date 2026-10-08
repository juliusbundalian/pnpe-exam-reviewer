import type { Firestore } from '@react-native-firebase/firestore';
import { FirebaseContentRemote } from './FirebaseContentRemote';

/** Consume an existing native Firestore instance; no Firebase initialization here. */
export async function createNativeContentRemote(
  firestore: Firestore,
): Promise<FirebaseContentRemote> {
  const sdk = await import('@react-native-firebase/firestore');
  return new FirebaseContentRemote({
    readDocument: async (path) => (await sdk.getDocFromServer(sdk.doc(firestore, path))).data(),
    readPage: async (path, afterId, pageSize) => {
      const constraints = [
        sdk.orderBy(sdk.documentId()),
        ...(afterId === null ? [] : [sdk.startAfter(afterId)]),
        sdk.limit(pageSize),
      ];
      const snapshot = await sdk.getDocsFromServer(
        sdk.query(sdk.collection(firestore, path), ...constraints),
      );
      return snapshot.docs.map((document) => ({ id: document.id, data: document.data() }));
    },
  });
}
