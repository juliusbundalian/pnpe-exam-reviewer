import type { CatalogEntry } from '../../content/domain/catalog';
import type { Bookmark, OwnerContext, ReviewerSession, StudyOperation } from './study';

/** Every access is owner-bound; epochs guard commits but are never database keys. */
export interface StudyRepository {
  /** Current non-archived session, including completed work that remains resumable. */
  active(owner: OwnerContext): Promise<ReviewerSession | null>;
  session(owner: OwnerContext, id: string): Promise<ReviewerSession | null>;
  /** Optional synchronous activation gate runs inside the transaction and before commit. */
  replaceActive(
    owner: OwnerContext,
    session: ReviewerSession,
    checkMutation?: () => void,
  ): Promise<void>;
  recordView(owner: OwnerContext, id: string, ordinal: number): Promise<ReviewerSession>;
  move(owner: OwnerContext, id: string, ordinal: number): Promise<ReviewerSession>;
  /** Includes tombstones; presentation filters deleted records. */
  listBookmarks(owner: OwnerContext): Promise<readonly Bookmark[]>;
  /** Optional synchronous authorization runs at transaction execution and immediately before commit. */
  setBookmark(
    owner: OwnerContext,
    entry: CatalogEntry,
    deleted: boolean,
    checkMutation?: () => void,
  ): Promise<Bookmark>;
  /** Never overwrite a pending local desired state. */
  mergeRemoteBookmark(owner: OwnerContext, bookmark: Bookmark): Promise<void>;
  pending(owner: OwnerContext, now: number): Promise<readonly StudyOperation[]>;
  acknowledge(owner: OwnerContext, operationId: string, remoteRevision?: number): Promise<void>;
  /** Preserve queued desired state while advancing its compare-and-set base. */
  rebaseBookmark(owner: OwnerContext, operationId: string, remoteRevision: number): Promise<void>;
  retry(owner: OwnerContext, operationId: string, nextAttemptAt: number): Promise<void>;
}
