import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useAppDependencies, useAuthentication, useConfig } from '../bootstrap/AppProviders';
import type { StudyDependencies } from '../bootstrap/studyComposition';
import { AppScreen } from '../core/components/AppScreen';
import { AppText } from '../core/components/AppText';
import { AppButton } from '../core/components/AppButton';
import { AppModal } from '../core/components/AppModal';
import { ErrorView, LoadingView } from '../core/components/StateViews';
import { StudyError, type ReviewerSession, type StudyScope } from '../features/study/domain/study';
import { ReviewerScreen } from '../features/reviewer/presentation/ReviewerScreen';
import type { CatalogSource } from '../features/reviewer/application/ReviewerService';
import { startBlock } from './startAvailability';

function safeError(error: unknown) {
  return error instanceof StudyError ? error : new StudyError('storage-unavailable');
}
export function StudyRoute({
  children,
  onBack,
}: {
  children(study: StudyDependencies): ReactNode;
  onBack(): void;
}) {
  const { auth } = useAuthentication();
  return auth.status === 'authenticated' ? (
    <LazyStudy key={auth.user.uid} onBack={onBack}>
      {children}
    </LazyStudy>
  ) : null;
}
function LazyStudy({
  children,
  onBack,
}: {
  children(study: StudyDependencies): ReactNode;
  onBack(): void;
}) {
  const app = useAppDependencies();
  const [state, setState] = useState<StudyDependencies | StudyError | null>(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let current = true;
    setState(null);
    void app.study().then(
      (value) => {
        if (current) setState(value);
      },
      (error) => {
        if (current) setState(safeError(error));
      },
    );
    return () => {
      current = false;
    };
  }, [app, attempt]);
  if (!state || state instanceof StudyError)
    return (
      <AppScreen>
        <AppButton variant="text" label="Back" onPress={onBack} />
        {state ? (
          <ErrorView message={state.message} onRetry={() => retry((n) => n + 1)} />
        ) : (
          <LoadingView message="Opening saved study" />
        )}
      </AppScreen>
    );
  return (
    <>
      <StudySyncStatus study={state} />
      {children(state)}
    </>
  );
}
function StudySyncStatus({ study }: { study: StudyDependencies }) {
  const [status, setStatus] = useState({
    pendingCount: 0,
    syncing: false,
    recovery: null,
  } as Parameters<Parameters<StudyDependencies['sync']['subscribe']>[0]>[0]);
  useEffect(() => study.sync.subscribe(setStatus), [study]);
  if (!status.pendingCount && !status.recovery) return null;
  return (
    <View>
      <AppText accessibilityLiveRegion="polite">
        {status.pendingCount} pending study changes
      </AppText>
      {status.recovery ? <AppText>{new StudyError(status.recovery).message}</AppText> : null}
      <AppButton
        variant="text"
        label="Retry sync"
        onPress={() => {
          study.sync.wake();
          void study.sync.flush();
        }}
      />
    </View>
  );
}
export function StudyReviewer({
  study,
  scope,
  sessionId,
  onBack,
}: {
  study: StudyDependencies;
  scope?: StudyScope;
  sessionId?: string;
  onBack(): void;
}) {
  const app = useAppDependencies();
  const info = useConfig('app_info');
  const config = useConfig('config');
  const blocked = startBlock(info);
  const [existing, setExisting] = useState<ReviewerSession | null>(null);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<StudyError | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const lifetime = useRef(0);
  const pending = useRef(false);
  const source = useRef<CatalogSource>('server');
  const action = useRef<() => void>(() => {});
  const scopeKey = JSON.stringify(scope);
  const open = async (session: ReviewerSession) => {
    await study.controller.open(study.owner, session.id);
    if (study.guard.isCurrent(study.owner)) setOpened(true);
  };
  const run = async (work: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    const token = lifetime.current;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      if (token === lifetime.current) setError(safeError(failure));
    } finally {
      if (token === lifetime.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const start = (replace: boolean, selected: CatalogSource = 'server') => {
    source.current = selected;
    const work = async () => {
      if (!scope) throw new StudyError('invalid-content');
      // Re-read live configuration on every retry/confirmation.
      if (startBlock(app.config.get('app_info'))) throw new StudyError('permission-denied');
      const shuffle = app.config.get('config').reviewer.shuffleQuestions;
      if (replace) await open(await study.reviewer.replace(study.owner, scope, shuffle, selected));
      else {
        const prepared = await study.reviewer.prepare(study.owner, scope, shuffle, selected);
        if (prepared.kind === 'existing') setExisting(prepared.session);
        else await open(prepared.session);
      }
    };
    action.current = () => {
      void run(work);
    };
    action.current();
  };
  useEffect(() => {
    ++lifetime.current;
    pending.current = false;
    setOpened(false);
    setExisting(null);
    const work = async () => {
      if (sessionId) {
        await open(await study.reviewer.resume(study.owner, sessionId));
        return;
      }
      const saved = await study.repository.active(study.owner);
      if (!study.guard.isCurrent(study.owner)) throw new StudyError('auth-required');
      if (saved) {
        setExisting(saved);
        return;
      }
      if (!scope) throw new StudyError('invalid-content');
      if (startBlock(app.config.get('app_info'))) return;
      const prepared = await study.reviewer.prepare(
        study.owner,
        scope,
        app.config.get('config').reviewer.shuffleQuestions,
      );
      if (prepared.kind === 'existing') setExisting(prepared.session);
      else await open(prepared.session);
    };
    action.current = () => {
      void run(work);
    };
    action.current();
    return () => {
      ++lifetime.current;
      study.controller.setVisibility(false, false);
    };
  }, [study, sessionId, scopeKey]);
  useEffect(() => {
    let active = true;
    const update = () => {
      const state = study.controller.snapshot();
      if (state.kind === 'idle' || !state.session || state.ordinal === null) return;
      const questionId = state.session.items[state.ordinal]?.entry.id;
      void study.bookmarks.list(study.owner).then(
        (rows) => {
          if (active) setBookmarked(rows.some((row) => row.questionId === questionId));
        },
        () => {},
      );
    };
    update();
    const unsubscribe = study.controller.subscribe(update);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [study]);
  if (opened)
    return (
      <>
        <ReviewerScreen
          controller={study.controller}
          onBack={onBack}
          bookmarked={bookmarked}
          bookmarkMutationsEnabled={config.features.bookmarks}
          onBookmark={() => {
            const state = study.controller.snapshot();
            if (state.kind === 'idle' || !state.session || state.ordinal === null) return;
            const entry = state.session.items[state.ordinal]!.entry;
            void study.bookmarks.toggle(study.owner, entry).then(
              (bookmark) => {
                if (study.guard.isCurrent(study.owner)) {
                  setBookmarked(!bookmark.deleted);
                  setError(null);
                }
              },
              (failure) => {
                if (study.guard.isCurrent(study.owner)) setError(safeError(failure));
              },
            );
          }}
        />
        {error ? <AppText accessibilityRole="alert">{error.message}</AppText> : null}
      </>
    );
  const same = existing && JSON.stringify(existing.scope) === scopeKey;
  return (
    <AppScreen>
      <AppButton variant="text" label="Back" onPress={onBack} />
      <AppText variant="title">Reviewer</AppText>
      {busy ? <LoadingView message="Preparing Reviewer" /> : null}
      {blocked ? <AppText accessibilityRole="alert">{blocked}</AppText> : null}
      {error ? (
        <>
          <ErrorView message={error.message} onRetry={() => action.current()} />
          {error.code === 'conflict' ? (
            <AppButton
              label="Use last complete cached catalog"
              variant="secondary"
              disabled={!!blocked || busy}
              onPress={() => start(!!existing, 'cached')}
            />
          ) : null}
        </>
      ) : null}
      {existing ? (
        <>
          <AppText>
            {same ? 'You have saved work for this scope.' : 'You have a saved Reviewer session.'}
          </AppText>
          <AppButton
            label={same ? 'Resume' : 'Resume existing'}
            variant="primary"
            disabled={busy}
            onPress={() => {
              action.current = () => {
                void run(() => open(existing));
              };
              action.current();
            }}
          />
          <AppButton
            label={same ? 'Start again' : 'Replace'}
            variant="secondary"
            disabled={busy || !!blocked}
            onPress={() => setConfirm(true)}
          />
          <AppButton label="Cancel" variant="text" onPress={onBack} />
        </>
      ) : null}
      <AppModal visible={confirm} title="Replace saved Reviewer?" onClose={() => setConfirm(false)}>
        <AppText>Your current session will be archived after the new session is ready.</AppText>
        <AppButton
          label="Confirm replacement"
          variant="primary"
          disabled={busy || !!blocked}
          onPress={() => {
            setConfirm(false);
            start(true, source.current);
          }}
        />
        <AppButton
          label="Keep saved session"
          variant="secondary"
          onPress={() => setConfirm(false)}
        />
      </AppModal>
    </AppScreen>
  );
}
