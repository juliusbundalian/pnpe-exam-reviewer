import { useState } from 'react';
import { View } from 'react-native';
import { AppButton } from '../../../core/components/AppButton';
import { AppModal } from '../../../core/components/AppModal';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { ContentBlocks } from '../../content/presentation/ContentBlocks';
import { spacing } from '../../../core/theme/tokens';
import type { ExamAttempt } from '../domain/exam';
import { ExamNavigator, type NavigatorMode } from './ExamNavigator';

function displayTime(ms: number) {
  const seconds = Math.ceil(ms / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ExamRunnerScreen({
  attempt,
  remainingMs,
  busy,
  error,
  bookmarked,
  bookmarksEnabled,
  onAnswer,
  onFlag,
  onMove,
  onBookmark,
  onRetry,
  onSubmit,
  onLeave,
}: {
  attempt: ExamAttempt;
  remainingMs: number;
  busy: boolean;
  error: string | null;
  bookmarked: boolean;
  bookmarksEnabled: boolean;
  onAnswer(choiceId: string | null): void;
  onFlag(): void;
  onMove(ordinal: number): void;
  onBookmark(): void;
  onRetry(): void;
  onSubmit(): void;
  onLeave(): void;
}) {
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [mode, setMode] = useState<NavigatorMode>('compact');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const item = attempt.questions[attempt.position]!;
  const unanswered = attempt.questions.filter(
    (question) => question.selectedChoiceId === null,
  ).length;
  return (
    <AppScreen>
      <AppText variant="title">
        Question {attempt.position + 1} of {attempt.questions.length}
      </AppText>
      <AppText accessibilityLiveRegion="polite">Time remaining {displayTime(remainingMs)}</AppText>
      <AppText>{item.entry.categoryId}</AppText>
      {item.question.stimulus ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">Shared passage</AppText>
          <ContentBlocks
            blocks={item.question.stimulus.blocks}
            onReady={() => {}}
            onError={() => {}}
          />
        </View>
      ) : null}
      <ContentBlocks blocks={item.question.prompt} onReady={() => {}} onError={() => {}} />
      {item.choiceOrder.map((choiceId, index) => {
        const choice = item.question.choices.find((candidate) => candidate.id === choiceId)!;
        return (
          <View key={choiceId} style={{ gap: spacing.xs }}>
            <AppButton
              variant={item.selectedChoiceId === choiceId ? 'secondary' : 'text'}
              label={`Choice ${index + 1}`}
              accessibilityState={{ selected: item.selectedChoiceId === choiceId }}
              disabled={busy}
              onPress={() => onAnswer(choiceId)}
            />
            <ContentBlocks blocks={choice.blocks} onReady={() => {}} onError={() => {}} />
          </View>
        );
      })}
      <AppButton
        variant="text"
        label="Clear answer"
        disabled={busy || item.selectedChoiceId === null}
        onPress={() => onAnswer(null)}
      />
      <AppButton
        variant="text"
        label={item.flagged ? 'Remove flag' : 'Flag question'}
        disabled={busy}
        onPress={onFlag}
      />
      <AppButton
        variant="text"
        label={bookmarked ? 'Remove bookmark' : 'Save question'}
        disabled={busy || !bookmarksEnabled}
        onPress={onBookmark}
      />
      {busy ? (
        <AppText accessibilityLiveRegion="polite">Saving…</AppText>
      ) : !error ? (
        <AppText accessibilityLiveRegion="polite">Saved</AppText>
      ) : null}
      {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
      {error ? <AppButton variant="secondary" label="Retry save" onPress={onRetry} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <AppButton
          variant="secondary"
          label="Previous"
          disabled={busy || attempt.position === 0}
          onPress={() => onMove(attempt.position - 1)}
        />
        <AppButton
          variant="secondary"
          label="Next"
          disabled={busy || attempt.position === attempt.questions.length - 1}
          onPress={() => onMove(attempt.position + 1)}
        />
        <AppButton
          variant="text"
          label="Navigator"
          onPress={() => setNavigatorOpen((value) => !value)}
        />
      </View>
      {navigatorOpen ? (
        <ExamNavigator
          attempt={attempt}
          mode={mode}
          onMode={setMode}
          onSelect={(ordinal) => {
            setNavigatorOpen(false);
            onMove(ordinal);
          }}
        />
      ) : null}
      <AppButton variant="text" label="Leave exam" onPress={() => setLeaveOpen(true)} />
      <AppButton
        variant="primary"
        label="Submit Exam"
        disabled={busy}
        onPress={() => setSubmitOpen(true)}
      />
      <AppModal visible={leaveOpen} title="Leave exam?" onClose={() => setLeaveOpen(false)}>
        <AppText>The clock continues while you are away.</AppText>
        <AppButton variant="secondary" label="Stay" onPress={() => setLeaveOpen(false)} />
        <AppButton
          variant="text"
          label="Leave and Resume Later"
          onPress={() => {
            setLeaveOpen(false);
            onLeave();
          }}
        />
      </AppModal>
      <AppModal visible={submitOpen} title="Submit exam?" onClose={() => setSubmitOpen(false)}>
        <AppText>{unanswered} unanswered questions. Submitting ends this attempt.</AppText>
        <AppButton variant="secondary" label="Continue Exam" onPress={() => setSubmitOpen(false)} />
        <AppButton
          variant="primary"
          label="Submit Anyway"
          onPress={() => {
            setSubmitOpen(false);
            onSubmit();
          }}
        />
      </AppModal>
    </AppScreen>
  );
}
