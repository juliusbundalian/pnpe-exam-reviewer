import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { digestStringAsync } from 'expo-crypto';
import { openNativeStudyDatabase } from '../../src/core/storage/sqlite/nativeSqlDatabase';
import { nativeFingerprint } from '../../src/core/content/nativeFingerprint';
import { SqliteStudyRepository } from '../../src/features/study/data/SqliteStudyRepository';
import { owner, studySession } from '../fixtures/study';
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(),
}));

test('native facade uses one connection for migration, bound writes, foreign keys and guarded rollback', async () => {
  const connection = new DatabaseSync(':memory:');
  const native = {
    runAsync: async (sql: string, params: (string | number | null)[] = []) =>
      connection.prepare(sql).run(...params),
    getAllAsync: async (sql: string, params: (string | number | null)[] = []) =>
      connection.prepare(sql).all(...params),
    closeAsync: async () => connection.close(),
  };
  jest.mocked(openDatabaseAsync).mockResolvedValue(native as unknown as SQLiteDatabase);
  const db = await openNativeStudyDatabase();
  let valid = true,
    id = 0;
  const repo = new SqliteStudyRepository(
    db,
    { now: () => 200 },
    { nextId: () => `op-${++id}` },
    { isCurrent: () => valid },
  );
  await repo.replaceActive(owner, studySession());
  expect((await repo.active(owner))?.items[0]?.entry.id).toBe('fixture-grammar');
  await expect(
    db.exclusive((tx) =>
      tx.run('INSERT INTO reviewer_views VALUES (?, ?, ?, ?)', [
        owner.uid,
        owner.deviceId,
        'missing',
        0,
      ]),
    ),
  ).rejects.toThrow();
  await expect(
    db.exclusive(
      async (tx) => {
        await tx.run('UPDATE reviewer_sessions SET position = 1');
        valid = false;
      },
      () => {
        if (!valid) throw new Error('stale');
      },
    ),
  ).rejects.toThrow('stale');
  valid = true;
  expect((await repo.active(owner))?.position).toBe(0);
  await db.close();
});
test('native fingerprint digests canonical UTF-8 JSON with SHA-256', async () => {
  jest.mocked(digestStringAsync).mockImplementation(async (algorithm, value) => {
    if (algorithm !== 'SHA-256') throw new Error('Wrong algorithm');
    return createHash('sha256').update(value).digest('hex');
  });
  expect(await nativeFingerprint.digest({ b: 2, a: 'é' })).toBe(
    '06c264c46ad5ada9493abd3aa2383fb205ae99d7d0bad40b03a43bfec8a1b8de',
  );
});
