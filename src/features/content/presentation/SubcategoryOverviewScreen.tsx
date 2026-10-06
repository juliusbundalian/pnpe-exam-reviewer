import { useRef } from 'react';
import type { View } from 'react-native';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
import type { AccessibilityFocusTarget } from '../../../core/components/AppModal';
import type { Availability } from '../domain/CategoryRepository';
export function SubcategoryOverviewScreen({
  title,
  onStart,
  onBack,
  blocked,
  availability,
}: {
  title: string;
  onStart(target: AccessibilityFocusTarget | null): void;
  onBack(): void;
  blocked: string | null;
  availability?: Availability;
}) {
  const target = useRef<View | null>(null);
  return (
    <AppScreen>
      <AppButton variant="text" label="Back" onPress={onBack} />
      <AppText variant="title">{title}</AppText>
      <AppText>
        Study all eligible published questions in this subcategory. Correct answers and explanations
        appear immediately; no answer selection, submission, question cap, or score.
      </AppText>
      <AppText>
        {availability?.status === 'known'
          ? `${availability.eligibleCount} eligible questions`
          : 'Question availability is not yet known.'}
      </AppText>
      {blocked ? <AppText accessibilityRole="alert">{blocked}</AppText> : null}
      <AppButton
        ref={target}
        variant="primary"
        label="Start Reviewer"
        disabled={!!blocked}
        onPress={() => onStart(target.current)}
      />
    </AppScreen>
  );
}
