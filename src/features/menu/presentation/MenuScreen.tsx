import { useSyncExternalStore, useRef } from 'react';
import type { View } from 'react-native';
import type { AuthenticationCoordinator } from '../../auth/application/AuthenticationCoordinator';
import { AppScreen } from '../../../core/components/AppScreen';
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
  const { auth } = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot);
  const bookmarks = useRef<View | null>(null);
  const history = useRef<View | null>(null);
  const profile = useRef<View | null>(null);
  const progress = useRef<View | null>(null);
  return (
    <AppScreen>
      <AppText variant="title">Menu</AppText>
      {auth.status === 'guest' ? (
        <>
          <AppText>Guest User</AppText>
          <AppButton
            variant="primary"
            label="Sign In"
            onPress={() => coordinator.beginSignIn({ type: 'menu' })}
          />
          <AppButton
            variant="secondary"
            label="Create Account"
            onPress={() => coordinator.beginRegistration({ type: 'menu' })}
          />
        </>
      ) : auth.status === 'authenticated' ? (
        <>
          <AppText>{auth.user.email ?? 'Signed in'}</AppText>
          <AppButton
            ref={profile}
            variant="text"
            label="Profile"
            onPress={() => onOpen('profile', profile.current)}
          />
          {progressEnabled ? (
            <AppButton
              ref={progress}
              variant="text"
              label="Progress"
              onPress={() => onOpen('progress', progress.current)}
            />
          ) : null}
          <AppButton
            variant="text"
            label="Sign Out"
            onPress={() => {
              void coordinator.signOut();
            }}
          />
        </>
      ) : (
        <AppText>
          Authentication is currently unavailable. Public browsing remains available.
        </AppText>
      )}
      <AppButton
        ref={bookmarks}
        variant="text"
        label="Saved Questions"
        onPress={() => onOpen('bookmarks', bookmarks.current)}
      />
      {historyEnabled ? (
        <AppButton
          ref={history}
          variant="text"
          label="Exam History"
          onPress={() => onOpen('exam-history', history.current)}
        />
      ) : null}
      <AppButton variant="text" label="Appearance" onPress={() => onOpen('appearance')} />
      <AppButton variant="text" label="About" onPress={() => onOpen('about')} />
      <AppButton variant="text" label="Privacy Policy" onPress={() => onOpen('privacy')} />
      <AppButton variant="text" label="Terms" onPress={() => onOpen('terms')} />
    </AppScreen>
  );
}
