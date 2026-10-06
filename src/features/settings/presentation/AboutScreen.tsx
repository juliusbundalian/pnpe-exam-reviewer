import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
export function AboutScreen({ version, onBack }: { version: string; onBack(): void }) {
  return (
    <AppScreen>
      <AppButton variant="text" label="Back" onPress={onBack} />
      <AppText variant="title">About PNPE Exam Reviewer</AppText>
      <AppText>Version {version}</AppText>
      <AppText>
        This application is an independent examination preparation tool. It is not an official
        application of the Philippine National Police unless explicitly stated otherwise. Use of
        this reviewer does not guarantee passing the PNPE. Users should verify official examination
        information and requirements through the appropriate government authorities.
      </AppText>
    </AppScreen>
  );
}
