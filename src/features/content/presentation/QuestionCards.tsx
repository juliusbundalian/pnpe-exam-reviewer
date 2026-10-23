import { Pressable, View } from 'react-native';
import { AppText } from '../../../core/components/AppText';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { radii, spacing, touchTarget } from '../../../core/theme/tokens';
import type { ContentBlock } from '../domain/content';
import type { CategoryId } from '../domain/taxonomy';
import { taxonomy } from '../domain/taxonomy';
import { ContentBlocks, type ContentBlocksProps } from './ContentBlocks';

type RenderCallbacks = Pick<ContentBlocksProps, 'onReady' | 'onError'>;

export function QuestionCard({
  categoryId,
  blocks,
  onReady,
  onError,
}: RenderCallbacks & { categoryId: CategoryId; blocks: readonly ContentBlock[] }) {
  const { colors } = useTheme();
  const category = taxonomy.find((item) => item.id === categoryId)!;
  return (
    <View
      testID="question-card"
      style={{
        gap: spacing.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.md,
        backgroundColor: colors.surface,
      }}
    >
      <AppText variant="caption" tone="accent" accessibilityRole="header">
        {category.label}
      </AppText>
      <ContentBlocks blocks={blocks} onReady={onReady} onError={onError} />
    </View>
  );
}

export function ChoiceCard({
  number,
  blocks,
  correct = false,
  selected = false,
  showSelection = false,
  onPress,
  disabled = false,
  onReady,
  onError,
}: RenderCallbacks & {
  number: number;
  blocks: readonly ContentBlock[];
  correct?: boolean;
  selected?: boolean;
  showSelection?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const cardStyle = {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
    minHeight: touchTarget,
    padding: spacing.md,
    borderWidth: selected || correct ? 2 : 1,
    borderColor: correct ? colors.success : selected ? colors.primary : colors.border,
    borderRadius: radii.md,
    backgroundColor: selected ? colors.primaryContainer : colors.surface,
  };
  const body = (
    <>
      <AppText
        variant="heading"
        style={{ minWidth: 84, color: correct ? colors.success : colors.textPrimary }}
      >
        Choice {number}
      </AppText>
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <ContentBlocks blocks={blocks} onReady={onReady} onError={onError} />
        {correct || showSelection ? (
          <AppText variant="caption" style={{ color: correct ? colors.success : colors.primary }}>
            {[correct ? 'Correct' : null, showSelection ? 'Your answer' : null]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        ) : null}
      </View>
    </>
  );
  if (onPress) {
    const answer = blocks
      .map((block) =>
        block.kind === 'text' ? block.text : block.kind === 'math' ? block.accessibleText : '',
      )
      .filter(Boolean)
      .join(' ');
    return (
      <Pressable
        testID={`choice-card-${number}`}
        accessibilityRole="button"
        accessibilityLabel={`Choice ${number}: ${answer}`}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, { opacity: pressed && !disabled ? 0.75 : 1 }]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View testID={`choice-card-${number}`} style={cardStyle}>
      {body}
    </View>
  );
}
