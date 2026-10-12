import { AppButton } from '../../../core/components/AppButton';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { ErrorView, LoadingView } from '../../../core/components/StateViews';
import { taxonomy } from '../../content/domain/taxonomy';
import type { ExamConfig } from '../domain/selection';

const examLabels: Record<string, string> = {
  communicationSkills: 'Verbal Reasoning',
  criticalThinking: 'Logical Reasoning',
};

export function ExamPreflightScreen({
  config,
  blocked,
  hasActive,
  busy,
  error,
  onStart,
  onResume,
  onBack,
}: {
  config: ExamConfig;
  blocked: string | null;
  hasActive: boolean;
  busy: boolean;
  error: string | null;
  onStart(): void;
  onResume(): void;
  onBack(): void;
}) {
  return (
    <AppScreen>
      <AppButton variant="text" label="Back" onPress={onBack} />
      <AppText variant="title">Mock Exam preflight</AppText>
      <AppText>{config.questionCount} questions</AppText>
      <AppText>{config.durationMinutes} minutes</AppText>
      {taxonomy.map((category) => (
        <AppText key={category.id}>
          {examLabels[category.id] ?? category.label}: {config.distribution[category.id]}
        </AppText>
      ))}
      <AppText>
        {config.passingPercentage}% application practice threshold. These practice settings are not
        a verified official examination claim.
      </AppText>
      {blocked ? <AppText accessibilityRole="alert">{blocked}</AppText> : null}
      {busy ? <LoadingView message="Preparing all exam questions" /> : null}
      {error ? <ErrorView message={error} onRetry={hasActive ? onResume : onStart} /> : null}
      {hasActive ? (
        <AppButton variant="primary" label="Resume Exam" disabled={busy} onPress={onResume} />
      ) : (
        <AppButton
          variant="primary"
          label="Start Exam"
          disabled={busy || !!blocked}
          onPress={onStart}
        />
      )}
    </AppScreen>
  );
}
