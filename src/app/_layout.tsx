import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../core/theme/ThemeProvider';
import Constants from 'expo-constants';
import { PublicBootstrapProvider } from '../bootstrap/PublicBootstrapProvider';
import { parseFirebaseEnvironment } from '../bootstrap/environment';
import { asyncStorageKeyValueStore } from '../core/storage/AsyncStorageKeyValueStore';
import { palettes } from '../core/theme/tokens';
import { NativeAppProviders } from '../bootstrap/AppProviders';

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
      <PublicBootstrapProvider
        storage={asyncStorageKeyValueStore}
        environment={parseFirebaseEnvironment(Constants.expoConfig?.extra?.firebase)}
      >
        <NativeAppProviders>
          <ThemedRoutes />
        </NativeAppProviders>
      </PublicBootstrapProvider>
    </SafeAreaProvider>
  );
}
