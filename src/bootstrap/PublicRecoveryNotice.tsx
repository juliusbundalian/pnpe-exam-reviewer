import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../core/components/AppText';
import { useTheme } from '../core/theme/ThemeProvider';
import { spacing } from '../core/theme/tokens';

export function PublicRecoveryNotice({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      testID="public-recovery-notice"
      edges={['top', 'left', 'right']}
      style={{ backgroundColor: colors.background, padding: spacing.md }}
    >
      <AppText accessibilityRole="alert">{message}</AppText>
    </SafeAreaView>
  );
}
