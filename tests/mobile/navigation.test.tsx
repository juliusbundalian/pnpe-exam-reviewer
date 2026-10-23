import { screen, fireEvent, waitFor, act } from 'expo-router/testing-library';
import { createAppHarness } from '../fixtures/app-harness';
import { authUser, flushTransitions } from '../fixtures/auth-harness';
const harnesses: ReturnType<typeof createAppHarness>[] = [];
function harness(options: Parameters<typeof createAppHarness>[0] = {}) {
  const h = createAppHarness(options);
  harnesses.push(h);
  return h;
}
afterEach(() => {
  harnesses.splice(0).forEach((h) => h.dispose());
});
test.each(['/auth/sign-in', '/auth/register', '/auth/forgot-password'])(
  'already authenticated direct entry to %s returns to public Home',
  async (url) => {
    const h = harness({ initialAuth: { status: 'authenticated', user: authUser('alice') } });
    const result = await h.render(url);
    expect(await screen.findByText('Explore reviewers')).toBeVisible();
    expect(result.getPathname()).toBe('/');
    expect(screen.queryByText(/Authentication is being checked/)).toBeNull();
  },
);
test.each([
  ['/auth/sign-in', 'signIn', 'Sign In'],
  ['/auth/register', 'registration', 'Create Account'],
  ['/auth/forgot-password', 'passwordReset', 'Reset Password'],
])('guest direct entry to %s starts its initial auth flow', async (url, form, heading) => {
  const h = harness();
  const result = await h.render(url);
  expect(result.getPathname()).toBe(url);
  expect(h.dependencies.coordinator.getSnapshot().screen).toBe(form);
  expect(await screen.findByRole('header', { name: heading })).toBeVisible();
});

test('Back after a password-reset roundtrip stays cancelled while the return navigation is delayed', async () => {
  const h = harness();
  const delayedReturns: (() => void)[] = [];
  const bindNavigation = h.dependencies.bindNavigation;
  h.dependencies.bindNavigation = (handlers) =>
    bindNavigation({
      ...handlers,
      returnTo: (origin) => delayedReturns.push(() => handlers.returnTo(origin)),
    });
  const result = await h.render('/menu');
  fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));
  await waitFor(() => expect(result.getPathname()).toBe('/auth/sign-in'));
  fireEvent.press(screen.getByRole('button', { name: 'Forgot Password?' }));
  await waitFor(() => expect(result.getPathname()).toBe('/auth/forgot-password'));
  fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.test');
  fireEvent.press(screen.getByRole('button', { name: 'Send Reset Email' }));
  expect(await screen.findByText(/If an account exists for this email/)).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Return to Sign In' }));
  await waitFor(() => expect(result.getPathname()).toBe('/auth/sign-in'));
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await act(flushTransitions);
  // The auth route remains mounted while the native navigator processes returnTo.
  expect(result.getPathname()).toBe('/auth/sign-in');
  expect(h.dependencies.coordinator.getSnapshot()).toMatchObject({
    screen: 'none',
    origin: null,
    pendingIntent: null,
  });
  expect(delayedReturns).toHaveLength(1);
  await act(async () => {
    delayedReturns[0]!();
    await flushTransitions();
  });
  await waitFor(() => expect(result.getPathname()).toBe('/menu'));
  expect(h.dependencies.coordinator.getSnapshot().screen).toBe('none');
  expect(screen.queryByLabelText('Password')).toBeNull();
});

test('Profile opened from cold Menu has an accessible return even after tab replacement', async () => {
  const h = harness({ initialAuth: { status: 'authenticated', user: authUser('alice') } });
  const result = await h.render('/menu');
  fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
  await waitFor(() => expect(result.getPathname()).toBe('/profile'));
  fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
  expect(await screen.findByText('Explore reviewers')).toBeVisible();
  expect(result.getPathname()).toBe('/');
});
test.each([
  ['/profile', '/'],
  ['/appearance', '/'],
  ['/about', '/'],
  ['/privacy', '/'],
  ['/terms', '/'],
  ['/review/generalInformation', '/review'],
  ['/review/generalInformation/constitutionAndLaws', '/review'],
])('direct entry to %s has an accessible return with a safe fallback', async (url, fallback) => {
  const h = harness({ initialAuth: { status: 'authenticated', user: authUser('alice') } });
  const result = await h.render(url);
  fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
  await waitFor(() => expect(result.getPathname()).toBe(fallback));
});
test('public settings return to the preceding screen when history exists', async () => {
  const h = harness();
  const result = await h.render('/menu');
  fireEvent.press(screen.getByRole('button', { name: 'Appearance' }));
  await waitFor(() => expect(result.getPathname()).toBe('/appearance'));
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(result.getPathname()).toBe('/menu'));
});
test('guest cold launch opens Home without Login', async () => {
  const h = harness();
  await h.render('/');
  expect(await screen.findByText('Explore reviewers')).toBeVisible();
  expect(screen.queryByText('Sign in to continue')).toBeNull();
});

test('Home Start Mock Exam is a protected start, while its overview remains public', async () => {
  const h = harness();
  await h.render('/');
  fireEvent.press(screen.getByRole('button', { name: 'Start Mock Exam' }));
  expect(await screen.findByText('Sign in to continue')).toBeVisible();
  await h.authenticate('alice');
  expect(await screen.findByText('Mock Exam preflight')).toBeVisible();
});

test('authenticated Home Start Mock Exam reaches preflight without an auth prompt or session', async () => {
  const h = harness({ initialAuth: { status: 'authenticated', user: authUser('alice') } });
  await h.render('/');
  fireEvent.press(screen.getByRole('button', { name: 'Start Mock Exam' }));
  expect(await screen.findByText('Mock Exam preflight')).toBeVisible();
  expect(screen.queryByText('Sign in to continue')).toBeNull();
  expect(screen.getByText(/No timer or session has started/)).toBeVisible();
});
test('guest browses actual category and subcategory routes without authentication', async () => {
  const h = harness();
  const result = await h.render('/');
  fireEvent.press(screen.getByRole('button', { name: 'Explore reviewers' }));
  fireEvent.press(await screen.findByRole('button', { name: 'General Information' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Philippine Constitution and Relevant Laws' }),
  );
  expect(result.getPathname()).toBe('/review/generalInformation/constitutionAndLaws');
  expect(await screen.findByRole('button', { name: 'Start Reviewer' })).toBeVisible();
  expect(screen.queryByText('Sign in to continue')).toBeNull();
});
test('guest Start Reviewer prompts before reaching a development boundary', async () => {
  const h = harness();
  await h.render('/review/generalInformation');
  fireEvent.press(screen.getByRole('button', { name: 'Start Reviewer' }));
  expect(await screen.findByText('Sign in to continue')).toBeVisible();
  await h.authenticate('alice');
  expect(await screen.findByText('Reviewer — development availability')).toBeVisible();
});
test('guest Start Mock Exam opens shared authentication prompt', async () => {
  const h = harness();
  await h.render('/mock-exam');
  fireEvent.press(screen.getByRole('button', { name: 'Start Mock Exam' }));
  expect(await screen.findByText('Sign in to continue')).toBeVisible();
});
test('Mock Exam login returns to preflight without starting a timer', async () => {
  const h = harness();
  await h.render('/mock-exam');
  fireEvent.press(screen.getByRole('button', { name: 'Start Mock Exam' }));
  await screen.findByText('Sign in to continue');
  await h.authenticate('alice');
  expect(await screen.findByText('Mock Exam preflight')).toBeVisible();
  expect(screen.getByLabelText('150 questions')).toBeVisible();
  expect(screen.getByText(/No timer or session has started/)).toBeVisible();
  expect(h.events).toEqual(['startMockExam']);
});
test('voluntary Menu authentication returns to Menu', async () => {
  const h = harness();
  const result = await h.render('/menu');
  fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));
  await waitFor(() => expect(result.getPathname()).toBe('/auth/sign-in'));
  await h.authenticate('alice');
  await waitFor(() => expect(result.getPathname()).toBe('/menu'));
  expect(await screen.findByRole('button', { name: 'Sign Out' })).toBeVisible();
});
test('authenticated relaunch still opens public Home', async () => {
  const h = harness({ initialAuth: { status: 'authenticated', user: authUser('alice') } });
  const result = await h.render('/');
  expect(await screen.findByText('Explore reviewers')).toBeVisible();
  expect(screen.queryByText('Sign in to continue')).toBeNull();
  expect(result.getPathname()).toBe('/');
});
test('Progress interception preserves prior tab after Maybe Later', async () => {
  const h = harness();
  const result = await h.render('/mock-exam');
  fireEvent.press(screen.getByRole('button', { name: /Progress, tab/ }));
  await screen.findByText('Sign in to continue');
  fireEvent.press(screen.getByRole('button', { name: 'Maybe Later' }));
  await waitFor(() => expect(result.getPathname()).toBe('/mock-exam'));
  expect(await screen.findByRole('button', { name: 'Start Mock Exam' })).toBeVisible();
});
test.each(['/profile', '/bookmarks', '/exam-history', '/progress'])(
  'protected deep link %s never flashes personal content',
  async (url) => {
    const h = harness();
    await h.render(url);
    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.queryByText(/development availability/)).toBeNull();
    expect(await screen.findByText('Sign in to continue')).toBeVisible();
  },
);
test('invalid taxonomy links show safe Not Found', async () => {
  const h = harness();
  const result = await h.render('/review/not-real/not-real');
  expect(await screen.findByText('Not Found')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(result.getPathname()).toBe('/review'));
});
test('rapid start taps resume exactly once', async () => {
  const h = harness();
  await h.render('/mock-exam');
  const button = screen.getByRole('button', { name: 'Start Mock Exam' });
  fireEvent.press(button);
  fireEvent.press(button);
  await screen.findByText('Sign in to continue');
  await h.authenticate('alice');
  expect(h.events).toEqual(['startMockExam']);
});
test('form switches retain the protected intent through password reset', async () => {
  const h = harness();
  const result = await h.render('/mock-exam');
  fireEvent.press(screen.getByRole('button', { name: 'Start Mock Exam' }));
  await screen.findByText('Sign in to continue');
  fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));
  await waitFor(() => expect(result.getPathname()).toBe('/auth/sign-in'));
  await act(async () => {
    h.dependencies.coordinator.chooseRegistration();
    await flushTransitions();
  });
  await waitFor(() => expect(result.getPathname()).toBe('/auth/register'));
  await act(async () => {
    h.dependencies.coordinator.choosePasswordReset();
    await flushTransitions();
  });
  await waitFor(() => expect(result.getPathname()).toBe('/auth/forgot-password'));
  await h.authenticate('alice');
  expect(await screen.findByText('Mock Exam preflight')).toBeVisible();
});

test.each(
  (['resolving', 'recoveryRequired'] as const).flatMap((status) =>
    ['/profile', '/progress', '/auth/sign-in', '/auth/register', '/auth/forgot-password'].map(
      (url) => ({ status, url }),
    ),
  ),
)('cold $url allows cancellation during $status without late replay', async ({ status, url }) => {
  const h = harness({
    initialAuth: status === 'resolving' ? { status } : { status, previousUid: null },
  });
  const result = await h.render(url);
  fireEvent.press(await screen.findByRole('button', { name: 'Back to public browsing' }));
  await waitFor(() => expect(result.getPathname()).toBe('/'));
  expect(h.dependencies.coordinator.getSnapshot()).toMatchObject({
    pendingIntent: null,
    origin: null,
    screen: 'none',
  });
  await h.authenticate('late-alice');
  expect(result.getPathname()).toBe('/');
  expect(h.events.filter((event) => !event.startsWith('return:'))).toEqual([]);
  expect(screen.getByRole('button', { name: 'Explore reviewers' })).toBeVisible();
});

test('unavailable cold Profile offers retry while preserving cancellation', async () => {
  const h = harness({ initialAuth: { status: 'recoveryRequired', previousUid: null } });
  const result = await h.render('/profile');
  const observations = jest.spyOn(h.auth, 'observe');
  fireEvent.press(await screen.findByRole('button', { name: 'Retry' }));
  await act(flushTransitions);
  expect(observations).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Back to public browsing' }));
  await waitFor(() => expect(result.getPathname()).toBe('/'));
  observations.mockRestore();
});

test.each(['resolving', 'recoveryRequired'] as const)(
  'Home exposes pending auth cancellation during %s and ignores late completion',
  async (status) => {
    const h = harness({
      initialAuth: status === 'resolving' ? { status } : { status, previousUid: null },
    });
    const result = await h.render('/');
    fireEvent.press(screen.getAllByRole('button', { name: 'Progress' })[0]!);
    await act(flushTransitions);
    expect(h.dependencies.coordinator.getSnapshot().pendingIntent?.action.type).toBe(
      'openProgress',
    );
    expect(screen.getByRole('button', { name: 'Explore reviewers' })).toBeVisible();
    const cancel = await screen.findByRole('button', { name: 'Cancel request' });
    expect(screen.getByRole('button', { name: 'Retry authentication' })).toBeEnabled();
    fireEvent.press(cancel);
    await act(flushTransitions);
    expect(h.dependencies.coordinator.getSnapshot()).toMatchObject({
      pendingIntent: null,
      origin: null,
    });
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
    await h.authenticate('late-alice');
    expect(result.getPathname()).toBe('/');
    expect(h.events.filter((event) => !event.startsWith('return:'))).toEqual([]);
    expect(screen.getByRole('button', { name: 'Explore reviewers' })).toBeVisible();
  },
);
