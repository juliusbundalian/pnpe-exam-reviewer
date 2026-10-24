import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { ExamRunnerScreen } from '../../src/features/exam/presentation/ExamRunnerScreen';
import type { ExamAttempt } from '../../src/features/exam/domain/exam';
import { examResult } from '../fixtures/exam';

function attempt(position = 0, answered = false): ExamAttempt {
  const result = examResult();
  return {
    id: result.attemptId,
    uid: result.uid,
    deviceId: 'device-one',
    generation: result.generation,
    config: result.config,
    startedAt: result.startedAt,
    deadlineAt: result.deadlineAt,
    lastEffectiveAt: result.startedAt,
    status: 'active',
    position,
    questions: result.questions.map((item) => ({
      ...item,
      selectedChoiceId: answered ? item.choiceOrder[0]! : null,
    })),
  };
}
function runner(value = attempt(), busy = false) {
  const callbacks = {
    onAnswer: jest.fn(),
    onFlag: jest.fn(),
    onMove: jest.fn(),
    onBookmark: jest.fn(),
    onRetry: jest.fn(),
    onSubmit: jest.fn(),
    onLeave: jest.fn(),
  };
  render(
    <ThemeProvider>
      <ExamRunnerScreen
        attempt={value}
        remainingMs={120_000}
        busy={busy}
        error={null}
        bookmarked={false}
        bookmarksEnabled
        {...callbacks}
      />
    </ThemeProvider>,
  );
  return callbacks;
}

test('question navigation and app bar are outside the question scroll area', () => {
  const { onMove } = runner();
  const body = screen.getByTestId('exam-question-scroll');
  expect(within(body).queryByRole('button', { name: 'Next' })).toBeNull();
  expect(within(body).queryByRole('button', { name: 'Previous' })).toBeNull();
  expect(within(body).queryByRole('button', { name: 'Leave exam' })).toBeNull();
  expect(screen.getByRole('header', { name: 'Question 1 of 150' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(onMove).toHaveBeenCalledWith(1);
});

test.each([
  [0, false, false],
  [149, false, true],
  [0, true, true],
  [75, true, true],
] as const)(
  'submit visibility at position=%s, allAnswered=%s is %s',
  (position, answered, visible) => {
    runner(attempt(position, answered));
    expect(!!screen.queryByRole('button', { name: 'Submit Exam' })).toBe(visible);
  },
);

test('navigator opens a modal sheet and selecting a question closes it', () => {
  const { onMove } = runner();
  fireEvent.press(screen.getByRole('button', { name: 'Navigator' }));
  expect(screen.getByRole('header', { name: 'Question navigator' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Close navigator' })).toBeVisible();
  fireEvent.press(screen.getByLabelText('Question 150, unanswered'));
  expect(onMove).toHaveBeenCalledWith(149);
  expect(screen.queryByRole('header', { name: 'Question navigator' })).toBeNull();
});

test('icon actions retain their accessible names and leave confirmation', () => {
  const { onFlag, onBookmark, onLeave } = runner();
  fireEvent.press(screen.getByRole('button', { name: 'Flag question' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save question' }));
  expect(onFlag).toHaveBeenCalledTimes(1);
  expect(onBookmark).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Leave exam' }));
  expect(onLeave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Leave and Resume Later' }));
  expect(onLeave).toHaveBeenCalledTimes(1);
});

test('busy state prevents question navigation and submission', () => {
  runner(attempt(149), true);
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Submit Exam' })).toBeDisabled();
});
