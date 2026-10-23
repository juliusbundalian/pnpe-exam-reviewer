import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppButton } from '../../../core/components/AppButton';
import { AppText } from '../../../core/components/AppText';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { spacing, type ThemeColors } from '../../../core/theme/tokens';
import type { ExamAttempt } from '../domain/exam';

export type NavigatorMode = 'compact' | 'expanded';
type QuestionState = 'unanswered' | 'answered' | 'skipped';
const noVisits: ReadonlySet<number> = new Set();

function preview(attempt: ExamAttempt, ordinal: number): string {
  const first = attempt.questions[ordinal]?.question.prompt.find((block) => block.kind === 'text');
  return first?.kind === 'text' ? first.text.replace(/\s+/g, ' ').slice(0, 65) : 'Question preview';
}
function stateColors(state: QuestionState, current: boolean, colors: ThemeColors) {
  const ink =
    state === 'answered'
      ? colors.success
      : state === 'skipped'
        ? colors.warning
        : colors.textSecondary;
  return {
    ink: current ? colors.onPrimary : ink,
    background: current ? colors.primary : state === 'unanswered' ? colors.surface : `${ink}14`,
    border: current ? colors.primary : state === 'unanswered' ? colors.border : ink,
  };
}
function StateBadge({
  state,
  current = false,
  number,
  flagged = false,
  small = false,
}: {
  state: QuestionState;
  current?: boolean;
  number?: number;
  flagged?: boolean;
  small?: boolean;
}) {
  const { colors } = useTheme();
  const palette = stateColors(state, current, colors);
  const icon =
    state === 'answered'
      ? 'checkmark'
      : state === 'skipped'
        ? 'arrow-forward'
        : current
          ? 'radio-button-on'
          : 'ellipse-outline';
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.badge,
        small && styles.smallBadge,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          borderWidth: current ? 2 : 1,
          borderStyle: state === 'skipped' && !current ? 'dashed' : 'solid',
        },
      ]}
    >
      {number === undefined ? (
        <Ionicons name={icon} size={17} color={palette.ink} accessible={false} />
      ) : (
        <>
          <AppText variant="button" style={{ color: palette.ink, fontVariant: ['tabular-nums'] }}>
            {number}
          </AppText>
          {state !== 'unanswered' ? (
            <Ionicons
              name={icon}
              size={11}
              color={palette.ink}
              style={styles.stateIcon}
              accessible={false}
            />
          ) : null}
        </>
      )}
      {flagged ? (
        <Ionicons
          name="flag"
          size={10}
          color={current ? colors.onPrimary : colors.warning}
          style={styles.flagIcon}
          accessible={false}
        />
      ) : null}
    </View>
  );
}

export function ExamNavigator({
  attempt,
  mode,
  onMode,
  onSelect,
  showHeading = true,
  visitedQuestions = noVisits,
}: {
  attempt: ExamAttempt;
  mode: NavigatorMode;
  onMode(mode: NavigatorMode): void;
  onSelect(ordinal: number): void;
  showHeading?: boolean;
  visitedQuestions?: ReadonlySet<number>;
}) {
  const { colors } = useTheme();
  const questions = attempt.questions.map((item, ordinal) => {
    const current = ordinal === attempt.position;
    const state: QuestionState =
      item.selectedChoiceId !== null
        ? 'answered'
        : visitedQuestions.has(ordinal) && !current
          ? 'skipped'
          : 'unanswered';
    return { item, ordinal, current, state };
  });
  const counts = { answered: 0, skipped: 0, unanswered: 0 };
  for (const question of questions) counts[question.state] += 1;
  return (
    <View style={{ gap: spacing.lg }}>
      {showHeading ? (
        <AppText variant="heading" accessibilityRole="header">
          Question navigator
        </AppText>
      ) : null}
      <View style={styles.guide}>
        <AppText variant="button" accessibilityRole="header">
          Question states
        </AppText>
        <View style={styles.legend}>
          {(
            [
              ['unanswered', 'Unanswered', false],
              ['answered', 'Answered', false],
              ['skipped', 'Skipped', false],
              ['unanswered', 'Current', true],
            ] as const
          ).map(([state, label, current]) => (
            <View key={label} style={styles.legendItem}>
              <StateBadge state={state} current={current} small />
              <AppText variant="caption">{label}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" tone="secondary">
          Skipped means opened and left without an answer.
        </AppText>
        <View style={styles.flagGuide}>
          <Ionicons name="flag" size={13} color={colors.warning} accessible={false} />
          <AppText variant="caption" tone="secondary">
            Flag marks a question to revisit.
          </AppText>
        </View>
      </View>
      <AppText variant="caption" tone="secondary">
        {counts.answered} answered · {counts.skipped} skipped · {counts.unanswered} unanswered
      </AppText>
      <View style={styles.modes}>
        <AppButton
          variant={mode === 'compact' ? 'secondary' : 'text'}
          style={{ minHeight: 48 }}
          label="Compact grid"
          accessibilityState={{ selected: mode === 'compact' }}
          onPress={() => onMode('compact')}
        />
        <AppButton
          variant={mode === 'expanded' ? 'secondary' : 'text'}
          style={{ minHeight: 48 }}
          label="Expanded list"
          accessibilityState={{ selected: mode === 'expanded' }}
          onPress={() => onMode('expanded')}
        />
      </View>
      <View style={styles.grid}>
        {questions.map(({ item, ordinal, state, current }) => {
          const states = [current ? 'current' : null, state, item.flagged ? 'flagged' : null]
            .filter(Boolean)
            .join(', ');
          const label = `Question ${ordinal + 1}, ${states}`;
          return (
            <Pressable
              key={item.entry.id}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: current }}
              onPress={() => onSelect(ordinal)}
              style={({ pressed }) => [
                styles.target,
                mode === 'expanded' && styles.expanded,
                {
                  opacity: pressed ? 0.7 : 1,
                  backgroundColor:
                    mode === 'expanded' && current ? colors.primaryContainer : 'transparent',
                },
              ]}
            >
              <StateBadge
                state={state}
                current={current}
                number={ordinal + 1}
                flagged={item.flagged}
              />
              {mode === 'expanded' ? (
                <View style={styles.preview}>
                  <AppText variant="button">{label}</AppText>
                  <AppText variant="caption" tone="secondary" numberOfLines={2}>
                    {preview(attempt, ordinal)}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  guide: { gap: spacing.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xl, rowGap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flagGuide: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  target: { minHeight: 52, minWidth: 52, borderRadius: 8 },
  badge: { width: 52, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  smallBadge: { width: 28, height: 28, borderRadius: 6 },
  stateIcon: { position: 'absolute', bottom: 3, right: 3 },
  flagIcon: { position: 'absolute', top: 3, left: 3 },
  expanded: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
  },
  preview: { flex: 1, minWidth: 0, gap: spacing.xs },
});
