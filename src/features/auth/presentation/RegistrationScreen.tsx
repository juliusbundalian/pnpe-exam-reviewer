import type { RegistrationController } from '../application/RegistrationController';
export type RegistrationScreenProps = {
  registration: RegistrationController;
  onSignIn(): void;
  onCancel(): void;
};
export function RegistrationScreen({ registration, onSignIn, onCancel }: RegistrationScreenProps) {
  const state = useSyncExternalStore(registration.subscribe, registration.getSnapshot);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
    clearErrors,
  } = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { email: '', password: '', confirmation: '', displayName: '' },
  });
  const busy = isSubmitting || state.status === 'registering' || state.status === 'savingProfile';
  const submit = handleSubmit(async (values) => {
    clearErrors('root');
    try {
      await registration.register(values.email, values.password, values.displayName);
      setValue('password', '');
      setValue('confirmation', '');
    } catch (error: unknown) {
      setError('root', { message: toFriendlyAuthMessage(error) });
    }
  });
  return (
    <AppScreen>
      <AppText variant="title" accessibilityRole="header">
        Create Account
      </AppText>
      {state.user ? (
        <>
          <AppText accessibilityLiveRegion="polite">Your account is ready.</AppText>
          {state.status === 'profileRecovery' ? (
            <>
              <AppText tone="error" accessibilityRole="alert" accessibilityLiveRegion="polite">
                {state.message}
              </AppText>
              <AppButton
                variant="primary"
                label="Retry Profile Save"
                onPress={() => {
                  void registration.retryProfile();
                }}
              />
            </>
          ) : state.status === 'savingProfile' ? (
            <AppText accessibilityLiveRegion="polite">Saving your profile…</AppText>
          ) : null}
        </>
      ) : (
        <>
          <Controller
            control={control}
            name="displayName"
            render={({ field }) => (
              <AppInput
                label="Name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.displayName?.message}
                editable={!busy}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
              />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <AppInput
                label="Email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.email?.message}
                editable={!busy}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <AppInput
                label="Password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.password?.message}
                editable={!busy}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                autoComplete="new-password"
              />
            )}
          />
          <Controller
            control={control}
            name="confirmation"
            render={({ field }) => (
              <AppInput
                label="Confirm Password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.confirmation?.message}
                editable={!busy}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                autoComplete="new-password"
                onSubmitEditing={() => {
                  void submit();
                }}
              />
            )}
          />
          {errors.root?.message ? (
            <AppText tone="error" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {errors.root.message}
            </AppText>
          ) : null}
          <AppButton
            variant="primary"
            label={busy ? 'Creating Account…' : 'Create Account'}
            disabled={busy}
            onPress={() => {
              void submit();
            }}
          />
          <AppButton
            variant="secondary"
            label="Sign In Instead"
            disabled={busy}
            onPress={onSignIn}
          />
        </>
      )}
      <AppButton variant="text" label="Back" disabled={busy} onPress={onCancel} />
    </AppScreen>
  );
}
import { useSyncExternalStore } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppInput } from '../../../core/components/AppInput';
import { AppButton } from '../../../core/components/AppButton';
import { toFriendlyAuthMessage } from '../../../core/errors/userMessage';
import { registrationSchema, type RegistrationValues } from './authFormSchemas';
