import { canonicalJson } from '../../../core/content/Fingerprint';
import type { Clock } from '../../../core/clock/Clock';
import type { IdentitySource } from '../../../core/identity/IdentitySource';
import type { SqlDatabase } from '../../../core/storage/sqlite/SqlDatabase';
import { stored, textValue, integer } from '../../../core/storage/sqlite/rows';
import {
  CatalogEntrySchema,
  SafeIntegerSchema,
  type CatalogEntry,
} from '../../content/domain/catalog';
import type { StudyRepository } from '../domain/StudyRepository';
import {
  BookmarkSchema,
  GeneratedIdSchema,
  OwnerContextSchema,
  ReviewerSessionSchema,
  StudyError,
  type Bookmark,
  type OwnerContext,
  type OwnerGuard,
  type ReviewerSession,
  type StudyOperation,
} from '../domain/study';
import {
  bookmarkRow,
  insertOperation,
  ownerKeys,
  readBookmark,
  readOperations,
  readSession,
  updateOperation,
  writeBookmark,
} from './studySqlRows';

function input<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new StudyError('invalid-content');
  return parsed.data;
}
function state(session: ReviewerSession) {
  return {
    sequence: session.sequence,
    position: session.position,
    status: session.status,
    viewedOrdinals: session.viewedOrdinals,
  };
}
function immutable(session: ReviewerSession) {
  return canonicalJson({
    id: session.id,
    uid: session.uid,
    deviceId: session.deviceId,
    scope: session.scope,
    generation: session.generation,
    catalogValidatedAt: session.catalogValidatedAt,
    createdAt: session.createdAt,
    shuffleQuestions: session.shuffleQuestions,
    items: session.items,
  });
}

export class SqliteStudyRepository implements StudyRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock,
    private readonly identity: IdentitySource,
    private readonly guard: OwnerGuard,
  ) {}
  private check(owner: OwnerContext) {
    input(OwnerContextSchema, owner);
    if (!this.guard.isCurrent(owner)) throw new StudyError('auth-required');
  }
  private async access<T>(
    owner: OwnerContext,
    work: (tx: SqlDatabase) => Promise<T>,
    checkMutation?: () => void,
  ): Promise<T> {
    this.check(owner);
    try {
      const result = await this.db.exclusive(
        async (tx) => {
          this.check(owner);
          checkMutation?.();
          return work(tx);
        },
        () => {
          this.check(owner);
          checkMutation?.();
        },
      );
      this.check(owner);
      return result;
    } catch (error) {
      if (error instanceof StudyError) throw error;
      throw new StudyError('storage-unavailable');
    }
  }
  private common(owner: OwnerContext, recordId: string, localSequence: number) {
    const now = input(SafeIntegerSchema, this.clock.now());
    return {
      id: input(GeneratedIdSchema, this.identity.nextId()),
      uid: owner.uid,
      deviceId: owner.deviceId,
      recordId,
      localSequence,
      createdAt: now,
      attempts: 0,
      nextAttemptAt: now,
    };
  }
  async deviceIdentity(): Promise<string> {
    try {
      return await this.db.exclusive(async (tx) => {
        const row = (await tx.all('SELECT device_id FROM device_identity WHERE singleton = 1'))[0];
        if (row) return stored(GeneratedIdSchema, row.device_id);
        const id = input(GeneratedIdSchema, this.identity.nextId());
        await tx.run('INSERT INTO device_identity (singleton, device_id) VALUES (1, ?)', [id]);
        return id;
      });
    } catch (error) {
      if (error instanceof StudyError) throw error;
      throw new StudyError('storage-unavailable');
    }
  }
  active(owner: OwnerContext): Promise<ReviewerSession | null> {
    return this.access(owner, async (tx) => {
      const row = (
        await tx.all(
          "SELECT session_id FROM reviewer_sessions WHERE uid = ? AND device_id = ? AND status != 'archived'",
          ownerKeys(owner),
        )
      )[0];
      return row ? readSession(tx, owner, textValue(row.session_id)) : null;
    });
  }
  session(owner: OwnerContext, id: string): Promise<ReviewerSession | null> {
    input(GeneratedIdSchema, id);
    return this.access(owner, (tx) => readSession(tx, owner, id));
  }
  async replaceActive(
    owner: OwnerContext,
    value: ReviewerSession,
    checkMutation?: () => void,
  ): Promise<void> {
    const session = input(ReviewerSessionSchema, value);
    if (
      session.uid !== owner.uid ||
      session.deviceId !== owner.deviceId ||
      session.sequence !== 0 ||
      session.position !== 0 ||
      session.viewedOrdinals.length ||
      session.status !== 'active'
    )
      throw new StudyError('invalid-content');
    await this.access(
      owner,
      async (tx) => {
        const existing = await readSession(tx, owner, session.id);
        if (existing) {
          if (immutable(existing) !== immutable(session)) throw new StudyError('conflict');
          return;
        }
        const previous = (
          await tx.all(
            "SELECT session_id FROM reviewer_sessions WHERE uid = ? AND device_id = ? AND status != 'archived'",
            ownerKeys(owner),
          )
        )[0];
        if (previous) {
          const prior = await readSession(tx, owner, textValue(previous.session_id));
          if (!prior) throw new StudyError('storage-corrupt');
          const archived = { ...prior, sequence: prior.sequence + 1, status: 'archived' as const };
          await this.saveState(tx, owner, archived);
          await insertOperation(tx, {
            ...this.common(owner, prior.id, archived.sequence),
            kind: 'sessionState',
            state: state(archived),
          });
        }
        await tx.run(
          'INSERT INTO reviewer_sessions (uid, device_id, session_id, scope_json, generation, catalog_validated_at, created_at, shuffle_questions, position, sequence, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            ...ownerKeys(owner),
            session.id,
            canonicalJson(session.scope),
            session.generation,
            session.catalogValidatedAt,
            session.createdAt,
            Number(session.shuffleQuestions),
            session.position,
            session.sequence,
            session.status,
          ],
        );
        for (const item of session.items)
          await tx.run(
            'INSERT INTO reviewer_items (uid, device_id, session_id, ordinal, entry_json) VALUES (?, ?, ?, ?, ?)',
            [...ownerKeys(owner), session.id, item.ordinal, canonicalJson(item.entry)],
          );
        await insertOperation(tx, {
          ...this.common(owner, session.id, session.sequence),
          kind: 'publishSession',
          session,
        });
      },
      checkMutation,
    );
  }
  private async saveState(tx: SqlDatabase, owner: OwnerContext, session: ReviewerSession) {
    stored(ReviewerSessionSchema, session);
    await tx.run(
      'UPDATE reviewer_sessions SET position = ?, sequence = ?, status = ? WHERE uid = ? AND device_id = ? AND session_id = ?',
      [session.position, session.sequence, session.status, ...ownerKeys(owner), session.id],
    );
  }
  private async changeSession(
    owner: OwnerContext,
    id: string,
    ordinal: number,
    view: boolean,
  ): Promise<ReviewerSession> {
    input(GeneratedIdSchema, id);
    input(SafeIntegerSchema, ordinal);
    return this.access(owner, async (tx) => {
      const previous = await readSession(tx, owner, id);
      if (!previous || previous.status === 'archived' || ordinal >= previous.items.length)
        throw new StudyError('invalid-content');
      if (view ? previous.viewedOrdinals.includes(ordinal) : previous.position === ordinal)
        return previous;
      const viewedOrdinals = view
        ? [...previous.viewedOrdinals, ordinal].sort((a, b) => a - b)
        : previous.viewedOrdinals;
      const updated = stored(ReviewerSessionSchema, {
        ...previous,
        position: view ? previous.position : ordinal,
        viewedOrdinals,
        sequence: previous.sequence + 1,
        status: viewedOrdinals.length === previous.items.length ? 'completed' : 'active',
      });
      if (view)
        await tx.run(
          'INSERT INTO reviewer_views (uid, device_id, session_id, ordinal) VALUES (?, ?, ?, ?)',
          [...ownerKeys(owner), id, ordinal],
        );
      await this.saveState(tx, owner, updated);
      await insertOperation(tx, {
        ...this.common(owner, id, updated.sequence),
        kind: 'sessionState',
        state: state(updated),
      });
      return updated;
    });
  }
  recordView(owner: OwnerContext, id: string, ordinal: number) {
    return this.changeSession(owner, id, ordinal, true);
  }
  move(owner: OwnerContext, id: string, ordinal: number) {
    return this.changeSession(owner, id, ordinal, false);
  }
  listBookmarks(owner: OwnerContext): Promise<readonly Bookmark[]> {
    return this.access(owner, async (tx) =>
      (
        await tx.all(
          'SELECT * FROM bookmarks WHERE uid = ? AND device_id = ? ORDER BY question_id',
          ownerKeys(owner),
        )
      ).map((row) => bookmarkRow(row).bookmark),
    );
  }
  setBookmark(
    owner: OwnerContext,
    value: CatalogEntry,
    deleted: boolean,
    checkMutation?: () => void,
  ): Promise<Bookmark> {
    const entry = input(CatalogEntrySchema, value);
    if (typeof deleted !== 'boolean') throw new StudyError('invalid-content');
    return this.access(
      owner,
      async (tx) => {
        const previous = await readBookmark(tx, owner, entry.id);
        const now = input(SafeIntegerSchema, this.clock.now());
        const bookmark = stored(BookmarkSchema, {
          uid: owner.uid,
          questionId: entry.id,
          entry,
          createdAt: previous?.bookmark.createdAt ?? now,
          updatedAt: Math.max(now, previous?.bookmark.updatedAt ?? 0),
          deleted,
          serverRevision: previous?.bookmark.serverRevision ?? 0,
        });
        const sequence = (previous?.sequence ?? 0) + 1;
        await writeBookmark(tx, owner, bookmark, sequence);
        await insertOperation(tx, {
          ...this.common(owner, entry.id, sequence),
          kind: 'bookmarkState',
          bookmark,
          baseRevision: bookmark.serverRevision,
        });
        return bookmark;
      },
      checkMutation,
    );
  }
  async mergeRemoteBookmark(owner: OwnerContext, value: Bookmark): Promise<void> {
    const bookmark = input(BookmarkSchema, value);
    if (bookmark.uid !== owner.uid) throw new StudyError('invalid-content');
    await this.access(owner, async (tx) => {
      const previous = await readBookmark(tx, owner, bookmark.questionId);
      const operations = await readOperations(tx, owner);
      if (
        operations.some((op) => op.kind === 'bookmarkState' && op.recordId === bookmark.questionId)
      )
        return;
      if (previous && previous.bookmark.serverRevision >= bookmark.serverRevision) return;
      await writeBookmark(tx, owner, bookmark, previous?.sequence ?? 0);
    });
  }
  pending(owner: OwnerContext, now: number): Promise<readonly StudyOperation[]> {
    input(SafeIntegerSchema, now);
    return this.access(owner, async (tx) => {
      const blocked = new Set<string>();
      return (await readOperations(tx, owner)).filter((operation) => {
        const key = `${operation.kind === 'bookmarkState' ? 'bookmark' : 'session'}:${operation.recordId}`;
        if (operation.nextAttemptAt > now) blocked.add(key);
        return !blocked.has(key);
      });
    });
  }
  private async advanceBookmark(
    tx: SqlDatabase,
    owner: OwnerContext,
    operation: StudyOperation,
    revision: number,
  ) {
    if (operation.kind !== 'bookmarkState') throw new StudyError('invalid-content');
    const local = await readBookmark(tx, owner, operation.recordId);
    if (!local) throw new StudyError('storage-corrupt');
    const next = Math.max(revision, local.bookmark.serverRevision);
    await writeBookmark(tx, owner, { ...local.bookmark, serverRevision: next }, local.sequence);
    for (const queued of await readOperations(tx, owner)) {
      if (queued.kind === 'bookmarkState' && queued.recordId === operation.recordId)
        await updateOperation(tx, {
          ...queued,
          baseRevision: next,
          bookmark: { ...queued.bookmark, serverRevision: next },
        });
    }
  }
  async acknowledge(
    owner: OwnerContext,
    operationId: string,
    remoteRevision?: number,
  ): Promise<void> {
    input(GeneratedIdSchema, operationId);
    if (remoteRevision !== undefined) input(SafeIntegerSchema, remoteRevision);
    await this.access(owner, async (tx) => {
      const operation = (await readOperations(tx, owner)).find((op) => op.id === operationId);
      if (!operation) return;
      if (operation.kind === 'bookmarkState') {
        if (remoteRevision === undefined) throw new StudyError('invalid-content');
        await this.advanceBookmark(tx, owner, operation, remoteRevision);
      }
      await tx.run(
        'DELETE FROM study_outbox WHERE uid = ? AND device_id = ? AND operation_id = ?',
        [...ownerKeys(owner), operationId],
      );
    });
  }
  async rebaseBookmark(
    owner: OwnerContext,
    operationId: string,
    remoteRevision: number,
  ): Promise<void> {
    input(GeneratedIdSchema, operationId);
    input(SafeIntegerSchema, remoteRevision);
    await this.access(owner, async (tx) => {
      const operation = (await readOperations(tx, owner)).find((op) => op.id === operationId);
      if (operation) await this.advanceBookmark(tx, owner, operation, remoteRevision);
    });
  }
  async retry(owner: OwnerContext, operationId: string, nextAttemptAt: number): Promise<void> {
    input(GeneratedIdSchema, operationId);
    input(SafeIntegerSchema, nextAttemptAt);
    await this.access(owner, async (tx) => {
      const operation = (await readOperations(tx, owner)).find((op) => op.id === operationId);
      if (operation)
        await updateOperation(tx, {
          ...operation,
          attempts: integer(operation.attempts + 1),
          nextAttemptAt,
        });
    });
  }
}
