import type { SqlDatabase } from '../../../core/storage/sqlite/SqlDatabase';
import { integer, stored, storedJson, textValue } from '../../../core/storage/sqlite/rows';
import { canonicalJson } from '../../../core/content/Fingerprint';
import { CatalogEntrySchema } from '../../content/domain/catalog';
import {
  BookmarkSchema,
  ReviewerSessionSchema,
  StudyOperationSchema,
  StudyError,
  type Bookmark,
  type OwnerContext,
  type ReviewerSession,
  type StudyOperation,
} from '../domain/study';

export const ownerKeys = (owner: OwnerContext) => [owner.uid, owner.deviceId];
export async function sessionItems(tx: SqlDatabase, owner: OwnerContext, id: string) {
  const rows = await tx.all(
    'SELECT ordinal, entry_json FROM reviewer_items WHERE uid = ? AND device_id = ? AND session_id = ? ORDER BY ordinal',
    [...ownerKeys(owner), id],
  );
  return rows.map((row) => ({
    ordinal: integer(row.ordinal),
    entry: storedJson(CatalogEntrySchema, row.entry_json),
  }));
}
export async function readSession(
  tx: SqlDatabase,
  owner: OwnerContext,
  id: string,
): Promise<ReviewerSession | null> {
  const row = (
    await tx.all(
      'SELECT * FROM reviewer_sessions WHERE uid = ? AND device_id = ? AND session_id = ?',
      [...ownerKeys(owner), id],
    )
  )[0];
  if (!row) return null;
  const views = await tx.all(
    'SELECT ordinal FROM reviewer_views WHERE uid = ? AND device_id = ? AND session_id = ? ORDER BY ordinal',
    [...ownerKeys(owner), id],
  );
  if (row.shuffle_questions !== 0 && row.shuffle_questions !== 1)
    throw new StudyError('storage-corrupt');
  let scope: unknown;
  try {
    scope = JSON.parse(textValue(row.scope_json));
  } catch {
    throw new StudyError('storage-corrupt');
  }
  return stored(ReviewerSessionSchema, {
    id: row.session_id,
    uid: row.uid,
    deviceId: row.device_id,
    scope,
    generation: row.generation,
    catalogValidatedAt: row.catalog_validated_at,
    createdAt: row.created_at,
    shuffleQuestions: row.shuffle_questions === 1,
    position: row.position,
    sequence: row.sequence,
    status: row.status,
    items: await sessionItems(tx, owner, id),
    viewedOrdinals: views.map((view) => integer(view.ordinal)),
  });
}
export async function readBookmark(
  tx: SqlDatabase,
  owner: OwnerContext,
  id: string,
): Promise<{ bookmark: Bookmark; sequence: number } | null> {
  const row = (
    await tx.all('SELECT * FROM bookmarks WHERE uid = ? AND device_id = ? AND question_id = ?', [
      ...ownerKeys(owner),
      id,
    ])
  )[0];
  return row ? bookmarkRow(row) : null;
}
export function bookmarkRow(row: Record<string, unknown>) {
  const bookmark = storedJson(BookmarkSchema, row.bookmark_json);
  if (bookmark.uid !== row.uid || bookmark.questionId !== row.question_id)
    throw new StudyError('storage-corrupt');
  return { bookmark, sequence: integer(row.local_sequence) };
}
export async function writeBookmark(
  tx: SqlDatabase,
  owner: OwnerContext,
  bookmark: Bookmark,
  sequence: number,
) {
  stored(BookmarkSchema, bookmark);
  integer(sequence);
  await tx.run(
    'INSERT INTO bookmarks (uid, device_id, question_id, bookmark_json, local_sequence) VALUES (?, ?, ?, ?, ?) ON CONFLICT(uid, device_id, question_id) DO UPDATE SET bookmark_json = excluded.bookmark_json, local_sequence = excluded.local_sequence',
    [...ownerKeys(owner), bookmark.questionId, canonicalJson(bookmark), sequence],
  );
}
/** Publication manifests live only in reviewer_items, never in an oversized outbox blob. */
function operationJson(operation: StudyOperation) {
  if (operation.kind !== 'publishSession') return canonicalJson(operation);
  const session = Object.fromEntries(
    Object.entries(operation.session).filter(([key]) => key !== 'items'),
  );
  return canonicalJson({ ...operation, session });
}
export async function insertOperation(tx: SqlDatabase, operation: StudyOperation) {
  const parsed = stored(StudyOperationSchema, operation);
  await tx.run(
    'INSERT INTO study_outbox (uid, device_id, operation_id, record_id, local_sequence, created_at, next_attempt_at, operation_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      parsed.uid,
      parsed.deviceId,
      parsed.id,
      parsed.recordId,
      parsed.localSequence,
      parsed.createdAt,
      parsed.nextAttemptAt,
      operationJson(parsed),
    ],
  );
}
export async function updateOperation(tx: SqlDatabase, operation: StudyOperation) {
  stored(StudyOperationSchema, operation);
  await tx.run(
    'UPDATE study_outbox SET next_attempt_at = ?, operation_json = ? WHERE uid = ? AND device_id = ? AND operation_id = ?',
    [
      operation.nextAttemptAt,
      operationJson(operation),
      operation.uid,
      operation.deviceId,
      operation.id,
    ],
  );
}
export async function readOperations(
  tx: SqlDatabase,
  owner?: OwnerContext,
): Promise<StudyOperation[]> {
  const rows = await tx.all(
    `SELECT * FROM study_outbox${owner ? ' WHERE uid = ? AND device_id = ?' : ''} ORDER BY rowid`,
    owner ? ownerKeys(owner) : [],
  );
  const operations: StudyOperation[] = [];
  for (const row of rows) {
    let raw: unknown;
    try {
      raw = JSON.parse(textValue(row.operation_json));
    } catch {
      throw new StudyError('storage-corrupt');
    }
    if (typeof raw !== 'object' || raw === null) throw new StudyError('storage-corrupt');
    const partial = raw as { kind?: unknown; session?: unknown };
    if (partial.kind === 'publishSession') {
      if (typeof partial.session !== 'object' || partial.session === null)
        throw new StudyError('storage-corrupt');
      if (Object.hasOwn(partial.session, 'items')) throw new StudyError('storage-corrupt');
      raw = {
        ...partial,
        session: {
          ...partial.session,
          items: await sessionItems(
            tx,
            { uid: textValue(row.uid), deviceId: textValue(row.device_id), epoch: 0 },
            textValue(row.record_id),
          ),
        },
      };
    }
    const operation = stored(StudyOperationSchema, raw);
    if (
      operation.uid !== row.uid ||
      operation.deviceId !== row.device_id ||
      operation.id !== row.operation_id ||
      operation.recordId !== row.record_id ||
      operation.localSequence !== row.local_sequence ||
      operation.createdAt !== row.created_at ||
      operation.nextAttemptAt !== row.next_attempt_at
    )
      throw new StudyError('storage-corrupt');
    operations.push(operation);
  }
  return operations;
}
