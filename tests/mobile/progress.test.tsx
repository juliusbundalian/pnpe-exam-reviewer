import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { ProgressScreen } from '../../src/features/reviewer/presentation/ProgressScreen';
import { studySession } from '../fixtures/study';

test('progress reports actual viewed membership and resumes the saved session', () => {
  const session = studySession({ position: 1, viewedOrdinals: [0] });
  const resume = jest.fn();
  render(
    <ThemeProvider>
      <ProgressScreen session={session} onResume={resume} onBack={() => undefined} />
    </ThemeProvider>,
  );
  expect(screen.getByText('Viewed 1 of 2')).toBeTruthy();
  expect(screen.getByText(/reading activity/)).toBeTruthy();
  expect(screen.getByText('Resume at item 2 of 2')).toBeTruthy();
  expect(screen.queryByText(/score|accuracy|mastery/i)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
  expect(resume).toHaveBeenCalledWith(session);
});
test('completed saved work is still resumable and unknown last check stays honest', () => {
  render(
    <ThemeProvider>
      <ProgressScreen
        session={studySession({ status: 'completed', viewedOrdinals: [0, 1] })}
        onResume={() => undefined}
        onBack={() => undefined}
      />
    </ThemeProvider>,
  );
  expect(screen.getByText('Viewed 2 of 2')).toBeTruthy();
  expect(screen.getByText('Content last checked: unknown')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
});
test('no active work does not fabricate progress or Resume', () => {
  render(
    <ThemeProvider>
      <ProgressScreen session={null} onResume={() => undefined} onBack={() => undefined} />
    </ThemeProvider>,
  );
  expect(screen.getByText('No saved Reviewer session.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
});

test('known validation date displays the frozen check and archived work is excluded', () => {
  const view = render(
    <ThemeProvider>
      <ProgressScreen
        session={studySession({ catalogValidatedAt: Date.parse('2024-01-01T00:00:00Z') })}
        onResume={() => undefined}
        onBack={() => undefined}
      />
    </ThemeProvider>,
  );
  expect(screen.getByText('Content last checked: 2024-01-01 (UTC)')).toBeTruthy();
  view.rerender(
    <ThemeProvider>
      <ProgressScreen
        session={studySession({ status: 'archived' })}
        onResume={() => undefined}
        onBack={() => undefined}
      />
    </ThemeProvider>,
  );
  expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
});
