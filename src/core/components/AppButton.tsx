import { Pressable, type PressableProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing, touchTarget } from '../theme/tokens';
import { AppText } from './AppText';

type Variant = { variant: 'primary' } | { variant: 'secondary' } | { variant: 'text' };
export type AppButtonProps = Omit<PressableProps, 'children'> & Variant & { label: string };

export function AppButton({
  variant,
  label,
  style,
  disabled,
  accessibilityState,
  ...props
}: AppButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ ...accessibilityState, disabled: disabled ?? false }}
      style={(state) => [
        {
          minHeight: touchTarget,
          minWidth: touchTarget,
          justifyContent: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          backgroundColor: disabled
            ? colors.surfaceVariant
            : variant === 'primary'
              ? colors.primary
              : variant === 'secondary'
                ? colors.primaryContainer
                : 'transparent',
          opacity: state.pressed && !disabled ? 0.75 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <AppText
        variant="button"
        style={{
          textAlign: 'center',
          color: disabled
            ? colors.textSecondary
            : variant === 'primary'
              ? colors.onPrimary
              : colors.primary,
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
