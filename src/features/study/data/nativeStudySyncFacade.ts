import type { Auth } from '@react-native-firebase/auth';
import type { Firestore } from '@react-native-firebase/firestore';
import { StudyError, type OwnerGuard } from '../domain/study';
import { FirebaseStudySyncRemote } from './FirebaseStudySyncRemote';

/** Existing native services only; no initialization or client-cache fallback. */
export async function createNativeStudySyncRemote(
  firestore: Firestore,
  auth: Auth,
  guard: OwnerGuard,
): Promise<FirebaseStudySyncRemote> {
  const sdk = await import('@react-native-firebase/firestore');
  const observed: OwnerGuard = {
    isCurrent: (owner) => auth.currentUser?.uid === owner.uid && guard.isCurrent(owner),
  };
  function decode(raw: unknown): unknown {
    if (raw === undefined || raw === null) return raw;
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new StudyError('invalid-content');
    const dto = { ...raw };
    for (const field of ['createdAt', 'updatedAt', 'writtenAt']) {
      if (field in dto) {
        const value = (dto as Record<string, unknown>)[field];
        if (!(value instanceof sdk.Timestamp)) throw new StudyError('invalid-content');
        (dto as Record<string, unknown>)[field] = value.toMillis();
      }
    }
    return dto;
  }
  function encode(data: object) {
    const dto = { ...data } as Record<string, unknown>;
    for (const field of ['createdAt', 'updatedAt'])
      if (field in dto) {
        const value = dto[field];
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
          throw new StudyError('invalid-content');
        dto[field] = sdk.Timestamp.fromMillis(value);
      }
    dto.writtenAt = sdk.serverTimestamp();
    return dto;
  }
  return new FirebaseStudySyncRemote(
    {
      transaction: (check, action) => {
        check();
        return sdk.runTransaction(firestore, async (transaction) => {
          check();
          const result = await action({
            get: async (path) => {
              check();
              const snapshot = await transaction.get(sdk.doc(firestore, path));
              check();
              return decode(snapshot.data());
            },
            set: (path, data) => {
              check();
              transaction.set(sdk.doc(firestore, path), encode(data));
            },
          });
          check();
          return result;
        });
      },
      readPage: async (check, path, afterId, pageSize) => {
        check();
        const constraints = [
          sdk.orderBy(sdk.documentId()),
          ...(afterId === null ? [] : [sdk.startAfter(afterId)]),
          sdk.limit(pageSize),
        ];
        const snapshot = await sdk.getDocsFromServer(
          sdk.query(sdk.collection(firestore, path), ...constraints),
        );
        check();
        return snapshot.docs.map((document) => ({
          id: document.id,
          data: decode(document.data()),
        }));
      },
    },
    observed,
  );
}
