import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../../core/components/AppButton';
import { AppModal } from '../../../core/components/AppModal';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { ExamIconButton } from './ExamIconButton';
import { AppText } from '../../../core/components/AppText';
import { ContentBlocks } from '../../content/presentation/ContentBlocks';
import { ChoiceCard, QuestionCard } from '../../content/presentation/QuestionCards';
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
  visitedQuestions,
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
  visitedQuestions?: ReadonlySet<number>;
}) {
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const navigatorTarget = useRef<View>(null);
  const leaveTarget = useRef<View>(null);
  const submitTarget = useRef<View>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [attempt.position]);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [mode, setMode] = useState<NavigatorMode>('compact');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const item = attempt.questions[attempt.position]!;
  const unanswered = attempt.questions.filter(
    (question) => question.selectedChoiceId === null,
  ).length;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.appBar}>
          <ExamIconButton
            buttonRef={leaveTarget}
            icon="arrow-back"
            label="Leave exam"
            onPress={() => setLeaveOpen(true)}
          />
          <AppText variant="heading" accessibilityRole="header" style={styles.appTitle}>
            Question {attempt.position + 1} of {attempt.questions.length}
          </AppText>
          <ExamIconButton
            buttonRef={navigatorTarget}
            icon="grid-outline"
            label="Navigator"
            disabled={busy}
            onPress={() => setNavigatorOpen(true)}
          />
        </View>
        <View style={styles.timerRow}>
          <AppText variant="caption" tone="secondary">
            Time remaining
          </AppText>
          <AppText variant="button" style={{ fontVariant: ['tabular-nums'] }}>
            {displayTime(remainingMs)}
          </AppText>
        </View>
      </View>
      <ScrollView
        ref={scroll}
        testID="exam-question-scroll"
        style={styles.body}
        contentContainerStyle={styles.content}
      >
        <View style={styles.questionTools}>
          <AppText
            variant="caption"
            tone="secondary"
            accessibilityLiveRegion="polite"
            style={{ flex: 1 }}
          >
            {busy ? 'Saving…' : error ? 'Answer not saved' : 'Saved'}
          </AppText>
          <ExamIconButton
            icon={item.flagged ? 'flag' : 'flag-outline'}
            label={item.flagged ? 'Remove flag' : 'Flag question'}
            selected={item.flagged}
            disabled={busy}
            onPress={onFlag}
          />
          <ExamIconButton
            icon={bookmarked ? 'bookmark' : 'bookmark-outline'}
            label={bookmarked ? 'Remove bookmark' : 'Save question'}
            selected={bookmarked}
            disabled={busy || !bookmarksEnabled}
            onPress={onBookmark}
          />
        </View>
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
        <QuestionCard
          categoryId={item.question.categoryId}
          blocks={item.question.prompt}
          onReady={() => {}}
          onError={() => {}}
        />
        {item.choiceOrder.map((choiceId, index) => {
          const choice = item.question.choices.find((candidate) => candidate.id === choiceId)!;
          return (
            <ChoiceCard
              key={choiceId}
              number={index + 1}
              blocks={choice.blocks}
              selected={item.selectedChoiceId === choiceId}
              disabled={busy}
              onPress={() => onAnswer(choiceId)}
              onReady={() => {}}
              onError={() => {}}
            />
          );
        })}
        <AppButton
          variant="text"
          label="Clear answer"
          disabled={busy || item.selectedChoiceId === null}
          onPress={() => onAnswer(null)}
        />
        {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
        {error ? <AppButton variant="secondary" label="Retry save" onPress={onRetry} /> : null}
      </ScrollView>
      <View
        style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.footerContent}>
          <View style={styles.navigation}>
            <AppButton
              variant="secondary"
              label="Previous"
              disabled={busy || attempt.position === 0}
              onPress={() => onMove(attempt.position - 1)}
              style={styles.navigationButton}
            />
            {attempt.position < attempt.questions.length - 1 ? (
              <AppButton
                variant="primary"
                label="Next"
                disabled={busy}
                onPress={() => onMove(attempt.position + 1)}
                style={styles.navigationButton}
              />
            ) : (
              <AppButton
                ref={submitTarget}
                variant="primary"
                label="Submit Exam"
                disabled={busy}
                onPress={() => setSubmitOpen(true)}
                style={styles.navigationButton}
              />
            )}
          </View>
          {unanswered === 0 && attempt.position < attempt.questions.length - 1 ? (
            <AppButton
              ref={submitTarget}
              variant="text"
              label="Submit Exam"
              disabled={busy}
              onPress={() => setSubmitOpen(true)}
            />
          ) : null}
        </View>
      </View>
      <AppModal
        visible={navigatorOpen}
        presentation="sheet"
        title="Question navigator"
        restoreFocusTarget={navigatorTarget}
        onClose={() => setNavigatorOpen(false)}
        headerAction={
          <ExamIconButton
            icon="close"
            label="Close navigator"
            onPress={() => setNavigatorOpen(false)}
          />
        }
      >
        <ExamNavigator
          attempt={attempt}
          {...(visitedQuestions ? { visitedQuestions } : {})}
          mode={mode}
          onMode={setMode}
          showHeading={false}
          onSelect={(ordinal) => {
            setNavigatorOpen(false);
            onMove(ordinal);
          }}
        />
      </AppModal>
      <AppModal
        restoreFocusTarget={leaveTarget}
        visible={leaveOpen}
        title="Leave exam?"
        onClose={() => setLeaveOpen(false)}
      >
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
      <AppModal
        restoreFocusTarget={submitTarget}
        visible={submitOpen}
        title="Submit exam?"
        onClose={() => setSubmitOpen(false)}
      >
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  appBar: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  appTitle: { flex: 1 },
  timerRow: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  body: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  questionTools: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  navigation: { flexDirection: 'row', gap: spacing.md },
  navigationButton: { flex: 1, minHeight: 48 },
});
