import { useMemo } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../core/components/AppText';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { spacing } from '../../../core/theme/tokens';
import type { Question } from '../domain/question';
import {
  ContentBlocks,
  ContentRenderError,
  supportsBlocks,
  hasContentArea,
  type ContentBlocksProps,
} from './ContentBlocks';

export type QuestionReadingViewProps = Pick<ContentBlocksProps, 'onReady' | 'onError'> & {
  question: Question;
};

export function QuestionReadingView({ question, onReady, onError }: QuestionReadingViewProps) {
  const { colors } = useTheme();
  const sections = useMemo(
    () => [
      ...(question.stimulus ? [question.stimulus.blocks] : []),
      question.prompt,
      ...question.choices.map((choice) => choice.blocks),
      ...(question.explanation ? [question.explanation] : []),
    ],
    [question],
  );
  const layout = useMemo(() => ({ seen: new Set<string>(), ready: false }), [question]);
  const correctIndex = question.choices.findIndex(
    (choice) => choice.id === question.correctChoiceId,
  );
  if (correctIndex < 0 || !sections.every(supportsBlocks))
    return <ContentRenderError onError={onError} />;
  const laidOut = (section: string) => {
    layout.seen.add(section);
    if (!layout.ready && layout.seen.size === sections.length + 2) {
      layout.ready = true;
      onReady();
    }
  };
  return (
    <View style={{ gap: spacing.lg }}>
      {question.isCurrentEvent ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption">
            Historical revision · As of {question.asOfDate ?? 'unknown'}
          </AppText>
          {question.reviewedTimeContext ? <AppText>{question.reviewedTimeContext}</AppText> : null}
        </View>
      ) : null}
      {question.stimulus ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            Shared passage
          </AppText>
          <ContentBlocks
            blocks={question.stimulus.blocks}
            onReady={() => laidOut('stimulus')}
            onError={onError}
          />
        </View>
      ) : null}
      <ContentBlocks blocks={question.prompt} onReady={() => laidOut('prompt')} onError={onError} />
      {question.choices.map((choice, index) => (
        <View
          key={choice.id}
          style={{
            gap: spacing.sm,
            borderLeftWidth: index === correctIndex ? 3 : 0,
            borderColor: colors.success,
            paddingLeft: spacing.md,
          }}
        >
          <AppText
            variant="heading"
            style={index === correctIndex ? { color: colors.success } : undefined}
          >
            Choice {index + 1}
            {index === correctIndex ? ' — Correct answer' : ''}
          </AppText>
          <ContentBlocks
            blocks={choice.blocks}
            onReady={() => laidOut(`choice:${index}`)}
            onError={onError}
          />
        </View>
      ))}
      <View style={{ gap: spacing.sm }}>
        <AppText
          variant="heading"
          accessibilityRole="header"
          onLayout={(event) => {
            if (hasContentArea(event)) laidOut('answer');
          }}
          style={{ color: colors.success }}
        >
          Correct answer
        </AppText>
        <AppText
          onLayout={(event) => {
            if (hasContentArea(event)) laidOut('answer-reference');
          }}
        >
          Choice {correctIndex + 1}
        </AppText>
      </View>
      {question.explanation ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            Explanation
          </AppText>
          <ContentBlocks
            blocks={question.explanation}
            onReady={() => laidOut('explanation')}
            onError={onError}
          />
        </View>
      ) : null}
    </View>
  );
}
