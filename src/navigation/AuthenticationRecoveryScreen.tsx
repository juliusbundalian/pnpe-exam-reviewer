import { useRouter } from 'expo-router';
import { useAppDependencies, useAppNavigation, useAuthentication } from '../bootstrap/AppProviders';
import { AppScreen } from '../core/components/AppScreen';
import { AppText } from '../core/components/AppText';
import { AppButton } from '../core/components/AppButton';
import { originDestination } from './destinations';

export function AuthenticationRecoveryScreen({ onLeave }: { onLeave?: () => void }) {
  const { coordinator } = useAppDependencies();
  const { origin } = useAppNavigation();
  const { auth } = useAuthentication();
  const router = useRouter();
  return (
    <AppScreen>
      <AppText variant="heading" accessibilityRole="header">
        {auth.status === 'resolving'
          ? 'Checking authentication'
          : auth.status === 'recoveryRequired'
            ? 'Sign in is currently unavailable'
            : auth.status === 'guest'
              ? 'Personal features require sign in'
              : 'Returning to public browsing'}
      </AppText>
      <AppText accessibilityLiveRegion="polite">
        You can return to public browsing while authentication is checked, or retry.
      </AppText>
      <AppButton
        variant="secondary"
        label="Retry"
        onPress={() => {
          void coordinator.retry();
        }}
      />
      <AppButton
        variant="primary"
        label="Back to public browsing"
        onPress={() => {
          onLeave?.();
          const hasOrigin = coordinator.getSnapshot().origin !== null;
          // Cancellation clears the intent synchronously, before navigation or a late auth callback.
          void coordinator.cancel();
          if (!hasOrigin) router.replace(originDestination(origin.current));
        }}
      />
    </AppScreen>
  );
}
