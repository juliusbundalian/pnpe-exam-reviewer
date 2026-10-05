import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../core/theme/ThemeProvider';
import { asyncStorageKeyValueStore } from '../core/storage/AsyncStorageKeyValueStore';
import { palettes } from '../core/theme/tokens';

function ThemedRoutes() {
  const { colors } = useTheme();
  return (
    <>
      <StatusBar style={colors.background === palettes.dark.background ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      />
    </>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider storage={asyncStorageKeyValueStore}>
        <ThemedRoutes />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
