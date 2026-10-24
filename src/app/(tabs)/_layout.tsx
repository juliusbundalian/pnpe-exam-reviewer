import { Tabs } from 'expo-router';
import { useAppNavigation, useAuthentication } from '../../bootstrap/AppProviders';
import { useTheme } from '../../core/theme/ThemeProvider';
import { permitsPersonalContent } from '../../navigation/routePolicy';
import { useRef } from 'react';
import {
  Pressable,
  View as NativeView,
  StyleSheet,
  useWindowDimensions,
  type View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../core/components/AppText';

const tabLabels: Record<string, string> = {
  index: 'Home',
  review: 'Reviewers',
  'mock-exam': 'Mock Exam',
  progress: 'Progress',
  menu: 'Menu',
};
const tabIcons: Record<
  string,
  [ComponentProps<typeof Ionicons>['name'], ComponentProps<typeof Ionicons>['name']]
> = {
  index: ['home-outline', 'home'],
  review: ['book-outline', 'book'],
  'mock-exam': ['document-text-outline', 'document-text'],
  progress: ['stats-chart-outline', 'stats-chart'],
  menu: ['grid-outline', 'grid'],
};

export default function TabLayout() {
  const navigation = useAppNavigation();
  const { auth } = useAuthentication();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const progressTarget = useRef<View | null>(null);
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarAccessibilityLabel: `${tabLabels[route.name]}, tab`,
        tabBarLabelPosition: 'below-icon',
        tabBarIcon: ({ focused, color }) => (
          <NativeView
            style={{
              width: 56,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? colors.primaryContainer : 'transparent',
            }}
          >
            <Ionicons
              testID={`tab-icon-${route.name}`}
              name={tabIcons[route.name]![focused ? 1 : 0]}
              size={26}
              color={color}
              accessible={false}
            />
          </NativeView>
        ),
        tabBarLabel: ({ color }) => (
          <AppText
            variant="caption"
            style={{ color, fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' }}
          >
            {route.name === 'review' ? 'Review' : tabLabels[route.name]}
          </AppText>
        ),
        tabBarItemStyle: { paddingVertical: 4, minHeight: 64 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          height: 80 + insets.bottom + Math.max(0, fontScale - 1) * 40,
          paddingTop: 6,
          paddingBottom: insets.bottom,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="review" options={{ title: 'Reviewers' }} />
      <Tabs.Screen
        name="mock-exam"
        options={({ route }) => ({
          title: 'Mock Exam',
          ...((route.params as { stage?: string } | undefined)?.stage === 'run'
            ? { tabBarStyle: { display: 'none' } }
            : {}),
        })}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarButton: (props) => <Pressable {...props} ref={progressTarget} />,
        }}
        listeners={{
          tabPress: (event) => {
            if (!permitsPersonalContent(auth)) {
              event.preventDefault();
              navigation.require({ type: 'openProgress' }, progressTarget.current);
            }
          },
        }}
      />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
    </Tabs>
  );
}
