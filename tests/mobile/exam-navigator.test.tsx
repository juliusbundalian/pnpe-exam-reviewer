import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { ExamNavigator } from '../../src/features/exam/presentation/ExamNavigator';
import type { ExamAttempt } from '../../src/features/exam/domain/exam';
import { examResult } from '../fixtures/exam';

function fixture(): ExamAttempt {
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
    position: 2,
    questions: result.questions.slice(0, 4).map((item, index) => ({
      ...item,
      selectedChoiceId: index === 0 ? item.choiceOrder[0]! : null,
      flagged: index === 1,
    })),
  };
}

test.each(['compact', 'expanded'] as const)('navigator explains real states in %s mode', (mode) => {
  const onSelect = jest.fn();
  render(
    <ThemeProvider>
      <ExamNavigator
        attempt={fixture()}
        visitedQuestions={new Set([0, 1, 2])}
        mode={mode}
        onMode={jest.fn()}
        onSelect={onSelect}
      />
    </ThemeProvider>,
  );
  expect(screen.getByText('Question states')).toBeVisible();
  for (const label of ['Unanswered', 'Answered', 'Skipped', 'Current'])
    expect(screen.getByText(label)).toBeVisible();
  expect(screen.getByLabelText('Question 1, answered')).toBeVisible();
  expect(screen.getByLabelText('Question 2, skipped, flagged')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Question 3, current, unanswered', selected: true }),
  ).toBeVisible();
  fireEvent.press(screen.getByLabelText('Question 4, unanswered'));
  expect(onSelect).toHaveBeenCalledWith(3);
});

test('cleared answers become skipped only if the question was visited and left', () => {
  const value = fixture();
  render(
    <ThemeProvider>
      <ExamNavigator
        attempt={{
          ...value,
          position: 3,
          questions: value.questions.map((item) => ({ ...item, selectedChoiceId: null })),
        }}
        visitedQuestions={new Set([0, 3])}
        mode="compact"
        onMode={jest.fn()}
        onSelect={jest.fn()}
      />
    </ThemeProvider>,
  );
  expect(screen.getByLabelText('Question 1, skipped')).toBeVisible();
  expect(screen.getByLabelText('Question 2, unanswered, flagged')).toBeVisible();
  expect(screen.getByLabelText('Question 4, current, unanswered')).toBeVisible();
});
