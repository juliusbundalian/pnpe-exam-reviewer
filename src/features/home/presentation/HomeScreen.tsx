import { Pressable, View } from 'react-native';
import { AppButton } from '../../../core/components/AppButton';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { spacing, touchTarget } from '../../../core/theme/tokens';
import { taxonomy } from '../../content/domain/taxonomy';
import {
  coverageSummaries,
  initialHomePresentationModel,
  type HomePresentationModel,
} from './HomePresentationModel';

export function HomeScreen({
  displayName,
  onExplore,
  onMockExam,
  onProgress,
  onBookmarks,
  model = initialHomePresentationModel,
}: {
  displayName?: string;
  onExplore: () => void;
  onMockExam: () => void;
  onProgress: () => void;
  onBookmarks: () => void;
  model?: HomePresentationModel;
}) {
  const { colors } = useTheme();
  return (
    <AppScreen>
      <AppText variant="heading">PNPE Exam Reviewer</AppText>
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        <AppText variant="caption" tone="accent">
          {displayName?.trim() ? `Welcome, ${displayName.trim()}` : 'Your preparation starts here'}
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          Build confidence. One question at a time.
        </AppText>
        <AppText tone="secondary">
          Prepare with structured reviewers and a realistic, timed Mock Exam.
        </AppText>
        <AppButton variant="primary" label="Explore reviewers" onPress={onExplore} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <AppButton variant="text" label="Mock Exam" onPress={onMockExam} />
        <AppButton variant="text" label="Progress" onPress={onProgress} />
        <AppButton variant="text" label="Saved Questions" onPress={onBookmarks} />
      </View>
      <View>
        <AppText variant="heading" accessibilityRole="header">
          Main coverage
        </AppText>
        {taxonomy.map((category, index) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={`Explore ${category.label}`}
            onPress={onExplore}
            style={({ pressed }) => ({
              minHeight: touchTarget,
              paddingVertical: spacing.xl,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              borderBottomWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceVariant : colors.background,
            })}
          >
            <AppText variant="caption" tone="secondary" accessible={false}>
              {String(index + 1).padStart(2, '0')}
            </AppText>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="button">{category.label}</AppText>
              <AppText variant="caption" tone="secondary">
                {coverageSummaries[category.id]}
              </AppText>
            </View>
            <AppText tone="secondary" accessible={false}>
              ›
            </AppText>
          </Pressable>
        ))}
      </View>
      <View
        style={{
          borderTopWidth: 2,
          borderColor: colors.border,
          paddingTop: spacing.xl,
          gap: spacing.sm,
        }}
      >
        <AppText variant="heading" accessibilityRole="header">
          Ready for a full Mock Exam?
        </AppText>
        <AppText
          variant="caption"
          tone="secondary"
        >{`${model.mockExam.questionCount} questions · ${model.mockExam.durationMinutes} minutes · All four areas`}</AppText>
        <AppButton variant="text" label="Start Mock Exam" onPress={onMockExam} />
      </View>
    </AppScreen>
  );
}
