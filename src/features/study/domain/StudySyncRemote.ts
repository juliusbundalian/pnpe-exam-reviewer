import type { Bookmark, OwnerContext, ReviewerSession } from './study';

export type BookmarkAcknowledgement = {
  readonly revision: number;
  readonly appliedOperationId: string;
};
export interface StudySyncRemote {
  publishSession(owner: OwnerContext, session: ReviewerSession, operationId: string): Promise<void>;
  writeSessionState(
    owner: OwnerContext,
    session: ReviewerSession,
    operationId: string,
  ): Promise<void>;
  /** Throws BookmarkConflictError with validated remote state for compare-and-set conflicts. */
  writeBookmark(
    owner: OwnerContext,
    bookmark: Bookmark,
    operationId: string,
    baseRevision: number,
  ): Promise<BookmarkAcknowledgement>;
  listBookmarks(owner: OwnerContext): Promise<readonly Bookmark[]>;
}
