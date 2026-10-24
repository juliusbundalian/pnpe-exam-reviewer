import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAppDependencies, useAuthentication, useConfig } from '../bootstrap/AppProviders';
import type { StudyDependencies } from '../bootstrap/studyComposition';
import { ProtectedRoute } from './ProtectedRoute';
import { StudyRoute } from './StudyRoute';
import { FeatureAvailabilityScreen } from '../core/components/FeatureAvailabilityScreen';
import { AppScreen } from '../core/components/AppScreen';
import { AppButton } from '../core/components/AppButton';
import { ErrorView, LoadingView } from '../core/components/StateViews';
import { ProfileScreen } from '../features/auth/presentation/ProfileScreen';
import { ProgressScreen } from '../features/reviewer/presentation/ProgressScreen';
import { ExamHistoryScreen } from '../features/exam/presentation/ExamHistoryScreen';
import { mergeExamHistory } from '../features/exam/application/examProgress';
import type { ExamAttempt, ExamResultSummary } from '../features/exam/domain/exam';
import { BookmarksScreen } from '../features/bookmarks/presentation/BookmarksScreen';
import { SafeIdSchema } from '../features/content/domain/catalog';
import { StudyError, type ReviewerSession } from '../features/study/domain/study';
import { useSafeBack } from './useSafeBack';
export function PersonalRoute({
  destination,
}: {
  destination: 'profile' | 'progress' | 'bookmarks' | 'exam-history';
}) {
  const router = useRouter();
  const onBack = useSafeBack();
  const { questionId } = useLocalSearchParams<{ questionId?: string }>();
  const { profiles } = useAppDependencies();
  const { auth } = useAuthentication();
  const { features } = useConfig('config');
  if (questionId !== undefined && !SafeIdSchema.safeParse(questionId).success)
    return <FeatureAvailabilityScreen title="Not Found" onBack={onBack} />;
  const action =
    destination === 'bookmarks' && questionId
      ? { type: 'openBookmark' as const, questionId }
      : {
          type: (
            {
              profile: 'openProfile',
              progress: 'openProgress',
              bookmarks: 'openBookmarks',
              'exam-history': 'openHistory',
            } as const
          )[destination],
        };
  return (
    <ProtectedRoute action={action}>
      {destination === 'profile' && auth.status === 'authenticated' ? (
        <ProfileScreen key={auth.user.uid} user={auth.user} profiles={profiles} onBack={onBack} />
      ) : destination === 'bookmarks' ? (
        <StudyRoute onBack={onBack}>
          {(study) => (
            <BookmarksScreen
              service={study.bookmarks}
              owner={study.owner}
              onBack={onBack}
              mutationsEnabled={features.bookmarks}
              {...(questionId ? { initialQuestionId: questionId } : {})}
            />
          )}
        </StudyRoute>
      ) : destination === 'progress' ? (
        <StudyRoute onBack={onBack}>
          {(study) => (
            <SavedProgress
              study={study}
              onBack={onBack}
              onResume={(session) => {
                const path = session.scope.subcategoryId
                  ? `/review/${session.scope.categoryId}/${session.scope.subcategoryId}`
                  : `/review/${session.scope.categoryId}`;
                router.push(`${path}?stage=session&sessionId=${session.id}`);
              }}
            />
          )}
        </StudyRoute>
      ) : destination === 'exam-history' ? (
        <StudyRoute onBack={onBack}>
          {(study) => (
            <SavedExamHistory
              study={study}
              onBack={onBack}
              onOpen={(id) => router.push(`/mock-exam?stage=result&attemptId=${id}`)}
              onResume={(id) => router.push(`/mock-exam?stage=run&attemptId=${id}`)}
            />
          )}
        </StudyRoute>
      ) : (
        <FeatureAvailabilityScreen
          title={
            features.examHistory
              ? 'Exam History — development availability'
              : 'This feature is currently disabled'
          }
          onBack={onBack}
        />
      )}
    </ProtectedRoute>
  );
}

function SavedExamHistory({
  study,
  onBack,
  onOpen,
  onResume,
}: {
  study: StudyDependencies;
  onBack(): void;
  onOpen(id: string): void;
  onResume(id: string): void;
}) {
  const [state, setState] = useState<
    | { results: readonly ExamResultSummary[]; active: ExamAttempt | null; offline: boolean }
    | StudyError
    | null
  >(null);
  const [retryKey, retry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      setState(null);
      void (async () => {
        try {
          const [local, active] = await Promise.all([
            study.examRepository.history(study.owner),
            study.examRepository.active(study.owner),
          ]);
          const ownedLocal = local.filter((result) => result.uid === study.owner.uid);
          if (live && study.guard.isCurrent(study.owner))
            setState({ results: mergeExamHistory(ownedLocal, []), active, offline: false });
          try {
            const remote = await study.examRemote.history(study.owner);
            if (live && study.guard.isCurrent(study.owner))
              setState({
                results: mergeExamHistory(
                  ownedLocal,
                  remote.filter((result) => result.uid === study.owner.uid),
                ),
                active,
                offline: false,
              });
          } catch {
            if (live && study.guard.isCurrent(study.owner))
              setState({ results: mergeExamHistory(ownedLocal, []), active, offline: true });
          }
        } catch (failure) {
          if (live && study.guard.isCurrent(study.owner))
            setState(
              failure instanceof StudyError ? failure : new StudyError('storage-unavailable'),
            );
        }
      })();
      return () => {
        live = false;
      };
    }, [study, retryKey]),
  );
  if (!state || state instanceof StudyError)
    return (
      <AppScreen>
        <AppButton variant="text" label="Back" onPress={onBack} />
        {state ? (
          <ErrorView message={state.message} onRetry={() => retry((n) => n + 1)} />
        ) : (
          <LoadingView message="Loading exam history" />
        )}
      </AppScreen>
    );
  return (
    <ExamHistoryScreen
      {...state}
      onOpen={onOpen}
      onResume={onResume}
      onRetry={() => retry((n) => n + 1)}
      onBack={onBack}
    />
  );
}
function SavedProgress({
  study,
  onBack,
  onResume,
}: {
  study: StudyDependencies;
  onBack(): void;
  onResume(session: ReviewerSession): void;
}) {
  const [state, setState] = useState<
    { session: ReviewerSession | null; exams: readonly ExamResultSummary[] } | StudyError | null
  >(null);
  const [attempt, retry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState(null);
      void Promise.all([
        study.repository.active(study.owner),
        study.examRepository.history(study.owner),
      ]).then(
        async ([session, local]) => {
          const ownedLocal = local.filter((result) => result.uid === study.owner.uid);
          if (active && study.guard.isCurrent(study.owner))
            setState({ session, exams: mergeExamHistory(ownedLocal, []) });
          const remote = await study.examRemote.history(study.owner).catch(() => []);
          if (active && study.guard.isCurrent(study.owner))
            setState({
              session,
              exams: mergeExamHistory(
                ownedLocal,
                remote.filter((result) => result.uid === study.owner.uid),
              ),
            });
        },
        (error) => {
          if (active && study.guard.isCurrent(study.owner))
            setState(error instanceof StudyError ? error : new StudyError('storage-unavailable'));
        },
      );
      return () => {
        active = false;
      };
    }, [study, attempt]),
  );
  if (!state || state instanceof StudyError)
    return (
      <AppScreen>
        <AppButton label="Back" variant="text" onPress={onBack} />
        {state ? (
          <ErrorView message={state.message} onRetry={() => retry((n) => n + 1)} />
        ) : (
          <LoadingView message="Loading saved progress" />
        )}
      </AppScreen>
    );
  return (
    <ProgressScreen
      session={state.session}
      examResults={state.exams}
      onBack={onBack}
      onResume={onResume}
    />
  );
}
