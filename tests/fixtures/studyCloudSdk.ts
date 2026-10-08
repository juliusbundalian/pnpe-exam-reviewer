import {
  FirebaseStudySyncRemote,
  type StudySyncSdk,
  type StudyCloudTransaction,
} from '../../src/features/study/data/FirebaseStudySyncRemote';
import type { OwnerGuard } from '../../src/features/study/domain/study';

/** Atomic in-memory substitute for external Firestore, with real remote policy above it. */
export function studyCloudBackend(guard?: OwnerGuard) {
  const documents = new Map<string, unknown>();
  let current = true;
  let beforeCommit: (() => void) | undefined;
  const writes: string[] = [];
  let tail = Promise.resolve();
  const sdk: StudySyncSdk = {
    transaction: (check, action) => {
      const result = tail.then(async () => {
        check();
        const staged = new Map<string, unknown>();
        const tx: StudyCloudTransaction = {
          get: async (path) => {
            check();
            return staged.get(path) ?? documents.get(path);
          },
          set: (path, data) => {
            check();
            staged.set(path, data);
          },
        };
        const value = await action(tx);
        beforeCommit?.();
        check();
        for (const [path, data] of staged) {
          documents.set(path, data);
          writes.push(path);
        }
        return value;
      });
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    readPage: async (check, path, after, limit) => {
      check();
      return [...documents]
        .filter(([key]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
        .map(([key, data]) => ({ id: key.slice(path.length + 1), data }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .filter((item) => after === null || item.id > after)
        .slice(0, limit);
    },
  };
  const remote = new FirebaseStudySyncRemote(sdk, guard ?? { isCurrent: () => current });
  return {
    sdk,
    documents,
    writes,
    remote,
    switchOwner: () => {
      current = false;
    },
    setBeforeCommit: (action: () => void) => {
      beforeCommit = action;
    },
  };
}
