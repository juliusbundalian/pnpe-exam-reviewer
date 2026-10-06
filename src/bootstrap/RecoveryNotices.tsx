import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../core/theme/ThemeProvider';
import { spacing } from '../core/theme/tokens';

export function RecoveryNotices({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      testID="app-recovery-notices"
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        testID="app-recovery-notices-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { maxHeight: '40%', flexShrink: 1 },
  scroll: { flexGrow: 0 },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
});
