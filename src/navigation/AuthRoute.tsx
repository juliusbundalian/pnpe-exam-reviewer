import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAppDependencies, useAppNavigation, useAuthentication } from '../bootstrap/AppProviders';
import { SignInScreen } from '../features/auth/presentation/SignInScreen';
import { RegistrationScreen } from '../features/auth/presentation/RegistrationScreen';
import { ForgotPasswordScreen } from '../features/auth/presentation/ForgotPasswordScreen';
import { AppText } from '../core/components/AppText';
import { originDestination } from './destinations';
export function AuthRoute({ screen }: { screen: 'signIn' | 'registration' | 'passwordReset' }) {
  const { auth, coordinator, registration } = useAppDependencies();
  const state = useAuthentication();
  const { origin } = useAppNavigation();
  const router = useRouter();
  // Once this route participates, the coordinator owns completion/cancellation.
  // A cleared flow must not restart while its return navigation is still pending.
  const participatedInFlow = useRef(false);
  if (state.origin || state.pendingIntent) participatedInFlow.current = true;
  useEffect(() => {
    if (
      state.auth.status === 'authenticated' &&
      !participatedInFlow.current &&
      state.screen === 'none'
    )
      router.replace(originDestination(origin.current));
  }, [origin, router, state.auth.status, state.screen]);
  useEffect(() => {
    if (state.auth.status === 'guest' && !participatedInFlow.current && state.screen === 'none') {
      if (screen === 'registration') coordinator.beginRegistration(origin.current);
      else {
        coordinator.beginSignIn(origin.current);
        if (screen === 'passwordReset') coordinator.choosePasswordReset();
      }
    }
  }, [coordinator, origin, screen, state.auth.status, state.screen]);
  const onCancel = () => {
    void coordinator.cancel();
  };
  if (state.auth.status !== 'guest')
    return <AppText>Authentication is being checked. Public browsing remains available.</AppText>;
  if (screen === 'registration')
    return (
      <RegistrationScreen
        registration={registration}
        onSignIn={() => coordinator.chooseSignIn()}
        onCancel={onCancel}
      />
    );
  if (screen === 'passwordReset')
    return (
      <ForgotPasswordScreen
        auth={auth}
        onSignIn={() => coordinator.chooseSignIn()}
        onCancel={onCancel}
      />
    );
  return (
    <SignInScreen
      auth={auth}
      onRegister={() => coordinator.chooseRegistration()}
      onPasswordReset={() => coordinator.choosePasswordReset()}
      onCancel={onCancel}
    />
  );
}
