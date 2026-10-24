import type { SqlDatabase, SqlDriver } from './SqlDatabase';

/** Serializes reads too: another caller cannot accidentally join an open transaction. */
export function serialSqlDatabase(driver: SqlDriver): SqlDatabase {
  let tail: Promise<unknown> = Promise.resolve();
  let closed = false;
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = tail.then(() => {
      if (closed) throw new Error('Database is closed');
      return work();
    });
    tail = result.catch(() => undefined);
    return result;
  }
  return {
    run: (sql, params) => enqueue(() => driver.run(sql, params)),
    all: (sql, params) => enqueue(() => driver.all(sql, params)),
    exclusive: (work, beforeCommit) =>
      enqueue(async () => {
        // PRAGMA must run before BEGIN; changing it inside a transaction is a no-op.
        await driver.run('PRAGMA foreign_keys = ON');
        const enabled = (await driver.all('PRAGMA foreign_keys'))[0];
        if (enabled?.foreign_keys !== 1) throw new Error('Foreign keys unavailable');
        await driver.run('BEGIN IMMEDIATE');
        let alive = true;
        const tx: SqlDatabase = {
          run: async (sql, params) => {
            if (!alive) throw new Error('Transaction ended');
            return driver.run(sql, params);
          },
          all: async (sql, params) => {
            if (!alive) throw new Error('Transaction ended');
            return driver.all(sql, params);
          },
          exclusive: async () => {
            throw new Error('Nested transaction');
          },
          close: async () => {
            throw new Error('Transaction cannot close connection');
          },
        };
        try {
          const result = await work(tx);
          alive = false;
          // No await between this check and scheduling COMMIT on the same connection.
          beforeCommit?.();
          await driver.run('COMMIT');
          return result;
        } catch (error) {
          alive = false;
          try {
            await driver.run('ROLLBACK');
          } catch {
            throw new Error('Transaction rollback failed');
          }
          throw error;
        }
      }),
    close: () =>
      enqueue(async () => {
        await driver.close();
        closed = true;
      }),
  };
}
