import { useEffect as mockUseEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, ScrollView, Text, type AppStateStatus } from 'react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { palettes } from '../../src/core/theme/tokens';
import { ReviewerScreen } from '../../src/features/reviewer/presentation/ReviewerScreen';
import { ReviewerController } from '../../src/features/reviewer/application/ReviewerController';
import { ReviewerService } from '../../src/features/reviewer/application/ReviewerService';
import { StudyError } from '../../src/features/study/domain/study';
import type { StudyRepository } from '../../src/features/study/domain/StudyRepository';
import type { ContentRepository } from '../../src/features/content/domain/ContentRepository';
import { owner, studyQuestion, studySession } from '../fixtures/study';

let mockFocus: (() => void | (() => void)) | undefined;
let mockBlur: (() => void) | undefined;
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    mockUseEffect(() => {
      let cleanup: void | (() => void);
      mockFocus = () => {
        cleanup?.();
        cleanup = callback();
      };
      mockBlur = () => {
        cleanup?.();
        cleanup = undefined;
      };
      mockFocus();
      return () => {
        cleanup?.();
      };
    }, [callback]);
  },
}));
const appListeners = new Map<string, (state: AppStateStatus) => void>();
beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    appListeners.set(event, listener);
    return {
      remove: () => {
        appListeners.delete(event);
      },
    };
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  appListeners.clear();
});

async function harness({
  count = 2,
  validatedAt = null,
  long = false,
}: { count?: number; validatedAt?: number | null; long?: boolean } = {}) {
  let session = studySession({ catalogValidatedAt: validatedAt });
  if (count === 1) session = { ...session, items: [session.items[0]!] };
  let failView = false;
  let failMove = false;
  const unavailable = new Set<string>();
  const unused = async (): Promise<never> => {
    throw new Error('Unexpected repository call');
  };
  const study: StudyRepository = {
    active: async () => session,
    session: async () => session,
    replaceActive: unused,
    move: async (_, __, ordinal) => {
      if (failMove) throw new StudyError('storage-unavailable');
      session = { ...session, position: ordinal, sequence: session.sequence + 1 };
      return session;
    },
    recordView: async (_, __, ordinal) => {
      if (failView) throw new StudyError('storage-unavailable');
      const viewedOrdinals = [...new Set([...session.viewedOrdinals, ordinal])];
      session = {
        ...session,
        viewedOrdinals,
        sequence: session.sequence + 1,
        status: viewedOrdinals.length === session.items.length ? 'completed' : 'active',
      };
      return session;
    },
    listBookmarks: unused,
    setBookmark: unused,
    mergeRemoteBookmark: unused,
    pending: unused,
    acknowledgedViews: unused,
    acknowledge: unused,
    rebaseBookmark: unused,
    retry: unused,
  };
  const content: ContentRepository = {
    catalog: unused,
    cachedCatalog: unused,
    question: async (_, entry) => {
      if (unavailable.has(entry.id)) throw new StudyError('network');
      return studyQuestion({
        id: entry.id,
        ...(long
          ? {
              stimulus: {
                id: 'fixture-passage',
                version: 1,
                blocks: [{ kind: 'text', text: 'A long shared passage. '.repeat(500), marks: [] }],
              },
            }
          : {}),
      });
    },
  };
  const guard = { isCurrent: () => true };
  const service = new ReviewerService(
    study,
    content,
    { now: () => 1000 },
    { next: () => 0.5 },
    { nextId: () => 'unused' },
    guard,
  );
  const controller = new ReviewerController(service, content, study, guard);
  await controller.open(owner, session.id);
  return {
    controller,
    saved: () => session,
    failView: (value: boolean) => {
      failView = value;
    },
    failMove: (value: boolean) => {
      failMove = value;
    },
    content,
    unavailable,
  };
}
function layoutAll() {
  screen
    .UNSAFE_getAllByType(Text)
    .filter((node) => node.props.onLayout)
    .forEach((node) =>
      fireEvent(node, 'layout', { nativeEvent: { layout: { width: 320, height: 50 } } }),
    );
}
function show(
  controller: ReviewerController,
  appearance: 'light' | 'dark' = 'light',
  bookmarked = false,
  onBookmark = jest.fn(),
) {
  return render(
    <ThemeProvider initialAppearance={appearance}>
      <ReviewerScreen
        controller={controller}
        onBack={jest.fn()}
        onBookmark={onBookmark}
        bookmarked={bookmarked}
      />
    </ThemeProvider>,
  );
}

test('navigation respects bounds and reports item and viewed counts without quiz controls', async () => {
  const h = await harness();
  show(h.controller);
  expect(screen.getByText('Communication Skills')).toBeVisible();
  expect(screen.getByText('Item 1 of 2')).toBeVisible();
  expect(screen.getByText('Viewed 0 of 2')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await act(async () => {
    layoutAll();
  });
  expect(screen.getByText('Viewed 1 of 2')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Item 2 of 2');
  await waitFor(() => expect(screen.getByText('Correct answer')).toBeVisible());
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Previous' }));
  await waitFor(() => expect(screen.getByText('Item 1 of 2')).toBeVisible());
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(screen.queryByText(/Submit Answer|Score|Accuracy|Mastery/)).toBeNull();
  expect(screen.getAllByRole('button').map((node) => node.props.accessibilityLabel)).toEqual([
    'Back',
    'Bookmark',
    'Previous',
    'Next',
  ]);
});

test('completion retains readable answer and navigation', async () => {
  const h = await harness({ count: 1 });
  show(h.controller);
  await act(async () => {
    layoutAll();
  });
  expect(screen.getByText('All 1 items viewed')).toBeVisible();
  expect(screen.getByText('Correct answer')).toBeVisible();
  expect(screen.getByText('Explanation')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(h.saved().status).toBe('completed');
});

test('offline missing page preserves its intended index and offers retry', async () => {
  const h = await harness();
  h.unavailable.add('fixture-second');
  show(h.controller);
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(
    await screen.findByText('This item is not available offline. Reconnect and retry.'),
  ).toBeVisible();
  expect(screen.getByText('Item 2 of 2')).toBeVisible();
  expect(h.saved().position).toBe(1);
  h.unavailable.clear();
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Correct answer')).toBeVisible();
});

test('durable view failure retains content and does not claim progress until retry succeeds', async () => {
  const h = await harness();
  h.failView(true);
  show(h.controller);
  await act(async () => {
    layoutAll();
  });
  expect(screen.getByText(new StudyError('storage-unavailable').message)).toBeVisible();
  expect(screen.getByText('Correct answer')).toBeVisible();
  expect(screen.getByText('Viewed 0 of 2')).toBeVisible();
  h.failView(false);
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Viewed 1 of 2')).toBeVisible();
});

test('failed durable navigation shows saved position and retries the requested move', async () => {
  const h = await harness();
  h.failMove(true);
  show(h.controller);
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText(new StudyError('storage-unavailable').message)).toBeVisible();
  expect(screen.getByText('Item 1 of 2')).toBeVisible();
  expect(screen.queryByText('Item 2 of 2')).toBeNull();
  expect(h.saved().position).toBe(0);
  h.failMove(false);
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByText('Item 2 of 2')).toBeVisible());
  expect(await screen.findByText('Correct answer')).toBeVisible();
  expect(h.saved().position).toBe(1);
});

test('loading the next page hides the previous answer and disables navigation until ready', async () => {
  const h = await harness();
  let resolve!: (question: ReturnType<typeof studyQuestion>) => void;
  const pending = new Promise<ReturnType<typeof studyQuestion>>((done) => {
    resolve = done;
  });
  const original = h.content.question;
  h.content.question = (candidate, entry) =>
    entry.id === 'fixture-second' ? pending : original(candidate, entry);
  show(h.controller);
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('progressbar', { name: 'Loading question' })).toBeVisible();
  expect(screen.queryByText('Correct answer')).toBeNull();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  await act(async () => {
    resolve(studyQuestion({ id: 'fixture-second' }));
  });
  expect(screen.getByText('Correct answer')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
});

test('clearing the shared controller removes its personal question and progress', async () => {
  const h = await harness();
  show(h.controller);
  act(() => {
    h.controller.dispose();
  });
  expect(screen.getByText('No Reviewer session is open.')).toBeVisible();
  expect(screen.queryByText('Correct answer')).toBeNull();
  expect(screen.queryByText('Viewed 0 of 2')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
});

test.each(['light', 'dark'] as const)(
  'long passages retain scalable text and scrollable controls in %s',
  async (appearance) => {
    const h = await harness({ long: true });
    show(h.controller, appearance);
    const passage = screen.getByText('A long shared passage. '.repeat(500));
    expect(passage).toHaveProp('allowFontScaling', true);
    expect(passage.props.numberOfLines).toBeUndefined();
    expect(passage.props.maxFontSizeMultiplier).toBeUndefined();
    expect(passage).toHaveStyle({ color: palettes[appearance].textPrimary });
    expect(screen.getAllByText('Choice 2')[0]).toHaveStyle({
      color: palettes[appearance].success,
    });
    const scroll = screen.UNSAFE_getByType(ScrollView);
    const next = screen.getByRole('button', { name: 'Next' });
    expect(scroll.findAllByType(next.type)).toContainEqual(next);
    expect(next).toHaveStyle({ minHeight: 44 });
    expect(next.props.style.height).toBeUndefined();
  },
);

test.each([null, Date.UTC(2026, 9, 1)])(
  'catalog validation date %s is honest about freshness',
  async (validatedAt) => {
    const h = await harness({ validatedAt });
    show(h.controller);
    expect(
      screen.getByText(
        validatedAt === null
          ? 'Content last checked: unknown'
          : 'Content last checked: 2026-10-01 (UTC)',
      ),
    ).toBeVisible();
  },
);

test('a safe integer outside the Date range does not crash freshness presentation', async () => {
  const h = await harness({ validatedAt: Number.MAX_SAFE_INTEGER });
  show(h.controller);
  expect(screen.getByText('Content last checked: unknown')).toBeVisible();
  expect(screen.getByText('Correct answer')).toBeVisible();
});

test('background layout records exactly once on foreground without another layout', async () => {
  const h = await harness();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
  show(h.controller);
  await act(async () => {
    layoutAll();
  });
  expect(h.saved().viewedOrdinals).toEqual([]);
  await act(async () => {
    appListeners.get('change')?.('active');
  });
  expect(h.saved().viewedOrdinals).toEqual([0]);
  const sequence = h.saved().sequence;
  await act(async () => {
    appListeners.get('change')?.('background');
    appListeners.get('change')?.('active');
  });
  expect(h.saved().sequence).toBe(sequence);
});

test('unfocused layout records once on refocus and unmount hides shared controller', async () => {
  const h = await harness();
  const tree = show(h.controller);
  await act(async () => {
    mockBlur?.();
    layoutAll();
  });
  expect(h.saved().viewedOrdinals).toEqual([]);
  await act(async () => {
    mockFocus?.();
  });
  expect(h.saved().viewedOrdinals).toEqual([0]);
  tree.unmount();
  await h.controller.move(1);
  const state = h.controller.snapshot();
  if (state.kind !== 'reading') throw new Error('Expected reading');
  await h.controller.rendered({
    sessionId: state.session.id,
    ordinal: state.ordinal,
    pageToken: state.pageToken,
  });
  expect(h.saved().viewedOrdinals).toEqual([0]);
});

test('Android app blur holds completed layout until focus returns', async () => {
  const h = await harness();
  show(h.controller);
  await act(async () => {
    appListeners.get('blur')?.('active');
    layoutAll();
  });
  expect(h.saved().viewedOrdinals).toEqual([]);
  await act(async () => {
    appListeners.get('focus')?.('active');
  });
  expect(h.saved().viewedOrdinals).toEqual([0]);
});

test('bookmark toggle reflects supplied state and delegates the action', async () => {
  const h = await harness(),
    bookmark = jest.fn();
  show(h.controller, 'light', true, bookmark);
  const button = screen.getByRole('button', { name: 'Remove bookmark' });
  expect(button).toHaveProp('accessibilityState', { selected: true, disabled: false });
  fireEvent.press(button);
  expect(bookmark).toHaveBeenCalledTimes(1);
});
