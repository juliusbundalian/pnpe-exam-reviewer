import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { createAppHarness } from '../fixtures/app-harness';
import { authUser, deferred, flushTransitions } from '../fixtures/auth-harness';
import { studyNavigationFactory } from '../fixtures/study-navigation';
import { examResult } from '../fixtures/exam';
import type { ExamAttempt } from '../../src/features/exam/domain/exam';
import type { ExamChange } from '../../src/features/exam/domain/exam';
import { defaults } from '../../src/core/config/defaults';

const harnesses: ReturnType<typeof createAppHarness>[] = [];
afterEach(async () => {
  await act(async () => harnesses.splice(0).forEach((h) => h.dispose()));
});

function prepared(
  options: { guest?: boolean; existing?: boolean; maintenance?: boolean; bookmarks?: boolean } = {},
) {
  const factory = studyNavigationFactory();
  const result = examResult();
  let saved: ExamAttempt = {
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
  let active = options.existing ?? false;
  let remaining = result.deadlineAt - result.startedAt;
  let failChange = false;
  const wait = deferred<void>();
  let delayStart = false;
  const config = structuredClone(defaults);
  if (options.maintenance) config.app_info.maintenanceMode = true;
  if (options.bookmarks === false) config.config.features.bookmarks = false;
  const h = createAppHarness({
    ...(options.guest ? {} : { initialAuth: { status: 'authenticated', user: authUser('alice') } }),
    config,
    study: async (source) => {
      const study = await factory.factory(source);
      Object.assign(study.examRepository, {
        active: async () => (active ? saved : null),
        result: async () => (active ? null : result),
      });
      Object.assign(study.exam, {
        start: jest.fn(async () => {
          if (delayStart) await wait.promise;
          active = true;
          return saved;
        }),
        resume: jest.fn(async () => saved),
        remaining: jest.fn(async () => remaining),
        change: jest.fn(async (_owner: unknown, _id: string, change: ExamChange) => {
          if (failChange) {
            failChange = false;
            throw new Error('disk failed');
          }
          if (change.type === 'move') saved = { ...saved, position: change.ordinal };
          else {
            const questions = [...saved.questions];
            const old = questions[change.ordinal]!;
            questions[change.ordinal] =
              change.type === 'answer'
                ? { ...old, selectedChoiceId: change.choiceId }
                : { ...old, flagged: change.flagged };
            saved = { ...saved, questions };
          }
          return saved;
        }),
        submit: jest.fn(async () => {
          active = false;
          return result;
        }),
      });
      return study;
    },
  });
  harnesses.push(h);
  return {
    h,
    factory,
    config,
    result,
    get saved() {
      return saved;
    },
    delayStart() {
      delayStart = true;
    },
    releaseStart() {
      wait.resolve();
    },
    expire() {
      remaining = 0;
    },
    failNextChange() {
      failChange = true;
    },
  };
}

test('guest Start authenticates to preflight without starting the clock', async () => {
  const fixture = prepared({ guest: true });
  await fixture.h.render('/mock-exam');
  fireEvent.press(screen.getByRole('button', { name: 'Start Mock Exam' }));
  await screen.findByText('Sign in to continue');
  await fixture.h.authenticate('alice');
  expect(await screen.findByRole('button', { name: 'Start Exam' })).toBeVisible();
  expect(screen.queryByText('Question 1 of 150')).toBeNull();
});

test('preflight waits for durable start, then answer, clear, flag and navigation persist without feedback', async () => {
  const fixture = prepared();
  fixture.delayStart();
  await fixture.h.render('/mock-exam?stage=preflight');
  fireEvent.press(await screen.findByRole('button', { name: 'Start Exam' }));
  expect(screen.queryByText('Question 1 of 150')).toBeNull();
  await act(async () => fixture.releaseStart());
  expect(await screen.findByText('Question 1 of 150')).toBeVisible();
  expect(screen.queryByText('Correct answer')).toBeNull();
  expect(screen.queryByText('Explanation')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Choice 1' }));
  await waitFor(() => expect(fixture.saved.questions[0]?.selectedChoiceId).toBe('c1'));
  fireEvent.press(screen.getByRole('button', { name: 'Clear answer' }));
  await waitFor(() => expect(fixture.saved.questions[0]?.selectedChoiceId).toBeNull());
  fireEvent.press(screen.getByRole('button', { name: 'Flag question' }));
  await waitFor(() => expect(fixture.saved.questions[0]?.flagged).toBe(true));
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText('Question 2 of 150')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Navigator' }));
  expect(screen.getByLabelText(/Question 1.*flagged/)).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Expanded list' }));
  expect(screen.getByText(/Question 1.*flagged/)).toBeVisible();
});

test('maintenance blocks a new start but keeps a saved attempt resumable', async () => {
  const fresh = prepared({ maintenance: true });
  await fresh.h.render('/mock-exam?stage=preflight');
  expect(await screen.findByRole('button', { name: 'Start Exam' })).toBeDisabled();
  await act(async () => fresh.h.dispose());
  const saved = prepared({ maintenance: true, existing: true });
  await saved.h.render('/mock-exam?stage=preflight');
  fireEvent.press(await screen.findByRole('button', { name: 'Resume Exam' }));
  expect(await screen.findByText('Question 1 of 150')).toBeVisible();
});

test('maintenance overview still permits entry to a saved attempt', async () => {
  const fixture = prepared({ maintenance: true, existing: true });
  await fixture.h.render('/mock-exam');
  fireEvent.press(screen.getByRole('button', { name: 'Start Mock Exam' }));
  expect(await screen.findByRole('button', { name: 'Resume Exam' })).toBeVisible();
});

test('foreground expiry finalizes and offers the durable result', async () => {
  const fixture = prepared({ existing: true });
  await fixture.h.render('/mock-exam?stage=preflight');
  fireEvent.press(await screen.findByRole('button', { name: 'Resume Exam' }));
  await screen.findByText('Question 1 of 150');
  fixture.expire();
  await act(async () => {
    jest.advanceTimersByTime(1_000);
    await flushTransitions();
  });
  expect(await screen.findByRole('button', { name: 'View Results' })).toBeVisible();
});

test('bookmark saves a reference and its live feature flag disables mutation', async () => {
  const fixture = prepared({ existing: true });
  await fixture.h.render('/mock-exam?stage=preflight');
  fireEvent.press(await screen.findByRole('button', { name: 'Resume Exam' }));
  await screen.findByText('Question 1 of 150');
  fireEvent.press(screen.getByRole('button', { name: 'Save question' }));
  expect(await screen.findByRole('button', { name: 'Remove bookmark' })).toBeVisible();
  expect((await fixture.factory.study.bookmarks.list(fixture.factory.study.owner)).length).toBe(1);
  fixture.config.config.features.bookmarks = false;
  await act(async () => fixture.h.dependencies.config.refresh());
  expect(screen.getByRole('button', { name: 'Remove bookmark' })).toBeDisabled();
  expect(screen.queryByText('Correct answer')).toBeNull();
});

test('leaving warns that time continues and manual submit confirms unanswered count', async () => {
  const fixture = prepared({ existing: true });
  await fixture.h.render('/mock-exam?stage=preflight');
  fireEvent.press(await screen.findByRole('button', { name: 'Resume Exam' }));
  await screen.findByText('Question 1 of 150');
  fireEvent.press(screen.getByRole('button', { name: 'Leave exam' }));
  expect(screen.getByText('The clock continues while you are away.')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
  fireEvent.press(screen.getByRole('button', { name: 'Submit Exam' }));
  expect(screen.getByText('150 unanswered questions. Submitting ends this attempt.')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Submit Anyway' }));
  expect(await screen.findByRole('button', { name: 'View Results' })).toBeVisible();
});

test('failed answer never claims Saved and Retry commits the same choice', async () => {
  const fixture = prepared({ existing: true });
  await fixture.h.render('/mock-exam?stage=preflight');
  fireEvent.press(await screen.findByRole('button', { name: 'Resume Exam' }));
  await screen.findByText('Question 1 of 150');
  fixture.failNextChange();
  fireEvent.press(screen.getByRole('button', { name: 'Choice 1' }));
  expect(await screen.findByRole('button', { name: 'Retry save' })).toBeVisible();
  expect(screen.queryByText('Saved')).toBeNull();
  expect(fixture.saved.questions[0]?.selectedChoiceId).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Retry save' }));
  await waitFor(() => expect(fixture.saved.questions[0]?.selectedChoiceId).toBe('c1'));
  expect(screen.getByText('Saved')).toBeVisible();
});
