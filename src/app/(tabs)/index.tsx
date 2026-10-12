import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { HomeScreen } from '../../features/home/presentation/HomeScreen';
import {
  useAppDependencies,
  useAppNavigation,
  useAuthentication,
  useConfig,
} from '../../bootstrap/AppProviders';
import { startBlock } from '../../navigation/startAvailability';
export default function HomeRoute() {
  const router = useRouter();
  const navigation = useAppNavigation();
  const { analytics } = useAppDependencies();
  const { auth } = useAuthentication();
  const model = useConfig('config');
  const notice = startBlock(useConfig('app_info'));
  useEffect(() => analytics.track({ name: 'public_home_opened' }), [analytics]);
  return (
    <HomeScreen
      displayName={
        auth.status === 'authenticated' ? (auth.user.displayName ?? undefined) : undefined
      }
      notice={notice}
      model={{ mockExam: model.mockExam }}
      onExplore={() => router.push('/review')}
      onMockExam={() => router.push('/mock-exam')}
      onStartMockExam={(target) => navigation.require({ type: 'startMockExam' }, target)}
      onProgress={(target) => navigation.require({ type: 'openProgress' }, target)}
      onBookmarks={(target) => navigation.require({ type: 'openBookmarks' }, target)}
    />
  );
}
