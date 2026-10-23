import { createRef } from 'react';
import { View } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { MockExamScreen } from '../../src/features/mock-exam/presentation/MockExamScreen';
import { defaults } from '../../src/core/config/defaults';

function renderExam({ preflight = false, blocked = null as string | null, dark = false } = {}) {
  const onStart = jest.fn();
  const onBack = jest.fn();
  const exam = {
    ...defaults.config.mockExam,
    questionCount: 100,
    durationMinutes: 90,
    passingPercentage: 80,
    distribution: {
      generalInformation: 20,
      communicationSkills: 30,
      quantitativeReasoning: 10,
      criticalThinking: 40,
    },
  };
  render(
    <ThemeProvider initialAppearance={dark ? 'dark' : 'light'}>
      <MockExamScreen
        exam={exam}
        preflight={preflight}
        blocked={blocked}
        startTarget={createRef<View>()}
        onStart={onStart}
        onBack={onBack}
      />
    </ThemeProvider>,
  );
  return { onStart, onBack };
}

test.each([false, true])(
  'configured exam briefing and start remain accessible in dark=%s',
  (dark) => {
    const { onStart } = renderExam({ dark });
    expect(screen.getByRole('header', { name: 'Mock Exam' })).toBeVisible();
    expect(screen.getByLabelText('100 questions')).toBeVisible();
    expect(screen.getByLabelText('90 minutes')).toBeVisible();
    expect(screen.getByText('80% practice threshold')).toBeVisible();
    expect(screen.getByLabelText(/General Information: 20 questions/)).toBeVisible();
    expect(screen.getByLabelText(/Critical Thinking: 40 questions/)).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Start Mock Exam' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  },
);

test('availability block explains why starting is disabled', () => {
  const { onStart } = renderExam({ blocked: 'Maintenance in progress. Please try again later.' });
  expect(screen.getByRole('alert')).toHaveTextContent(/Maintenance in progress/);
  const start = screen.getByRole('button', { name: 'Start Mock Exam' });
  expect(start).toBeDisabled();
  fireEvent.press(start);
  expect(onStart).not.toHaveBeenCalled();
});

test('preflight states the development boundary and returns without starting', () => {
  const { onStart, onBack } = renderExam({ preflight: true });
  expect(screen.getByText(/No timer or session has started/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Start Mock Exam' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onStart).not.toHaveBeenCalled();
});
