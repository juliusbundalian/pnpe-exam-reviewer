import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { CategoryOverviewScreen } from '../../src/features/content/presentation/CategoryOverviewScreen';
import { ProfileScreen } from '../../src/features/auth/presentation/ProfileScreen';
import { SignInScreen } from '../../src/features/auth/presentation/SignInScreen';
import { AuthRequiredModal } from '../../src/features/auth/presentation/AuthRequiredModal';
import { authUser, FakeAuthenticationRepository } from '../fixtures/auth-harness';

test.each(['light', 'dark'] as const)(
  'long public category names retain full accessible names in %s',
  (appearance) => {
    render(
      <ThemeProvider initialAppearance={appearance}>
        <CategoryOverviewScreen
          categoryId="generalInformation"
          blocked={null}
          onOpen={() => {}}
          onBack={() => {}}
        />
      </ThemeProvider>,
    );
    const label = 'Philippine Constitution and Relevant Laws';
    expect(screen.getByRole('button', { name: label })).toBeVisible();
    expect(screen.getByText(label)).toHaveProp('allowFontScaling', true);
    expect(screen.getByText(label).props.numberOfLines).toBeUndefined();
    expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
  },
);

test('long saved names remain readable without truncating the profile text', async () => {
  const name = 'Maria '.repeat(16).trim();
  render(
    <ThemeProvider>
      <ProfileScreen
        user={authUser('alice')}
        profiles={{ get: async () => ({ displayName: name }), save: async () => {} }}
        onBack={() => {}}
      />
    </ThemeProvider>,
  );
  const text = await screen.findByText(name);
  expect(text).toHaveProp('allowFontScaling', true);
  expect(text.props.numberOfLines).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
});

test('form validation errors are exposed as alerts and associated with named inputs', async () => {
  render(
    <ThemeProvider>
      <SignInScreen
        auth={new FakeAuthenticationRepository({ status: 'guest' })}
        onRegister={() => {}}
        onPasswordReset={() => {}}
        onCancel={() => {}}
      />
    </ThemeProvider>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
  expect(screen.getByLabelText('Email')).toHaveProp(
    'accessibilityHint',
    'Enter a valid email address.',
  );
  expect(screen.getByLabelText('Password')).toHaveProp('accessibilityHint', 'Enter your password.');
  expect(screen.getByText('Enter your password.')).toHaveProp('accessibilityLiveRegion', 'polite');
});

test('authentication prompt has a named heading and three distinct accessible actions', () => {
  render(
    <ThemeProvider>
      <AuthRequiredModal
        visible
        title="Sign in to continue"
        message="Save progress with your account."
        onCancel={() => {}}
        onSignIn={() => {}}
        onRegister={() => {}}
      />
    </ThemeProvider>,
  );
  expect(screen.getByRole('header', { name: 'Sign in to continue' })).toBeVisible();
  for (const name of ['Sign In', 'Register', 'Maybe Later']) {
    expect(screen.getByRole('button', { name })).toHaveStyle({ minHeight: 44 });
  }
  expect(screen.UNSAFE_getByType(ScrollView).props.accessibilityViewIsModal).toBe(true);
});
