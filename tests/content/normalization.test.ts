import { normalize, normalizeText } from '../../tools/questions/normalize';
import { fingerprint, duplicateReport } from '../../tools/questions/duplicates';
import { assignIdentity, allocateIdentity } from '../../tools/questions/identity';
import { paragraphFixture } from './fixtures/source-records';
import regressionRecords from './fixtures/regression-records.json';
import type { SourceRecord } from '../../tools/questions/parsers/types';
test('identical image bytes at different source placements are exact duplicate suggestions', () => {
  const first = paragraphFixture('Same passage');
  first.evidence.imageLocations = [
    `document.json#page=1&xref=2&bbox=0,0,1,1&image=images/${'a'.repeat(64)}.png`,
  ];
  const second = {
    ...first,
    sourceKey: 'comprehensive:VI:2',
    evidence: {
      ...first.evidence,
      imageLocations: [`other.json#page=9&xref=7&bbox=4,4,9,9&image=images/${'a'.repeat(64)}.png`],
    },
  };
  expect(duplicateReport([normalize(first), normalize(second)]).exact).toEqual([
    ['comprehensive:VI:1', 'comprehensive:VI:2'],
  ]);
});
test('short unrelated rendered content is not near-duplicated by DTO key noise', () => {
  const rawChoices = Array.from({ length: 6 }, (_, index) => ({
    label: String(index),
    text: String(index),
  }));
  const first = normalize({
    ...paragraphFixture('Cat'),
    stimulus: null,
    rawPrompt: 'Dog?',
    rawChoices,
  });
  const second = normalize({
    ...paragraphFixture('Sun'),
    stimulus: null,
    sourceKey: 'comprehensive:VI:2',
    rawPrompt: 'Moon?',
    rawChoices,
  });
  expect(duplicateReport([first, second]).near).toEqual([]);
});

test('normalization preserves negation and mathematical grouping', () => {
  expect(normalizeText('Which is NOT correct?')).toContain('NOT');
  expect(normalizeText('(a + b) / c')).toBe('(a + b) / c');
  expect(normalizeText(' A\u200b  − B²\n C ')).toBe('A − B²\n C');
});
test('a generic prompt in different passages is not a duplicate', () => {
  const base = normalize(paragraphFixture('Passage one'));
  const other = normalize(paragraphFixture('Passage two'));
  expect(fingerprint(base)).not.toBe(fingerprint(other));
});
test('re-extraction keeps source identity after editorial correction', () => {
  const registry = { 'large:VIII:33': 'q-stable-33' };
  expect(assignIdentity('large:VIII:33', registry)).toBe('q-stable-33');
});
test('identity assignment cannot silently allocate or accept collisions', () => {
  expect(() => assignIdentity('unknown', {})).toThrow(/unallocated/i);
  expect(() => allocateIdentity('new', 'q-same', { old: 'q-same' })).toThrow(/collision/i);
});
test('identity lookup cannot mistake inherited object properties for registered IDs', () => {
  expect(() => assignIdentity('toString', {})).toThrow(/unallocated/i);
});
test('exact duplicate report retains both occurrences without merging', () => {
  const first = normalize(paragraphFixture('Same'));
  const second = normalize({
    ...paragraphFixture('Same'),
    sourceKey: 'comprehensive:VI:2',
    ordinal: 2,
  });
  expect(duplicateReport([first, second]).exact).toEqual([
    ['comprehensive:VI:1', 'comprehensive:VI:2'],
  ]);
  expect(first.original.sourceKey).toBe('comprehensive:VI:1');
});
test('normalization preserves source choice labels but proposes opaque IDs and blocks ambiguity', () => {
  const record = paragraphFixture('Same');
  record.rawChoices = [
    { label: 'b', text: 'same' },
    { label: 'b', text: 'same' },
  ];
  const candidate = normalize(record);
  expect(candidate.proposed.choices?.map((choice) => choice.id)).toEqual(['choice-1', 'choice-2']);
  expect(candidate.issues.map((issue) => issue.code)).toEqual(
    expect.arrayContaining(['duplicate-label', 'duplicate-alternative']),
  );
  expect(candidate.state).toBe('needsReview');
});
const observed = regressionRecords as SourceRecord[];
test.each(observed.map((record) => [record.sourceKey, record] as const))(
  '%s remains an unapproved blocked candidate',
  (_key, record) => {
    const candidate = normalize(record);
    expect(candidate.state).toBe('needsReview');
    expect(candidate.issues.some((issue) => issue.blocking)).toBe(true);
    expect(candidate.original).toEqual(record);
  },
);
test('real source duplicate pair fingerprints identically without losing occurrences', () => {
  const first = normalize(observed.find((record) => record.sourceKey === 'comprehensive:VIII:33')!);
  const second = normalize(
    observed.find((record) => record.sourceKey === 'comprehensive:VIII:34')!,
  );
  expect(fingerprint(first)).toBe(fingerprint(second));
  expect(duplicateReport([first, second]).exact).toEqual([
    ['comprehensive:VIII:33', 'comprehensive:VIII:34'],
  ]);
});
test('real duplicate labels and incorrect arithmetic are never silently repaired', () => {
  const labels = normalize(observed.find((record) => record.sourceKey === 'comprehensive:XII:15')!);
  expect(labels.original.rawChoices?.map((choice) => choice.label)).toEqual(['a', 'b', 'b', 'd']);
  expect(labels.proposed.correctChoiceId).toBeNull();
  const arithmetic = normalize(
    observed.find((record) => record.sourceKey === 'comprehensive:X:8')!,
  );
  expect(arithmetic.proposed.explanation?.[0]?.text).toContain('380 + 120 = 520');
});
