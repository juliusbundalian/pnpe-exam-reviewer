import { Tabs } from 'expo-router';
import { useAppNavigation, useAuthentication } from '../../bootstrap/AppProviders';
import { useTheme } from '../../core/theme/ThemeProvider';
import { permitsPersonalContent } from '../../navigation/routePolicy';
import { useRef } from 'react';
import { Pressable, type View } from 'react-native';
export default function TabLayout() {
  const navigation = useAppNavigation();
  const { auth } = useAuthentication();
  const { colors } = useTheme();
  const progressTarget = useRef<View | null>(null);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, minHeight: 56 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="review" options={{ title: 'Reviewers' }} />
      <Tabs.Screen name="mock-exam" options={{ title: 'Mock Exam' }} />
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
