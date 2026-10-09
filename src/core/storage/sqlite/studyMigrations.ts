import { StudyError } from '../../../features/study/domain/study';
import type { SqlDatabase } from './SqlDatabase';

export const STUDY_SCHEMA_VERSION = 3;
const statements = [
  `CREATE TABLE catalogs (generation TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL, validated_at INTEGER NOT NULL, item_count INTEGER NOT NULL, fingerprint TEXT NOT NULL)`,
  `CREATE TABLE catalog_items (generation TEXT NOT NULL REFERENCES catalogs(generation) ON DELETE CASCADE, ordinal INTEGER NOT NULL, entry_json TEXT NOT NULL, PRIMARY KEY (generation, ordinal))`,
  `CREATE TABLE question_revisions (question_id TEXT NOT NULL, version INTEGER NOT NULL, entry_json TEXT NOT NULL, payload_json TEXT NOT NULL, fingerprint TEXT NOT NULL, PRIMARY KEY (question_id, version))`,
  `CREATE TABLE device_identity (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), device_id TEXT NOT NULL)`,
  `CREATE TABLE reviewer_sessions (uid TEXT NOT NULL, device_id TEXT NOT NULL, session_id TEXT NOT NULL, scope_json TEXT NOT NULL, generation TEXT NOT NULL, created_at INTEGER NOT NULL, shuffle_questions INTEGER NOT NULL CHECK (shuffle_questions IN (0,1)), position INTEGER NOT NULL, sequence INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('active','completed','archived')), PRIMARY KEY (uid, device_id, session_id))`,
  `CREATE UNIQUE INDEX current_session ON reviewer_sessions(uid, device_id) WHERE status != 'archived'`,
  `CREATE TABLE reviewer_items (uid TEXT NOT NULL, device_id TEXT NOT NULL, session_id TEXT NOT NULL, ordinal INTEGER NOT NULL, entry_json TEXT NOT NULL, PRIMARY KEY (uid, device_id, session_id, ordinal), FOREIGN KEY (uid, device_id, session_id) REFERENCES reviewer_sessions(uid, device_id, session_id) ON DELETE CASCADE)`,
  `CREATE TABLE reviewer_views (uid TEXT NOT NULL, device_id TEXT NOT NULL, session_id TEXT NOT NULL, ordinal INTEGER NOT NULL, PRIMARY KEY (uid, device_id, session_id, ordinal), FOREIGN KEY (uid, device_id, session_id, ordinal) REFERENCES reviewer_items(uid, device_id, session_id, ordinal) ON DELETE CASCADE)`,
  `CREATE TABLE bookmarks (uid TEXT NOT NULL, device_id TEXT NOT NULL, question_id TEXT NOT NULL, bookmark_json TEXT NOT NULL, local_sequence INTEGER NOT NULL, PRIMARY KEY (uid, device_id, question_id))`,
  `CREATE TABLE study_outbox (uid TEXT NOT NULL, device_id TEXT NOT NULL, operation_id TEXT NOT NULL, record_id TEXT NOT NULL, local_sequence INTEGER NOT NULL, created_at INTEGER NOT NULL, next_attempt_at INTEGER NOT NULL, operation_json TEXT NOT NULL, PRIMARY KEY (uid, device_id, operation_id))`,
  `CREATE INDEX outbox_record ON study_outbox(uid, device_id, record_id, local_sequence)`,
];

/** Never clears or recreates an existing file, including on unsupported future versions. */
export async function migrateStudyDatabase(db: SqlDatabase): Promise<void> {
  try {
    await db.exclusive(async (tx) => {
      const version = (await tx.all('PRAGMA user_version'))[0]?.user_version;
      if (
        typeof version !== 'number' ||
        !Number.isSafeInteger(version) ||
        version < 0 ||
        version > STUDY_SCHEMA_VERSION
      )
        throw new StudyError('storage-corrupt');
      if (version === 0) {
        for (const sql of statements) await tx.run(sql);
        await tx.run('PRAGMA user_version = 1');
      }
      if (version < 2) {
        await tx.run('ALTER TABLE reviewer_sessions ADD COLUMN catalog_validated_at INTEGER');
        await tx.run('PRAGMA user_version = 2');
      }
      if (version < 3) {
        await tx.run(
          `CREATE TABLE reviewer_view_acknowledgements (uid TEXT NOT NULL, device_id TEXT NOT NULL, session_id TEXT NOT NULL, ordinal INTEGER NOT NULL, PRIMARY KEY (uid, device_id, session_id, ordinal), FOREIGN KEY (uid, device_id, session_id, ordinal) REFERENCES reviewer_items(uid, device_id, session_id, ordinal) ON DELETE CASCADE)`,
        );
        await tx.run('PRAGMA user_version = 3');
      }
      const integrity = await tx.all('PRAGMA quick_check');
      if (
        integrity.length !== 1 ||
        integrity[0]?.quick_check !== 'ok' ||
        (await tx.all('PRAGMA foreign_key_check')).length !== 0
      )
        throw new StudyError('storage-corrupt');
    });
  } catch (error) {
    if (error instanceof StudyError) throw error;
    throw new StudyError('storage-unavailable');
  }
}
