import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import type { StudyDependencies } from '../bootstrap/studyComposition';
import { AppScreen } from '../core/components/AppScreen';
import { AppText } from '../core/components/AppText';
import { AppButton } from '../core/components/AppButton';
import { ErrorView } from '../core/components/StateViews';
import { StudyError } from '../features/study/domain/study';
import type { ExamAttempt, ExamChange, ExamResult } from '../features/exam/domain/exam';
import type { ExamConfig } from '../features/exam/domain/selection';
import { ExamPreflightScreen } from '../features/exam/presentation/ExamPreflightScreen';
import { ExamRunnerScreen } from '../features/exam/presentation/ExamRunnerScreen';

function errorMessage(error: unknown) {
  return error instanceof StudyError
    ? error.message
    : new StudyError('storage-unavailable').message;
}

export function ExamFlow({
  study,
  stage,
  attemptId,
  blocked,
  config,
  bookmarksEnabled,
  onBack,
}: {
  study: StudyDependencies;
  stage: string;
  attemptId?: string;
  blocked: string | null;
  config: ExamConfig;
  bookmarksEnabled: boolean;
  onBack(): void;
}) {
  const router = useRouter();
  const [active, setActive] = useState<ExamAttempt | null>(null);
  const [terminal, setTerminal] = useState<ExamResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const pending = useRef(false);
  const failedChange = useRef<ExamChange | null>(null);
  const generation = useRef(0);
  const questionId = active?.questions[active.position]?.entry.id;

  useEffect(() => {
    const token = ++generation.current;
    void (async () => {
      try {
        const saved = await study.examRepository.active(study.owner);
        if (generation.current !== token || !study.guard.isCurrent(study.owner)) return;
        setActive(saved);
        if (stage === 'run' && attemptId && saved?.id === attemptId) {
          const resumed = await study.exam.resume(study.owner, attemptId);
          if (generation.current === token) setActive(resumed);
        }
        if (stage === 'result' && attemptId) {
          const result = await study.examRepository.result(study.owner, attemptId);
          if (generation.current === token) setTerminal(result);
        }
      } catch (failure) {
        if (generation.current === token) setError(errorMessage(failure));
      } finally {
        if (generation.current === token) setLoading(false);
      }
    })();
    return () => {
      ++generation.current;
    };
  }, [study, stage, attemptId]);

  useEffect(() => {
    let live = true;
    setBookmarked(false);
    if (questionId)
      void study.bookmarks.list(study.owner).then(
        (rows) => {
          if (live && study.guard.isCurrent(study.owner))
            setBookmarked(rows.some((row) => row.questionId === questionId));
        },
        () => {},
      );
    return () => {
      live = false;
    };
  }, [study, questionId]);

  const tick = useCallback(async () => {
    if (!active || pending.current || terminal) return;
    try {
      const ms = await study.exam.remaining(study.owner, active.id);
      if (!study.guard.isCurrent(study.owner)) return;
      setRemaining(ms);
      if (ms === 0) {
        pending.current = true;
        const result = await study.exam.submit(study.owner, active.id, 'timeExpired');
        if (study.guard.isCurrent(study.owner)) setTerminal(result);
        pending.current = false;
      }
    } catch (failure) {
      if (study.guard.isCurrent(study.owner)) setError(errorMessage(failure));
    }
  }, [active, study, terminal]);

  useEffect(() => {
    if (!active || terminal || stage === 'result') return;
    void tick();
    const interval = setInterval(() => void tick(), 1_000);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tick();
    });
    return () => {
      clearInterval(interval);
      foreground.remove();
    };
  }, [active, terminal, stage, tick]);

  const run = async (work: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      if (study.guard.isCurrent(study.owner)) setError(errorMessage(failure));
    } finally {
      pending.current = false;
      if (study.guard.isCurrent(study.owner)) setBusy(false);
    }
  };
  const start = () =>
    void run(async () => {
      const attempt = await study.exam.start(study.owner, config);
      if (!study.guard.isCurrent(study.owner)) return;
      setActive(attempt);
      router.replace(`/mock-exam?stage=run&attemptId=${attempt.id}`);
    });
  const resume = () =>
    void run(async () => {
      if (!active) throw new StudyError('invalid-content');
      const attempt = await study.exam.resume(study.owner, active.id);
      if (!study.guard.isCurrent(study.owner)) return;
      setActive(attempt);
      router.replace(`/mock-exam?stage=run&attemptId=${attempt.id}`);
    });
  const change = (mutation: ExamChange) => {
    failedChange.current = mutation;
    void run(async () => {
      if (!active) throw new StudyError('invalid-content');
      const saved = await study.exam.change(study.owner, active.id, mutation);
      if (study.guard.isCurrent(study.owner)) {
        setActive(saved);
        failedChange.current = null;
      }
    });
  };
  const submit = (reason: 'manual' | 'timeExpired') =>
    void run(async () => {
      if (!active) throw new StudyError('invalid-content');
      const result = await study.exam.submit(study.owner, active.id, reason);
      if (study.guard.isCurrent(study.owner)) setTerminal(result);
    });

  if (loading)
    return (
      <AppScreen>
        <AppText>Opening saved exam</AppText>
      </AppScreen>
    );
  if (terminal)
    return (
      <AppScreen>
        <AppText variant="title">Exam complete</AppText>
        <AppButton
          variant="primary"
          label="View Results"
          onPress={() => router.replace(`/mock-exam?stage=result&attemptId=${terminal.attemptId}`)}
        />
      </AppScreen>
    );
  if (stage === 'result')
    return (
      <AppScreen>
        <ErrorView
          message={error ?? 'Result is unavailable.'}
          onRetry={() => router.replace('/exam-history')}
        />
      </AppScreen>
    );
  if (stage === 'run' && active)
    return (
      <ExamRunnerScreen
        attempt={active}
        remainingMs={remaining}
        busy={busy}
        error={error}
        bookmarked={bookmarked}
        bookmarksEnabled={bookmarksEnabled}
        onAnswer={(choiceId) => change({ type: 'answer', ordinal: active.position, choiceId })}
        onFlag={() =>
          change({
            type: 'flag',
            ordinal: active.position,
            flagged: !active.questions[active.position]!.flagged,
          })
        }
        onMove={(ordinal) => change({ type: 'move', ordinal })}
        onBookmark={() =>
          void run(async () => {
            const row = await study.bookmarks.setSaved(
              study.owner,
              active.questions[active.position]!.entry,
              !bookmarked,
            );
            if (study.guard.isCurrent(study.owner)) setBookmarked(!row.deleted);
          })
        }
        onRetry={() => {
          if (failedChange.current) change(failedChange.current);
        }}
        onSubmit={() => submit('manual')}
        onLeave={onBack}
      />
    );
  return (
    <ExamPreflightScreen
      config={config}
      blocked={blocked}
      hasActive={!!active}
      busy={busy}
      error={error}
      onStart={start}
      onResume={resume}
      onBack={onBack}
    />
  );
}
