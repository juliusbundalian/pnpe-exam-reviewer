import { useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppNavigation, useConfig } from '../bootstrap/AppProviders';
import type { View } from 'react-native';
import { ProtectedRoute } from './ProtectedRoute';
import { startBlock } from './startAvailability';
import { MockExamScreen } from '../features/mock-exam/presentation/MockExamScreen';

export default function MockExamRoute() {
  const { stage } = useLocalSearchParams<{ stage?: string }>();
  const { mockExam } = useConfig('config');
  const blocked = startBlock(useConfig('app_info'));
  const navigation = useAppNavigation();
  const router = useRouter();
  const target = useRef<View | null>(null);
  const content = (
    <MockExamScreen
      exam={mockExam}
      preflight={stage === 'preflight'}
      blocked={blocked}
      startTarget={target}
      onStart={() => navigation.require({ type: 'startMockExam' }, target.current)}
      onBack={() => router.replace('/mock-exam')}
    />
  );
  return stage === 'preflight' ? (
    <ProtectedRoute action={{ type: 'startMockExam' }}>{content}</ProtectedRoute>
  ) : (
    content
  );
}
