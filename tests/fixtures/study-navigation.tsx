import type { AuthOwnerSource, StudyDependencies } from '../../src/bootstrap/studyComposition';
import { nodeSqlDatabase } from './nodeSqlDatabase';
import { migrateStudyDatabase } from '../../src/core/storage/sqlite/studyMigrations';
import { SqliteStudyRepository } from '../../src/features/study/data/SqliteStudyRepository';
import { ReviewerService } from '../../src/features/reviewer/application/ReviewerService';
import { ReviewerController } from '../../src/features/reviewer/application/ReviewerController';
import { BookmarkService } from '../../src/features/bookmarks/application/BookmarkService';
import { StudySyncWorker } from '../../src/features/study/application/StudySyncWorker';
import { SqliteExamRepository } from '../../src/features/exam/data/SqliteExamRepository';
import { ExamService } from '../../src/features/exam/application/ExamService';
import { ExamSyncWorker } from '../../src/features/exam/application/ExamSyncWorker';
import { generation, studyEntry, studyQuestion } from './study';
import { StudyError, type OwnerContext } from '../../src/features/study/domain/study';
export function studyNavigationFactory() {
  let current: StudyDependencies | null = null;
  let conflict = false;
  let questionDelay: Promise<void> | null = null;
  let id = 0;
  const factory = async (source: AuthOwnerSource): Promise<StudyDependencies> => {
    const observed = source.current();
    if (!observed) throw new StudyError('auth-required');
    const owner = { ...observed, deviceId: 'device' };
    let disposed = false;
    const guard = {
      isCurrent: (candidate: OwnerContext) =>
        !disposed &&
        source.current()?.uid === candidate.uid &&
        source.current()?.epoch === candidate.epoch &&
        candidate.deviceId === 'device',
    };
    const db = nodeSqlDatabase(':memory:');
    await migrateStudyDatabase(db);
    const clock = { now: () => 1000 };
    const identity = { nextId: () => `session-${++id}` };
    const repository = new SqliteStudyRepository(db, clock, identity, guard);
    const catalog = {
      generation,
      revision: 1,
      validatedAt: 500,
      entries: [studyEntry(), studyEntry({ id: 'second' })],
    };
    const content = {
      catalog: async () => {
        if (conflict) throw new StudyError('conflict');
        return catalog;
      },
      cachedCatalog: async () => catalog,
      question: async (_: OwnerContext, entry: ReturnType<typeof studyEntry>) => {
        await questionDelay;
        return studyQuestion({ id: entry.id });
      },
    };
    const reviewer = new ReviewerService(
      repository,
      content,
      clock,
      { next: () => 0.5 },
      identity,
      guard,
    );
    const controller = new ReviewerController(reviewer, content, repository, guard);
    const bookmarks = new BookmarkService(repository, content, guard, () =>
      source.bookmarksEnabled(),
    );
    const sync = new StudySyncWorker(
      repository,
      {
        publishSession: async () => {},
        writeSessionState: async () => {},
        writeBookmark: async (_o, _b, operationId, baseRevision) => ({
          revision: baseRevision + 1,
          appliedOperationId: operationId,
        }),
        listBookmarks: async () => [],
      },
      clock,
      guard,
    );
    const examRepository = new SqliteExamRepository(db, guard);
    const examSync = new ExamSyncWorker(
      examRepository,
      {
        publish: async () => {},
        history: async () => [],
        result: async () => {
          throw new StudyError('invalid-content');
        },
      },
      guard,
    );
    const exam = new ExamService(
      examRepository,
      content,
      clock,
      { next: () => 0.5 },
      identity,
      guard,
      () => source.startAllowed(),
      { now: () => 0 },
    );
    current = {
      owner,
      guard,
      repository,
      content,
      reviewer,
      controller,
      bookmarks,
      sync,
      exam,
      examRepository,
      examSync,
      dispose() {
        disposed = true;
        sync.stop();
        examSync.stop();
        controller.dispose();
        void db.close();
      },
    };
    return current;
  };
  return {
    factory,
    get study() {
      if (!current) throw new Error('not initialized');
      return current;
    },
    conflict(value: boolean) {
      conflict = value;
    },
    delay(value: Promise<void> | null) {
      questionDelay = value;
    },
  };
}
