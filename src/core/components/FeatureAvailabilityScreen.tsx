import { AppScreen } from './AppScreen';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
export function FeatureAvailabilityScreen({ title, onBack }: { title: string; onBack(): void }) {
  return (
    <AppScreen>
      <AppText variant="title">{title}</AppText>
      <AppText>
        This feature is not available in this development build. No study session, timer, or
        personal results have been created.
      </AppText>
      <AppButton label="Back" variant="text" onPress={onBack} />
    </AppScreen>
  );
}
