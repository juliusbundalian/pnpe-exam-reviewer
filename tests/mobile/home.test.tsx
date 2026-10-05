import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { HomeScreen } from '../../src/features/home/presentation/HomeScreen';
import { KeyboardAvoidingView, ScrollView } from 'react-native';

test('guest Home offers content, not a login wall or invented statistics', () => {
  const action = jest.fn();
  render(
    <ThemeProvider>
      <HomeScreen onExplore={action} onMockExam={action} onProgress={action} onBookmarks={action} />
    </ThemeProvider>,
  );
  expect(screen.getByText('Explore reviewers')).toBeVisible();
  expect(screen.queryByText('Sign in to continue')).toBeNull();
  expect(screen.queryByText('Overall accuracy')).toBeNull();
});

test.each(['light', 'dark'] as const)(
  'Home keeps scalable text in keyboard-safe scrolling in %s',
  (appearance) => {
    const action = jest.fn();
    const tree = render(
      <ThemeProvider initialAppearance={appearance}>
        <HomeScreen
          displayName={'Learner '.repeat(30)}
          onExplore={action}
          onMockExam={action}
          onProgress={action}
          onBookmarks={action}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText('Build confidence. One question at a time.')).toHaveProp(
      'allowFontScaling',
      true,
    );
    expect(
      screen.getByText('Build confidence. One question at a time.').props.numberOfLines,
    ).toBeUndefined();
    expect(tree.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    expect(tree.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
    expect(screen.getByRole('button', { name: 'Start Mock Exam' })).toBeVisible();
  },
);

test('Home invitation renders injected exam configuration', () => {
  const action = jest.fn();
  render(
    <ThemeProvider>
      <HomeScreen
        model={{ mockExam: { questionCount: 100, durationMinutes: 120 } }}
        onExplore={action}
        onMockExam={action}
        onProgress={action}
        onBookmarks={action}
      />
    </ThemeProvider>,
  );
  expect(screen.getByText('100 questions · 120 minutes · All four areas')).toBeVisible();
});

test('Home dispatches independent actions and keeps a long name and coverage reachable', () => {
  const onExplore = jest.fn();
  const onMockExam = jest.fn();
  const onProgress = jest.fn();
  const onBookmarks = jest.fn();
  const displayName = 'A very long learner name that should wrap across multiple lines';
  render(
    <ThemeProvider initialAppearance="dark">
      <HomeScreen
        displayName={displayName}
        onExplore={onExplore}
        onMockExam={onMockExam}
        onProgress={onProgress}
        onBookmarks={onBookmarks}
      />
    </ThemeProvider>,
  );
  expect(screen.getByText(`Welcome, ${displayName}`)).toBeVisible();
  for (const label of [
    'General Information',
    'Communication Skills',
    'Quantitative Reasoning',
    'Critical Thinking',
  ]) {
    expect(screen.getByText(label)).toBeVisible();
  }
  fireEvent.press(screen.getByRole('button', { name: 'Explore reviewers' }));
  fireEvent.press(screen.getByRole('button', { name: 'Mock Exam' }));
  fireEvent.press(screen.getByRole('button', { name: 'Progress' }));
  fireEvent.press(screen.getByRole('button', { name: 'Saved Questions' }));
  expect(onExplore).toHaveBeenCalledTimes(1);
  expect(onMockExam).toHaveBeenCalledTimes(1);
  expect(onProgress).toHaveBeenCalledTimes(1);
  expect(onBookmarks).toHaveBeenCalledTimes(1);
  expect(screen.getByText('150 questions · 180 minutes · All four areas')).toBeVisible();
});
