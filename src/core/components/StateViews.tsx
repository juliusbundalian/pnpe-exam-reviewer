import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

export function LoadingView({ message = 'Loading' }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={{ gap: spacing.md }}
    >
      <ActivityIndicator color={colors.primary} />
      <AppText>{message}</AppText>
    </View>
  );
}
export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: spacing.md }}>
      <AppText variant="heading" tone="error">
        Something went wrong
      </AppText>
      <AppText>{message}</AppText>
      <AppButton variant="primary" label="Retry" onPress={onRetry} />
    </View>
  );
}
export function EmptyView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="heading">Nothing available yet</AppText>
      <AppText>{message}</AppText>
      <AppButton variant="secondary" label="Retry" onPress={onRetry} />
    </View>
  );
}
