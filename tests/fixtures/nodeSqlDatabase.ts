import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { canonicalJson, type Fingerprint } from '../../src/core/content/Fingerprint';
import { serialSqlDatabase } from '../../src/core/storage/sqlite/serialSqlDatabase';
import type { SqlDatabase } from '../../src/core/storage/sqlite/SqlDatabase';

/** Real SQLite with the same serialization/transaction facade as native; test-only. */
export function nodeSqlDatabase(filename: string): SqlDatabase {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON');
  return serialSqlDatabase({
    async run(sql, params = []) {
      return { changes: Number(db.prepare(sql).run(...params).changes) };
    },
    async all(sql, params = []) {
      return db.prepare(sql).all(...params) as Record<string, unknown>[];
    },
    async close() {
      db.close();
    },
  });
}
export const nodeFingerprint: Fingerprint = {
  async digest(value) {
    return createHash('sha256').update(canonicalJson(value)).digest('hex');
  },
};
