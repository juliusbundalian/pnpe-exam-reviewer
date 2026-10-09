import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { BookmarksScreen } from '../features/bookmarks/presentation/BookmarksScreen';
import { SafeIdSchema } from '../features/content/domain/catalog';
import { StudyError, type ReviewerSession } from '../features/study/domain/study';
import { useSafeBack } from './useSafeBack';
import { actionDestination } from './destinations';
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
              onResume={(session) =>
                router.push(actionDestination({ type: 'resumeReviewer', sessionId: session.id }))
              }
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
function SavedProgress({
  study,
  onBack,
  onResume,
}: {
  study: StudyDependencies;
  onBack(): void;
  onResume(session: ReviewerSession): void;
}) {
  const [state, setState] = useState<{ session: ReviewerSession | null } | StudyError | null>(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setState(null);
    void study.repository.active(study.owner).then(
      (session) => {
        if (active && study.guard.isCurrent(study.owner)) setState({ session });
      },
      (error) => {
        if (active)
          setState(error instanceof StudyError ? error : new StudyError('storage-unavailable'));
      },
    );
    return () => {
      active = false;
    };
  }, [study, attempt]);
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
  return <ProgressScreen session={state.session} onBack={onBack} onResume={onResume} />;
}
