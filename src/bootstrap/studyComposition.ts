import { AppState } from 'react-native';
import type { NativeServices } from '../core/firebase/native';
import { systemClock } from '../core/clock/Clock';
import type { ContentRepository } from '../features/content/domain/ContentRepository';
import type { StudyRepository } from '../features/study/domain/StudyRepository';
import {
  StudyError,
  type OwnerContext,
  type OwnerGuard,
  type StudyErrorCode,
} from '../features/study/domain/study';
import type { ReviewerService } from '../features/reviewer/application/ReviewerService';
import type { ReviewerController } from '../features/reviewer/application/ReviewerController';
import type { BookmarkService } from '../features/bookmarks/application/BookmarkService';
import type { StudySyncWorker } from '../features/study/application/StudySyncWorker';
import type { ExamRepository } from '../features/exam/domain/ExamRepository';
import type { ExamService } from '../features/exam/application/ExamService';
import type { ExamSyncWorker } from '../features/exam/application/ExamSyncWorker';
import type { ExamRemote } from '../features/exam/domain/ExamRemote';

export interface AuthOwnerSource {
  current(): { uid: string; epoch: number } | null;
  bookmarksEnabled(): boolean;
  startAllowed(): boolean;
}
export interface StudyDependencies {
  owner: OwnerContext;
  guard: OwnerGuard;
  content: ContentRepository;
  repository: StudyRepository;
  reviewer: ReviewerService;
  controller: ReviewerController;
  bookmarks: BookmarkService;
  sync: StudySyncWorker;
  exam: ExamService;
  examRepository: ExamRepository;
  examSync: ExamSyncWorker;
  examRemote: ExamRemote;
  dispose(): void;
}
/** Called only after a protected study entry. Native storage failures stay retryable. */
export async function composeStudyDependencies(
  nativeServices: NativeServices,
  authOwnerSource: AuthOwnerSource,
): Promise<StudyDependencies> {
  const captured = authOwnerSource.current();
  if (!captured || !nativeServices.available) throw new StudyError('auth-required');
  const [
    { openNativeStudyDatabase },
    crypto,
    { nativeFingerprint },
    { SqliteStudyRepository },
    { SqliteContentCache },
    { CachedContentRepository },
    { createNativeContentRemote },
    { ReviewerService },
    { ReviewerController },
    { BookmarkService },
    { StudySyncWorker },
    { createNativeStudySyncRemote },
    { SqliteExamRepository },
    { ExamService },
    { ExamSyncWorker },
    { createNativeExamRemote },
  ] = await Promise.all([
    import('../core/storage/sqlite/nativeSqlDatabase'),
    import('expo-crypto'),
    import('../core/content/nativeFingerprint'),
    import('../features/study/data/SqliteStudyRepository'),
    import('../features/content/data/SqliteContentCache'),
    import('../features/content/data/CachedContentRepository'),
    import('../features/content/data/nativeContentFacade'),
    import('../features/reviewer/application/ReviewerService'),
    import('../features/reviewer/application/ReviewerController'),
    import('../features/bookmarks/application/BookmarkService'),
    import('../features/study/application/StudySyncWorker'),
    import('../features/study/data/nativeStudySyncFacade'),
    import('../features/exam/data/SqliteExamRepository'),
    import('../features/exam/application/ExamService'),
    import('../features/exam/application/ExamSyncWorker'),
    import('../features/exam/data/nativeExamFacade'),
  ]);
  const db = await openNativeStudyDatabase();
  let disposed = false;
  let deviceId = '';
  const guard: OwnerGuard = {
    isCurrent: (owner) => {
      const current = authOwnerSource.current();
      return (
        !disposed &&
        current?.uid === owner.uid &&
        current.epoch === owner.epoch &&
        owner.deviceId === deviceId
      );
    },
  };
  try {
    const ids = { nextId: () => crypto.randomUUID() };
    const durable = new SqliteStudyRepository(db, systemClock, ids, guard);
    deviceId = await durable.deviceIdentity();
    const owner = { ...captured, deviceId };
    if (!guard.isCurrent(owner)) throw new StudyError('auth-required');
    const content = new CachedContentRepository(
      await createNativeContentRemote(nativeServices.firestore),
      new SqliteContentCache(db, nativeFingerprint),
      systemClock,
      guard,
    );
    const sync = new StudySyncWorker(
      durable,
      await createNativeStudySyncRemote(nativeServices.firestore, nativeServices.auth, guard),
      systemClock,
      guard,
    );
    // Only durable user mutations trigger due work. Worker acknowledgments use the raw repository.
    const flushAfter = async <T>(operation: Promise<T>): Promise<T> => {
      const result = await operation;
      if (guard.isCurrent(owner)) void sync.flush();
      return result;
    };
    const repository: StudyRepository = {
      active: (o) => durable.active(o),
      session: (o, id) => durable.session(o, id),
      replaceActive: (o, session, check) => {
        if (!authOwnerSource.startAllowed())
          return Promise.reject(new StudyError('permission-denied'));
        return flushAfter(
          durable.replaceActive(o, session, () => {
            if (!authOwnerSource.startAllowed()) throw new StudyError('permission-denied');
            check?.();
          }),
        );
      },
      recordView: (o, id, ordinal) => flushAfter(durable.recordView(o, id, ordinal)),
      move: (o, id, ordinal) => flushAfter(durable.move(o, id, ordinal)),
      listBookmarks: (o) => durable.listBookmarks(o),
      setBookmark: (o, entry, deleted, check) =>
        flushAfter(durable.setBookmark(o, entry, deleted, check)),
      mergeRemoteBookmark: (o, bookmark) => durable.mergeRemoteBookmark(o, bookmark),
      pending: (o, now) => durable.pending(o, now),
      acknowledgedViews: (o, id) => durable.acknowledgedViews(o, id),
      acknowledge: (o, id, revision) => durable.acknowledge(o, id, revision),
      rebaseBookmark: (o, id, revision) => durable.rebaseBookmark(o, id, revision),
      retry: (o, id, deadline) => durable.retry(o, id, deadline),
    };
    const random = { next: () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296 };
    const reviewer = new ReviewerService(
      repository,
      content,
      systemClock,
      random,
      { nextId: () => `${deviceId}_${crypto.randomUUID()}` },
      guard,
    );
    const controller = new ReviewerController(reviewer, content, repository, guard);
    const examRepository: ExamRepository = new SqliteExamRepository(db, guard);
    const examRemote = await createNativeExamRemote(
      nativeServices.firestore,
      nativeServices.auth,
      guard,
    );
    const examSync = new ExamSyncWorker(examRepository, examRemote, guard);
    const examStorage: ExamRepository = {
      active: (o) => examRepository.active(o),
      create: (o, attempt, check) => examRepository.create(o, attempt, check),
      attempt: (o, id) => examRepository.attempt(o, id),
      change: (o, id, mutation, now) => examRepository.change(o, id, mutation, now),
      observeTime: (o, id, now) => examRepository.observeTime(o, id, now),
      finalize: async (o, id, now, reason) => {
        const result = await examRepository.finalize(o, id, now, reason);
        if (guard.isCurrent(o)) void examSync.flush(o).catch(() => undefined);
        return result;
      },
      result: (o, id) => examRepository.result(o, id),
      history: (o) => examRepository.history(o),
      pending: (o) => examRepository.pending(o),
      acknowledge: (o, id) => examRepository.acknowledge(o, id),
    };
    const exam = new ExamService(
      examStorage,
      content,
      systemClock,
      random,
      { nextId: () => `${deviceId}_${crypto.randomUUID()}` },
      guard,
      () => authOwnerSource.startAllowed(),
      { now: () => Math.max(0, Math.floor(performance.now())) },
    );
    const bookmarks = new BookmarkService(
      repository,
      content,
      guard,
      () => authOwnerSource.bookmarksEnabled(),
      async () => {
        if (!guard.isCurrent(owner)) throw new StudyError('auth-required');
        sync.wake();
        await sync.flush();
        if (!guard.isCurrent(owner)) throw new StudyError('auth-required');
        let recovery: StudyErrorCode | null = null;
        sync.subscribe((status) => {
          recovery = status.recovery;
        })();
        // Offline refresh still exposes durable local records; other failures need recovery.
        if (recovery && recovery !== 'network') throw new StudyError(recovery);
      },
    );
    if (!guard.isCurrent(owner)) throw new StudyError('auth-required');
    sync.start(owner);
    void examSync.flush(owner).catch(() => undefined);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active' && guard.isCurrent(owner)) {
        sync.wake();
        void examSync.flush(owner).catch(() => undefined);
      }
    });
    return {
      owner,
      guard,
      content,
      repository,
      reviewer,
      controller,
      bookmarks,
      sync,
      exam,
      examRepository,
      examSync,
      examRemote,
      dispose() {
        if (disposed) return;
        disposed = true;
        foreground.remove();
        sync.stop();
        examSync.stop();
        controller.dispose();
        void db.close().catch(() => undefined);
      },
    };
  } catch (error) {
    disposed = true;
    await db.close();
    throw error;
  }
}
