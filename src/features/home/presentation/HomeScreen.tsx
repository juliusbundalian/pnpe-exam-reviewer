import { Pressable, View } from 'react-native';
import { useRef } from 'react';
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
    <AppScreen>
      <AppText variant="heading">PNPE Exam Reviewer</AppText>
      {notice ? <AppText accessibilityRole="alert">{notice}</AppText> : null}
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
        {progressEnabled ? (
          <AppButton
            ref={progressTarget}
            variant="text"
            label="Progress"
            onPress={() => onProgress(progressTarget.current)}
          />
        ) : null}
        <AppButton
          ref={bookmarksTarget}
          variant="text"
          label="Saved Questions"
          onPress={() => onBookmarks(bookmarksTarget.current)}
        />
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
        <AppButton
          ref={mockTarget}
          variant="text"
          label="Start Mock Exam"
          onPress={() => onStartMockExam(mockTarget.current)}
        />
      </View>
    </AppScreen>
  );
}
