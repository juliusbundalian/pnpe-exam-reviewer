import { PageHeading } from '../../../core/components/TabPage';
import { NavigationRow } from '../../../core/components/NavigationRow';
import { coverageSummaries } from '../../home/presentation/HomePresentationModel';
import { spacing } from '../../../core/theme/tokens';
import { View } from 'react-native';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
import { taxonomy } from '../domain/taxonomy';
import type { Availability } from '../domain/CategoryRepository';
import type { AccessibilityFocusTarget } from '../../../core/components/AppModal';
import { useRef } from 'react';
export function CategoryOverviewScreen({
  categoryId,
  availability,
  onOpen,
  onStart,
  onBack,
  blocked,
}: {
  categoryId?: string;
  availability?: Availability;
  onOpen(categoryId: string, subcategoryId?: string): void;
  onStart?(target: AccessibilityFocusTarget | null): void;
  onBack(): void;
  blocked: string | null;
}) {
  const target = useRef<View | null>(null);
  const category = taxonomy.find((entry) => entry.id === categoryId);
  if (categoryId && !category)
    return (
      <AppScreen>
        <AppText>Not Found</AppText>
        <AppButton label="Back" variant="text" onPress={onBack} />
      </AppScreen>
    );
  return (
    <AppScreen
      {...(!category
        ? { edges: ['top', 'left', 'right'] as import('react-native-safe-area-context').Edge[] }
        : {})}
      contentContainerStyle={{ paddingTop: spacing.xxl, gap: spacing.xl }}
    >
      {category ? (
        <AppButton
          variant="text"
          label="Back"
          onPress={onBack}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}
      <PageHeading
        title={category?.label ?? 'Reviewers'}
        description={
          category
            ? coverageSummaries[category.id]
            : 'Choose a subject. Build understanding at your own pace.'
        }
      />
      <View>
        <AppText variant="heading" accessibilityRole="header" style={{ marginBottom: spacing.sm }}>
          {category ? 'Topics in this subject' : 'Explore the subjects'}
        </AppText>
        {category
          ? category.subcategories.map((child) => (
              <NavigationRow
                key={child.id}
                icon="reader-outline"
                label={child.label}
                onPress={() => onOpen(category.id, child.id)}
              />
            ))
          : taxonomy.map((entry) => (
              <NavigationRow
                key={entry.id}
                icon={
                  entry.id === 'generalInformation'
                    ? 'library-outline'
                    : entry.id === 'communicationSkills'
                      ? 'chatbubbles-outline'
                      : entry.id === 'quantitativeReasoning'
                        ? 'calculator-outline'
                        : 'bulb-outline'
                }
                label={entry.label}
                description={`${coverageSummaries[entry.id]} · ${entry.subcategories.length} topics`}
                onPress={() => onOpen(entry.id)}
              />
            ))}
      </View>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading" accessibilityRole="header">
          How reviewers work
        </AppText>
        <AppText tone="secondary">
          Study all eligible published questions in this category, with the correct answer and
          explanation shown immediately. There is no answer selection, submission, question cap, or
          score.
        </AppText>
        <AppText variant="caption" tone="secondary">
          {availability?.status === 'known'
            ? `${availability.eligibleCount} eligible questions`
            : 'Question availability is not yet known.'}
        </AppText>
      </View>
      {blocked ? <AppText accessibilityRole="alert">{blocked}</AppText> : null}
      {onStart ? (
        <AppButton
          ref={target}
          label="Start Reviewer"
          variant="primary"
          disabled={!!blocked}
          onPress={() => onStart(target.current)}
        />
      ) : null}
    </AppScreen>
  );
}
