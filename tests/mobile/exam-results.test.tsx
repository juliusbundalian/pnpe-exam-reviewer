import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { createAppHarness } from '../fixtures/app-harness';
import { authUser } from '../fixtures/auth-harness';
import { studyNavigationFactory } from '../fixtures/study-navigation';
import { examResult } from '../fixtures/exam';
import { defaults } from '../../src/core/config/defaults';
import type { ExamAttempt } from '../../src/features/exam/domain/exam';

const harnesses: ReturnType<typeof createAppHarness>[] = [];
afterEach(async () => {
  await act(async () => harnesses.splice(0).forEach((h) => h.dispose()));
});

function prepared(
  options: {
    offline?: boolean;
    delayedRemote?: boolean;
    historyEnabled?: boolean;
    completed?: boolean;
    active?: boolean;
  } = {},
) {
  const factory = studyNavigationFactory();
  const base = examResult();
  const result = {
    ...base,
    overall: {
      total: 150,
      correct: 112,
      incorrect: 1,
      unanswered: 37,
      percentage: (112 * 100) / 150,
      passed: false,
    },
  };
  const activeAttempt: ExamAttempt = {
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
  const config = structuredClone(defaults);
  if (options.historyEnabled === false) config.config.features.examHistory = false;
  const h = createAppHarness({
    initialAuth: { status: 'authenticated', user: authUser('alice') },
    config,
    study: async (source) => {
      const study = await factory.factory(source);
      Object.assign(study.examRepository, {
        active: async () => (options.active ? activeAttempt : null),
        result: async () => result,
        history: async () => (options.completed === false ? [] : [result]),
      });
      Object.assign(study, {
        examRemote: {
          publish: async () => {},
          history: async () => {
            if (options.offline) throw new Error('network');
            if (options.delayedRemote) return new Promise<never>(() => {});
            return options.completed === false ? [] : [result];
          },
          result: async () => result,
        },
      });
      return study;
    },
  });
  harnesses.push(h);
  return { h, result };
}

test('local result shows exact score, threshold outcome and submitted frozen review', async () => {
  const fixture = prepared();
  await fixture.h.render('/mock-exam?stage=result&attemptId=exam-fixture');
  expect(await screen.findByText('112 correct')).toBeVisible();
  expect(screen.getByText('37 unanswered')).toBeVisible();
  expect(screen.getByText('Practice threshold not met')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Review submitted answers' }));
  expect(await screen.findByText('Correct answer')).toBeVisible();
  expect(screen.getByText('What is 15% of 200?')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Back to Results' }));
  expect(await screen.findByText('112 correct')).toBeVisible();
});

test('history merges local and cloud attempt once and remains readable offline', async () => {
  const fixture = prepared({ offline: true });
  await fixture.h.render('/exam-history');
  expect(await screen.findByText(/Attempt.*74\.67%/)).toBeVisible();
  expect(screen.getAllByText(/Attempt.*74\.67%/)).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: /Open attempt/ }));
  expect(await screen.findByText('112 correct')).toBeVisible();
});

test('local history appears while a cloud request remains pending', async () => {
  const fixture = prepared({ delayedRemote: true });
  await fixture.h.render('/exam-history');
  expect(await screen.findByText(/Attempt.*74\.67%/)).toBeVisible();
});

test('progress counts completed exams separately from Reviewer views', async () => {
  const fixture = prepared();
  await fixture.h.render('/progress');
  expect(await screen.findByLabelText('Completed mock exams: 1')).toBeVisible();
  expect(screen.getByLabelText('Average exam score: 74.67%')).toBeVisible();
  expect(screen.getByText('No saved Reviewer session.')).toBeVisible();
});

test('active attempt is a Resume entry and empty exam statistics are unavailable', async () => {
  const fixture = prepared({ completed: false, active: true });
  await fixture.h.render('/exam-history');
  expect(await screen.findByRole('button', { name: 'Resume active exam' })).toBeVisible();
  expect(screen.getByText('No completed mock exams yet.')).toBeVisible();
});

test('no completed exams shows unavailable averages instead of zero', async () => {
  const fixture = prepared({ completed: false, active: true });
  await fixture.h.render('/progress');
  expect(await screen.findByLabelText('Completed mock exams: 0')).toBeVisible();
  expect(screen.getByLabelText('Average exam score: Unavailable')).toBeVisible();
  expect(screen.getByLabelText('Highest exam score: Unavailable')).toBeVisible();
});

test('disabled history hides its menu entry', async () => {
  const fixture = prepared({ historyEnabled: false });
  await fixture.h.render('/menu');
  expect(screen.queryByRole('button', { name: 'Exam History' })).toBeNull();
});

test('disabled history leaves a direct owner result available', async () => {
  const fixture = prepared({ historyEnabled: false });
  await fixture.h.render('/mock-exam?stage=result&attemptId=exam-fixture');
  expect(await screen.findByText('112 correct')).toBeVisible();
});

test('account switch clears visible prior-owner result', async () => {
  const fixture = prepared();
  await fixture.h.render('/mock-exam?stage=result&attemptId=exam-fixture');
  await screen.findByText('112 correct');
  await fixture.h.authenticate('bob');
  await waitFor(() => expect(screen.queryByText('112 correct')).toBeNull());
});
