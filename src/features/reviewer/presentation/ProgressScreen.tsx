import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
import type { ReviewerSession } from '../../study/domain/study';
import type { ExamResultSummary } from '../../exam/domain/exam';
import { examProgress } from '../../exam/application/examProgress';

export type ProgressScreenProps = {
  session: ReviewerSession | null;
  examResults?: readonly ExamResultSummary[];
  onResume(session: ReviewerSession): void;
  onBack(): void;
};
export function ProgressScreen({
  session,
  examResults = [],
  onResume,
  onBack,
}: ProgressScreenProps) {
  const active = session?.status === 'archived' ? null : session;
  const exams = examProgress(examResults);
  const checked = active?.catalogValidatedAt == null ? null : new Date(active.catalogValidatedAt);
  const date =
    checked && Number.isFinite(checked.getTime()) ? checked.toISOString().slice(0, 10) : null;
  return (
    <AppScreen>
      <AppButton variant="text" label="Back" onPress={onBack} />
      <AppText variant="title" accessibilityRole="header">
        Viewed progress
      </AppText>
      <AppText>
        Viewed counts describe reading activity: items displayed successfully in your Reviewer.
      </AppText>
      {active ? (
        <>
          <AppText accessibilityLiveRegion="polite">
            Viewed {active.viewedOrdinals.length} of {active.items.length}
          </AppText>
          <AppText>
            Resume at item {active.position + 1} of {active.items.length}
          </AppText>
          <AppText variant="caption">
            {date === null
              ? 'Content last checked: unknown'
              : `Content last checked: ${date} (UTC)`}
          </AppText>
          <AppButton variant="primary" label="Resume" onPress={() => onResume(active)} />
        </>
      ) : (
        <AppText>No saved Reviewer session.</AppText>
      )}
      <AppText variant="heading" accessibilityRole="header">
        Mock Exam progress
      </AppText>
      <AppText>Completed mock exams: {exams.completed}</AppText>
      <AppText>
        Average exam score:{' '}
        {exams.averagePercentage === null
          ? 'Unavailable'
          : `${exams.averagePercentage.toFixed(2)}%`}
      </AppText>
      <AppText>
        Highest exam score:{' '}
        {exams.highestPercentage === null
          ? 'Unavailable'
          : `${exams.highestPercentage.toFixed(2)}%`}
      </AppText>
    </AppScreen>
  );
}
