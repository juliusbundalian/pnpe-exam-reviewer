import { useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  AppState,
  findNodeHandle,
  Modal,
  Platform,
  ScrollView,
  View,
  type Text,
  type View as NativeView,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
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
  presentation = 'dialog',
  headerAction,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose(): void;
  restoreFocusTarget?: { readonly current: AccessibilityFocusTarget | null };
  presentation?: 'dialog' | 'sheet';
  headerAction?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const heading = useRef<Text>(null);
  const wasVisible = useRef(visible);
  const pendingRestore = useRef(false);
  useLayoutEffect(() => {
    pendingRestore.current = wasVisible.current && !visible;
    wasVisible.current = visible;
  }, [visible]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // Android Modal has no onDismiss; wait until its native dialog releases
    // focus to the app window instead of competing with the dismissal animation.
    const subscription = AppState.addEventListener('focus', () => {
      if (!wasVisible.current && pendingRestore.current) {
        pendingRestore.current = false;
        const target = restoreFocusTarget?.current;
        // TalkBack follows hover-enter to the launcher; input-focus events can
        // leave accessibility focus on another node after the dialog closes.
        if (target) AccessibilityInfo.sendAccessibilityEvent(target, 'viewHoverEnter');
      }
    });
    return () => subscription.remove();
  }, [restoreFocusTarget]);
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
          justifyContent: presentation === 'sheet' ? 'flex-end' : 'center',
          padding: presentation === 'sheet' ? 0 : spacing.xl,
          backgroundColor: '#00000080',
        }}
      >
        <ScrollView
          accessibilityViewIsModal
          contentContainerStyle={{
            padding: spacing.xl,
            ...(presentation === 'sheet'
              ? {
                  paddingBottom: spacing.xl + (insets?.bottom ?? 0),
                  paddingLeft: spacing.xl + (insets?.left ?? 0),
                  paddingRight: spacing.xl + (insets?.right ?? 0),
                }
              : {}),
            gap: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: presentation === 'sheet' ? 0 : radii.md,
            borderTopLeftRadius: radii.md,
            borderTopRightRadius: radii.md,
            width: '100%',
            maxWidth: presentation === 'sheet' ? 720 : 560,
            alignSelf: 'center',
          }}
          style={{ flexGrow: 0, ...(presentation === 'sheet' ? { maxHeight: '85%' } : {}) }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText ref={heading} variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </AppText>
            {headerAction}
          </View>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
