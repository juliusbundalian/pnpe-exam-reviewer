import { AppButton } from '../../../core/components/AppButton';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import type { ExamAttempt, ExamResultSummary } from '../domain/exam';

function startedDate(value: number): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown date';
}

export function ExamHistoryScreen({
  results,
  active,
  offline,
  onOpen,
  onResume,
  onRetry,
  onBack,
}: {
  results: readonly ExamResultSummary[];
  active: ExamAttempt | null;
  offline: boolean;
  onOpen(attemptId: string): void;
  onResume(attemptId: string): void;
  onRetry(): void;
  onBack(): void;
}) {
  return (
    <AppScreen>
      <AppButton variant="text" label="Back" onPress={onBack} />
      <AppText variant="title" accessibilityRole="header">
        Exam History
      </AppText>
      {offline ? (
        <>
          <AppText>Cloud history is unavailable. Saved results remain available.</AppText>
          <AppButton variant="text" label="Retry history sync" onPress={onRetry} />
        </>
      ) : null}
      {active ? (
        <AppButton
          variant="primary"
          label="Resume active exam"
          onPress={() => onResume(active.id)}
        />
      ) : null}
      {results.length ? (
        results.map((result) => (
          <AppButton
            key={result.attemptId}
            variant="text"
            label={`Attempt ${startedDate(result.startedAt)} · ${result.overall.percentage?.toFixed(2) ?? 'unavailable'}% · ${Math.floor(result.durationUsedMs / 60_000)} min · ${result.reason === 'timeExpired' ? 'time limit' : 'submitted'} · ${result.syncState}`}
            accessibilityLabel={`Open attempt ${result.attemptId}`}
            onPress={() => onOpen(result.attemptId)}
          />
        ))
      ) : (
        <AppText>No completed mock exams yet.</AppText>
      )}
    </AppScreen>
  );
}
