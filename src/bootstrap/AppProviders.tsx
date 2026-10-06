import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'expo-router';
import type { AccessibilityFocusTarget } from '../core/components/AppModal';
import { AppText } from '../core/components/AppText';
import { AppButton } from '../core/components/AppButton';
import { RecoveryNotices } from './RecoveryNotices';
import { AuthRequiredModal } from '../features/auth/presentation/AuthRequiredModal';
import type { ProtectedAction, SafeOrigin } from '../features/auth/application/intents';
import { actionDestination, originDestination, publicOrigin } from '../navigation/destinations';
import { composeNativeApp, type AppDependencies } from './composition';
import { usePublicDependencies } from './PublicBootstrapProvider';
import type { ConfigKey, ConfigModels } from '../core/config/ConfigRepository';

interface NavigationContext {
  origin: { current: SafeOrigin };
  focus: { current: AccessibilityFocusTarget | null };
  require(action: ProtectedAction, focus?: AccessibilityFocusTarget | null): void;
}
const Dependencies = createContext<AppDependencies | null>(null);
const Navigation = createContext<NavigationContext | null>(null);
export function useAppDependencies(): AppDependencies {
  const value = useContext(Dependencies);
  if (!value) throw new Error('App providers are missing.');
  return value;
}
export function useAppNavigation(): NavigationContext {
  const value = useContext(Navigation);
  if (!value) throw new Error('App navigation is missing.');
  return value;
}
export function useAuthentication() {
  const { coordinator } = useAppDependencies();
  return useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot);
}
export function useConfig<K extends ConfigKey>(key: K): ConfigModels[K] {
  const { config } = useAppDependencies();
  return useSyncExternalStore(
    (listener) => config.subscribe(listener),
    () => config.get(key),
  );
}
export function NativeAppProviders({ children }: { children: ReactNode }) {
  const ports = usePublicDependencies();
  const [dependencies] = useState(() => composeNativeApp(ports));
  useEffect(() => () => dependencies.dispose(), [dependencies]);
  return <AppProviders dependencies={dependencies}>{children}</AppProviders>;
}
export function AppProviders({
  dependencies,
  children,
}: {
  dependencies: AppDependencies;
  children: ReactNode;
}) {
  const router = useRouter();
  const path = usePathname();
  const currentPath = useRef(path);
  currentPath.current = path;
  const origin = useRef<SafeOrigin>({ type: 'home' });
  const focus = useRef<AccessibilityFocusTarget | null>(null);
  const state = useSyncExternalStore(
    dependencies.coordinator.subscribe,
    dependencies.coordinator.getSnapshot,
  );
  const registration = useSyncExternalStore(
    dependencies.registration.subscribe,
    dependencies.registration.getSnapshot,
  );
  const current = publicOrigin(path);
  if (current) origin.current = current;
  useEffect(
    () =>
      dependencies.bindNavigation({
        resume: async (action) => {
          router.replace(actionDestination(action));
        },
        returnTo: (destination) => {
          const route = originDestination(destination);
          if (currentPath.current !== route) router.replace(route);
        },
      }),
    [dependencies, router],
  );
  useEffect(() => {
    const routes = {
      signIn: '/auth/sign-in',
      registration: '/auth/register',
      passwordReset: '/auth/forgot-password',
    } as const;
    if (state.screen !== 'none') router.replace(routes[state.screen]);
  }, [state.screen, router]);
  return (
    <Dependencies.Provider value={dependencies}>
      <Navigation.Provider
        value={{
          origin,
          focus,
          require(action, target) {
            if (!dependencies.coordinator.getSnapshot().pendingIntent)
              focus.current = target ?? null;
            void dependencies.coordinator.requireAuthentication(action, origin.current);
          },
        }}
      >
        {state.recoveryMessage || registration.status === 'profileRecovery' ? (
          <RecoveryNotices>
            {state.recoveryMessage ? (
              <>
                <AppText accessibilityRole="alert">{state.recoveryMessage}</AppText>
                <AppButton
                  variant="text"
                  label="Retry authentication"
                  onPress={() => {
                    void dependencies.coordinator.retry();
                  }}
                />
              </>
            ) : null}
            {registration.status === 'profileRecovery' ? (
              <>
                <AppText accessibilityRole="alert">
                  Your account is ready, but your profile could not be saved. {registration.message}
                </AppText>
                <AppButton
                  variant="secondary"
                  label="Retry Profile Save"
                  onPress={() => {
                    void dependencies.registration.retryProfile();
                  }}
                />
              </>
            ) : null}
          </RecoveryNotices>
        ) : null}
        {children}
        <AuthRequiredModal
          visible={state.promptOpen}
          title="Sign in to continue"
          message="Sign in or create an account to use personal study features."
          restoreFocusTarget={focus}
          onSignIn={() => dependencies.coordinator.chooseSignIn()}
          onRegister={() => dependencies.coordinator.chooseRegistration()}
          onCancel={() => {
            void dependencies.coordinator.cancel();
          }}
        />
      </Navigation.Provider>
    </Dependencies.Provider>
  );
}
