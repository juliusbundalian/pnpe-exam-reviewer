import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TabPage, PageHeading } from '../../../core/components/TabPage';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { spacing } from '../../../core/theme/tokens';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
import type { ReviewerSession } from '../../study/domain/study';
import type { ExamResultSummary } from '../../exam/domain/exam';
import { examProgress } from '../../exam/application/examProgress';

export type ProgressScreenProps = {
  session: ReviewerSession | null;
  examResults?: readonly ExamResultSummary[];
  onResume(session: ReviewerSession): void;
  onBack(): void;
};
export function ProgressScreen({
  session,
  examResults = [],
  onResume,
  onBack,
}: ProgressScreenProps) {
  const { colors } = useTheme();
  const active = session?.status === 'archived' ? null : session;
  const exams = examProgress(examResults);
  const checked = active?.catalogValidatedAt == null ? null : new Date(active.catalogValidatedAt);
  const date =
    checked && Number.isFinite(checked.getTime()) ? checked.toISOString().slice(0, 10) : null;
  return (
    <TabPage>
      <PageHeading
        title="Progress"
        description="A clear view of your study sessions and exam results."
      />
      <View style={{ gap: spacing.lg }}>
        <AppText variant="heading" accessibilityRole="header">
          Viewed progress
        </AppText>
        <AppText variant="caption" tone="secondary">
          Viewed counts describe reading activity: items displayed successfully in your Reviewer.
        </AppText>
        {active ? (
          <View
            style={{
              gap: spacing.md,
              padding: spacing.xl,
              backgroundColor: colors.surface,
              borderRadius: 16,
            }}
          >
            <AppText variant="heading" accessibilityLiveRegion="polite">
              Viewed {active.viewedOrdinals.length} of {active.items.length}
            </AppText>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Reviewer items viewed"
              accessibilityValue={{
                min: 0,
                max: active.items.length,
                now: active.viewedOrdinals.length,
              }}
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.primaryContainer,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${(active.viewedOrdinals.length / active.items.length) * 100}%`,
                  backgroundColor: colors.primary,
                }}
              />
            </View>
            <AppText tone="secondary">
              Resume at item {active.position + 1} of {active.items.length}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {date === null
                ? 'Content last checked: unknown'
                : `Content last checked: ${date} (UTC)`}
            </AppText>
            <AppButton variant="primary" label="Resume" onPress={() => onResume(active)} />
          </View>
        ) : (
          <View style={{ gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Ionicons
              name="book-outline"
              size={32}
              color={colors.textSecondary}
              accessible={false}
            />
            <AppText variant="button">No saved Reviewer session.</AppText>
            <AppText variant="caption" tone="secondary">
              Open a subject in Reviewers to start a saved session.
            </AppText>
          </View>
        )}
      </View>
      <View
        style={{
          gap: spacing.lg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingTop: spacing.xl,
        }}
      >
        <AppText variant="heading" accessibilityRole="header">
          Mock Exam progress
        </AppText>
        <View
          accessible
          accessibilityLabel={`Completed mock exams: ${exams.completed}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}
        >
          <Ionicons
            name="document-text-outline"
            size={28}
            color={colors.primary}
            accessible={false}
          />
          <AppText style={{ flex: 1 }}>Completed mock exams</AppText>
          <AppText variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {exams.completed}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl }}>
          <View
            accessible
            accessibilityLabel={`Average exam score: ${exams.averagePercentage === null ? 'Unavailable' : `${exams.averagePercentage.toFixed(2)}%`}`}
            style={{ flex: 1, minWidth: 136, gap: spacing.sm }}
          >
            <AppText variant="caption" tone="secondary">
              Average exam score
            </AppText>
            <AppText variant="heading">
              {exams.averagePercentage === null
                ? 'Unavailable'
                : `${exams.averagePercentage.toFixed(2)}%`}
            </AppText>
          </View>
          <View
            accessible
            accessibilityLabel={`Highest exam score: ${exams.highestPercentage === null ? 'Unavailable' : `${exams.highestPercentage.toFixed(2)}%`}`}
            style={{ flex: 1, minWidth: 136, gap: spacing.sm }}
          >
            <AppText variant="caption" tone="secondary">
              Highest exam score
            </AppText>
            <AppText variant="heading">
              {exams.highestPercentage === null
                ? 'Unavailable'
                : `${exams.highestPercentage.toFixed(2)}%`}
            </AppText>
          </View>
        </View>
        {exams.completed === 0 ? (
          <AppText variant="caption" tone="secondary">
            Complete a Mock Exam to see your scores here.
          </AppText>
        ) : null}
      </View>
      <AppButton variant="text" label="Back" onPress={onBack} style={{ alignSelf: 'flex-start' }} />
    </TabPage>
  );
}
