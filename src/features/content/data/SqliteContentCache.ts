import type { Fingerprint } from '../../../core/content/Fingerprint';
import { canonicalJson } from '../../../core/content/Fingerprint';
import type { SqlDatabase } from '../../../core/storage/sqlite/SqlDatabase';
import { integer, stored, storedJson, textValue } from '../../../core/storage/sqlite/rows';
import { BookmarkSchema, StudyError } from '../../study/domain/study';
import { readOperations, readSession } from '../../study/data/studySqlRows';
import type { ContentCache } from '../domain/ContentRepository';
import {
  CatalogEntrySchema,
  CatalogSnapshotSchema,
  QuestionRefSchema,
  type CatalogEntry,
  type CatalogSnapshot,
  type QuestionRef,
} from '../domain/catalog';
import { catalogEntryForQuestion, validateRevision } from '../domain/revisionValidation';
import type { Question } from '../domain/question';

function validSnapshot(value: CatalogSnapshot) {
  const parsed = CatalogSnapshotSchema.safeParse(value);
  if (!parsed.success) throw new StudyError('invalid-content');
  return parsed.data;
}
const key = (ref: QuestionRef) => canonicalJson({ id: ref.id, version: ref.version });

export class SqliteContentCache implements ContentCache {
  constructor(
    private readonly db: SqlDatabase,
    private readonly fingerprint: Fingerprint,
  ) {}
  private async access<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    try {
      return await this.db.exclusive(work);
    } catch (error) {
      if (error instanceof StudyError) throw error;
      throw new StudyError('storage-unavailable');
    }
  }
  private async readCatalog(
    tx: SqlDatabase,
    row: Record<string, unknown>,
  ): Promise<CatalogSnapshot> {
    const entries = (
      await tx.all(
        'SELECT ordinal, entry_json FROM catalog_items WHERE generation = ? ORDER BY ordinal',
        [textValue(row.generation)],
      )
    ).map((item, ordinal) => {
      if (item.ordinal !== ordinal) throw new StudyError('storage-corrupt');
      return storedJson(CatalogEntrySchema, item.entry_json);
    });
    if (entries.length !== integer(row.item_count)) throw new StudyError('storage-corrupt');
    const snapshot = stored(CatalogSnapshotSchema, {
      generation: row.generation,
      revision: row.revision,
      validatedAt: row.validated_at,
      entries,
    });
    const immutable = {
      generation: snapshot.generation,
      entries: snapshot.entries,
    };
    if ((await this.fingerprint.digest(immutable)) !== row.fingerprint)
      throw new StudyError('storage-corrupt');
    return snapshot;
  }
  catalog(): Promise<CatalogSnapshot | null> {
    return this.access(async (tx) => {
      const row = (
        await tx.all('SELECT * FROM catalogs ORDER BY revision DESC, validated_at DESC LIMIT 1')
      )[0];
      return row ? this.readCatalog(tx, row) : null;
    });
  }
  async saveCatalog(value: CatalogSnapshot): Promise<void> {
    const snapshot = validSnapshot(value);
    const immutable = {
      generation: snapshot.generation,
      entries: snapshot.entries,
    };
    const fingerprint = await this.fingerprint.digest(immutable);
    await this.access(async (tx) => {
      const previous = (
        await tx.all('SELECT * FROM catalogs WHERE generation = ?', [snapshot.generation])
      )[0];
      if (previous) {
        await this.readCatalog(tx, previous);
        if (previous.fingerprint !== fingerprint) throw new StudyError('conflict');
        await tx.run('UPDATE catalogs SET revision = ?, validated_at = ? WHERE generation = ?', [
          Math.max(snapshot.revision, integer(previous.revision)),
          Math.max(snapshot.validatedAt, integer(previous.validated_at)),
          snapshot.generation,
        ]);
        return;
      }
      await tx.run(
        'INSERT INTO catalogs (generation, revision, validated_at, item_count, fingerprint) VALUES (?, ?, ?, ?, ?)',
        [
          snapshot.generation,
          snapshot.revision,
          snapshot.validatedAt,
          snapshot.entries.length,
          fingerprint,
        ],
      );
      for (const [ordinal, entry] of snapshot.entries.entries())
        await tx.run(
          'INSERT INTO catalog_items (generation, ordinal, entry_json) VALUES (?, ?, ?)',
          [snapshot.generation, ordinal, canonicalJson(entry)],
        );
    });
  }
  private async readQuestion(row: Record<string, unknown>): Promise<Question> {
    try {
      const entry = storedJson(CatalogEntrySchema, row.entry_json);
      if (entry.id !== row.question_id || entry.version !== row.version)
        throw new StudyError('storage-corrupt');
      const question = validateRevision(JSON.parse(textValue(row.payload_json)), entry);
      if ((await this.fingerprint.digest(question)) !== row.fingerprint)
        throw new StudyError('storage-corrupt');
      return question;
    } catch {
      throw new StudyError('storage-corrupt');
    }
  }
  question(value: QuestionRef): Promise<Question | null> {
    const parsed = QuestionRefSchema.safeParse({ id: value.id, version: value.version });
    if (!parsed.success) return Promise.reject(new StudyError('invalid-content'));
    return this.access(async (tx) => {
      const row = (
        await tx.all('SELECT * FROM question_revisions WHERE question_id = ? AND version = ?', [
          parsed.data.id,
          parsed.data.version,
        ])
      )[0];
      return row ? this.readQuestion(row) : null;
    });
  }
  async saveQuestion(entry: CatalogEntry, raw: Question): Promise<void> {
    const question = validateRevision(raw, entry);
    const fingerprint = await this.fingerprint.digest(question);
    await this.access(async (tx) => {
      const previous = (
        await tx.all('SELECT * FROM question_revisions WHERE question_id = ? AND version = ?', [
          question.id,
          question.version,
        ])
      )[0];
      if (previous) {
        await this.readQuestion(previous);
        if (fingerprint !== previous.fingerprint) throw new StudyError('conflict');
        return;
      }
      await tx.run(
        'INSERT INTO question_revisions (question_id, version, entry_json, payload_json, fingerprint) VALUES (?, ?, ?, ?, ?)',
        [
          question.id,
          question.version,
          canonicalJson(catalogEntryForQuestion(question)),
          canonicalJson(question),
          fingerprint,
        ],
      );
    });
  }
  /** All owners and devices count. Pending uploads retain their pinned revisions too. */
  async evictUnreferenced(): Promise<void> {
    await this.access(async (tx) => {
      const refs = new Set<string>();
      const generations = new Set<string>();
      const latest = (
        await tx.all(
          'SELECT generation FROM catalogs ORDER BY revision DESC, validated_at DESC LIMIT 1',
        )
      )[0];
      if (latest) generations.add(textValue(latest.generation));
      const sessions = await tx.all(
        "SELECT uid, device_id, session_id, generation FROM reviewer_sessions WHERE status != 'archived'",
      );
      for (const session of sessions) {
        generations.add(textValue(session.generation));
        const items = await tx.all(
          'SELECT entry_json FROM reviewer_items WHERE uid = ? AND device_id = ? AND session_id = ?',
          [textValue(session.uid), textValue(session.device_id), textValue(session.session_id)],
        );
        for (const item of items) refs.add(key(storedJson(CatalogEntrySchema, item.entry_json)));
      }
      for (const row of await tx.all('SELECT bookmark_json FROM bookmarks')) {
        const bookmark = storedJson(BookmarkSchema, row.bookmark_json);
        if (!bookmark.deleted) refs.add(key(bookmark.entry));
      }
      for (const operation of await readOperations(tx)) {
        if (operation.kind === 'publishSession') {
          generations.add(operation.session.generation);
          for (const item of operation.session.items) refs.add(key(item.entry));
        } else if (operation.kind === 'bookmarkState') refs.add(key(operation.bookmark.entry));
        else {
          const session = await readSession(
            tx,
            { uid: operation.uid, deviceId: operation.deviceId, epoch: 0 },
            operation.recordId,
          );
          if (!session) throw new StudyError('storage-corrupt');
          generations.add(session.generation);
          for (const item of session.items) refs.add(key(item.entry));
        }
      }
      for (const row of await tx.all('SELECT question_id, version FROM question_revisions')) {
        const ref = stored(QuestionRefSchema, { id: row.question_id, version: row.version });
        if (!refs.has(key(ref)))
          await tx.run('DELETE FROM question_revisions WHERE question_id = ? AND version = ?', [
            ref.id,
            ref.version,
          ]);
      }
      for (const row of await tx.all('SELECT generation FROM catalogs')) {
        const generation = textValue(row.generation);
        if (!generations.has(generation))
          await tx.run('DELETE FROM catalogs WHERE generation = ?', [generation]);
      }
    });
  }
}
