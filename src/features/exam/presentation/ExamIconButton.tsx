import { Pressable, type View } from 'react-native';
import type { ComponentProps, Ref } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../../core/theme/ThemeProvider';

export function ExamIconButton({
  icon,
  label,
  selected = false,
  disabled = false,
  onPress,
  buttonRef,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress(): void;
  buttonRef?: Ref<View>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      ref={buttonRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: selected || pressed ? colors.primaryContainer : 'transparent',
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Ionicons
        name={icon}
        size={23}
        color={selected ? colors.primary : colors.textPrimary}
        accessible={false}
      />
    </Pressable>
  );
}
