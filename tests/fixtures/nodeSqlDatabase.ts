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

/** A test built from the latest schema must remove later tables before impersonating a legacy file. */
export async function dropExamTablesForLegacyFixture(db: SqlDatabase): Promise<void> {
  for (const table of ['exam_outbox', 'exam_results', 'exam_questions', 'exam_attempts']) {
    await db.run(`DROP TABLE IF EXISTS ${table}`);
  }
}
export const nodeFingerprint: Fingerprint = {
  async digest(value) {
    return createHash('sha256').update(canonicalJson(value)).digest('hex');
  },
};
