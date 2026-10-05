import type { AuthenticationRepository } from '../domain/AuthenticationRepository';
export type ForgotPasswordScreenProps = {
  auth: AuthenticationRepository;
  onSignIn(): void;
  onCancel(): void;
};
export function ForgotPasswordScreen({ auth, onSignIn, onCancel }: ForgotPasswordScreenProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<PasswordResetValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { email: '' },
  });
  const submit = handleSubmit(async (values) => {
    clearErrors('root');
    try {
      await auth.requestPasswordReset(values.email);
      setAcknowledged(true);
    } catch (error: unknown) {
      if (error instanceof AppError && error.code === 'invalid-credentials') setAcknowledged(true);
      else setError('root', { message: toFriendlyAuthMessage(error) });
    }
  });
  return (
    <AppScreen>
      <AppText variant="title" accessibilityRole="header">
        Reset Password
      </AppText>
      {acknowledged ? (
        <AppText accessibilityLiveRegion="polite">
          If an account exists for this email, you will receive password reset instructions.
        </AppText>
      ) : (
        <>
          <AppText>Enter your email to request password reset instructions.</AppText>
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
                editable={!isSubmitting}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
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
            label={isSubmitting ? 'Sending…' : 'Send Reset Email'}
            disabled={isSubmitting}
            onPress={() => {
              void submit();
            }}
          />
        </>
      )}
      <AppButton
        variant="secondary"
        label="Return to Sign In"
        disabled={isSubmitting}
        onPress={onSignIn}
      />
      <AppButton variant="text" label="Back" disabled={isSubmitting} onPress={onCancel} />
    </AppScreen>
  );
}
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppInput } from '../../../core/components/AppInput';
import { AppButton } from '../../../core/components/AppButton';
import { AppError } from '../../../core/errors/AppError';
import { toFriendlyAuthMessage } from '../../../core/errors/userMessage';
import { passwordResetSchema, type PasswordResetValues } from './authFormSchemas';
