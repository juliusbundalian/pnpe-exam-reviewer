import { Text, type TextProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/tokens';

export function AppText({
  variant = 'body',
  tone = 'primary',
  style,
  ...props
}: TextProps & {
  variant?: keyof typeof typeScale;
  tone?: 'primary' | 'secondary' | 'accent' | 'error';
}) {
  const { colors } = useTheme();
  const color = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    accent: colors.primary,
    error: colors.error,
  }[tone];
  return <Text {...props} allowFontScaling style={[typeScale[variant], { color }, style]} />;
}
