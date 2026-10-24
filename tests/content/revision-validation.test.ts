import { validateRevision } from '../../src/features/content/domain/revisionValidation';
import { StudyError } from '../../src/features/study/domain/study';
import { studyEntry, studyQuestion } from '../fixtures/study';

test('validates complete rich content and preserves exact UTF-16 mark offsets', () => {
  const question = validateRevision(JSON.parse(JSON.stringify(studyQuestion())), studyEntry());
  expect(question.prompt[0]).toEqual({
    kind: 'text',
    text: '😀 Café is open.',
    marks: [{ start: 3, end: 7, role: 'target' }],
  });
  expect(question.stimulus?.blocks[0]).toEqual({
    kind: 'text',
    text: 'A shared passage.',
    marks: [],
  });
  expect(question.explanation?.[0]).toEqual({
    kind: 'math',
    expression: '(1 + 2) / 3',
    accessibleText: 'one plus two, divided by three',
  });
});

test.each([
  { id: 'different' },
  { id: ' fixture-grammar ' },
  { version: 2 },
  { categoryId: 'generalInformation', subcategoryId: 'pnpHistory' },
  { status: 'inactive' },
  { stimulus: undefined },
  {
    stimulus: {
      id: 'different',
      version: 1,
      blocks: [{ kind: 'text', text: 'passage', marks: [] }],
    },
  },
  {
    stimulus: {
      id: ' fixture-passage ',
      version: 1,
      blocks: [{ kind: 'text', text: 'passage', marks: [] }],
    },
  },
  {
    stimulus: {
      id: 'fixture-passage',
      version: 2,
      blocks: [{ kind: 'text', text: 'passage', marks: [] }],
    },
  },
  { explanation: undefined },
  { expiresAt: '2026-10-09T00:00:00Z' },
  { asOfDate: '2026-10-08' },
  { publishedAt: '2026-10-08T00:00:00Z' },
  { isCurrentEvent: true },
  { extra: true },
])('rejects revision metadata or required-content disagreement (%#)', (change) => {
  expect(() => validateRevision({ ...studyQuestion(), ...change }, studyEntry())).toThrow(
    StudyError,
  );
});

test('asset references must agree including URI and kinds, independent of metadata ordering', () => {
  const asset = { id: 'fixture-asset', version: 1, uri: 'https://example.com/a' };
  const second = { id: 'fixture-second-asset', version: 2, uri: 'https://example.com/second' };
  const question = studyQuestion({
    explanation: [
      { kind: 'image', ...asset, width: 100, height: 100, alt: 'Fixture' },
      { kind: 'diagram', ...second, width: 100, height: 100, alt: 'Second fixture' },
    ],
  });
  const entry = studyEntry({
    supportedKinds: ['image', 'diagram', 'text'],
    assets: [second, asset],
  });
  expect(validateRevision(question, entry).id).toBe('fixture-grammar');
  for (const assets of [
    [],
    [second, { ...asset, version: 2 }],
    [second, { ...asset, uri: 'https://example.com/b' }],
  ]) {
    expect(() => validateRevision(question, { ...entry, assets })).toThrow(StudyError);
  }
});

test('rejects oversized revision payloads without leaking raw data in the error', () => {
  expect(() =>
    validateRevision(
      { ...studyQuestion(), prompt: [{ kind: 'text', text: 'é'.repeat(400_000), marks: [] }] },
      studyEntry(),
    ),
  ).toThrow('This question could not be loaded. Please try again.');
});

test('current-event revisions require reviewed context and matching verification provenance', () => {
  const metadata = {
    categoryId: 'generalInformation',
    subcategoryId: 'currentEvents',
    isCurrentEvent: true,
    publishedAt: '2026-10-01T00:00:00Z',
    asOfDate: '2026-10-01',
    expiresAt: '2026-10-08T00:00:00Z',
  } as const;
  const entry = studyEntry(metadata);
  const raw = { ...studyQuestion(), ...metadata };
  expect(() => validateRevision(raw, entry)).toThrow(StudyError);
  expect(
    validateRevision(
      {
        ...raw,
        reviewedTimeContext: 'As of October 1',
        verification: {
          sourceUrl: 'https://example.com/official',
          verifiedAt: '2026-10-01T00:00:00Z',
          asOfDate: '2026-10-01',
        },
      },
      entry,
    ).id,
  ).toBe(entry.id);
});
