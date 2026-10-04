import { readFileSync } from 'node:fs';
import { sourceDocumentSchema } from '../../tools/questions/source-schema';
import { sourceRegistry, verifySource } from '../../tools/questions/source-registry';
import { parseShort } from '../../tools/questions/parsers/short';
import { parseLarge } from '../../tools/questions/parsers/large';
import { parseNotes } from '../../tools/questions/parsers/notes';
import { normalize } from '../../tools/questions/normalize';
import { assignIdentity, type IdentityRegistry } from '../../tools/questions/identity';
import { createHash } from 'node:crypto';
const adapters = { short: parseShort, comprehensive: parseLarge, notes: parseNotes };
const records = sourceRegistry.map((source) => {
  verifySource(source.sourceId, readFileSync(`references/${source.filename}`));
  const document = sourceDocumentSchema.parse(JSON.parse(readFileSync(`evidence/reference-extraction/${source.sourceId}/document.json`, 'utf8')));
  return adapters[source.sourceId as keyof typeof adapters](document);
});
test('all 687 observed occurrences have prompts or blocked image evidence', () => {
  expect(records.map((source) => source.length)).toEqual([20, 477, 190]);
  for (const record of records.flat()) {
    expect(record.rawPrompt !== null || (record.evidence.imageLocations.length > 0 && record.issues.some((issue) => issue.blocking))).toBe(true);
  }
});
test('known comprehensive source defects remain blocked and uncorrected', () => {
  for (const key of ['I:5', 'IV:2', 'V:11', 'V:12', 'VIII:33', 'VIII:34', 'X:8', 'XII:15', 'XV:1', 'XV:5', 'XV:7']) {
    const record = records[1]!.find((record) => record.sourceKey === `comprehensive:${key}`)!;
    expect(record).toBeDefined();
    expect(normalize(record).issues.some((issue) => issue.blocking)).toBe(true);
  }
  expect(records[1]!.find((record) => record.sourceKey === 'comprehensive:X:8')?.rawExplanation).toContain('380 + 120 = 520');
});
test('all notes remain answer-only candidates and current events lack dates', () => {
  expect(records[2]).toHaveLength(190);
  for (const record of records[2]!) expect(normalize(record).proposed.choices).toBeNull();
  const current = records[2]!.filter((record) => record.section === 'Current Events');
  expect(current).toHaveLength(35);
  expect(current.every((record) => normalize(record).issues.some((issue) => issue.code === 'missing-time-context'))).toBe(true);
});
test('truncated registered document cannot bypass source accounting', () => {
  const document = sourceDocumentSchema.parse(JSON.parse(readFileSync('evidence/reference-extraction/short/document.json', 'utf8')));
  const truncated = { ...document, pageCount: 1, pages: document.pages.slice(0,1) };
  expect(() => parseShort(truncated)).toThrow(/source count mismatch/i);
});
test('paragraph groups retain five labels and duplicate pair retains complete context', () => {
  const groups = records[1]!.filter((record) => record.section === 'VI');
  expect(new Set(groups.map((record) => record.stimulus?.id)).size).toBe(16);
  expect(groups.every((record) => record.rawChoices?.length === 5)).toBe(true);
});
test('all observed source keys have unique registered logical identities', () => {
  const registry = JSON.parse(readFileSync('data/identity-registry.json', 'utf8')) as IdentityRegistry;
  expect(Object.keys(registry)).toHaveLength(687);
  const ids = records.flat().map((record) => assignIdentity(record.sourceKey, registry));
  expect(new Set(ids).size).toBe(687);
});
test('two independent parsing/normalization runs preserve IDs and byte-identical output', () => {
  const registry = JSON.parse(readFileSync('data/identity-registry.json', 'utf8')) as IdentityRegistry;
  const first = records.flat().map((record) => ({ id: assignIdentity(record.sourceKey, registry), candidate: normalize(record) }));
  const second = sourceRegistry.flatMap((source) => {
    const document = sourceDocumentSchema.parse(JSON.parse(readFileSync(`evidence/reference-extraction/${source.sourceId}/document.json`, 'utf8')));
    return adapters[source.sourceId as keyof typeof adapters](document).map((record) => ({ id: assignIdentity(record.sourceKey, registry), candidate: normalize(record) }));
  });
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect(digest(second)).toBe(digest(first));
  expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
});
