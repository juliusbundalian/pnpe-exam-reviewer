import { ContentBlockSchema } from '../../src/features/content/domain/content';
import { QuestionSchema } from '../../src/features/content/domain/question';
import { testQuestion } from '../fixtures/content/question';

test('correct choice identity and taxonomy are structural invariants', () => {
  expect(QuestionSchema.safeParse(testQuestion()).success).toBe(true);
  expect(QuestionSchema.safeParse(testQuestion({ correctChoiceId: 'missing' })).success).toBe(
    false,
  );
  expect(QuestionSchema.safeParse(testQuestion({ categoryId: 'generalInformation' })).success).toBe(
    false,
  );
});

test('current events cannot activate with unknown dates', () => {
  expect(QuestionSchema.safeParse(testQuestion({ isCurrentEvent: true })).success).toBe(false);
});

test.each([
  [
    { id: 'c1', blocks: [{ kind: 'text', text: '20', marks: [] }] },
    { id: 'c1', blocks: [{ kind: 'text', text: '30', marks: [] }] },
  ],
  [
    { id: 'c1', blocks: [{ kind: 'text', text: '  THIRTY ', marks: [] }] },
    { id: 'c2', blocks: [{ kind: 'text', text: 'thirty', marks: [] }] },
  ],
])('rejects duplicate choice identity or normalized rendered text (%#)', (...choices) => {
  expect(QuestionSchema.safeParse({ ...testQuestion(), choices }).success).toBe(false);
});

test.each([
  { kind: 'text', text: 'word', marks: [{ start: 0, end: 5, role: 'target' }] },
  { kind: 'text', text: 'word', marks: [{ start: 2, end: 2, role: 'target' }] },
  {
    kind: 'image',
    id: 'asset',
    version: 1,
    uri: 'https://example.com/a.png',
    width: 10,
    height: 10,
  },
  { kind: 'table', headers: ['A', 'B'], rows: [['one']] },
  { kind: 'unknown', text: 'do not discard' },
])('rejects invalid rich-content blocks (%#)', (block) => {
  expect(ContentBlockSchema.safeParse(block).success).toBe(false);
});

test('math preserves grouping with its accessible description', () => {
  expect(
    ContentBlockSchema.parse({
      kind: 'math',
      expression: '(2 + 3) * 4',
      accessibleText: 'Two plus three, multiplied by four',
    }),
  ).toEqual({
    kind: 'math',
    expression: '(2 + 3) * 4',
    accessibleText: 'Two plus three, multiplied by four',
  });
});

test('marked text preserves leading whitespace and original offsets', () => {
  const block = { kind: 'text', text: ' word ', marks: [{ start: 1, end: 5, role: 'target' }] };
  expect(ContentBlockSchema.parse(block)).toEqual(block);
});

test.each([
  {
    kind: 'image',
    id: 'asset',
    version: 1,
    uri: 'http://example.com/a.png',
    width: 10,
    height: 10,
    alt: 'Chart',
  },
  {
    kind: 'diagram',
    id: 'asset',
    version: 0,
    uri: 'bundled://a.png',
    width: 10,
    height: 10,
    alt: 'Diagram',
  },
  { kind: 'text', text: '   ', marks: [] },
])('rejects unusable required content (%#)', (block) => {
  expect(ContentBlockSchema.safeParse(block).success).toBe(false);
});

test('accepts reviewed assets with accessible descriptions', () => {
  expect(
    ContentBlockSchema.safeParse({
      kind: 'image',
      id: 'chart',
      version: 1,
      uri: 'bundled://charts/a.png',
      width: 640,
      height: 480,
      alt: 'Population chart',
    }).success,
  ).toBe(true);
});

test('identical prompts retain distinct versioned stimuli', () => {
  const one = QuestionSchema.parse(
    testQuestion({
      stimulus: {
        id: 'passage-one',
        version: 1,
        blocks: [{ kind: 'text', text: 'First passage', marks: [] }],
      },
    }),
  );
  const two = QuestionSchema.parse(
    testQuestion({
      stimulus: {
        id: 'passage-two',
        version: 2,
        blocks: [{ kind: 'text', text: 'Second passage', marks: [] }],
      },
    }),
  );
  expect(one.stimulus?.id).toBe('passage-one');
  expect(two.stimulus?.id).toBe('passage-two');
});

test('rejects incomplete shared stimulus dependencies', () => {
  expect(
    QuestionSchema.safeParse({ ...testQuestion(), stimulus: { id: 'absent', version: 1 } }).success,
  ).toBe(false);
});

test.each([
  { version: 0 },
  { createdAt: 'unknown' },
  { updatedAt: '2020-01-01T00:00:00Z' },
  { sources: [] },
  { sources: [{ sourceId: 'file-only' }] },
  { correctChoiceId: ['c1', 'c2'] },
])('rejects malformed immutable revision metadata (%#)', (overrides) => {
  expect(QuestionSchema.safeParse({ ...testQuestion(), ...overrides }).success).toBe(false);
});

test('requires reviewed current-event context and expiry after publication', () => {
  const current = {
    ...testQuestion(),
    isCurrentEvent: true,
    reviewedTimeContext: 'As of October 2026',
    publishedAt: '2026-10-04T00:00:00Z',
    asOfDate: '2026-10-04',
    expiresAt: '2026-11-04T00:00:00Z',
    verification: {
      asOfDate: '2026-10-04',
      verifiedAt: '2026-10-04T00:00:00Z',
      sourceUrl: 'https://example.com/primary',
    },
  };
  expect(QuestionSchema.safeParse(current).success).toBe(true);
  expect(QuestionSchema.safeParse({ ...current, expiresAt: current.publishedAt }).success).toBe(
    false,
  );
  expect(QuestionSchema.safeParse({ ...current, verification: undefined }).success).toBe(false);
});
