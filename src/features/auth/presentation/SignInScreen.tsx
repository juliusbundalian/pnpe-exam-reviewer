import type { AuthenticationRepository } from '../domain/AuthenticationRepository';
export type SignInScreenProps = {
  auth: AuthenticationRepository;
  onRegister(): void;
  onPasswordReset(): void;
  onCancel(): void;
};
export function SignInScreen({ auth, onRegister, onPasswordReset, onCancel }: SignInScreenProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
    clearErrors,
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const submit = handleSubmit(async (values) => {
    clearErrors('root');
    try {
      await auth.signIn(values.email, values.password);
      setValue('password', '');
    } catch (error: unknown) {
      setError('root', { message: toFriendlyAuthMessage(error) });
    }
  });
  return (
    <AppScreen>
      <AppText variant="title" accessibilityRole="header">
        Sign In
      </AppText>
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
            editable={!isSubmitting}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="current-password"
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
        label={isSubmitting ? 'Signing In…' : 'Sign In'}
        disabled={isSubmitting}
        onPress={() => {
          void submit();
        }}
      />
      <AppButton
        variant="secondary"
        label="Create Account"
        disabled={isSubmitting}
        onPress={onRegister}
      />
      <AppButton
        variant="text"
        label="Forgot Password?"
        disabled={isSubmitting}
        onPress={onPasswordReset}
      />
      <AppButton variant="text" label="Back" disabled={isSubmitting} onPress={onCancel} />
    </AppScreen>
  );
}
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppInput } from '../../../core/components/AppInput';
import { AppButton } from '../../../core/components/AppButton';
import { toFriendlyAuthMessage } from '../../../core/errors/userMessage';
import { signInSchema, type SignInValues } from './authFormSchemas';
