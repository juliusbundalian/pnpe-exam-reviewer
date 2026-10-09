import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { createAppHarness } from '../fixtures/app-harness';
import { authUser, deferred, flushTransitions } from '../fixtures/auth-harness';
import { defaults } from '../../src/core/config/defaults';
import type { StudyDependencies } from '../../src/bootstrap/studyComposition';

const harnesses: ReturnType<typeof createAppHarness>[] = [];
afterEach(() => harnesses.splice(0).forEach((h) => h.dispose()));
function harness(options: Parameters<typeof createAppHarness>[0] = {}) {
  const h = createAppHarness(options);
  harnesses.push(h);
  return h;
}

test('guest Home and overview never start lazy study storage', async () => {
  const load = jest.fn(() => new Promise<StudyDependencies>(() => {}));
  const h = harness({ study: load });
  await h.render('/');
  fireEvent.press(screen.getByRole('button', { name: 'Explore reviewers' }));
  expect(await screen.findByRole('button', { name: 'General Information' })).toBeVisible();
  expect(load).not.toHaveBeenCalled();
});
test('authenticated personal entry reports lazy storage recovery with retry', async () => {
  const h = harness({
    initialAuth: { status: 'authenticated', user: authUser('alice') },
    study: async () => {
      throw new Error('private native detail');
    },
  });
  await h.render('/progress');
  expect(
    await screen.findByText('Your study data could not be saved. Please try again.'),
  ).toBeVisible();
  expect(screen.queryByText('private native detail')).toBeNull();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
});
test('owner observation invalidates pending lazy dependency construction before account return', async () => {
  const pending = deferred<StudyDependencies>();
  const h = harness({
    initialAuth: { status: 'authenticated', user: authUser('alice') },
    study: () => pending.promise,
  });
  const promise = h.dependencies.study();
  const rejected = expect(promise).rejects.toMatchObject({ code: 'auth-required' });
  await h.emit({ status: 'guest' });
  const dispose = jest.fn();
  pending.resolve({ dispose } as unknown as StudyDependencies);
  await rejected;
  expect(dispose).toHaveBeenCalledTimes(1);
});

import { studyNavigationFactory } from '../fixtures/study-navigation';
import { studyBookmark, studySession } from '../fixtures/study';
import { AppState, Text } from 'react-native';
function prepared(options: { config?: typeof defaults; guest?: boolean } = {}) {
  const factory = studyNavigationFactory();
  const h = harness({
    study: factory.factory,
    ...(options.guest
      ? {}
      : { initialAuth: { status: 'authenticated' as const, user: authUser('alice') } }),
    ...(options.config ? { config: options.config } : {}),
  });
  return { h, factory };
}
async function seed(
  h: ReturnType<typeof createAppHarness>,
  factory: ReturnType<typeof studyNavigationFactory>,
) {
  const study = await h.dependencies.study();
  await study.repository.replaceActive(
    study.owner,
    studySession({ id: 'device_saved', uid: study.owner.uid, deviceId: study.owner.deviceId }),
  );
  return factory.study;
}
test('guest start returns to actual readable Reviewer and full layout completion retains answer', async () => {
  const { h, factory } = prepared({ guest: true });
  await h.render('/review/communicationSkills');
  fireEvent.press(screen.getByRole('button', { name: 'Start Reviewer' }));
  await screen.findByText('Sign in to continue');
  await h.authenticate('alice');
  await screen.findByText('Correct answer');
  expect(h.events).toEqual(['startReviewer']);
  await act(async () => {
    screen.UNSAFE_getAllByType(Text).forEach((node) => {
      if (node.props.onLayout)
        fireEvent(node, 'layout', {
          nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 20 } },
        });
    });
    await flushTransitions();
  });
  // Router focus is represented by the actual controller visibility path.
  await act(async () => factory.study.controller.setVisibility(true, true));
  await waitFor(() => expect(screen.getByText('Viewed 1 of 2')).toBeVisible());
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Item 2 of 2');
  await act(async () => {
    screen.UNSAFE_getAllByType(Text).forEach((node) => {
      if (node.props.onLayout)
        fireEvent(node, 'layout', {
          nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 20 } },
        });
    });
    await flushTransitions();
  });
  expect(await screen.findByText('All 2 items viewed')).toBeVisible();
  expect(screen.getByText('Correct answer')).toBeVisible();
});
test('same scope Start again requires confirmation and cancellation preserves frozen session', async () => {
  const { h, factory } = prepared();
  await seed(h, factory);
  await h.render('/review/communicationSkills?stage=availability');
  fireEvent.press(await screen.findByRole('button', { name: 'Start again' }));
  await screen.findByText('Replace saved Reviewer?');
  fireEvent.press(screen.getByRole('button', { name: 'Keep saved session' }));
  expect((await factory.study.repository.active(factory.study.owner))?.id).toBe('device_saved');
  fireEvent.press(screen.getByRole('button', { name: 'Start again' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Confirm replacement' }));
  await screen.findByText('Correct answer');
  expect((await factory.study.repository.active(factory.study.owner))?.id).not.toBe('device_saved');
});
test('different scope offers existing resume without replacing work', async () => {
  const { h, factory } = prepared();
  await seed(h, factory);
  await h.render('/review/criticalThinking?stage=availability');
  expect(await screen.findByRole('button', { name: 'Replace' })).toBeEnabled();
  fireEvent.press(screen.getByRole('button', { name: 'Resume existing' }));
  await screen.findByText('Correct answer');
  expect((await factory.study.repository.active(factory.study.owner))?.id).toBe('device_saved');
});
test.each(['maintenance', 'minimumVersion'] as const)(
  '%s blocks new sessions but saved progress resumes even when feature disabled',
  async (gate) => {
    const config = structuredClone(defaults);
    config.config.features.progress = false;
    if (gate === 'maintenance') config.app_info.maintenanceMode = true;
    else config.app_info.minimumSupportedVersion = '99.0.0';
    const { h, factory } = prepared({ config });
    await seed(h, factory);
    await h.render('/progress');
    fireEvent.press(await screen.findByRole('button', { name: 'Resume' }));
    await screen.findByText('Correct answer');
    expect((await factory.study.repository.active(factory.study.owner))?.id).toBe('device_saved');
  },
);
test('bounded catalog churn offers deliberate complete-cache choice', async () => {
  const { h, factory } = prepared();
  factory.conflict(true);
  await h.render('/review/communicationSkills?stage=availability');
  fireEvent.press(await screen.findByRole('button', { name: 'Use last complete cached catalog' }));
  await screen.findByText('Correct answer');
  expect(screen.getByText('Content last checked: 1970-01-01 (UTC)')).toBeVisible();
});
test('session deep link validates repository owner and ignores route UID', async () => {
  const { h } = prepared();
  await h.render('/review?stage=session&sessionId=other-session&uid=bob');
  expect(
    await screen.findByText('This question could not be loaded. Please try again.'),
  ).toBeVisible();
  expect(screen.queryByText('Correct answer')).toBeNull();
});
test('account switch during question loading cannot publish previous owner content', async () => {
  const { h, factory } = prepared();
  await seed(h, factory);
  const pending = deferred<void>();
  factory.delay(pending.promise);
  await h.render('/review?stage=session&sessionId=device_saved');
  await h.authenticate('bob');
  await act(async () => {
    pending.resolve();
    await flushTransitions();
  });
  expect(screen.queryByText('Correct answer')).toBeNull();
});
test('disabled bookmarks retain reads and gate Reviewer action and service mutations live', async () => {
  const config = structuredClone(defaults);
  const { h, factory } = prepared({ config });
  const study = await seed(h, factory);
  await study.repository.setBookmark(study.owner, studyBookmark().entry, false);
  await h.render('/review?stage=session&sessionId=device_saved');
  await screen.findByText('Correct answer');
  config.config.features.bookmarks = false;
  await act(async () => {
    await h.dependencies.config.refresh();
  });
  expect(screen.getByRole('button', { name: 'Remove bookmark' })).toBeDisabled();
  await expect(study.bookmarks.toggle(study.owner, studyBookmark().entry)).rejects.toMatchObject({
    code: 'permission-denied',
  });
  expect(await study.bookmarks.list(study.owner)).toHaveLength(1);
});
test('disabled bookmarks deep link still opens only the owner saved pin', async () => {
  const config = structuredClone(defaults);
  config.config.features.bookmarks = false;
  const { h, factory } = prepared({ config });
  const study = await seed(h, factory);
  await study.repository.setBookmark(study.owner, studyBookmark().entry, false);
  await h.render('/bookmarks?questionId=fixture-grammar');
  await screen.findByText('Correct answer');
  expect(screen.getByRole('button', { name: 'Remove fixture-grammar' })).toBeDisabled();
  expect((await study.repository.active(study.owner))?.viewedOrdinals).toEqual([]);
});

async function completeVisibleLayout() {
  await act(async () => {
    screen.UNSAFE_getAllByType(Text).forEach((node) => {
      if (node.props.onLayout)
        fireEvent(node, 'layout', {
          nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 20 } },
        });
    });
    await flushTransitions();
  });
}
test('retained Progress reloads durable views and position when Reviewer returns', async () => {
  const { h, factory } = prepared();
  await seed(h, factory);
  const appState = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  try {
    const routes = await h.render('/progress');
    expect(await screen.findByText('Viewed 0 of 2')).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    await screen.findByText('Correct answer');
    await completeVisibleLayout();
    await screen.findByText('Viewed 1 of 2');
    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Item 2 of 2');
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(routes.getPathname()).toBe('/progress'));
    expect(await screen.findByText('Resume at item 2 of 2')).toBeVisible();
    expect(screen.getByText('Viewed 1 of 2')).toBeVisible();
  } finally {
    Object.defineProperty(AppState, 'currentState', appState);
  }
});
test.each(['maintenance', 'minimumVersion'] as const)(
  'initial %s gate clearing offers Start on the same mounted route',
  async (gate) => {
    const config = structuredClone(defaults);
    if (gate === 'maintenance') config.app_info.maintenanceMode = true;
    else config.app_info.minimumSupportedVersion = '99.0.0';
    const { h } = prepared({ config });
    const routes = await h.render('/review/communicationSkills?stage=availability');
    await waitFor(() => expect(screen.queryByText('Preparing Reviewer')).toBeNull());
    expect(screen.queryByText('Correct answer')).toBeNull();
    config.app_info.maintenanceMode = false;
    config.app_info.minimumSupportedVersion = '0.1.0';
    await act(async () => {
      await h.dependencies.config.refresh();
    });
    fireEvent.press(await screen.findByRole('button', { name: 'Start Reviewer' }));
    expect(await screen.findByText('Correct answer')).toBeVisible();
    expect(routes.getPathname()).toBe('/review/communicationSkills');
  },
);

test('late bookmark lookup for question A cannot change question B saved label', async () => {
  const { h, factory } = prepared();
  const study = await seed(h, factory);
  await study.repository.setBookmark(study.owner, studyBookmark().entry, false);
  const list = study.repository.listBookmarks.bind(study.repository);
  const entered = deferred<void>(),
    release = deferred<void>();
  let held = false;
  study.repository.listBookmarks = async (owner) => {
    const page = study.controller.snapshot();
    const delay =
      !held && (page.kind === 'reading' || page.kind === 'completed') && page.ordinal === 0;
    const rows = await list(owner);
    if (delay) {
      held = true;
      entered.resolve();
      await release.promise;
    }
    return rows;
  };
  await h.render('/review?stage=session&sessionId=device_saved');
  await screen.findByText('Correct answer');
  await entered.promise;
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Item 2 of 2');
  expect(await screen.findByRole('button', { name: 'Bookmark' })).toBeEnabled();
  await act(async () => {
    release.resolve();
    await flushTransitions();
  });
  expect(screen.getByRole('button', { name: 'Bookmark' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Remove bookmark' })).toBeNull();
});
test('late bookmark action for question A cannot change question B saved label', async () => {
  const { h, factory } = prepared();
  const study = await seed(h, factory);
  const save = study.repository.setBookmark.bind(study.repository);
  const entered = deferred<void>(),
    release = deferred<void>();
  study.repository.setBookmark = async (...args) => {
    const saved = await save(...args);
    entered.resolve();
    await release.promise;
    return saved;
  };
  await h.render('/review?stage=session&sessionId=device_saved');
  await screen.findByText('Correct answer');
  fireEvent.press(await screen.findByRole('button', { name: 'Bookmark' }));
  await entered.promise;
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Item 2 of 2');
  expect(await screen.findByRole('button', { name: 'Bookmark' })).toBeEnabled();
  await act(async () => {
    release.resolve();
    await flushTransitions();
  });
  expect(screen.getByRole('button', { name: 'Bookmark' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Remove bookmark' })).toBeNull();
  expect(
    (await study.repository.listBookmarks(study.owner)).map((bookmark) => bookmark.questionId),
  ).toEqual(['fixture-grammar']);
});
test('bookmark lookup rejection keeps question readable and retries uncertain status before enabling changes', async () => {
  const { h, factory } = prepared();
  const study = await seed(h, factory);
  const list = study.repository.listBookmarks.bind(study.repository);
  let failed = true;
  study.repository.listBookmarks = async (owner) => {
    if (failed) throw new Error('private storage details');
    return list(owner);
  };
  await h.render('/review?stage=session&sessionId=device_saved');
  expect(await screen.findByText('Correct answer')).toBeVisible();
  expect(await screen.findByRole('button', { name: 'Bookmark status unavailable' })).toBeDisabled();
  expect(screen.queryByText('private storage details')).toBeNull();
  failed = false;
  fireEvent.press(screen.getByRole('button', { name: 'Retry bookmark' }));
  expect(await screen.findByRole('button', { name: 'Bookmark' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Retry bookmark' })).toBeNull();
});
