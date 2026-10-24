import { useEffect, useMemo } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { AppText } from '../../../core/components/AppText';
import { spacing } from '../../../core/theme/tokens';
import { ContentBlockSchema, type ContentBlock } from '../domain/content';
import { StudyError } from '../../study/domain/study';

export type ContentBlocksProps = {
  blocks: readonly ContentBlock[];
  onReady(): void;
  onError(error: StudyError): void;
};

export function hasContentArea(event: LayoutChangeEvent): boolean {
  const { width, height } = event.nativeEvent.layout;
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

/** Required assets/tables stay fail-closed until a complete renderer exists. */
export function supportsBlocks(blocks: readonly ContentBlock[]): boolean {
  return (
    blocks.length > 0 &&
    blocks.every(
      (block) =>
        ContentBlockSchema.safeParse(block).success &&
        (block.kind === 'text' || block.kind === 'math'),
    )
  );
}

export function ContentRenderError({ onError }: Pick<ContentBlocksProps, 'onError'>) {
  useEffect(() => {
    onError(new StudyError('invalid-content'));
  }, [onError]);
  return (
    <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" tone="error">
      This question cannot be displayed completely. It has not been marked viewed.
    </AppText>
  );
}

type TextBlock = Extract<ContentBlock, { kind: 'text' }>;
function textSegments(block: TextBlock) {
  // Offsets use the schema's UTF-16 indices. Expand a split pair rather than
  // rendering a lone surrogate or losing the marked character.
  const splitsPair = (offset: number) =>
    offset > 0 &&
    offset < block.text.length &&
    /[\uD800-\uDBFF]/.test(block.text[offset - 1]!) &&
    /[\uDC00-\uDFFF]/.test(block.text[offset]!);
  const marks = block.marks.map((mark) => ({
    ...mark,
    start: splitsPair(mark.start) ? mark.start - 1 : mark.start,
    end: splitsPair(mark.end) ? mark.end + 1 : mark.end,
  }));
  const boundaries = [
    ...new Set([0, block.text.length, ...marks.flatMap((mark) => [mark.start, mark.end])]),
  ].sort((a, b) => a - b);
  const segments = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]!;
    const active = marks.filter((mark) => mark.start <= start && mark.end >= end);
    return {
      start,
      text: block.text.slice(start, end),
      target: active.some((mark) => mark.role === 'target'),
      emphasis: active.some((mark) => mark.role === 'emphasis'),
    };
  });
  const targets = marks
    .filter((mark) => mark.role === 'target')
    .map((mark) => block.text.slice(mark.start, mark.end));
  return {
    segments,
    label: targets.length
      ? `${block.text}${/[.!?]$/.test(block.text) ? '' : '.'} Grammar target: ${targets.join('; ')}.`
      : block.text,
  };
}

export function ContentBlocks({ blocks, onReady, onError }: ContentBlocksProps) {
  const layout = useMemo(() => ({ seen: new Set<number>(), ready: false }), [blocks]);
  if (!supportsBlocks(blocks)) return <ContentRenderError onError={onError} />;
  const laidOut = (index: number) => {
    layout.seen.add(index);
    if (!layout.ready && layout.seen.size === blocks.length) {
      layout.ready = true;
      onReady();
    }
  };
  return (
    <View style={{ gap: spacing.md }}>
      {blocks.map((block, index) => {
        if (block.kind === 'math')
          return (
            <AppText
              key={index}
              accessible
              accessibilityLabel={block.accessibleText}
              onLayout={(event) => {
                if (hasContentArea(event)) laidOut(index);
              }}
            >
              {block.expression}
            </AppText>
          );
        if (block.kind !== 'text') return null; // supportsBlocks has checked the entire required payload.
        const { segments, label } = textSegments(block);
        return (
          <AppText
            key={index}
            accessible
            accessibilityLabel={label}
            onLayout={(event) => {
              if (hasContentArea(event)) laidOut(index);
            }}
          >
            {segments.map((segment) => (
              <AppText
                key={segment.start}
                accessible={false}
                style={{
                  fontWeight: segment.emphasis ? '700' : '400',
                  textDecorationLine: segment.target ? 'underline' : 'none',
                }}
              >
                {segment.text}
              </AppText>
            ))}
          </AppText>
        );
      })}
    </View>
  );
}
