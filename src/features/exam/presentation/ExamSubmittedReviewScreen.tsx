import { useState } from 'react';
import { View } from 'react-native';
import { AppButton } from '../../../core/components/AppButton';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { spacing } from '../../../core/theme/tokens';
import { ContentBlocks } from '../../content/presentation/ContentBlocks';
import type { ExamResult } from '../domain/exam';

export function ExamSubmittedReviewScreen({
  result,
  onBack,
}: {
  result: ExamResult;
  onBack(): void;
}) {
  const [position, setPosition] = useState(0);
  const item = result.questions[position]!;
  const correct = item.question.correctChoiceId;
  return (
    <AppScreen>
      <AppButton variant="text" label="Back to Results" onPress={onBack} />
      <AppText variant="title" accessibilityRole="header">
        Submitted question {position + 1} of {result.questions.length}
      </AppText>
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
      {item.choiceOrder.map((id, index) => {
        const choice = item.question.choices.find((candidate) => candidate.id === id)!;
        return (
          <View key={id} style={{ gap: spacing.xs }}>
            <AppText variant="heading">
              Choice {index + 1}
              {id === correct ? ' — Correct answer' : ''}
              {id === item.selectedChoiceId ? ' — Your answer' : ''}
            </AppText>
            <ContentBlocks blocks={choice.blocks} onReady={() => {}} onError={() => {}} />
          </View>
        );
      })}
      <AppText variant="heading">Correct answer</AppText>
      <AppText>
        {item.selectedChoiceId === null
          ? 'Unanswered'
          : item.selectedChoiceId === correct
            ? 'Correct'
            : 'Incorrect'}
      </AppText>
      {item.question.explanation ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">Explanation</AppText>
          <ContentBlocks blocks={item.question.explanation} onReady={() => {}} onError={() => {}} />
        </View>
      ) : null}
      <AppButton
        variant="secondary"
        label="Previous"
        disabled={position === 0}
        onPress={() => setPosition(position - 1)}
      />
      <AppButton
        variant="secondary"
        label="Next"
        disabled={position === result.questions.length - 1}
        onPress={() => setPosition(position + 1)}
      />
    </AppScreen>
  );
}
