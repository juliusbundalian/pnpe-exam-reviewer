import { useCallback, useSyncExternalStore } from 'react';
import { AppState, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
import { ErrorView, LoadingView } from '../../../core/components/StateViews';
import { spacing } from '../../../core/theme/tokens';
import { taxonomy } from '../../content/domain/taxonomy';
import { QuestionReadingView } from '../../content/presentation/QuestionReadingView';
import type { ReviewerController } from '../application/ReviewerController';

export type ReviewerScreenProps = {
  controller: ReviewerController;
  onBack(): void;
  onBookmark(): void;
  bookmarked: boolean;
  bookmarkMutationsEnabled?: boolean;
};
const contentError = () => {
  /* The renderer shows a safe error and never sends a receipt. */
};

export function ReviewerScreen({
  controller,
  onBack,
  onBookmark,
  bookmarked,
  bookmarkMutationsEnabled = true,
}: ReviewerScreenProps) {
  const state = useSyncExternalStore(
    useCallback((listener) => controller.subscribe(listener), [controller]),
    useCallback(() => controller.snapshot(), [controller]),
  );
  useFocusEffect(
    useCallback(() => {
      let active = AppState.currentState === 'active';
      let appFocused = true;
      const visibility = () => controller.setVisibility(true, active && appFocused);
      visibility();
      const change = AppState.addEventListener('change', (status) => {
        active = status === 'active';
        visibility();
      });
      const blur = AppState.addEventListener('blur', () => {
        appFocused = false;
        visibility();
      });
      const focus = AppState.addEventListener('focus', () => {
        appFocused = true;
        visibility();
      });
      return () => {
        change.remove();
        blur.remove();
        focus.remove();
        controller.setVisibility(false, false);
      };
    }, [controller]),
  );
  const session = state.kind === 'idle' ? null : state.session;
  const ordinal = state.kind === 'idle' ? null : state.ordinal;
  const question =
    state.kind === 'reading' || state.kind === 'completed' || state.kind === 'error'
      ? state.question
      : undefined;
  const category = taxonomy.find((item) => item.id === session?.scope.categoryId);
  const scope = session?.scope.subcategoryId
    ? category?.subcategories.find((item) => item.id === session.scope.subcategoryId)?.label
    : category?.label;
  const busy = state.kind === 'loading';
  const validatedDate =
    session?.catalogValidatedAt == null ? null : new Date(session.catalogValidatedAt);
  const checkedDate =
    validatedDate && Number.isFinite(validatedDate.getTime())
      ? validatedDate.toISOString().slice(0, 10)
      : null;
  return (
    <AppScreen>
      <AppButton variant="text" label="Back" onPress={onBack} />
      <AppText variant="title" accessibilityRole="header">
        Reviewer
      </AppText>
      {session ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">{scope}</AppText>
          <AppText>
            Item {(ordinal ?? session.position) + 1} of {session.items.length}
          </AppText>
          <AppText accessibilityLiveRegion="polite">
            Viewed {session.viewedOrdinals.length} of {session.items.length}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {checkedDate === null
              ? 'Content last checked: unknown'
              : `Content last checked: ${checkedDate} (UTC)`}
          </AppText>
        </View>
      ) : null}
      {state.kind === 'completed' ? (
        <AppText accessibilityRole="alert" accessibilityLiveRegion="polite">
          All {state.session.items.length} items viewed
        </AppText>
      ) : null}
      {state.kind === 'idle' ? <AppText>No Reviewer session is open.</AppText> : null}
      {busy ? <LoadingView message="Loading question" /> : null}
      {state.kind === 'missing' ? (
        <ErrorView
          message="This item is not available offline. Reconnect and retry."
          onRetry={() => {
            void controller.retry();
          }}
        />
      ) : null}
      {state.kind === 'error' ? (
        <ErrorView
          message={state.error.message}
          onRetry={() => {
            void controller.retry();
          }}
        />
      ) : null}
      {question && session && ordinal !== null && state.kind !== 'idle' ? (
        <>
          <QuestionReadingView
            key={`${session.id}:${state.pageToken}`}
            question={question}
            onError={contentError}
            onReady={() => {
              void controller.rendered({
                sessionId: session.id,
                ordinal,
                pageToken: state.pageToken,
              });
            }}
          />
          <AppButton
            variant="secondary"
            label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
            disabled={!bookmarkMutationsEnabled}
            accessibilityState={{ selected: bookmarked }}
            onPress={onBookmark}
          />
        </>
      ) : null}
      {session && ordinal !== null ? (
        <View style={{ gap: spacing.md }}>
          <AppButton
            variant="secondary"
            label="Previous"
            disabled={busy || ordinal <= 0}
            onPress={() => {
              void controller.move(ordinal - 1);
            }}
          />
          <AppButton
            variant="primary"
            label="Next"
            disabled={busy || ordinal >= session.items.length - 1}
            onPress={() => {
              void controller.move(ordinal + 1);
            }}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}
