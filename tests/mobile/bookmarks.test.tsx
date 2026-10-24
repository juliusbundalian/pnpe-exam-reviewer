import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { BookmarksScreen } from '../../src/features/bookmarks/presentation/BookmarksScreen';
import { BookmarkService } from '../../src/features/bookmarks/application/BookmarkService';
import type { StudyRepository } from '../../src/features/study/domain/StudyRepository';
import {
  StudyError,
  type Bookmark,
  type StudyOperation,
} from '../../src/features/study/domain/study';
import { owner, studyBookmark, studyQuestion } from '../fixtures/study';
import { Text } from 'react-native';

function harness({ empty = false, historical = false, explanation = true } = {}) {
  let saved: Bookmark[] = empty ? [] : [studyBookmark()];
  let operations: StudyOperation[] = [];
  let offline = false;
  let storageFailed = false;
  let failReload = false;
  let gate = true;
  let delayed: Promise<void> | null = null;
  const unused = async (): Promise<never> => {
    throw new Error('Unexpected Reviewer mutation');
  };
  const study: StudyRepository = {
    active: unused,
    session: unused,
    replaceActive: unused,
    recordView: unused,
    move: unused,
    listBookmarks: async () => {
      if (storageFailed) throw new StudyError('storage-unavailable');
      return saved;
    },
    setBookmark: async (_, entry, deleted) => {
      if (storageFailed) throw new StudyError('storage-unavailable');
      const bookmark = { ...studyBookmark(), entry, deleted };
      saved = [bookmark];
      if (failReload) {
        storageFailed = true;
        failReload = false;
      }
      operations = [
        {
          id: 'op',
          uid: owner.uid,
          deviceId: owner.deviceId,
          recordId: entry.id,
          localSequence: 1,
          createdAt: 100,
          attempts: 0,
          nextAttemptAt: 9999999,
          kind: 'bookmarkState',
          bookmark,
          baseRevision: 0,
        },
      ];
      return bookmark;
    },
    pending: async () => operations,
    acknowledgedViews: unused,
    acknowledge: unused,
    retry: unused,
    mergeRemoteBookmark: unused,
    rebaseBookmark: unused,
  };
  const question = studyQuestion({
    ...(historical
      ? {
          isCurrentEvent: true,
          asOfDate: '2024-01-01',
          publishedAt: '2024-01-01T00:00:00Z',
          expiresAt: '2025-01-01T00:00:00Z',
          reviewedTimeContext: 'Office holder as of January 2024.',
          verification: {
            sourceUrl: 'https://example.com/fixture',
            verifiedAt: '2024-01-01T00:00:00Z',
            asOfDate: '2024-01-01',
          },
        }
      : {}),
  });
  const raw = explanation
    ? question
    : Object.fromEntries(Object.entries(question).filter(([key]) => key !== 'explanation'));
  if (!empty)
    saved = [
      studyBookmark({
        entry: {
          ...studyBookmark().entry,
          ...(!explanation ? { supportedKinds: ['text'] as const } : {}),
          ...(historical
            ? {
                isCurrentEvent: true,
                asOfDate: '2024-01-01',
                publishedAt: '2024-01-01T00:00:00Z',
                expiresAt: '2025-01-01T00:00:00Z',
              }
            : {}),
        },
      }),
    ];
  const service = new BookmarkService(
    study,
    {
      catalog: unused,
      cachedCatalog: unused,
      question: async () => {
        await delayed;
        if (offline) throw new StudyError('network');
        return raw as typeof question;
      },
    },
    { isCurrent: (candidate) => candidate.uid === owner.uid && candidate.epoch === owner.epoch },
    () => gate,
  );
  return {
    service,
    saved: () => saved,
    mergeTombstone: () => {
      saved = saved.map((row) => ({ ...row, deleted: true, serverRevision: 2 }));
    },
    operations: () => operations,
    delay: (promise: Promise<void>) => {
      delayed = promise;
    },
    setOffline: (value: boolean) => {
      offline = value;
    },
    setStorageFailed: (value: boolean) => {
      storageFailed = value;
    },
    failNextReload: () => {
      failReload = true;
    },
    setGate: (value: boolean) => {
      gate = value;
    },
    queue: () => {
      operations = [
        {
          id: 'op',
          uid: owner.uid,
          deviceId: owner.deviceId,
          recordId: 'fixture-grammar',
          localSequence: 1,
          createdAt: 100,
          attempts: 2,
          nextAttemptAt: 9999999,
          kind: 'bookmarkState',
          bookmark: studyBookmark(),
          baseRevision: 0,
        },
      ];
    },
    acknowledge: () => {
      operations = [];
    },
  };
}
function show(h: ReturnType<typeof harness>, mutationsEnabled = true) {
  return render(
    <ThemeProvider>
      <BookmarksScreen
        service={h.service}
        owner={owner}
        onBack={() => undefined}
        mutationsEnabled={mutationsEnabled}
      />
    </ThemeProvider>,
  );
}

test('lists and opens the pinned answer without creating Reviewer work or recording views', async () => {
  const h = harness();
  show(h);
  fireEvent.press(await screen.findByRole('button', { name: 'Open fixture-grammar' }));
  await screen.findByText('Correct answer');
  expect(screen.getByTestId('choice-card-2')).toHaveTextContent(/Choice 2.*Correct/);
  expect(screen.getByText('Explanation')).toBeTruthy();
  act(() => {
    screen.UNSAFE_getAllByType(Text).forEach((node) => {
      if (node.props.onLayout)
        fireEvent(node, 'layout', {
          nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 20 } },
        });
    });
  });
  expect(h.operations()).toEqual([]);
  expect(screen.queryByText('Pending sync')).toBeNull();
});

test('removes durably and displays empty saved questions', async () => {
  const h = harness();
  show(h);
  fireEvent.press(await screen.findByRole('button', { name: 'Remove fixture-grammar' }));
  await screen.findByText('No bookmarks yet.');
  expect(h.saved()[0]?.deleted).toBe(true);
  expect(h.operations()[0]?.kind).toBe('bookmarkState');
});

test('missing page retains bookmark and reconnect retry opens it', async () => {
  const h = harness();
  h.setOffline(true);
  show(h);
  fireEvent.press(await screen.findByRole('button', { name: 'Open fixture-grammar' }));
  await screen.findByText('This saved question is not available offline. Reconnect and retry.');
  expect(h.saved()[0]?.deleted).toBe(false);
  h.setOffline(false);
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Correct answer');
  expect(h.operations()).toEqual([]);
});

test('storage failure never claims removal and Retry repeats the mutation', async () => {
  const h = harness();
  show(h);
  await screen.findByRole('button', { name: 'Remove fixture-grammar' });
  h.setStorageFailed(true);
  fireEvent.press(screen.getByRole('button', { name: 'Remove fixture-grammar' }));
  await screen.findByText('Your study data could not be saved. Please try again.');
  expect(h.saved()[0]?.deleted).toBe(false);
  h.setStorageFailed(false);
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No bookmarks yet.');
});

test('historical current-event context survives opening a saved revision', async () => {
  const h = harness({ historical: true });
  show(h);
  fireEvent.press(await screen.findByRole('button', { name: 'Open fixture-grammar' }));
  await screen.findByText('Historical revision · As of 2024-01-01');
  expect(screen.getByText('Office holder as of January 2024.')).toBeTruthy();
});

test('absent explanation retains readable answer without invented explanation', async () => {
  const h = harness({ explanation: false });
  show(h);
  fireEvent.press(await screen.findByRole('button', { name: 'Open fixture-grammar' }));
  await screen.findByText('Correct answer');
  expect(screen.queryByText('Explanation')).toBeNull();
});

test('pending indicator comes from durable operations and Refresh observes acknowledgement', async () => {
  const h = harness();
  h.queue();
  show(h);
  await screen.findByText('Pending sync');
  h.acknowledge();
  fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.queryByText('Pending sync')).toBeNull());
});

test('disabled feature still reads saved questions while disallowing removal', async () => {
  const h = harness();
  h.setGate(false);
  show(h, false);
  expect(
    (await screen.findByRole('button', { name: 'Remove fixture-grammar' })).props.accessibilityState
      .disabled,
  ).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Open fixture-grammar' }));
  await screen.findByText('Correct answer');
  expect(h.operations()).toEqual([]);
});

test('empty bookmarks are actionable and Back remains available', async () => {
  const h = harness({ empty: true });
  show(h);
  await screen.findByText('No bookmarks yet.');
  expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
});

test('owner change immediately hides personal list and any late page', async () => {
  const h = harness();
  const view = show(h);
  await screen.findByRole('button', { name: 'Open fixture-grammar' });
  await act(async () =>
    view.rerender(
      <ThemeProvider>
        <BookmarksScreen
          service={h.service}
          owner={{ ...owner, uid: 'bob', epoch: 2 }}
          onBack={() => undefined}
        />
      </ThemeProvider>,
    ),
  );
  expect(screen.queryByRole('button', { name: 'Open fixture-grammar' })).toBeNull();
  await screen.findByText('Please sign in to continue studying.');
});

test('Retry after committed removal only reloads and never restores the tombstone', async () => {
  const h = harness();
  show(h);
  await screen.findByRole('button', { name: 'Remove fixture-grammar' });
  h.failNextReload();
  fireEvent.press(screen.getByRole('button', { name: 'Remove fixture-grammar' }));
  await screen.findByText('Your study data could not be saved. Please try again.');
  expect(h.saved()[0]?.deleted).toBe(true);
  h.setStorageFailed(false);
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No bookmarks yet.');
  expect(h.saved()[0]?.deleted).toBe(true);
});

test('late bookmark content cannot reappear after owner change', async () => {
  const h = harness();
  let release!: () => void;
  h.delay(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const view = show(h);
  fireEvent.press(await screen.findByRole('button', { name: 'Open fixture-grammar' }));
  view.rerender(
    <ThemeProvider>
      <BookmarksScreen
        service={h.service}
        owner={{ ...owner, uid: 'bob', epoch: 2 }}
        onBack={() => undefined}
      />
    </ThemeProvider>,
  );
  await screen.findByText('Please sign in to continue studying.');
  await act(async () => release());
  expect(screen.queryByText('Correct answer')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Open fixture-grammar' })).toBeNull();
});

test('displayed Remove retains its desired state after background tombstone merge', async () => {
  const h = harness();
  show(h);
  await screen.findByRole('button', { name: 'Remove fixture-grammar' });
  h.mergeTombstone();
  fireEvent.press(screen.getByRole('button', { name: 'Remove fixture-grammar' }));
  await waitFor(() => expect(h.operations()).toHaveLength(1));
  expect(h.saved()[0]?.deleted).toBe(true);
  expect(h.operations()[0]).toMatchObject({ bookmark: { deleted: true } });
  await screen.findByText('No bookmarks yet.');
});
