import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppScreen } from './AppScreen';
import { AppText } from './AppText';
import { spacing } from '../theme/tokens';

export function TabPage({ children }: { children: ReactNode }) {
  return (
    <AppScreen
      edges={['top', 'left', 'right']}
      contentContainerStyle={{ paddingTop: spacing.xxl, gap: spacing.xl }}
    >
      {children}
    </AppScreen>
  );
}
export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText
        variant="title"
        accessibilityRole="header"
        style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.6 }}
      >
        {title}
      </AppText>
      {description ? (
        <AppText tone="secondary" style={{ maxWidth: 520 }}>
          {description}
        </AppText>
      ) : null}
    </View>
  );
}
