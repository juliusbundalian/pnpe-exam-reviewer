import { fireEvent, screen } from 'expo-router/testing-library';
import { createAppHarness } from '../fixtures/app-harness';

const harnesses: ReturnType<typeof createAppHarness>[] = [];
afterEach(() => {
  harnesses.splice(0).forEach((h) => h.dispose());
});

test('tab destinations retain icons, selected semantics and public navigation', async () => {
  const h = createAppHarness();
  harnesses.push(h);
  const result = await h.render('/');
  for (const name of ['index', 'review', 'mock-exam', 'progress', 'menu']) {
    expect(screen.getAllByTestId(`tab-icon-${name}`).length).toBeGreaterThan(0);
  }
  expect(screen.getByRole('button', { name: /Home, tab/, selected: true })).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: /Reviewers, tab/ }));
  expect(await screen.findByRole('header', { name: 'Reviewers' })).toBeVisible();
  expect(result.getPathname()).toBe('/review');
  fireEvent.press(screen.getByRole('button', { name: /Menu, tab/ }));
  expect(await screen.findByRole('header', { name: 'Menu' })).toBeVisible();
  expect(result.getPathname()).toBe('/menu');
});
