import { useEffect, useRef, type ReactNode } from 'react';
import type { ProtectedAction } from '../features/auth/application/intents';
import { useAppDependencies, useAppNavigation, useAuthentication } from '../bootstrap/AppProviders';
import { AppText } from '../core/components/AppText';
import { permitsPersonalContent } from './routePolicy';
export function ProtectedRoute({
  action,
  children,
}: {
  action: ProtectedAction;
  children: ReactNode;
}) {
  const { coordinator } = useAppDependencies();
  const { origin } = useAppNavigation();
  const { auth } = useAuthentication();
  const requested = useRef(false);
  useEffect(() => {
    if (!permitsPersonalContent(auth) && !requested.current) {
      requested.current = true;
      void coordinator.requireAuthentication(action, origin.current);
    }
    if (permitsPersonalContent(auth)) requested.current = false;
  }, [action, auth.status, coordinator, origin]);
  return permitsPersonalContent(auth) ? (
    children
  ) : (
    <AppText>Personal features require sign in.</AppText>
  );
}
