import type { ContentRepository } from '../../content/domain/ContentRepository';
import { CatalogEntrySchema, SafeIdSchema, type CatalogEntry } from '../../content/domain/catalog';
import { validateRevision } from '../../content/domain/revisionValidation';
import type { Question } from '../../content/domain/question';
import type { StudyRepository } from '../../study/domain/StudyRepository';
import {
  OwnerContextSchema,
  StudyError,
  type Bookmark,
  type OwnerContext,
  type OwnerGuard,
} from '../../study/domain/study';

/** Pinned local desired state is authoritative until explicitly removed/restored. */
export class BookmarkService {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly study: StudyRepository,
    private readonly content: ContentRepository,
    private readonly guard: OwnerGuard,
    private readonly mutationAllowed: () => boolean = () => true,
  ) {}
  private check(owner: OwnerContext) {
    if (!OwnerContextSchema.safeParse(owner).success || !this.guard.isCurrent(owner))
      throw new StudyError('auth-required');
  }
  async list(owner: OwnerContext): Promise<readonly Bookmark[]> {
    this.check(owner);
    const rows = await this.study.listBookmarks(owner);
    this.check(owner);
    return rows.filter((row) => !row.deleted);
  }
  async pending(owner: OwnerContext): Promise<readonly string[]> {
    this.check(owner);
    // Include backoff-delayed operations: eligibility to retry is not sync completion.
    const operations = await this.study.pending(owner, Number.MAX_SAFE_INTEGER);
    this.check(owner);
    return [
      ...new Set(operations.filter((op) => op.kind === 'bookmarkState').map((op) => op.recordId)),
    ];
  }
  toggle(owner: OwnerContext, entry: CatalogEntry): Promise<Bookmark> {
    const next = this.queue.then(async () => {
      this.check(owner);
      if (!this.mutationAllowed()) throw new StudyError('permission-denied');
      const parsed = CatalogEntrySchema.safeParse(entry);
      if (!parsed.success) throw new StudyError('invalid-content');
      // Unfiltered rows retain the original pin across tombstone restoration.
      const rows = await this.study.listBookmarks(owner);
      this.check(owner);
      if (!this.mutationAllowed()) throw new StudyError('permission-denied');
      const previous = rows.find((row) => row.questionId === parsed.data.id);
      const bookmark = await this.study.setBookmark(
        owner,
        previous?.entry ?? parsed.data,
        previous ? !previous.deleted : false,
        () => {
          if (!this.mutationAllowed()) throw new StudyError('permission-denied');
        },
      );
      this.check(owner);
      return bookmark;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
  async open(owner: OwnerContext, questionId: string): Promise<Question> {
    this.check(owner);
    if (!SafeIdSchema.safeParse(questionId).success) throw new StudyError('invalid-content');
    const bookmark = (await this.list(owner)).find((row) => row.questionId === questionId);
    this.check(owner);
    if (!bookmark) throw new StudyError('invalid-content');
    const question = await this.content.question(owner, bookmark.entry);
    this.check(owner);
    return validateRevision(question, bookmark.entry);
  }
}
