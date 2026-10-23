import { View } from 'react-native';
import { useRef } from 'react';
import { AppButton } from '../../../core/components/AppButton';
import { TabPage, PageHeading } from '../../../core/components/TabPage';
import { NavigationRow } from '../../../core/components/NavigationRow';
import { AppText } from '../../../core/components/AppText';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { spacing } from '../../../core/theme/tokens';
import { taxonomy } from '../../content/domain/taxonomy';
import {
  coverageSummaries,
  initialHomePresentationModel,
  type HomePresentationModel,
} from './HomePresentationModel';

export function HomeScreen({
  displayName,
  notice,
  onExplore,
  onMockExam,
  onStartMockExam = onMockExam,
  progressEnabled = true,
  onProgress,
  onBookmarks,
  model = initialHomePresentationModel,
}: {
  displayName?: string | undefined;
  notice?: string | null;
  onExplore: () => void;
  onMockExam: () => void;
  onStartMockExam?: (target: View | null) => void;
  progressEnabled?: boolean;
  onProgress: (target: View | null) => void;
  onBookmarks: (target: View | null) => void;
  model?: HomePresentationModel;
}) {
  const { colors } = useTheme();
  const progressTarget = useRef<View | null>(null);
  const bookmarksTarget = useRef<View | null>(null);
  const mockTarget = useRef<View | null>(null);
  return (
    <TabPage>
      <PageHeading
        title="Home"
        description={
          displayName?.trim() ? `Welcome, ${displayName.trim()}` : 'Your preparation starts here'
        }
      />
      {notice ? <AppText accessibilityRole="alert">{notice}</AppText> : null}
      <View
        style={{
          padding: spacing.xl,
          backgroundColor: colors.primaryContainer,
          borderRadius: 16,
          gap: spacing.lg,
        }}
      >
        <AppText
          variant="title"
          accessibilityRole="header"
          style={{ fontSize: 26, lineHeight: 34, letterSpacing: -0.4 }}
        >
          Build confidence. One question at a time.
        </AppText>
        <AppText tone="secondary">
          Prepare with structured reviewers and a realistic, timed Mock Exam.
        </AppText>
        <AppButton variant="primary" label="Explore reviewers" onPress={onExplore} />
      </View>
      <View>
        <AppText variant="heading" accessibilityRole="header" style={{ marginBottom: spacing.sm }}>
          Your study tools
        </AppText>
        <NavigationRow
          icon="document-text-outline"
          label="Mock Exam"
          description="Prepare for a complete timed practice exam"
          onPress={onMockExam}
        />
        {progressEnabled ? (
          <NavigationRow
            ref={progressTarget}
            icon="stats-chart-outline"
            label="Progress"
            description="Review your reading activity and exam scores"
            onPress={() => onProgress(progressTarget.current)}
          />
        ) : null}
        <NavigationRow
          ref={bookmarksTarget}
          icon="bookmark-outline"
          label="Saved Questions"
          description="Return to the questions you bookmarked"
          onPress={() => onBookmarks(bookmarksTarget.current)}
        />
      </View>
      <View>
        <AppText variant="heading" accessibilityRole="header" style={{ marginBottom: spacing.sm }}>
          Main coverage
        </AppText>
        {taxonomy.map((category) => (
          <NavigationRow
            key={category.id}
            icon={
              category.id === 'generalInformation'
                ? 'library-outline'
                : category.id === 'communicationSkills'
                  ? 'chatbubbles-outline'
                  : category.id === 'quantitativeReasoning'
                    ? 'calculator-outline'
                    : 'bulb-outline'
            }
            label={category.label}
            description={coverageSummaries[category.id]}
            onPress={onExplore}
          />
        ))}
      </View>
      <View style={{ gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <AppText variant="heading" accessibilityRole="header">
          Ready for a full Mock Exam?
        </AppText>
        <AppText
          variant="caption"
          tone="secondary"
        >{`${model.mockExam.questionCount} questions · ${model.mockExam.durationMinutes} minutes · All four areas`}</AppText>
        <AppButton
          ref={mockTarget}
          variant="secondary"
          label="Start Mock Exam"
          onPress={() => onStartMockExam(mockTarget.current)}
        />
      </View>
    </TabPage>
  );
}
