import { useEffect, useState } from 'react';
import type { AuthUser } from '../domain/AuthenticationRepository';
import type { Profile, ProfileRepository } from '../domain/ProfileRepository';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
export function ProfileScreen({ user, profiles }: { user: AuthUser; profiles: ProfileRepository }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    uid: string;
    status: 'loading' | 'ready' | 'error';
    profile: Profile | null;
  }>({ uid: user.uid, status: 'loading', profile: null });
  useEffect(() => {
    let active = true;
    setState({ uid: user.uid, status: 'loading', profile: null });
    void profiles.get(user.uid).then(
      (profile) => {
        if (active) setState({ uid: user.uid, status: 'ready', profile });
      },
      () => {
        if (active) setState({ uid: user.uid, status: 'error', profile: null });
      },
    );
    return () => {
      active = false;
    };
  }, [user.uid, profiles, attempt]);
  const status = state.uid === user.uid ? state.status : 'loading';
  return (
    <AppScreen>
      <AppText variant="title">Profile</AppText>
      <AppText>{user.email ?? 'No email is available.'}</AppText>
      <AppText>Account ID: {user.uid}</AppText>
      {status === 'loading' ? (
        <AppText>Loading profile…</AppText>
      ) : status === 'error' ? (
        <>
          <AppText accessibilityRole="alert">Your profile could not be loaded.</AppText>
          <AppButton
            variant="primary"
            label="Retry"
            onPress={() => setAttempt((value) => value + 1)}
          />
        </>
      ) : (
        <AppText>{state.profile?.displayName ?? 'No display name has been saved.'}</AppText>
      )}
    </AppScreen>
  );
}
