import type { Firestore } from '@react-native-firebase/firestore';
import {
  FirebaseCategoryRepository,
  createCategorySdk,
  type CategoryMetadataPolicy,
} from './FirebaseCategoryRepository';

/** Consume an existing NativeServices.firestore instance; never initialize Firebase. */
export async function createNativeCategoryRepository(
  firestore: Firestore,
  policy: CategoryMetadataPolicy = {},
): Promise<FirebaseCategoryRepository> {
  const sdk = await import('@react-native-firebase/firestore');
  return new FirebaseCategoryRepository(
    createCategorySdk({
      collection: (path) => sdk.collection(firestore, path),
      getDocs: (reference) => sdk.getDocs(reference),
    }),
    policy,
  );
}
