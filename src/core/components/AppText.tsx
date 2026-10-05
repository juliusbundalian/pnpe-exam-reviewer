import { Text, type TextProps } from 'react-native';
import { forwardRef } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/tokens';

type AppTextProps = TextProps & {
  variant?: keyof typeof typeScale;
  tone?: 'primary' | 'secondary' | 'accent' | 'error';
};
export const AppText = forwardRef<Text, AppTextProps>(function AppText(
  { variant = 'body', tone = 'primary', style, ...props }: AppTextProps,
  ref,
) {
  const { colors } = useTheme();
  const color = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    accent: colors.primary,
    error: colors.error,
  }[tone];
  return (
    <Text {...props} ref={ref} allowFontScaling style={[typeScale[variant], { color }, style]} />
  );
});
