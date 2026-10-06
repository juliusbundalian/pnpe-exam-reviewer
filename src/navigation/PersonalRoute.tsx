import { useRouter } from 'expo-router';
import { useAppDependencies, useAuthentication, useConfig } from '../bootstrap/AppProviders';
import { ProtectedRoute } from './ProtectedRoute';
import { FeatureAvailabilityScreen } from '../core/components/FeatureAvailabilityScreen';
import { ProfileScreen } from '../features/auth/presentation/ProfileScreen';
import { useSafeBack } from './useSafeBack';
export function PersonalRoute({
  destination,
}: {
  destination: 'profile' | 'progress' | 'bookmarks' | 'exam-history';
}) {
  const router = useRouter();
  const onBack = useSafeBack();
  const { profiles } = useAppDependencies();
  const { auth } = useAuthentication();
  const { features } = useConfig('config');
  const action = {
    type: (
      {
        profile: 'openProfile',
        progress: 'openProgress',
        bookmarks: 'openBookmarks',
        'exam-history': 'openHistory',
      } as const
    )[destination],
  };
  const enabled =
    destination === 'profile' ||
    features[destination === 'exam-history' ? 'examHistory' : destination];
  return (
    <ProtectedRoute action={action}>
      {destination === 'profile' && auth.status === 'authenticated' ? (
        <ProfileScreen key={auth.user.uid} user={auth.user} profiles={profiles} onBack={onBack} />
      ) : (
        <FeatureAvailabilityScreen
          title={
            enabled
              ? `${destination === 'exam-history' ? 'Exam History' : destination} — development availability`
              : 'This feature is currently disabled'
          }
          onBack={() => router.replace('/')}
        />
      )}
    </ProtectedRoute>
  );
}
