import { useState } from 'react';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
export function AppearanceScreen() {
  const { appearance, setAppearance } = useTheme();
  const [error, setError] = useState(false);
  return (
    <AppScreen>
      <AppText variant="title">Appearance</AppText>
      {(['system', 'light', 'dark'] as const).map((value) => (
        <AppButton
          key={value}
          variant="secondary"
          label={value[0]?.toUpperCase() + value.slice(1)}
          accessibilityState={{ selected: appearance === value }}
          onPress={() => {
            setError(false);
            void setAppearance(value).catch(() => setError(true));
          }}
        />
      ))}
      {error ? (
        <AppText accessibilityRole="alert">
          The preference could not be saved. Select it again to retry.
        </AppText>
      ) : null}
    </AppScreen>
  );
}
