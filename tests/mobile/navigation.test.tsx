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
  expect(screen.getByText('150 questions')).toBeVisible();
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
