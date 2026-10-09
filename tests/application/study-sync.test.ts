import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeSqlDatabase } from '../fixtures/nodeSqlDatabase';
import { migrateStudyDatabase } from '../../src/core/storage/sqlite/studyMigrations';
import { SqliteStudyRepository } from '../../src/features/study/data/SqliteStudyRepository';
import {
  StudySyncWorker,
  type StudySyncStatus,
} from '../../src/features/study/application/StudySyncWorker';
import {
  BookmarkConflictError,
  StudyError,
  type OwnerContext,
} from '../../src/features/study/domain/study';
import type { StudySyncRemote } from '../../src/features/study/domain/StudySyncRemote';
import type { SqlDatabase } from '../../src/core/storage/sqlite/SqlDatabase';
import { owner as alice, studyEntry, studyBookmark, studySession } from '../fixtures/study';
import {
  FirebaseStudySyncRemote,
  type StudySyncSdk,
} from '../../src/features/study/data/FirebaseStudySyncRemote';
import { studyCloudBackend } from '../fixtures/studyCloudSdk';

let dir: string,
  db: SqlDatabase,
  study: SqliteStudyRepository,
  current: OwnerContext,
  now: number,
  id: number;
let worker: StudySyncWorker;
const clock = { now: () => now };
const guard = {
  isCurrent: (owner: OwnerContext) =>
    owner.uid === current.uid &&
    owner.epoch === current.epoch &&
    owner.deviceId === current.deviceId,
};
const bob = { ...alice, uid: 'bob', epoch: 2 };
function remote(overrides: Partial<StudySyncRemote> = {}): StudySyncRemote {
  return {
    publishSession: async () => {},
    writeSessionState: async () => {},
    writeBookmark: async (_owner, _bookmark, operationId, baseRevision) => ({
      revision: baseRevision + 1,
      appliedOperationId: operationId,
    }),
    listBookmarks: async () => [],
    ...overrides,
  };
}
function create(transport: StudySyncRemote) {
  worker = new StudySyncWorker(study, transport, clock, guard);
  worker.start(current);
  return worker;
}
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'study-sync-'));
  db = nodeSqlDatabase(join(dir, 'study.db'));
  await migrateStudyDatabase(db);
  current = alice;
  now = 200;
  id = 0;
  study = new SqliteStudyRepository(db, clock, { nextId: () => `op-${++id}` }, guard);
});
afterEach(async () => {
  worker?.stop();
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('late_ack_does_not_touch_next_owner', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  const alicePending = await study.pending(alice, clock.now());
  current = bob;
  await study.setBookmark(bob, studyEntry(), true);
  const bobPending = await study.pending(bob, clock.now());
  current = alice;
  let finish!: (value: { revision: number; appliedOperationId: string }) => void,
    entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  create(
    remote({
      writeBookmark: async () => {
        entered();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    }),
  );
  const flush = worker.flush();
  await ready;
  current = bob;
  worker.stop();
  finish({ revision: 1, appliedOperationId: alicePending[0]!.id });
  await flush;
  expect(await study.pending(bob, clock.now())).toEqual(bobPending);
  current = alice;
  expect(await study.pending(alice, clock.now())).toEqual(alicePending);
});
test('serialized flush advances queued bases while preserving newer local tombstone', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  await study.setBookmark(alice, studyEntry({ version: 2 }), true);
  const accepted: { deleted: boolean; base: number }[] = [];
  create(
    remote({
      writeBookmark: async (_owner, bookmark, operationId, base) => {
        accepted.push({ deleted: bookmark.deleted, base });
        return { revision: base + 1, appliedOperationId: operationId };
      },
    }),
  );
  await Promise.all([worker.flush(), worker.flush()]);
  expect(accepted).toEqual([
    { deleted: false, base: 0 },
    { deleted: true, base: 1 },
  ]);
  expect(await study.pending(alice, now)).toEqual([]);
  expect((await study.listBookmarks(alice))[0]).toMatchObject({
    deleted: true,
    serverRevision: 2,
    entry: { version: 2 },
  });
});
test('three CAS rebases per wake leave pending desired state and next wake can recover', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  await study.setBookmark(alice, studyEntry(), true);
  let revision = 0,
    conflicts = true;
  create(
    remote({
      writeBookmark: async (_owner, _bookmark, operationId, base) => {
        if (conflicts)
          throw new BookmarkConflictError(studyBookmark({ serverRevision: ++revision }));
        return { revision: base + 1, appliedOperationId: operationId };
      },
    }),
  );
  await worker.flush();
  expect(revision).toBe(3);
  expect((await study.pending(alice, now))[0]).toMatchObject({ baseRevision: 3 });
  expect((await study.listBookmarks(alice))[0]?.deleted).toBe(true);
  conflicts = false;
  worker.wake();
  await worker.flush();
  expect(await study.pending(alice, now)).toEqual([]);
});
test('retry persists exponential backoff and blocks only the failing record', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  await study.setBookmark(alice, studyEntry(), true);
  await study.setBookmark(alice, studyEntry({ id: 'other' }), false);
  create(
    remote({
      writeBookmark: async (_owner, bookmark, operationId, base) => {
        if (bookmark.questionId === 'fixture-grammar') throw new StudyError('network');
        return { revision: base + 1, appliedOperationId: operationId };
      },
    }),
  );
  const statuses: StudySyncStatus[] = [];
  worker.subscribe((status) => statuses.push(status));
  await worker.flush();
  expect(statuses.at(-1)).toMatchObject({ pendingCount: 2, recovery: 'network' });
  let pending = await study.pending(alice, Number.MAX_SAFE_INTEGER);
  expect(pending[0]).toMatchObject({ attempts: 1, nextAttemptAt: 1200 });
  for (let attempt = 2; attempt <= 8; attempt++) {
    now = pending[0]!.nextAttemptAt;
    worker.wake();
    await worker.flush();
    pending = await study.pending(alice, Number.MAX_SAFE_INTEGER);
  }
  expect(pending[0]).toMatchObject({ attempts: 8, nextAttemptAt: now + 60000 });
  worker.stop();
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  study = new SqliteStudyRepository(db, clock, { nextId: () => `op-${++id}` }, guard);
  expect((await study.pending(alice, Number.MAX_SAFE_INTEGER))[0]).toMatchObject({
    attempts: 8,
    nextAttemptAt: now + 60000,
  });
});
test('permission failure pauses timers and manual wake recovers without losing local actions', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  let denied = true,
    calls = 0;
  create(
    remote({
      writeBookmark: async (_owner, _bookmark, operationId, base) => {
        calls++;
        if (denied) throw new StudyError('permission-denied');
        return { revision: base + 1, appliedOperationId: operationId };
      },
    }),
  );
  const statuses: StudySyncStatus[] = [];
  worker.subscribe((status) => statuses.push(status));
  await worker.flush();
  expect(statuses.at(-1)).toMatchObject({ recovery: 'permission-denied', pendingCount: 1 });
  await worker.flush();
  expect(calls).toBe(1);
  denied = false;
  worker.wake();
  await worker.flush();
  expect(await study.pending(alice, now)).toEqual([]);
});
test('downloads tombstones after wake and protects pending local desired states', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  create(
    remote({
      listBookmarks: async () => [
        studyBookmark({ deleted: true, serverRevision: 4 }),
        studyBookmark({
          questionId: 'other',
          entry: studyEntry({ id: 'other' }),
          deleted: true,
          serverRevision: 3,
        }),
      ],
      writeBookmark: async () => {
        throw new StudyError('network');
      },
    }),
  );
  await worker.flush();
  expect(await study.listBookmarks(alice)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ questionId: 'other', deleted: true, serverRevision: 3 }),
      expect.objectContaining({ questionId: 'fixture-grammar', deleted: false }),
    ]),
  );
});
test('session publication precedes ordered state operations', async () => {
  await study.replaceActive(alice, studySession());
  await study.recordView(alice, studySession().id, 0);
  await study.move(alice, studySession().id, 1);
  const sequences: number[] = [];
  create(
    remote({
      publishSession: async (_owner, session) => {
        sequences.push(session.sequence);
      },
      writeSessionState: async (_owner, session) => {
        sequences.push(session.sequence);
      },
    }),
  );
  await worker.flush();
  expect(sequences).toEqual([0, 1, 2]);
  expect(await study.pending(alice, now)).toEqual([]);
});

test('restart after remote commit before local acknowledgement replays without revision growth', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  const operation = (await study.pending(alice, now))[0]!;
  const cloud = studyCloudBackend(guard);
  study.acknowledge = async () => {
    throw new StudyError('storage-unavailable');
  };
  create(cloud.remote);
  await worker.flush();
  expect(await study.pending(alice, now)).toHaveLength(1);
  worker.stop();
  await db.close();
  db = nodeSqlDatabase(join(dir, 'study.db'));
  study = new SqliteStudyRepository(db, clock, { nextId: () => `op-${++id}` }, guard);
  create(cloud.remote);
  await worker.flush();
  expect(await study.pending(alice, now)).toEqual([]);
  expect((await cloud.remote.listBookmarks(alice))[0]).toMatchObject({ serverRevision: 1 });
  expect(
    cloud.documents.get(`users/${alice.uid}/bookmarks/fixture-grammar/operations/${operation.id}`),
  ).toMatchObject({ revision: 1 });
});
test('network failure downloading does not prevent durable local uploads', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  create(
    remote({
      listBookmarks: async () => {
        throw new StudyError('network');
      },
    }),
  );
  await worker.flush();
  expect(await study.pending(alice, now)).toEqual([]);
});
test('stop clears retry timer and unsubscribe prevents late status callbacks', async () => {
  jest.useFakeTimers();
  try {
    await study.setBookmark(alice, studyEntry(), false);
    let calls = 0;
    create(
      remote({
        writeBookmark: async () => {
          calls++;
          throw new StudyError('network');
        },
      }),
    );
    const statuses: StudySyncStatus[] = [];
    const detach = worker.subscribe((status) => statuses.push(status));
    await worker.flush();
    expect(jest.getTimerCount()).toBe(1);
    detach();
    const count = statuses.length;
    worker.stop();
    now = 1200;
    jest.advanceTimersByTime(1000);
    await worker.flush();
    expect(jest.getTimerCount()).toBe(0);
    expect(calls).toBe(1);
    expect(statuses.length).toBe(count);
  } finally {
    jest.useRealTimers();
  }
});
test('late bookmark download after switch cannot merge into either owner', async () => {
  let finish!: (value: ReturnType<typeof studyBookmark>[]) => void, entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  create(
    remote({
      listBookmarks: async () => {
        entered();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    }),
  );
  const flush = worker.flush();
  await ready;
  current = bob;
  worker.stop();
  finish([studyBookmark({ deleted: true, serverRevision: 8 })]);
  await flush;
  expect(await study.listBookmarks(bob)).toEqual([]);
  current = alice;
  expect(await study.listBookmarks(alice)).toEqual([]);
});
test('simultaneous device CAS writes conflict and worker rebases queued local desired state', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  await study.setBookmark(alice, studyEntry(), true);
  const cloud = studyCloudBackend({ isCurrent: () => true });
  const results = await Promise.allSettled([
    cloud.remote.writeBookmark(alice, studyBookmark(), 'device-one', 0),
    cloud.remote.writeBookmark(
      { ...alice, deviceId: 'second-device' },
      studyBookmark({ deleted: true }),
      'device-two',
      0,
    ),
  ]);
  expect(results[0]).toMatchObject({ status: 'fulfilled', value: { revision: 1 } });
  expect(results[1]).toMatchObject({
    status: 'rejected',
    reason: { code: 'conflict', remote: { serverRevision: 1 } },
  });
  create(cloud.remote);
  await worker.flush();
  expect(await study.pending(alice, now)).toEqual([]);
  expect((await study.listBookmarks(alice))[0]).toMatchObject({ deleted: true, serverRevision: 3 });
  expect((await cloud.remote.listBookmarks(alice))[0]).toMatchObject({
    deleted: true,
    serverRevision: 3,
  });
});
test('late drain after stop and start cannot publish stale owner status', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  let finish!: (value: ReturnType<typeof studyBookmark>[]) => void, entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  create(
    remote({
      listBookmarks: async (candidate) => {
        if (candidate.uid === alice.uid) {
          entered();
          return new Promise((resolve) => {
            finish = resolve;
          });
        }
        return [];
      },
    }),
  );
  const flush = worker.flush();
  await ready;
  const statuses: StudySyncStatus[] = [];
  worker.subscribe((status) => statuses.push(status));
  current = bob;
  worker.start(bob);
  const index = statuses.length;
  finish([]);
  await flush;
  expect(
    statuses.slice(index).every((status) => status.pendingCount === 0 && status.recovery === null),
  ).toBe(true);
  expect(await study.pending(bob, now)).toEqual([]);
  current = alice;
  expect(await study.pending(alice, now)).toHaveLength(1);
});

test('ordinary flush respects persisted delay but explicit wake retries immediately', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  let failed = true,
    calls = 0;
  create(
    remote({
      writeBookmark: async (_owner, _bookmark, operationId, base) => {
        calls++;
        if (failed) throw new StudyError('network');
        return { revision: base + 1, appliedOperationId: operationId };
      },
    }),
  );
  await worker.flush();
  expect((await study.pending(alice, Number.MAX_SAFE_INTEGER))[0]).toMatchObject({
    attempts: 1,
    nextAttemptAt: 1200,
  });
  failed = false;
  await worker.flush();
  expect(calls).toBe(1);
  worker.wake();
  await worker.flush();
  expect(calls).toBe(2);
  expect(await study.pending(alice, now)).toEqual([]);
});
test.each(['network', 'permission-denied'] as const)(
  'wake during a %s drain queues one immediate pass after failure',
  async (code) => {
    await study.setBookmark(alice, studyEntry(), false);
    let finish!: (reason: StudyError) => void,
      entered!: () => void,
      calls = 0;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    create(
      remote({
        writeBookmark: async (_owner, _bookmark, operationId, base) => {
          if (++calls === 1) {
            entered();
            return new Promise((_resolve, reject) => {
              finish = reject;
            });
          }
          return { revision: base + 1, appliedOperationId: operationId };
        },
      }),
    );
    const flush = worker.flush();
    await ready;
    worker.wake();
    worker.wake();
    finish(new StudyError(code));
    await flush;
    expect(calls).toBe(2);
    expect(await study.pending(alice, now)).toEqual([]);
  },
);

test('pending count comes from durable outbox before a deferred startup download', async () => {
  await study.setBookmark(alice, studyEntry(), false);
  let finish!: (value: ReturnType<typeof studyBookmark>[]) => void, entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  create(
    remote({
      listBookmarks: async () => {
        entered();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    }),
  );
  const statuses: StudySyncStatus[] = [];
  worker.subscribe((status) => statuses.push(status));
  const flush = worker.flush();
  await ready;
  const status = statuses.at(-1);
  finish([]);
  await flush;
  expect(status).toMatchObject({ pendingCount: 1, syncing: true, recovery: null });
});

test('ordinary flush during final pending await drains new due work and preserves delayed retries', async () => {
  await study.setBookmark(alice, studyEntry({ id: 'delayed' }), false);
  const delayedOperation = (await study.pending(alice, now))[0]!;
  await study.retry(alice, delayedOperation.id, 1200);
  const delayedPending = await study.pending(alice, Number.MAX_SAFE_INTEGER);
  const pending = study.pending.bind(study);
  let release!: () => void,
    entered!: () => void,
    allReads = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  study.pending = async (owner, time) => {
    // Preflight is the first all-pending read. The second follows an empty
    // due query and is the end-of-drain status query from the review probe.
    if (time === Number.MAX_SAFE_INTEGER && ++allReads === 2) {
      entered();
      await gate;
    }
    return pending(owner, time);
  };
  const uploaded: string[] = [];
  create(
    remote({
      writeBookmark: async (_owner, bookmark, operationId, base) => {
        uploaded.push(bookmark.questionId);
        return { revision: base + 1, appliedOperationId: operationId };
      },
    }),
  );
  const first = worker.flush();
  await ready;
  await study.setBookmark(alice, studyEntry(), false);
  const second = worker.flush();
  release();
  await Promise.all([first, second]);
  expect(uploaded).toEqual(['fixture-grammar']);
  expect(await study.pending(alice, now)).toEqual([]);
  expect(await study.pending(alice, Number.MAX_SAFE_INTEGER)).toEqual(delayedPending);
});

test('276 online views and moves use bounded incremental session transactions', async () => {
  const cloud = studyCloudBackend(guard);
  let transactions = 0,
    reads = 0,
    acknowledgedInserts = 0;
  const exclusive = db.exclusive.bind(db);
  jest.spyOn(db, 'exclusive').mockImplementation((work, check) =>
    exclusive(
      (tx) =>
        work({
          ...tx,
          run: (sql, params) => {
            if (sql.startsWith('INSERT OR IGNORE INTO reviewer_view_acknowledgements'))
              acknowledgedInserts++;
            return tx.run(sql, params);
          },
        }),
      check,
    ),
  );
  const sdk: StudySyncSdk = {
    ...cloud.sdk,
    transaction: (check, action) => {
      transactions++;
      return cloud.sdk.transaction(check, (tx) =>
        action({
          ...tx,
          get: (path) => {
            reads++;
            return tx.get(path);
          },
        }),
      );
    },
  };
  const session = studySession({
    items: Array.from({ length: 276 }, (_, ordinal) => ({
      ordinal,
      entry: studyEntry({ id: `q-${ordinal}` }),
    })),
  });
  await study.replaceActive(alice, session);
  create(new FirebaseStudySyncRemote(sdk, guard));
  await worker.flush();
  expect({ transactions, reads, writes: cloud.writes.length }).toEqual({
    transactions: 140,
    reads: 140,
    writes: 140,
  });
  transactions = 0;
  reads = 0;
  for (let ordinal = 0; ordinal < 276; ordinal++) {
    if (ordinal) {
      await study.move(alice, session.id, ordinal);
      await worker.flush();
    }
    await study.recordView(alice, session.id, ordinal);
    await worker.flush();
  }
  expect({ transactions, reads, writes: cloud.writes.length - 140 }).toEqual({
    transactions: 1103,
    reads: 1655,
    writes: 827,
  });
  expect(acknowledgedInserts).toBe(276);
  expect(cloud.documents.get(`users/${alice.uid}/reviewerSessions/${session.id}`)).toMatchObject({
    sequence: 551,
    viewedCount: 276,
    status: 'completed',
  });
  expect(await study.pending(alice, now)).toEqual([]);
}, 60000);

test.each(['partial-membership', 'lost-local-ack'] as const)(
  'session %s restart safely replays before later state',
  async (failure) => {
    const cloud = studyCloudBackend(guard);
    const path = `users/${alice.uid}/reviewerSessions/${studySession().id}`;
    await study.replaceActive(alice, studySession());
    create(cloud.remote);
    await worker.flush();
    worker.stop();
    await study.recordView(alice, studySession().id, 1);
    await study.recordView(alice, studySession().id, 0);
    if (failure === 'partial-membership') {
      cloud.setBeforeCommit(() => {
        if (cloud.documents.has(`${path}/items/1`)) throw new StudyError('network');
      });
    } else {
      study.acknowledge = async () => {
        throw new StudyError('storage-unavailable');
      };
    }
    create(cloud.remote);
    await worker.flush();
    expect(cloud.documents.has(`${path}/items/1`)).toBe(true);
    expect(cloud.documents.get(path)).toMatchObject({
      sequence: failure === 'partial-membership' ? 0 : 1,
    });
    expect(await study.acknowledgedViews(alice, studySession().id)).toEqual([]);
    expect(await study.pending(alice, Number.MAX_SAFE_INTEGER)).toHaveLength(2);
    worker.stop();
    await db.close();
    db = nodeSqlDatabase(join(dir, 'study.db'));
    study = new SqliteStudyRepository(db, clock, { nextId: () => `op-${++id}` }, guard);
    cloud.setBeforeCommit(() => {});
    create(cloud.remote);
    worker.wake();
    await worker.flush();
    expect(await study.pending(alice, Number.MAX_SAFE_INTEGER)).toEqual([]);
    expect(await study.acknowledgedViews(alice, studySession().id)).toEqual([0, 1]);
    expect(cloud.documents.get(path)).toMatchObject({
      sequence: 2,
      viewedCount: 2,
      status: 'completed',
    });
    expect(cloud.writes.filter((value) => value === `${path}/items/1`)).toHaveLength(1);
  },
);

test('legacy v2 empty acknowledgement catches up once and later position sends no viewed delta', async () => {
  const cloud = studyCloudBackend(guard);
  await study.replaceActive(alice, studySession());
  await study.recordView(alice, studySession().id, 0);
  create(cloud.remote);
  await worker.flush();
  worker.stop();
  await db.run('DROP TABLE reviewer_view_acknowledgements');
  await db.run('PRAGMA user_version = 2');
  await migrateStudyDatabase(db);
  await study.move(alice, studySession().id, 1);
  const deltas: (readonly number[] | undefined)[] = [];
  const upload = cloud.remote.writeSessionState.bind(cloud.remote);
  cloud.remote.writeSessionState = async (...args) => {
    deltas.push(args[3]);
    return upload(...args);
  };
  create(cloud.remote);
  await worker.flush();
  await study.move(alice, studySession().id, 0);
  await worker.flush();
  expect(deltas).toEqual([[0], []]);
  expect(cloud.writes.filter((path) => path.endsWith('/items/0'))).toHaveLength(1);
  expect(await study.acknowledgedViews(alice, studySession().id)).toEqual([0]);
});

test('owner switch after session upload cannot acknowledge its viewed delta', async () => {
  await study.replaceActive(alice, studySession());
  await study.recordView(alice, studySession().id, 0);
  const cloud = studyCloudBackend(guard);
  const upload = cloud.remote.writeSessionState.bind(cloud.remote);
  cloud.remote.writeSessionState = async (...args) => {
    await upload(...args);
    current = bob;
  };
  create(cloud.remote);
  await worker.flush();
  current = alice;
  expect(await study.acknowledgedViews(alice, studySession().id)).toEqual([]);
  expect(await study.pending(alice, Number.MAX_SAFE_INTEGER)).toHaveLength(1);
  expect(
    cloud.documents.get(`users/${alice.uid}/reviewerSessions/${studySession().id}`),
  ).toMatchObject({ sequence: 1, viewedCount: 1 });
});
