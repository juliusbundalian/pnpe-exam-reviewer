import { useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { View } from 'react-native';
import { useAppNavigation, useConfig } from '../bootstrap/AppProviders';
import { AppScreen } from '../core/components/AppScreen';
import { AppText } from '../core/components/AppText';
import { AppButton } from '../core/components/AppButton';
import { taxonomy } from '../features/content/domain/taxonomy';
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
    <AppScreen>
      <AppText variant="title">Mock Exam</AppText>
      <AppText>{mockExam.questionCount} questions</AppText>
      <AppText>{mockExam.durationMinutes} minutes</AppText>
      {taxonomy.map((category) => (
        <AppText key={category.id}>
          {category.id === 'communicationSkills'
            ? 'Verbal Reasoning'
            : category.id === 'criticalThinking'
              ? 'Logical Reasoning'
              : category.label}
          : {mockExam.distribution[category.id]}
        </AppText>
      ))}
      <AppText>
        {mockExam.passingPercentage}% application practice threshold. These practice settings are
        not a verified official examination claim.
      </AppText>
      {blocked ? <AppText accessibilityRole="alert">{blocked}</AppText> : null}
      <AppButton
        ref={target}
        variant="primary"
        label="Start Mock Exam"
        onPress={() => navigation.require({ type: 'startMockExam' }, target.current)}
      />
    </AppScreen>
  );
}
