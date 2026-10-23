import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { Ref } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../../core/components/AppButton';
import { AppText } from '../../../core/components/AppText';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { radii, spacing } from '../../../core/theme/tokens';
import type { ConfigModels } from '../../../core/config/schemas';
import { taxonomy } from '../../content/domain/taxonomy';

type Props = {
  exam: ConfigModels['config']['mockExam'];
  preflight: boolean;
  blocked: string | null;
  startTarget: Ref<View>;
  onStart: () => void;
  onBack: () => void;
};

const subjectLabels: Record<string, string> = {
  communicationSkills: 'Verbal Reasoning',
  criticalThinking: 'Logical Reasoning',
};

const subjectNotes = {
  generalInformation: 'Laws, public service & current events',
  communicationSkills: 'Vocabulary, grammar & comprehension',
  quantitativeReasoning: 'Concepts, problem solving & data',
  criticalThinking: 'Logic, patterns & deduction',
} as const;

export function MockExamScreen({ exam, preflight, blocked, startTarget, onStart, onBack }: Props) {
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const expanded = width / fontScale >= 760;
  const stackSummary = width / fontScale < 340;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.page}>
          <View style={styles.introduction}>
            <AppText variant="title" accessibilityRole="header" style={styles.title}>
              {preflight ? 'Mock Exam preflight' : 'Mock Exam'}
            </AppText>
            <AppText tone="secondary" style={styles.description}>
              A focused space to put your preparation into practice.
            </AppText>
          </View>

          <View
            style={[
              styles.summary,
              stackSummary && styles.stackedSummary,
              { borderColor: colors.border },
            ]}
          >
            <View
              style={styles.stat}
              accessible
              accessibilityLabel={`${exam.questionCount} questions`}
            >
              <AppText tone="accent" style={styles.statValue}>
                {exam.questionCount}
              </AppText>
              <AppText variant="caption" tone="secondary">
                questions
              </AppText>
            </View>
            <View
              style={[
                styles.stat,
                stackSummary ? styles.stackedTime : styles.time,
                { borderColor: colors.border },
              ]}
              accessible
              accessibilityLabel={`${exam.durationMinutes} minutes`}
            >
              <AppText style={styles.statValue}>{exam.durationMinutes}</AppText>
              <AppText variant="caption" tone="secondary">
                minutes
              </AppText>
            </View>
          </View>

          <View style={[styles.details, expanded && styles.columns]}>
            <View style={styles.coverage}>
              <View style={styles.sectionHeading}>
                <AppText variant="heading" accessibilityRole="header">
                  Exam coverage
                </AppText>
                <AppText variant="caption" tone="secondary">
                  Four subject areas. One practice exam.
                </AppText>
              </View>
              {taxonomy.map((category) => (
                <View
                  key={category.id}
                  style={[styles.subject, { borderColor: colors.border }]}
                  accessible
                  accessibilityLabel={`${subjectLabels[category.id] ?? category.label}: ${exam.distribution[category.id]} questions. ${subjectNotes[category.id]}`}
                >
                  <View style={styles.subjectCopy}>
                    <AppText variant="button">
                      {subjectLabels[category.id] ?? category.label}
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      {subjectNotes[category.id]}
                    </AppText>
                  </View>
                  <AppText style={styles.subjectCount}>{exam.distribution[category.id]}</AppText>
                </View>
              ))}
              <AppText variant="caption" tone="secondary" style={styles.coverageNote}>
                Numbers show the questions allocated to each subject.
              </AppText>
            </View>

            <View
              style={[
                styles.briefing,
                expanded && styles.briefingColumn,
                { borderColor: colors.border },
              ]}
            >
              <AppText variant="heading" accessibilityRole="header">
                Before you begin
              </AppText>
              <AppText tone="secondary">
                Set aside {exam.durationMinutes} minutes and find a quiet place where you can focus.
              </AppText>
              <View style={[styles.threshold, { backgroundColor: colors.primaryContainer }]}>
                <AppText variant="button" tone="accent">
                  {exam.passingPercentage}% practice threshold
                </AppText>
                <AppText variant="caption" tone="secondary">
                  An application practice target, not a verified official examination requirement.
                </AppText>
              </View>
              <AppText variant="caption" tone="secondary">
                Review the coverage above before continuing.
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      <ScrollView
        bounces={false}
        style={[styles.actionArea, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={[styles.actions, expanded && styles.actionRow]}>
          <View style={styles.actionCopy}>
            {blocked ? (
              <AppText tone="error" accessibilityRole="alert" accessibilityLiveRegion="polite">
                {blocked}
              </AppText>
            ) : null}
            {preflight ? (
              <View style={styles.availability}>
                <AppText variant="button">Exam sessions are not available yet</AppText>
                <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
                  Mock Exam sessions are not available in this development build. No timer or
                  session has started.
                </AppText>
              </View>
            ) : (
              <>
                <AppText variant="button">Ready when you are.</AppText>
                <AppText variant="caption" tone="secondary">
                  Continue to the exam preflight.
                </AppText>
              </>
            )}
          </View>
          <AppButton
            ref={preflight ? null : startTarget}
            variant={preflight ? 'secondary' : 'primary'}
            label={preflight ? 'Back' : 'Start Mock Exam'}
            onPress={preflight ? onBack : onStart}
            accessibilityHint={
              preflight
                ? 'Return to the Mock Exam overview'
                : 'Sign in if needed, then continue to preflight'
            }
            style={[styles.startButton, expanded && styles.expandedButton]}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  page: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: 40,
  },
  introduction: { gap: spacing.sm, marginBottom: spacing.xxl },
  title: { fontSize: 32, lineHeight: 40, letterSpacing: -0.7 },
  description: { maxWidth: 500 },
  summary: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: spacing.xl,
    marginBottom: spacing.xxl,
  },
  stackedSummary: { flexDirection: 'column', gap: spacing.lg },
  stackedTime: { borderTopWidth: 1, paddingTop: spacing.lg },
  stat: { flex: 1, gap: spacing.xs, paddingRight: spacing.lg },
  time: { borderLeftWidth: 1, paddingLeft: spacing.xl },
  statValue: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '600',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  details: { gap: spacing.xxl },
  columns: { flexDirection: 'row', gap: 40, alignItems: 'flex-start' },
  coverage: { flex: 1, minWidth: 0 },
  sectionHeading: { gap: spacing.xs, marginBottom: spacing.sm },
  subject: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subjectCopy: { flex: 1, gap: spacing.xs },
  subjectCount: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  coverageNote: { marginTop: spacing.md },
  briefing: { gap: spacing.md },
  briefingColumn: { width: 264, paddingLeft: spacing.xl, borderLeftWidth: 1 },
  threshold: { padding: spacing.lg, gap: spacing.sm, borderRadius: radii.md },
  actionArea: { borderTopWidth: 1, maxHeight: '45%', flexGrow: 0, flexShrink: 0 },
  actions: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  actionCopy: { flexShrink: 1, gap: spacing.xs },
  availability: { gap: spacing.xs },
  startButton: { minHeight: 52 },
  expandedButton: { minWidth: 208, marginLeft: 'auto' },
});
