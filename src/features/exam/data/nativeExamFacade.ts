import type { Auth } from '@react-native-firebase/auth';
import type { Firestore } from '@react-native-firebase/firestore';
import { canonicalJson } from '../../../core/content/Fingerprint';
import { StudyError, type OwnerGuard } from '../../study/domain/study';
import { FirebaseExamRemote } from './FirebaseExamRemote';

/** Native server-only reads and transactions; local result remains the immediate source of truth. */
export async function createNativeExamRemote(
  firestore: Firestore,
  auth: Auth,
  guard: OwnerGuard,
): Promise<FirebaseExamRemote> {
  const sdk = await import('@react-native-firebase/firestore');
  const observed: OwnerGuard = {
    isCurrent: (owner) => auth.currentUser?.uid === owner.uid && guard.isCurrent(owner),
  };
  function decode(raw: unknown): unknown {
    if (raw === undefined || raw === null) return raw;
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new StudyError('invalid-content');
    const value = { ...raw } as Record<string, unknown>;
    if (!(value.writtenAt instanceof sdk.Timestamp)) throw new StudyError('invalid-content');
    value.writtenAt = Math.floor(value.writtenAt.toMillis());
    return value;
  }
  function encode(data: object): object {
    const value = JSON.parse(canonicalJson(data)) as Record<string, unknown>;
    value.writtenAt = sdk.serverTimestamp();
    return value;
  }
  return new FirebaseExamRemote(
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
      readPage: async (check, path, afterId, limit) => {
        check();
        const constraints = [
          sdk.orderBy(sdk.documentId()),
          ...(afterId === null ? [] : [sdk.startAfter(afterId)]),
          sdk.limit(limit),
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
