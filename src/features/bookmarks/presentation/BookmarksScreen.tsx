import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
import { ErrorView, LoadingView } from '../../../core/components/StateViews';
import { spacing } from '../../../core/theme/tokens';
import { taxonomy } from '../../content/domain/taxonomy';
import type { Question } from '../../content/domain/question';
import { QuestionReadingView } from '../../content/presentation/QuestionReadingView';
import { StudyError, type Bookmark, type OwnerContext } from '../../study/domain/study';
import type { BookmarkService } from '../application/BookmarkService';

export type BookmarksScreenProps = {
  service: BookmarkService;
  owner: OwnerContext;
  onBack(): void;
  mutationsEnabled?: boolean;
};
type SavedState = {
  key: string;
  rows: readonly Bookmark[];
  pending: readonly string[];
  question: Question | null;
  busy: boolean;
  error: StudyError | null;
  retry: (() => void) | null;
};
const noReceipt = () => {};

export function BookmarksScreen({
  service,
  owner,
  onBack,
  mutationsEnabled = true,
}: BookmarksScreenProps) {
  const key = JSON.stringify([owner.uid, owner.deviceId, owner.epoch]);
  const current = useRef({ key, service, mutationsEnabled, generation: 0, mounted: true });
  current.current.key = key;
  current.current.service = service;
  current.current.mutationsEnabled = mutationsEnabled;
  const [saved, setSaved] = useState<SavedState>({
    key: '',
    rows: [],
    pending: [],
    question: null,
    busy: true,
    error: null,
    retry: null,
  });
  const state =
    saved.key === key
      ? saved
      : { ...saved, rows: [], pending: [], question: null, busy: true, error: null };
  const run = async (
    work: () => Promise<{
      rows?: readonly Bookmark[];
      pending?: readonly string[];
      question?: Question | null;
    }>,
    retry: () => void,
    clearQuestion = false,
  ) => {
    const generation = ++current.current.generation;
    setSaved((previous) => ({
      ...(previous.key === key ? previous : { ...previous, rows: [], pending: [], question: null }),
      key,
      busy: true,
      error: null,
      retry: null,
      ...(clearQuestion ? { question: null } : {}),
    }));
    const applies = () =>
      current.current.mounted &&
      current.current.key === key &&
      current.current.service === service &&
      current.current.generation === generation;
    try {
      const result = await work();
      if (applies())
        setSaved((previous) => ({
          ...previous,
          ...result,
          key,
          busy: false,
          error: null,
          retry: null,
        }));
    } catch (error) {
      if (applies())
        setSaved((previous) => ({
          ...previous,
          key,
          busy: false,
          error: error instanceof StudyError ? error : new StudyError('storage-unavailable'),
          retry,
        }));
    }
  };
  const records = async () => {
    const [rows, pending] = await Promise.all([service.list(owner), service.pending(owner)]);
    return { rows, pending };
  };
  const refresh = () => {
    void run(records, refresh);
  };
  const open = (id: string) => {
    void run(
      async () => ({ question: await service.open(owner, id) }),
      () => open(id),
      true,
    );
  };
  const remove = (bookmark: Bookmark) => {
    if (!current.current.mutationsEnabled) return;
    let committed = false;
    void run(
      async () => {
        await service.toggle(owner, bookmark.entry);
        committed = true;
        return { ...(await records()), question: null };
      },
      () => {
        if (committed) refresh();
        else remove(bookmark);
      },
    );
  };
  useEffect(() => {
    current.current.mounted = true;
    refresh();
    return () => {
      current.current.mounted = false;
      ++current.current.generation;
    };
    // Reload only for a new owner epoch or service, not each local state update.
  }, [key, service]);
  return (
    <AppScreen>
      <AppButton variant="text" label="Back" onPress={onBack} />
      <AppText variant="title" accessibilityRole="header">
        Bookmarks
      </AppText>
      <AppButton variant="secondary" label="Refresh" disabled={state.busy} onPress={refresh} />
      {!mutationsEnabled ? (
        <AppText>
          Saved bookmarks remain available. Bookmark changes are currently disabled.
        </AppText>
      ) : null}
      {state.busy ? <LoadingView message="Loading bookmarks" /> : null}
      {state.error ? (
        <ErrorView
          message={
            state.error.code === 'network'
              ? 'This saved question is not available offline. Reconnect and retry.'
              : state.error.message
          }
          onRetry={() => state.retry?.()}
        />
      ) : null}
      {!state.busy && !state.error && !state.rows.length ? (
        <AppText>No bookmarks yet.</AppText>
      ) : null}
      {state.pending.some((id) => !state.rows.some((row) => row.questionId === id)) ? (
        <AppText accessibilityLiveRegion="polite">Pending bookmark sync</AppText>
      ) : null}
      {state.rows.map((bookmark) => (
        <View key={bookmark.questionId} style={{ gap: spacing.sm }}>
          <AppText variant="heading">{bookmark.questionId}</AppText>
          <AppText variant="caption">
            {taxonomy.find((item) => item.id === bookmark.entry.categoryId)?.label} · Saved revision{' '}
            {bookmark.entry.version}
          </AppText>
          {state.pending.includes(bookmark.questionId) ? (
            <AppText accessibilityLiveRegion="polite">Pending sync</AppText>
          ) : null}
          <AppButton
            variant="secondary"
            label="Open"
            accessibilityLabel={`Open ${bookmark.questionId}`}
            disabled={state.busy || state.error !== null}
            onPress={() => open(bookmark.questionId)}
          />
          <AppButton
            variant="text"
            label="Remove bookmark"
            accessibilityLabel={`Remove ${bookmark.questionId}`}
            disabled={state.busy || state.error !== null || !mutationsEnabled}
            onPress={() => remove(bookmark)}
          />
        </View>
      ))}
      {state.question ? (
        <QuestionReadingView
          key={`${key}:${state.question.id}:${state.question.version}`}
          question={state.question}
          onReady={noReceipt}
          onError={noReceipt}
        />
      ) : null}
    </AppScreen>
  );
}
