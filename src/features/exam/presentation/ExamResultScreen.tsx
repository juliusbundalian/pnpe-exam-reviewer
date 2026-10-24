import { AppButton } from '../../../core/components/AppButton';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { taxonomy } from '../../content/domain/taxonomy';
import type { ExamBreakdown, ExamResult } from '../domain/exam';

function percentage(value: number | null) {
  return value === null ? 'No questions' : `${value.toFixed(2)}%`;
}

function examCategoryLabel(id: string): string {
  if (id === 'communicationSkills') return 'Verbal Reasoning';
  if (id === 'criticalThinking') return 'Logical Reasoning';
  return taxonomy.find((category) => category.id === id)?.label ?? id;
}

function examSubcategoryLabel(id: string): string {
  for (const category of taxonomy) {
    for (const child of category.subcategories) {
      if (child.id === id) return child.label;
    }
  }
  return id;
}

function breakdown(group: ExamBreakdown) {
  return `${group.correct} correct, ${group.incorrect} incorrect, ${group.unanswered} unanswered of ${group.total} · ${percentage(group.percentage)}`;
}

export function ExamResultScreen({
  result,
  onReview,
  onHistory,
  onBack,
  onRetrySync,
}: {
  result: ExamResult;
  onReview(): void;
  onHistory(): void;
  onBack(): void;
  onRetrySync(): void;
}) {
  const duration = Math.min(result.durationUsedMs, result.config.durationMinutes * 60_000);
  return (
    <AppScreen>
      <AppButton variant="text" label="Back" onPress={onBack} />
      <AppText variant="title" accessibilityRole="header">
        Mock Exam Results
      </AppText>
      <AppText>{percentage(result.overall.percentage)}</AppText>
      <AppText>
        {result.overall.passed ? 'Practice threshold met' : 'Practice threshold not met'}
      </AppText>
      <AppText>{result.overall.correct} correct</AppText>
      <AppText>{result.overall.incorrect} incorrect</AppText>
      <AppText>{result.overall.unanswered} unanswered</AppText>
      <AppText>
        Completed by {result.reason === 'timeExpired' ? 'time limit' : 'submission'}
      </AppText>
      <AppText>Time used: {Math.floor(duration / 60_000)} minutes</AppText>
      <AppText>Cloud sync: {result.syncState}</AppText>
      {result.syncState !== 'synced' ? (
        <AppButton variant="text" label="Retry sync" onPress={onRetrySync} />
      ) : null}
      <AppText variant="heading" accessibilityRole="header">
        Category scores
      </AppText>
      {result.categories.map((group) => (
        <AppText key={group.id}>
          {examCategoryLabel(group.id)}: {breakdown(group)}
        </AppText>
      ))}
      <AppText variant="heading" accessibilityRole="header">
        Subcategory scores
      </AppText>
      {result.subcategories.map((group) => (
        <AppText key={group.id}>
          {examSubcategoryLabel(group.id)}: {breakdown(group)}
        </AppText>
      ))}
      <AppButton variant="primary" label="Review submitted answers" onPress={onReview} />
      <AppButton variant="text" label="Exam History" onPress={onHistory} />
    </AppScreen>
  );
}
