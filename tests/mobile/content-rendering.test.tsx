import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { ContentBlocks } from '../../src/features/content/presentation/ContentBlocks';
import { QuestionReadingView } from '../../src/features/content/presentation/QuestionReadingView';
import { studyQuestion } from '../fixtures/study';
import type { ContentBlock } from '../../src/features/content/domain/content';

function layoutAll() {
  screen
    .UNSAFE_getAllByType(Text)
    .filter((node) => node.props.onLayout)
    .forEach((node) =>
      fireEvent(node, 'layout', { nativeEvent: { layout: { width: 320, height: 50 } } }),
    );
}

test('answer_is_visible_without_interaction', () => {
  render(
    <ThemeProvider>
      <QuestionReadingView question={studyQuestion()} onReady={jest.fn()} onError={jest.fn()} />
    </ThemeProvider>,
  );
  expect(screen.getByText('Correct answer')).toBeOnTheScreen();
  expect(screen.queryByText('Submit Answer')).toBeNull();
  expect(screen.getByText('Explanation')).toBeOnTheScreen();
  expect(screen.getByLabelText('one plus two, divided by three')).toBeOnTheScreen();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
});

test('passage precedes prompt and choices preserve original order with a textual correct label', () => {
  render(
    <ThemeProvider>
      <QuestionReadingView question={studyQuestion()} onReady={jest.fn()} onError={jest.fn()} />
    </ThemeProvider>,
  );
  const readable = screen
    .UNSAFE_getAllByType(Text)
    .map((node) => node.props.accessibilityLabel)
    .filter(Boolean);
  expect(readable.indexOf('A shared passage.')).toBeLessThan(
    readable.findIndex((label) => label.includes('😀 Café is open.')),
  );
  expect(readable.indexOf('20')).toBeLessThan(readable.indexOf('30'));
  expect(screen.getByText('Choice 2 — Correct answer')).toBeVisible();
});

test.each([
  'A shared passage.',
  '😀 Café is open. Grammar target: Café.',
  '20',
  '30',
  'Correct answer',
  'Choice 2',
  'one plus two, divided by three',
])(
  'complete layout waits for required section %s and deduplicates repeated layouts',
  (withheld) => {
    const onReady = jest.fn();
    render(
      <ThemeProvider>
        <QuestionReadingView question={studyQuestion()} onReady={onReady} onError={jest.fn()} />
      </ThemeProvider>,
    );
    const nodes = screen.UNSAFE_getAllByType(Text).filter((node) => node.props.onLayout);
    const target =
      withheld === 'Correct answer' || withheld === 'Choice 2'
        ? screen.getByText(withheld)
        : screen.getByLabelText(withheld);
    const matching = (node: (typeof nodes)[number]) =>
      withheld === 'Correct answer' || withheld === 'Choice 2'
        ? (Array.isArray(node.props.children)
            ? node.props.children.join('')
            : node.props.children) === withheld
        : node.props.accessibilityLabel === withheld;
    nodes
      .filter((node) => !matching(node))
      .forEach((node) =>
        fireEvent(node, 'layout', { nativeEvent: { layout: { width: 320, height: 50 } } }),
      );
    expect(onReady).not.toHaveBeenCalled();
    fireEvent(target, 'layout', { nativeEvent: { layout: { width: 320, height: 50 } } });
    expect(onReady).toHaveBeenCalledTimes(1);
    layoutAll();
    expect(onReady).toHaveBeenCalledTimes(1);
  },
);

test('zero-area layout is not a complete reading receipt', () => {
  const onReady = jest.fn();
  render(
    <ThemeProvider>
      <QuestionReadingView question={studyQuestion()} onReady={onReady} onError={jest.fn()} />
    </ThemeProvider>,
  );
  screen
    .UNSAFE_getAllByType(Text)
    .filter((node) => node.props.onLayout)
    .forEach((node) =>
      fireEvent(node, 'layout', { nativeEvent: { layout: { width: 0, height: 0 } } }),
    );
  expect(onReady).not.toHaveBeenCalled();
  layoutAll();
  expect(onReady).toHaveBeenCalledTimes(1);
});

test('every block within one section must lay out before its ready callback', () => {
  const onReady = jest.fn();
  render(
    <ThemeProvider>
      <ContentBlocks
        blocks={[
          { kind: 'text', text: 'First paragraph.', marks: [] },
          {
            kind: 'math',
            expression: '(1 + 2) / 3',
            accessibleText: 'one plus two, divided by three',
          },
          { kind: 'text', text: 'Last paragraph.', marks: [] },
        ]}
        onReady={onReady}
        onError={jest.fn()}
      />
    </ThemeProvider>,
  );
  const event = { nativeEvent: { layout: { width: 320, height: 50 } } };
  fireEvent(screen.getByLabelText('First paragraph.'), 'layout', event);
  fireEvent(screen.getByLabelText('Last paragraph.'), 'layout', event);
  expect(onReady).not.toHaveBeenCalled();
  fireEvent(screen.getByLabelText('one plus two, divided by three'), 'layout', event);
  expect(onReady).toHaveBeenCalledTimes(1);
});

test('malformed required marked text fails visibly without a ready callback', () => {
  const onReady = jest.fn(),
    onError = jest.fn();
  render(
    <ThemeProvider>
      <ContentBlocks
        blocks={[{ kind: 'text', text: 'Short.', marks: [{ start: 3, end: 100, role: 'target' }] }]}
        onReady={onReady}
        onError={onError}
      />
    </ThemeProvider>,
  );
  expect(screen.getByRole('alert')).toBeVisible();
  layoutAll();
  expect(onReady).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid-content' }));
});

test.each(['stimulus', 'prompt', 'choice', 'explanation'] as const)(
  'unsupported_%s_never_reports_ready',
  (section) => {
    const unsupported: ContentBlock = {
      kind: 'table',
      headers: ['Required'],
      rows: [['Unsupported']],
    };
    const base = studyQuestion();
    const question = {
      ...base,
      ...(section === 'stimulus'
        ? { stimulus: { id: 'passage', version: 1, blocks: [unsupported] } }
        : {}),
      ...(section === 'prompt' ? { prompt: [unsupported] } : {}),
      ...(section === 'choice'
        ? { choices: [{ id: 'c1', blocks: [unsupported] }, base.choices[1]!] }
        : {}),
      ...(section === 'explanation' ? { explanation: [unsupported] } : {}),
    };
    const onReady = jest.fn(),
      onError = jest.fn();
    render(
      <ThemeProvider>
        <QuestionReadingView question={question} onReady={onReady} onError={onError} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('alert')).toBeVisible();
    layoutAll();
    expect(onReady).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid-content' }));
  },
);

test('overlapping grammar marks render every character once and announce targets across surrogate pairs', () => {
  const text = '😀 Café is open.';
  render(
    <ThemeProvider>
      <ContentBlocks
        blocks={[
          {
            kind: 'text',
            text,
            marks: [
              { start: 3, end: 7, role: 'target' },
              { start: 5, end: 10, role: 'emphasis' },
            ],
          },
        ]}
        onReady={jest.fn()}
        onError={jest.fn()}
      />
    </ThemeProvider>,
  );
  const content = screen.getByLabelText('😀 Café is open. Grammar target: Café.');
  expect(content).toHaveTextContent(text);
  const segments = content
    .findAllByType(Text)
    .filter((node) => typeof node.props.children === 'string');
  expect(segments.map((node) => node.props.children).join('')).toBe(text);
  expect(screen.getByText('fé')).toHaveStyle({
    fontWeight: '700',
    textDecorationLine: 'underline',
  });
});

test.each([
  { start: 1, end: 2 },
  { start: 0, end: 1 },
])(
  'a mark boundary $start:$end inside a surrogate pair preserves the whole character',
  ({ start, end }) => {
    render(
      <ThemeProvider>
        <ContentBlocks
          blocks={[{ kind: 'text', text: '😀 ok', marks: [{ start, end, role: 'target' }] }]}
          onReady={jest.fn()}
          onError={jest.fn()}
        />
      </ThemeProvider>,
    );
    const text = screen.getByLabelText('😀 ok. Grammar target: 😀.');
    expect(text).toHaveTextContent('😀 ok');
    expect(
      text
        .findAllByType(Text)
        .filter((node) => typeof node.props.children === 'string')
        .map((node) => node.props.children),
    ).toEqual(['😀', ' ok']);
  },
);

test('multiline math displays exact grouping and supplied accessible description without execution', () => {
  const expression = '(a + b) / c\n√(x² + 1) <script>';
  render(
    <ThemeProvider>
      <ContentBlocks
        blocks={[
          {
            kind: 'math',
            expression,
            accessibleText: 'a plus b, divided by c; square root of x squared plus one',
          },
        ]}
        onReady={jest.fn()}
        onError={jest.fn()}
      />
    </ThemeProvider>,
  );
  expect(
    screen.getByLabelText('a plus b, divided by c; square root of x squared plus one').props
      .children,
  ).toBe(expression);
});

test('optional explanation is omitted and historical current-event context is visible', () => {
  const base = { ...studyQuestion() };
  delete base.explanation;
  render(
    <ThemeProvider>
      <QuestionReadingView
        question={{
          ...base,
          isCurrentEvent: true,
          asOfDate: '2025-01-01',
          reviewedTimeContext: 'Office holders as of January 2025.',
        }}
        onReady={jest.fn()}
        onError={jest.fn()}
      />
    </ThemeProvider>,
  );
  expect(screen.queryByText('Explanation')).toBeNull();
  expect(screen.getByText('Historical revision · As of 2025-01-01')).toBeVisible();
  expect(screen.getByText('Office holders as of January 2025.')).toBeVisible();
});
