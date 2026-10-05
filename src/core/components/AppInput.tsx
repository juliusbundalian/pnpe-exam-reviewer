import type { Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing, touchTarget, typeScale } from '../theme/tokens';
import { AppText } from './AppText';

export function AppInput({
  label,
  error,
  ref,
  style,
  ...props
}: TextInputProps & { label: string; error?: string | undefined; ref?: Ref<TextInput> }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText>{label}</AppText>
      <TextInput
        {...props}
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error}
        allowFontScaling
        placeholderTextColor={colors.textSecondary}
        style={[
          typeScale.body,
          {
            minHeight: touchTarget,
            padding: spacing.md,
            borderWidth: 1,
            borderRadius: radii.sm,
            borderColor: error ? colors.error : colors.border,
            backgroundColor: colors.surface,
            color: colors.textPrimary,
          },
          style,
        ]}
      />
      {error ? (
        <AppText tone="error" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
