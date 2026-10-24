import { canonicalJson, jsonBytes } from '../../../core/content/Fingerprint';
import { contentReadError } from '../../content/data/FirebaseContentRemote';
import { SafeIdSchema, SafeIntegerSchema } from '../../content/domain/catalog';
import type { StudySyncRemote } from '../domain/StudySyncRemote';
import {
  BookmarkConflictError,
  BookmarkSchema,
  GeneratedIdSchema,
  OwnerContextSchema,
  ReviewerSessionSchema,
  StudyError,
  type Bookmark,
  type OwnerContext,
  type OwnerGuard,
  type ReviewerSession,
} from '../domain/study';
import {
  CloudBookmarkReceiptSchema,
  CloudBookmarkSchema,
  CloudManifestChunkSchema,
  CloudSessionRootSchema,
  CloudViewedItemSchema,
  MAX_MANIFEST_CHUNK_ITEMS,
  MAX_STUDY_DOCUMENT_BYTES,
  type CloudManifestChunk,
  type CloudSessionRoot,
} from './cloudStudySchemas';

export interface StudyCloudTransaction {
  get(path: string): Promise<unknown>;
  set(path: string, data: object): void;
}
export interface StudySyncSdk {
  /** check executes on each native retry and immediately before transaction writes. */
  transaction<T>(check: () => void, action: (tx: StudyCloudTransaction) => Promise<T>): Promise<T>;
  readPage(
    check: () => void,
    path: string,
    afterId: string | null,
    limit: number,
  ): Promise<readonly { id: string; data: unknown }[]>;
}
function parse<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch {
    throw new StudyError('invalid-content');
  }
}
function same(a: object, b: object) {
  const withoutTime = (value: object) =>
    Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'writtenAt'));
  return canonicalJson(withoutTime(a)) === canonicalJson(withoutTime(b));
}
function immutableRoot(root: CloudSessionRoot) {
  return {
    uid: root.uid,
    deviceId: root.deviceId,
    sessionId: root.sessionId,
    scope: root.scope,
    generation: root.generation,
    catalogValidatedAt: root.catalogValidatedAt,
    createdAt: root.createdAt,
    shuffleQuestions: root.shuffleQuestions,
    manifestChunkCount: root.manifestChunkCount,
    itemCount: root.itemCount,
    publicationOperationId: root.publicationOperationId,
  };
}
function localBookmark(value: Bookmark): Bookmark {
  return parse(BookmarkSchema, {
    uid: value.uid,
    questionId: value.questionId,
    entry: value.entry,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    deleted: value.deleted,
    serverRevision: value.serverRevision,
  });
}

export class FirebaseStudySyncRemote implements StudySyncRemote {
  constructor(
    private readonly sdk: StudySyncSdk,
    private readonly guard: OwnerGuard,
  ) {}
  private check(owner: OwnerContext) {
    parse(OwnerContextSchema, owner);
    if (!this.guard.isCurrent(owner)) throw new StudyError('auth-required');
  }
  private async access<T>(owner: OwnerContext, work: () => Promise<T>): Promise<T> {
    this.check(owner);
    try {
      const result = await work();
      this.check(owner);
      return result;
    } catch (error) {
      throw contentReadError(error);
    }
  }
  private transaction<T>(owner: OwnerContext, work: (tx: StudyCloudTransaction) => Promise<T>) {
    this.check(owner);
    return this.sdk.transaction(
      () => this.check(owner),
      async (tx) => {
        this.check(owner);
        const result = await work(tx);
        this.check(owner);
        return result;
      },
    );
  }
  private session(owner: OwnerContext, value: ReviewerSession) {
    const session = parse(ReviewerSessionSchema, value);
    if (session.uid !== owner.uid || session.deviceId !== owner.deviceId)
      throw new StudyError('invalid-content');
    return session;
  }
  private chunks(session: ReviewerSession): readonly CloudManifestChunk[] {
    const chunks: CloudManifestChunk[] = [];
    let items: ReviewerSession['items'] = [];
    const dto = () => ({
      uid: session.uid,
      deviceId: session.deviceId,
      sessionId: session.id,
      index: chunks.length,
      items,
      writtenAt: 0,
    });
    for (const item of session.items) {
      const candidate = { ...dto(), items: [...items, item], writtenAt: Number.MAX_SAFE_INTEGER };
      if (
        items.length &&
        (items.length === MAX_MANIFEST_CHUNK_ITEMS ||
          jsonBytes(candidate) > MAX_STUDY_DOCUMENT_BYTES)
      ) {
        chunks.push(parse(CloudManifestChunkSchema, dto()));
        items = [];
      }
      items = [...items, item];
      if (jsonBytes({ ...dto(), writtenAt: Number.MAX_SAFE_INTEGER }) > MAX_STUDY_DOCUMENT_BYTES)
        throw new StudyError('invalid-content');
    }
    if (items.length) chunks.push(parse(CloudManifestChunkSchema, dto()));
    return chunks;
  }
  publishSession(owner: OwnerContext, value: ReviewerSession, operationId: string): Promise<void> {
    return this.access(owner, async () => {
      const session = this.session(owner, value);
      parse(GeneratedIdSchema, operationId);
      if (
        session.sequence !== 0 ||
        session.position !== 0 ||
        session.viewedOrdinals.length !== 0 ||
        session.status !== 'active'
      )
        throw new StudyError('invalid-content');
      const chunks = this.chunks(session);
      const path = `users/${owner.uid}/reviewerSessions/${session.id}`;
      const root = parse(CloudSessionRootSchema, {
        uid: owner.uid,
        deviceId: owner.deviceId,
        sessionId: session.id,
        scope: session.scope,
        generation: session.generation,
        catalogValidatedAt: session.catalogValidatedAt,
        createdAt: session.createdAt,
        shuffleQuestions: session.shuffleQuestions,
        manifestChunkCount: chunks.length,
        itemCount: session.items.length,
        publicationOperationId: operationId,
        lastOperationId: operationId,
        phase: 'preparing',
        ready: false,
        sequence: session.sequence,
        position: session.position,
        viewedCount: session.viewedOrdinals.length,
        status: session.status,
        writtenAt: 0,
      });
      const alreadyReady = await this.transaction(owner, async (tx) => {
        const raw = await tx.get(path);
        if (raw !== undefined && raw !== null) {
          const existing = parse(CloudSessionRootSchema, raw);
          if (canonicalJson(immutableRoot(existing)) !== canonicalJson(immutableRoot(root)))
            throw new StudyError('invalid-content');
          return existing.ready;
        }
        tx.set(path, root);
        return false;
      });
      if (alreadyReady) return;
      for (const chunk of chunks)
        await this.transaction(owner, async (tx) => {
          const chunkPath = `${path}/manifest/${chunk.index}`;
          const existing = await tx.get(chunkPath);
          if (existing !== undefined && existing !== null) {
            if (!same(parse(CloudManifestChunkSchema, existing), chunk))
              throw new StudyError('invalid-content');
          } else tx.set(chunkPath, chunk);
        });
      await this.transaction(owner, async (tx) => {
        const existing = parse(CloudSessionRootSchema, await tx.get(path));
        if (canonicalJson(immutableRoot(existing)) !== canonicalJson(immutableRoot(root)))
          throw new StudyError('invalid-content');
        if (!existing.ready)
          tx.set(
            path,
            parse(CloudSessionRootSchema, {
              ...existing,
              phase: 'ready',
              ready: true,
              writtenAt: 0,
            }),
          );
      });
    });
  }
  writeSessionState(
    owner: OwnerContext,
    value: ReviewerSession,
    operationId: string,
    pendingViewedOrdinals?: readonly number[],
  ): Promise<void> {
    return this.access(owner, async () => {
      const session = this.session(owner, value);
      parse(GeneratedIdSchema, operationId);
      const path = `users/${owner.uid}/reviewerSessions/${session.id}`;
      const chunks = this.chunks(session);
      const checkRoot = (root: CloudSessionRoot) => {
        const frozen = {
          uid: session.uid,
          deviceId: session.deviceId,
          sessionId: session.id,
          scope: session.scope,
          generation: session.generation,
          catalogValidatedAt: session.catalogValidatedAt,
          createdAt: session.createdAt,
          shuffleQuestions: session.shuffleQuestions,
          itemCount: session.items.length,
          manifestChunkCount: chunks.length,
          publicationOperationId: root.publicationOperationId,
        };
        if (!root.ready || canonicalJson(immutableRoot(root)) !== canonicalJson(frozen))
          throw new StudyError('invalid-content');
      };
      const pending = pendingViewedOrdinals ?? session.viewedOrdinals;
      if (
        !Array.isArray(pending) ||
        new Set(pending).size !== pending.length ||
        pending.some(
          (ordinal) => !Number.isSafeInteger(ordinal) || !session.viewedOrdinals.includes(ordinal),
        )
      )
        throw new StudyError('invalid-content');
      const updateRoot = (tx: StudyCloudTransaction, existing: CloudSessionRoot) => {
        if (session.viewedOrdinals.length < existing.viewedCount)
          throw new StudyError('invalid-content');
        tx.set(
          path,
          parse(CloudSessionRootSchema, {
            ...existing,
            sequence: session.sequence,
            position: session.position,
            status: session.status,
            viewedCount: session.viewedOrdinals.length,
            lastOperationId: operationId,
            writtenAt: 0,
          }),
        );
      };
      // Reject stale/equal replays before visiting membership. Position-only work
      // finishes here; new membership must commit before advancing the root.
      const finished = await this.transaction(owner, async (tx) => {
        const root = parse(CloudSessionRootSchema, await tx.get(path));
        checkRoot(root);
        if (session.sequence <= root.sequence) return true;
        if (!pending.length) {
          updateRoot(tx, root);
          return true;
        }
        return false;
      });
      if (finished) return;
      // Deltas come only from durable completed-operation acknowledgements.
      // A partial failure leaves them unacknowledged and safe to replay.
      for (const ordinal of pending)
        await this.transaction(owner, async (tx) => {
          const raw = await tx.get(path);
          const root = parse(CloudSessionRootSchema, raw);
          checkRoot(root);
          if (session.sequence <= root.sequence) return;
          const chunk = chunks.find((candidate) =>
            candidate.items.some((item) => item.ordinal === ordinal),
          );
          if (!chunk) throw new StudyError('invalid-content');
          const manifest = parse(
            CloudManifestChunkSchema,
            await tx.get(`${path}/manifest/${chunk.index}`),
          );
          if (!same(manifest, chunk)) throw new StudyError('invalid-content');
          const itemPath = `${path}/items/${ordinal}`;
          const dto = parse(CloudViewedItemSchema, {
            uid: owner.uid,
            deviceId: owner.deviceId,
            sessionId: session.id,
            ...session.items[ordinal],
            viewed: true,
            writtenAt: 0,
          });
          const existing = await tx.get(itemPath);
          if (existing !== undefined && existing !== null) {
            if (!same(parse(CloudViewedItemSchema, existing), dto))
              throw new StudyError('invalid-content');
          } else tx.set(itemPath, dto);
        });
      await this.transaction(owner, async (tx) => {
        const existing = parse(CloudSessionRootSchema, await tx.get(path));
        checkRoot(existing);
        if (session.sequence <= existing.sequence) return;
        updateRoot(tx, existing);
      });
    });
  }
  writeBookmark(owner: OwnerContext, value: Bookmark, operationId: string, baseRevision: number) {
    return this.access(owner, async () => {
      const bookmark = parse(BookmarkSchema, value);
      parse(GeneratedIdSchema, operationId);
      parse(SafeIntegerSchema, baseRevision);
      if (bookmark.uid !== owner.uid) throw new StudyError('invalid-content');
      const path = `users/${owner.uid}/bookmarks/${bookmark.questionId}`;
      return this.transaction(owner, async (tx) => {
        const receiptPath = `${path}/operations/${operationId}`;
        const receiptRaw = await tx.get(receiptPath);
        if (receiptRaw !== undefined && receiptRaw !== null) {
          const receipt = parse(CloudBookmarkReceiptSchema, receiptRaw);
          if (
            receipt.uid !== owner.uid ||
            receipt.questionId !== bookmark.questionId ||
            receipt.operationId !== operationId
          )
            throw new StudyError('invalid-content');
          return { revision: receipt.revision, appliedOperationId: operationId };
        }
        const raw = await tx.get(path);
        const existing = raw === undefined || raw === null ? null : parse(CloudBookmarkSchema, raw);
        if (existing && (existing.uid !== owner.uid || existing.questionId !== bookmark.questionId))
          throw new StudyError('invalid-content');
        if ((existing?.serverRevision ?? 0) !== baseRevision) {
          if (!existing) throw new StudyError('invalid-content');
          throw new BookmarkConflictError(localBookmark(existing));
        }
        const revision = parse(SafeIntegerSchema, baseRevision + 1);
        const dto = parse(CloudBookmarkSchema, {
          ...bookmark,
          serverRevision: revision,
          lastOperationId: operationId,
          writtenAt: 0,
        });
        const receipt = parse(CloudBookmarkReceiptSchema, {
          uid: owner.uid,
          questionId: bookmark.questionId,
          operationId,
          revision,
          writtenAt: 0,
        });
        tx.set(path, dto);
        tx.set(receiptPath, receipt);
        return { revision, appliedOperationId: operationId };
      });
    });
  }
  listBookmarks(owner: OwnerContext): Promise<readonly Bookmark[]> {
    return this.access(owner, async () => {
      const result: Bookmark[] = [];
      let after: string | null = null;
      for (;;) {
        this.check(owner);
        const page = await this.sdk.readPage(
          () => this.check(owner),
          `users/${owner.uid}/bookmarks`,
          after,
          50,
        );
        this.check(owner);
        if (!Array.isArray(page) || page.length > 50) throw new StudyError('invalid-content');
        for (const document of page) {
          parse(SafeIdSchema, document.id);
          if (after !== null && document.id <= after) throw new StudyError('invalid-content');
          const bookmark = localBookmark(parse(CloudBookmarkSchema, document.data));
          if (bookmark.uid !== owner.uid || bookmark.questionId !== document.id)
            throw new StudyError('invalid-content');
          result.push(bookmark);
          after = document.id;
        }
        if (page.length < 50) return result;
      }
    });
  }
}
