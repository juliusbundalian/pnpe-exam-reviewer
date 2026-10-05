import { useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppNavigation, useConfig } from '../bootstrap/AppProviders';
import { AppScreen } from '../core/components/AppScreen';
import { AppText } from '../core/components/AppText';
import { AppButton } from '../core/components/AppButton';
import type { View } from 'react-native';
import { ProtectedRoute } from './ProtectedRoute';
import { startBlock } from './startAvailability';
import { taxonomy } from '../features/content/domain/taxonomy';
export default function MockExamRoute() {
  const { stage } = useLocalSearchParams<{ stage?: string }>();
  const { mockExam } = useConfig('config');
  const blocked = startBlock(useConfig('app_info'));
  const navigation = useAppNavigation();
  const router = useRouter();
  const target = useRef<View | null>(null);
  const content = (
    <AppScreen>
      <AppText variant="title">
        {stage === 'preflight' ? 'Mock Exam preflight' : 'Mock Exam'}
      </AppText>
      <AppText>{mockExam.questionCount} questions</AppText>
      <AppText>{mockExam.durationMinutes} minutes</AppText>
      {taxonomy.map((category) => (
        <AppText key={category.id}>
          {category.label}: {mockExam.distribution[category.id]}
        </AppText>
      ))}
      <AppText>
        {mockExam.passingPercentage}% application practice threshold. These practice settings are
        not a verified official examination claim.
      </AppText>
      {blocked ? <AppText accessibilityRole="alert">{blocked}</AppText> : null}
      {stage === 'preflight' ? (
        <>
          <AppText>
            Mock Exam sessions are not available in this development build. No timer or session has
            started.
          </AppText>
          <AppButton variant="text" label="Back" onPress={() => router.replace('/mock-exam')} />
        </>
      ) : (
        <AppButton
          ref={target}
          variant="primary"
          label="Start Mock Exam"
          disabled={!!blocked}
          onPress={() => navigation.require({ type: 'startMockExam' }, target.current)}
        />
      )}
    </AppScreen>
  );
  return stage === 'preflight' ? (
    <ProtectedRoute action={{ type: 'startMockExam' }}>{content}</ProtectedRoute>
  ) : (
    content
  );
}
