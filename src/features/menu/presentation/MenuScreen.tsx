import { useSyncExternalStore, useRef } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { TabPage, PageHeading } from '../../../core/components/TabPage';
import { NavigationRow } from '../../../core/components/NavigationRow';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { spacing } from '../../../core/theme/tokens';
import type { AuthenticationCoordinator } from '../../auth/application/AuthenticationCoordinator';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
export function MenuScreen({
  coordinator,
  onOpen,
  historyEnabled = true,
  progressEnabled = true,
}: {
  coordinator: AuthenticationCoordinator;
  historyEnabled?: boolean;
  progressEnabled?: boolean;
  onOpen(
    destination:
      | 'profile'
      | 'progress'
      | 'bookmarks'
      | 'exam-history'
      | 'appearance'
      | 'about'
      | 'privacy'
      | 'terms',
    target?: View | null,
  ): void;
}) {
  const { colors, appearance } = useTheme();
  const { auth } = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot);
  const bookmarks = useRef<View | null>(null);
  const history = useRef<View | null>(null);
  const profile = useRef<View | null>(null);
  const progress = useRef<View | null>(null);
  return (
    <TabPage>
      <PageHeading title="Menu" description="Your account, study tools and preferences." />
      <View
        style={{
          padding: spacing.xl,
          borderRadius: 16,
          backgroundColor: colors.surface,
          gap: spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons
            name="person-circle-outline"
            size={42}
            color={colors.primary}
            accessible={false}
          />
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
            <AppText variant="heading">
              {auth.status === 'guest'
                ? 'Guest User'
                : auth.status === 'authenticated'
                  ? auth.user.displayName?.trim() || 'Your account'
                  : 'Account connection'}
            </AppText>
            {auth.status === 'authenticated' ? (
              <AppText variant="caption" tone="secondary">
                {auth.user.email ?? 'Signed in'}
              </AppText>
            ) : auth.status === 'guest' ? (
              <AppText variant="caption" tone="secondary">
                Sign in to access your personal study tools.
              </AppText>
            ) : (
              <AppText variant="caption" tone="secondary">
                Authentication is currently unavailable. Public browsing remains available.
              </AppText>
            )}
          </View>
        </View>
        {auth.status === 'guest' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <AppButton
              variant="primary"
              label="Sign In"
              style={{ flex: 1, minWidth: 120 }}
              onPress={() => coordinator.beginSignIn({ type: 'menu' })}
            />
            <AppButton
              variant="secondary"
              label="Create Account"
              style={{ flex: 1, minWidth: 120 }}
              onPress={() => coordinator.beginRegistration({ type: 'menu' })}
            />
          </View>
        ) : null}
      </View>
      {auth.status === 'authenticated' ? (
        <MenuGroup title="Account">
          <NavigationRow
            ref={profile}
            icon="person-outline"
            label="Profile"
            description="Manage your account details"
            onPress={() => onOpen('profile', profile.current)}
          />
          {progressEnabled ? (
            <NavigationRow
              ref={progress}
              icon="stats-chart-outline"
              label="Progress"
              description="Your reading activity and exam results"
              onPress={() => onOpen('progress', progress.current)}
            />
          ) : null}
        </MenuGroup>
      ) : null}
      <MenuGroup title="Study tools">
        <NavigationRow
          ref={bookmarks}
          icon="bookmark-outline"
          label="Saved Questions"
          description="Questions you want to revisit"
          onPress={() => onOpen('bookmarks', bookmarks.current)}
        />
        {historyEnabled ? (
          <NavigationRow
            ref={history}
            icon="time-outline"
            label="Exam History"
            description="Review your completed practice exams"
            onPress={() => onOpen('exam-history', history.current)}
          />
        ) : null}
      </MenuGroup>
      <MenuGroup title="Preferences">
        <NavigationRow
          icon="contrast-outline"
          label="Appearance"
          description={
            appearance === 'system'
              ? 'Following your device settings'
              : appearance === 'dark'
                ? 'Dark mode'
                : 'Light mode'
          }
          onPress={() => onOpen('appearance')}
        />
      </MenuGroup>
      <MenuGroup title="Information">
        <NavigationRow
          icon="information-circle-outline"
          label="About"
          onPress={() => onOpen('about')}
        />
        <NavigationRow
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() => onOpen('privacy')}
        />
        <NavigationRow icon="document-outline" label="Terms" onPress={() => onOpen('terms')} />
      </MenuGroup>
      {auth.status === 'authenticated' ? (
        <NavigationRow
          icon="log-out-outline"
          label="Sign Out"
          destructive
          onPress={() => {
            void coordinator.signOut();
          }}
        />
      ) : null}
    </TabPage>
  );
}
function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <AppText variant="heading" accessibilityRole="header" style={{ marginBottom: spacing.sm }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}
