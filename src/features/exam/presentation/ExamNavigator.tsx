import { View } from 'react-native';
import { AppButton } from '../../../core/components/AppButton';
import { AppText } from '../../../core/components/AppText';
import { spacing } from '../../../core/theme/tokens';
import type { ExamAttempt } from '../domain/exam';

export type NavigatorMode = 'compact' | 'expanded';

function preview(attempt: ExamAttempt, ordinal: number): string {
  const first = attempt.questions[ordinal]?.question.prompt.find((block) => block.kind === 'text');
  return first?.kind === 'text' ? first.text.replace(/\s+/g, ' ').slice(0, 65) : 'Question preview';
}

export function ExamNavigator({
  attempt,
  mode,
  onMode,
  onSelect,
}: {
  attempt: ExamAttempt;
  mode: NavigatorMode;
  onMode(mode: NavigatorMode): void;
  onSelect(ordinal: number): void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="heading" accessibilityRole="header">
        Question navigator
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <AppButton
          variant={mode === 'compact' ? 'secondary' : 'text'}
          label="Compact grid"
          onPress={() => onMode('compact')}
        />
        <AppButton
          variant={mode === 'expanded' ? 'secondary' : 'text'}
          label="Expanded list"
          onPress={() => onMode('expanded')}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {attempt.questions.map((item, ordinal) => {
          const states = [
            ordinal === attempt.position ? 'current' : null,
            item.selectedChoiceId ? 'answered' : 'unanswered',
            item.flagged ? 'flagged' : null,
          ]
            .filter(Boolean)
            .join(', ');
          const label = `Question ${ordinal + 1}, ${states}`;
          return (
            <View key={item.entry.id} style={mode === 'expanded' ? { width: '100%' } : undefined}>
              <AppButton
                variant={ordinal === attempt.position ? 'secondary' : 'text'}
                label={mode === 'compact' ? `${ordinal + 1}${item.flagged ? ' ⚑' : ''}` : label}
                accessibilityLabel={label}
                onPress={() => onSelect(ordinal)}
              />
              {mode === 'expanded' ? (
                <AppText numberOfLines={1}>{preview(attempt, ordinal)}</AppText>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
