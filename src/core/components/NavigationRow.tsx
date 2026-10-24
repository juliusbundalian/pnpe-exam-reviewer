import { Pressable, StyleSheet, View, type View as NativeView } from 'react-native';
import type { ComponentProps, Ref } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from './AppText';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';

export function NavigationRow({
  label,
  description,
  icon,
  onPress,
  ref,
  destructive = false,
}: {
  label: string;
  description?: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress(): void;
  ref?: Ref<NativeView>;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(description ? { accessibilityHint: description } : {})}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceVariant : 'transparent',
      })}
    >
      <Ionicons
        name={icon}
        size={24}
        color={destructive ? colors.error : colors.primary}
        accessible={false}
      />
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <AppText
          variant="button"
          style={{ color: destructive ? colors.error : colors.textPrimary }}
        >
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" tone="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} accessible={false} />
    </Pressable>
  );
}
