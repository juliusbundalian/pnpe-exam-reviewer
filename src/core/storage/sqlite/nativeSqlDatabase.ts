import { openDatabaseAsync } from 'expo-sqlite';
import { StudyError } from '../../../features/study/domain/study';
import type { SqlDatabase } from './SqlDatabase';
import { serialSqlDatabase } from './serialSqlDatabase';
import { migrateStudyDatabase } from './studyMigrations';

/** Own connection; all statements, transactions and FK settings use this connection. */
export async function openNativeStudyDatabase(name = 'pnpe-study.db'): Promise<SqlDatabase> {
  try {
    const native = await openDatabaseAsync(name, { useNewConnection: true });
    const db = serialSqlDatabase({
      run: (sql, params = []) => native.runAsync(sql, [...params]),
      all: (sql, params = []) => native.getAllAsync<Record<string, unknown>>(sql, [...params]),
      close: () => native.closeAsync(),
    });
    try {
      await db.run('PRAGMA foreign_keys = ON');
      await db.run('PRAGMA journal_mode = WAL');
      await migrateStudyDatabase(db);
      return db;
    } catch (error) {
      await db.close();
      throw error;
    }
  } catch (error) {
    if (error instanceof StudyError) throw error;
    throw new StudyError('storage-unavailable');
  }
}
