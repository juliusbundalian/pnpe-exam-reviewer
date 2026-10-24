import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { QuestionReadingView } from '../../src/features/content/presentation/QuestionReadingView';
import { ExamRunnerScreen } from '../../src/features/exam/presentation/ExamRunnerScreen';
import { ExamSubmittedReviewScreen } from '../../src/features/exam/presentation/ExamSubmittedReviewScreen';
import { studyQuestion } from '../fixtures/study';
import { examResult } from '../fixtures/exam';
import type { ExamAttempt } from '../../src/features/exam/domain/exam';

test('Reviewer displays the category in a question card and each choice beside its number', () => {
  render(
    <ThemeProvider>
      <QuestionReadingView question={studyQuestion()} onReady={() => {}} onError={() => {}} />
    </ThemeProvider>,
  );

  expect(screen.getByTestId('question-card')).toHaveTextContent(/Communication Skills/);
  expect(screen.getByTestId('question-card')).toHaveTextContent(/😀 Café is open\./);
  expect(screen.getByTestId('choice-card-1')).toHaveStyle({ flexDirection: 'row' });
  expect(screen.getByTestId('choice-card-1')).toHaveTextContent(/Choice 1/);
  expect(screen.getByTestId('choice-card-1')).toHaveTextContent(/20/);
});

test('live exam choices are whole cards with horizontal numbers and the question category', () => {
  const result = examResult();
  const attempt: ExamAttempt = {
    id: result.attemptId,
    uid: result.uid,
    deviceId: 'device',
    generation: result.generation,
    config: result.config,
    startedAt: result.startedAt,
    deadlineAt: result.deadlineAt,
    lastEffectiveAt: result.startedAt,
    position: 0,
    status: 'active',
    questions: result.questions,
  };
  render(
    <ThemeProvider>
      <ExamRunnerScreen
        attempt={attempt}
        remainingMs={60_000}
        busy={false}
        error={null}
        bookmarked={false}
        bookmarksEnabled
        onAnswer={() => {}}
        onFlag={() => {}}
        onMove={() => {}}
        onBookmark={() => {}}
        onRetry={() => {}}
        onSubmit={() => {}}
        onLeave={() => {}}
      />
    </ThemeProvider>,
  );

  expect(screen.getByTestId('question-card')).toHaveTextContent(/General Information/);
  expect(screen.getByTestId('choice-card-1')).toHaveStyle({ flexDirection: 'row' });
  expect(screen.getByTestId('choice-card-1')).toHaveTextContent(/Choice 1/);
  expect(screen.getByTestId('choice-card-1')).toHaveTextContent(/20/);
});

test('submitted review keeps the answer indicators inside horizontal choice cards', () => {
  render(
    <ThemeProvider>
      <ExamSubmittedReviewScreen result={examResult()} onBack={() => {}} />
    </ThemeProvider>,
  );

  expect(screen.getByTestId('question-card')).toHaveTextContent(/General Information/);
  expect(screen.getByTestId('choice-card-2')).toHaveStyle({ flexDirection: 'row' });
  expect(screen.getByTestId('choice-card-2')).toHaveTextContent(/Choice 2/);
  expect(screen.getByTestId('choice-card-2')).toHaveTextContent(/Correct/);
});
