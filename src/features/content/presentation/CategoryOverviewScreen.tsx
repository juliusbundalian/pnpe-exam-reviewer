import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
import { taxonomy } from '../domain/taxonomy';
import type { Availability } from '../domain/CategoryRepository';
import type { AccessibilityFocusTarget } from '../../../core/components/AppModal';
import { useRef } from 'react';
import type { View } from 'react-native';
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
    <AppScreen>
      {category ? <AppButton variant="text" label="Back" onPress={onBack} /> : null}
      <AppText variant="title">{category?.label ?? 'Reviewers'}</AppText>
      <AppText>
        Study all eligible published questions in this category, with the correct answer and
        explanation shown immediately. There is no answer selection, submission, question cap, or
        score.
      </AppText>
      <AppText>
        {availability?.status === 'known'
          ? `${availability.eligibleCount} eligible questions`
          : 'Question availability is not yet known.'}
      </AppText>
      {category
        ? category.subcategories.map((child) => (
            <AppButton
              key={child.id}
              variant="text"
              label={child.label}
              onPress={() => onOpen(category.id, child.id)}
            />
          ))
        : taxonomy.map((entry) => (
            <AppButton
              key={entry.id}
              variant="text"
              label={entry.label}
              onPress={() => onOpen(entry.id)}
            />
          ))}
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
