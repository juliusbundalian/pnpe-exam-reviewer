import { useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { View } from 'react-native';
import { useAppNavigation, useConfig } from '../bootstrap/AppProviders';
import { MockExamScreen } from '../features/mock-exam/presentation/MockExamScreen';
import { ProtectedRoute } from './ProtectedRoute';
import { StudyRoute } from './StudyRoute';
import { startBlock } from './startAvailability';
import { ExamFlow } from './ExamFlow';

export default function MockExamRoute() {
  const { stage, attemptId } = useLocalSearchParams<{ stage?: string; attemptId?: string }>();
  const { mockExam, features } = useConfig('config');
  const blocked = startBlock(useConfig('app_info'));
  const navigation = useAppNavigation();
  const router = useRouter();
  const target = useRef<View | null>(null);
  if (stage === 'preflight' || stage === 'run' || stage === 'result')
    return (
      <ProtectedRoute action={{ type: 'startMockExam' }}>
        <StudyRoute onBack={() => router.replace('/mock-exam')}>
          {(study) => (
            <ExamFlow
              key={`${stage}:${attemptId ?? ''}`}
              study={study}
              stage={stage}
              {...(attemptId ? { attemptId } : {})}
              blocked={blocked}
              config={mockExam}
              bookmarksEnabled={features.bookmarks}
              onBack={() => router.replace('/mock-exam')}
            />
          )}
        </StudyRoute>
      </ProtectedRoute>
    );
  return (
    <MockExamScreen
      exam={mockExam}
      preflight={false}
      blocked={blocked}
      startTarget={target}
      onStart={() => navigation.require({ type: 'startMockExam' }, target.current)}
      onBack={() => router.replace('/mock-exam')}
    />
  );
}
