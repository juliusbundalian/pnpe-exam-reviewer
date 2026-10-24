import {
  FirebaseExamRemote,
  type ExamCloudSdk,
} from '../../src/features/exam/data/FirebaseExamRemote';
import { ExamSyncWorker } from '../../src/features/exam/application/ExamSyncWorker';
import { StudyError, type OwnerContext } from '../../src/features/study/domain/study';
import { examResult } from '../fixtures/exam';

const alice: OwnerContext = { uid: 'alice', deviceId: 'device-one', epoch: 1 };
const aliceOtherDevice: OwnerContext = { ...alice, deviceId: 'device-two' };
const bob: OwnerContext = { uid: 'bob', deviceId: 'device-one', epoch: 1 };

function memoryCloud() {
  const documents = new Map<string, object>();
  let failAt: string | null = null;
  const sdk: ExamCloudSdk = {
    async transaction(check, action) {
      check();
      const writes = new Map<string, object>();
      const result = await action({
        get: async (path) => documents.get(path) ?? null,
        set: (path, data) => {
          if (path === failAt) throw new StudyError('network');
          writes.set(path, data);
        },
      });
      check();
      for (const [path, data] of writes) documents.set(path, data);
      return result;
    },
    async readPage(check, path, afterId, limit) {
      check();
      return [...documents.entries()]
        .filter(([key]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
        .map(([key, data]) => ({ id: key.slice(path.length + 1), data }))
        .filter((item) => afterId === null || item.id > afterId)
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, limit);
    },
  };
  return {
    sdk,
    documents,
    fail(path: string | null) {
      failAt = path;
    },
  };
}

test('sync_retry_deduplicates_attempt and restores frozen submitted review', async () => {
  const cloud = memoryCloud();
  const remote = new FirebaseExamRemote(cloud.sdk, { isCurrent: () => true });
  const result = examResult();
  await remote.publish(alice, result);
  await remote.publish(alice, result);
  expect(
    (await remote.history(alice)).filter((item) => item.attemptId === result.attemptId),
  ).toHaveLength(1);
  expect(await remote.result(alice, result.attemptId)).toMatchObject({
    attemptId: result.attemptId,
    questions: result.questions,
    syncState: 'synced',
  });
  expect(cloud.documents.size).toBe(151);
});

test('interrupted upload stays pending and retry completes it once', async () => {
  const cloud = memoryCloud();
  const remote = new FirebaseExamRemote(cloud.sdk, { isCurrent: () => true });
  const result = examResult();
  const lastPath = `users/alice/examAttempts/${result.attemptId}/items/149`;
  cloud.fail(lastPath);
  const pending = new Map([[result.attemptId, result]]);
  const repository = {
    pending: async () => [...pending.values()],
    acknowledge: async (_owner: OwnerContext, id: string) => {
      pending.delete(id);
    },
  };
  const worker = new ExamSyncWorker(repository, remote, { isCurrent: () => true });
  await worker.flush(alice);
  expect(pending.size).toBe(1);
  expect(
    (await remote.history(alice)).filter((item) => item.attemptId === result.attemptId),
  ).toEqual([]);
  cloud.fail(null);
  await worker.flush(alice);
  await worker.flush(alice);
  expect(pending.size).toBe(0);
  expect(
    (await remote.history(alice)).filter((item) => item.attemptId === result.attemptId),
  ).toHaveLength(1);
});

test('remote_history_owner_only for same UID on another device', async () => {
  const cloud = memoryCloud();
  const remote = new FirebaseExamRemote(cloud.sdk, { isCurrent: () => true });
  const result = examResult();
  await remote.publish(alice, result);
  expect(await remote.history(aliceOtherDevice)).toHaveLength(1);
  expect(await remote.history(bob)).toEqual([]);
  await expect(remote.result(bob, result.attemptId)).rejects.toMatchObject({
    code: 'invalid-content',
  });
});

test('conflicting retry cannot overwrite immutable terminal score', async () => {
  const cloud = memoryCloud();
  const remote = new FirebaseExamRemote(cloud.sdk, { isCurrent: () => true });
  const result = examResult();
  await remote.publish(alice, result);
  await expect(
    remote.publish(alice, {
      ...result,
      overall: { ...result.overall, correct: 1, unanswered: 149, percentage: 100 / 150 },
    }),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect((await remote.result(alice, result.attemptId)).overall.correct).toBe(0);
});

test('account switch stops an in-flight upload before it acknowledges the prior owner', async () => {
  const result = examResult();
  const pending = new Map([[result.attemptId, result]]);
  let current = alice.uid;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const worker = new ExamSyncWorker(
    {
      pending: async () => [...pending.values()],
      acknowledge: async (_owner, id) => {
        pending.delete(id);
      },
    },
    {
      publish: async () => gate,
      history: async () => [],
      result: async () => result,
    },
    { isCurrent: (owner) => owner.uid === current },
  );
  const first = worker.flush(alice);
  await Promise.resolve();
  current = bob.uid;
  worker.stop();
  release();
  await expect(first).rejects.toMatchObject({ code: 'auth-required' });
  expect(pending.size).toBe(1);
  expect(worker.status()).toEqual({ syncing: false, pendingCount: 0, recovery: null });
});
