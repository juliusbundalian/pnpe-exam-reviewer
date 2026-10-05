import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SignInScreen } from '../../src/features/auth/presentation/SignInScreen';
import { ForgotPasswordScreen } from '../../src/features/auth/presentation/ForgotPasswordScreen';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { AppError } from '../../src/core/errors/AppError';
import { FakeAuthenticationRepository, deferred, authUser } from '../fixtures/auth-harness';
import { RegistrationScreen } from '../../src/features/auth/presentation/RegistrationScreen';
import { RegistrationController } from '../../src/features/auth/application/RegistrationController';
import { useSyncExternalStore } from 'react';
import { createAuthHarness, flushTransitions } from '../fixtures/auth-harness';
import { PixelRatio, ScrollView, Text, KeyboardAvoidingView } from 'react-native';
import { AppInput } from '../../src/core/components/AppInput';

function signIn(
  auth = new FakeAuthenticationRepository({ status: 'guest' }),
  appearance: 'light' | 'dark' = 'light',
) {
  const callbacks = { onRegister: jest.fn(), onPasswordReset: jest.fn(), onCancel: jest.fn() };
  const tree = render(
    <ThemeProvider initialAppearance={appearance}>
      <SignInScreen auth={auth} {...callbacks} />
    </ThemeProvider>,
  );
  return { auth, ...callbacks, tree };
}
function credentials(email = ' learner@example.test ', password = ' password ') {
  fireEvent.changeText(screen.getByLabelText('Email'), email);
  fireEvent.changeText(screen.getByLabelText('Password'), password);
}
test.each(['light', 'dark'] as const)(
  'sign in validates fields and protects password in %s',
  async (appearance) => {
    const { auth } = signIn(undefined, appearance);
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeVisible();
    expect(screen.getByText('Enter your password.')).toBeVisible();
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
    expect(screen.getByLabelText('Email')).toHaveProp('keyboardType', 'email-address');
    expect(screen.getByLabelText('Email')).toHaveStyle({ minHeight: 44 });
    credentials();
    await user.press(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() =>
      expect(auth.signIn).toHaveBeenCalledWith('learner@example.test', ' password '),
    );
    expect(screen.getByLabelText('Password')).toHaveProp('value', '');
  },
);

test('registration rejects mismatched passwords and long names without creating an account', async () => {
  const auth = new FakeAuthenticationRepository({ status: 'guest' });
  const profiles = { get: jest.fn(async () => null), save: jest.fn(async () => {}) };
  const registration = new RegistrationController(auth, profiles);
  render(
    <ThemeProvider>
      <RegistrationScreen registration={registration} onSignIn={jest.fn()} onCancel={jest.fn()} />
    </ThemeProvider>,
  );
  credentials();
  fireEvent.changeText(screen.getByLabelText('Name'), 'X'.repeat(101));
  fireEvent.changeText(screen.getByLabelText('Confirm Password'), 'password');
  fireEvent.press(screen.getByRole('button', { name: 'Create Account' }));
  expect(await screen.findByText('Use a name of up to 100 characters.')).toBeVisible();
  expect(screen.getByText('Passwords must match.')).toBeVisible();
  expect(screen.getByLabelText('Confirm Password')).toHaveProp('secureTextEntry', true);
  expect(auth.register).not.toHaveBeenCalled();
  registration.dispose();
});
test('registration keeps account success and profile recovery after form unmount', async () => {
  const auth = new FakeAuthenticationRepository({ status: 'guest' });
  const request = deferred<ReturnType<typeof authUser>>();
  auth.register.mockImplementation(() => request.promise);
  const profiles = { get: jest.fn(async () => null), save: jest.fn(async () => {}) };
  profiles.save.mockRejectedValueOnce(new AppError('profile-unavailable'));
  const registration = new RegistrationController(auth, profiles);
  const tree = render(
    <ThemeProvider>
      <RegistrationScreen registration={registration} onSignIn={jest.fn()} onCancel={jest.fn()} />
    </ThemeProvider>,
  );
  credentials();
  fireEvent.changeText(screen.getByLabelText('Name'), ' Person ');
  fireEvent.changeText(screen.getByLabelText('Confirm Password'), ' password ');
  fireEvent.press(screen.getByRole('button', { name: 'Create Account' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Creating Account…' })).toBeDisabled(),
  );
  tree.unmount();
  request.resolve(authUser('user-a'));
  await waitFor(() => expect(registration.getSnapshot().status).toBe('profileRecovery'));
  expect(auth.register).toHaveBeenCalledWith('learner@example.test', ' password ');
  expect(profiles.save).toHaveBeenCalledWith('user-a', { displayName: 'Person' });
  await registration.retryProfile();
  expect(registration.getSnapshot().status).toBe('complete');
  expect(auth.register).toHaveBeenCalledTimes(1);
  registration.dispose();
});
test('sign in disables controls while pending and never leaks unknown SDK messages', async () => {
  const auth = new FakeAuthenticationRepository({ status: 'guest' });
  const request = deferred<ReturnType<typeof authUser>>();
  auth.signIn.mockImplementation(() => request.promise);
  signIn(auth);
  credentials();
  fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Signing In…' })).toBeDisabled());
  expect(screen.getByLabelText('Password')).toHaveProp('editable', false);
  request.reject(new Error('firebase/auth secret stack'));
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeVisible();
  expect(screen.queryByText(/firebase/)).toBeNull();
});
test('mapped errors are announced and controls remain available', async () => {
  const auth = new FakeAuthenticationRepository({ status: 'guest' });
  auth.signIn.mockRejectedValue(new AppError('network'));
  signIn(auth);
  credentials();
  fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));
  const error = await screen.findByText('Please check your connection and try again.');
  expect(error).toHaveProp('accessibilityLiveRegion', 'polite');
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
});
test('switching and explicit exit call their supplied coordinator actions', async () => {
  const { onRegister, onPasswordReset, onCancel } = signIn();
  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: 'Create Account' }));
  await user.press(screen.getByRole('button', { name: 'Forgot Password?' }));
  await user.press(screen.getByRole('button', { name: 'Back' }));
  expect(onRegister).toHaveBeenCalledTimes(1);
  expect(onPasswordReset).toHaveBeenCalledTimes(1);
  expect(onCancel).toHaveBeenCalledTimes(1);
});
test.each([false, true])(
  'reset acknowledgement is neutral when address unknown=%s',
  async (unknown) => {
    const auth = new FakeAuthenticationRepository({ status: 'guest' });
    if (unknown) auth.requestPasswordReset.mockRejectedValue(new AppError('invalid-credentials'));
    render(
      <ThemeProvider>
        <ForgotPasswordScreen auth={auth} onSignIn={jest.fn()} onCancel={jest.fn()} />
      </ThemeProvider>,
    );
    fireEvent.changeText(screen.getByLabelText('Email'), ' person@example.test ');
    fireEvent.press(screen.getByRole('button', { name: 'Send Reset Email' }));
    expect(
      await screen.findByText(
        'If an account exists for this email, you will receive password reset instructions.',
      ),
    ).toBeVisible();
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('person@example.test');
    expect(screen.getByRole('button', { name: 'Return to Sign In' })).toBeVisible();
  },
);

test('actual form round trip preserves intent until explicit exit clears it', async () => {
  const h = createAuthHarness();
  await flushTransitions();
  await h.coordinator.requireAuthentication({ type: 'openBookmarks' }, { type: 'menu' });
  h.coordinator.chooseSignIn();
  const intent = h.coordinator.getSnapshot().pendingIntent?.id;
  const registration = new RegistrationController(h.repository, {
    get: async () => null,
    save: async () => {},
  });
  function Forms() {
    const state = useSyncExternalStore(h.coordinator.subscribe, h.coordinator.getSnapshot);
    const onCancel = () => {
      void h.coordinator.cancel();
    };
    return state.screen === 'signIn' ? (
      <SignInScreen
        auth={h.repository}
        onRegister={() => h.coordinator.chooseRegistration()}
        onPasswordReset={() => h.coordinator.choosePasswordReset()}
        onCancel={onCancel}
      />
    ) : state.screen === 'registration' ? (
      <RegistrationScreen
        registration={registration}
        onSignIn={() => h.coordinator.chooseSignIn()}
        onCancel={onCancel}
      />
    ) : state.screen === 'passwordReset' ? (
      <ForgotPasswordScreen
        auth={h.repository}
        onSignIn={() => h.coordinator.chooseSignIn()}
        onCancel={onCancel}
      />
    ) : null;
  }
  render(
    <ThemeProvider>
      <Forms />
    </ThemeProvider>,
  );
  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: 'Create Account' }));
  await user.press(screen.getByRole('button', { name: 'Sign In Instead' }));
  await user.press(screen.getByRole('button', { name: 'Forgot Password?' }));
  await user.press(screen.getByRole('button', { name: 'Return to Sign In' }));
  expect(h.coordinator.getSnapshot().pendingIntent?.id).toBe(intent);
  credentials();
  await user.press(screen.getByRole('button', { name: 'Sign In' }));
  expect(h.resume).not.toHaveBeenCalled();
  expect(h.coordinator.getSnapshot().pendingIntent?.id).toBe(intent);
  await user.press(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(h.coordinator.getSnapshot().pendingIntent).toBeNull());
  expect(h.returnTo).toHaveBeenCalledWith({ type: 'menu' });
  expect(h.store.values.size).toBe(0);
  h.coordinator.dispose();
  registration.dispose();
});

test.each(['light', 'dark'] as const)(
  'large font and long field error keep scrollable controls in %s',
  (appearance) => {
    const scale = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    const message = 'Please check this field and try again. '.repeat(20);
    render(
      <ThemeProvider initialAppearance={appearance}>
        <SignInScreen
          auth={new FakeAuthenticationRepository({ status: 'guest' })}
          onRegister={jest.fn()}
          onPasswordReset={jest.fn()}
          onCancel={jest.fn()}
        />
        <AppInput label="Example" error={message} />
      </ThemeProvider>,
    );
    expect(screen.getByText(message)).toHaveProp('allowFontScaling', true);
    expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toMatch(/padding|height/);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeVisible();
      expect(button).toHaveStyle({ minHeight: 44 });
    }
    for (const text of screen.UNSAFE_getAllByType(Text))
      expect(text.props.allowFontScaling).toBe(true);
    scale.mockRestore();
  },
);

test('profile recovery exposes account success and retry control without another registration', async () => {
  const auth = new FakeAuthenticationRepository({ status: 'guest' });
  const profiles = { get: jest.fn(async () => null), save: jest.fn(async () => {}) };
  profiles.save.mockRejectedValueOnce(new AppError('profile-unavailable'));
  const registration = new RegistrationController(auth, profiles);
  render(
    <ThemeProvider>
      <RegistrationScreen registration={registration} onSignIn={jest.fn()} onCancel={jest.fn()} />
    </ThemeProvider>,
  );
  credentials();
  fireEvent.changeText(screen.getByLabelText('Name'), 'Person');
  fireEvent.changeText(screen.getByLabelText('Confirm Password'), ' password ');
  fireEvent.press(screen.getByRole('button', { name: 'Create Account' }));
  expect(await screen.findByText('Your account is ready.')).toBeVisible();
  expect(
    screen.getByText('Your profile could not be saved or loaded. Please try again.'),
  ).toBeVisible();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Retry Profile Save' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry Profile Save' })).toBeNull(),
  );
  expect(auth.register).toHaveBeenCalledTimes(1);
  expect(profiles.save).toHaveBeenCalledTimes(2);
  registration.dispose();
});

test('reset validation blocks invalid address and pending reset disables switching', async () => {
  const auth = new FakeAuthenticationRepository({ status: 'guest' });
  const request = deferred<void>();
  auth.requestPasswordReset.mockImplementation(() => request.promise);
  render(
    <ThemeProvider>
      <ForgotPasswordScreen auth={auth} onSignIn={jest.fn()} onCancel={jest.fn()} />
    </ThemeProvider>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Send Reset Email' }));
  expect(await screen.findByText('Enter a valid email address.')).toBeVisible();
  expect(auth.requestPasswordReset).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.test');
  fireEvent.press(screen.getByRole('button', { name: 'Send Reset Email' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled());
  expect(screen.getByRole('button', { name: 'Return to Sign In' })).toBeDisabled();
  request.reject(new AppError('rate-limited'));
  expect(await screen.findByText('Too many attempts. Please try again later.')).toBeVisible();
});
