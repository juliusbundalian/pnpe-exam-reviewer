import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  ScrollView,
  View,
  type Text,
  type View as NativeView,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radii } from '../theme/tokens';
import { AppText } from './AppText';

export type AccessibilityFocusTarget = Text | NativeView;
function focus(target: AccessibilityFocusTarget | null | undefined) {
  if (!target) return;
  const handle = findNodeHandle(target);
  if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
}
export function AppModal({
  visible,
  title,
  children,
  onClose,
  restoreFocusTarget,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose(): void;
  restoreFocusTarget?: { readonly current: AccessibilityFocusTarget | null };
}) {
  const { colors } = useTheme();
  const heading = useRef<Text>(null);
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible && Platform.OS !== 'ios') focus(restoreFocusTarget?.current);
    wasVisible.current = visible;
  }, [visible, restoreFocusTarget]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => focus(heading.current)}
      onDismiss={() => focus(restoreFocusTarget?.current)}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: spacing.xl,
          backgroundColor: '#00000080',
        }}
      >
        <ScrollView
          accessibilityViewIsModal
          contentContainerStyle={{
            padding: spacing.xl,
            gap: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
          }}
          style={{ flexGrow: 0 }}
        >
          <AppText ref={heading} variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
