import { readFileSync } from 'node:fs';
import {
  CatalogEntrySchema,
  CatalogShardSchema,
  QuestionRefSchema,
} from '../../src/features/content/domain/catalog';
import { QuestionSchema } from '../../src/features/content/domain/question';
import {
  catalogEntryForQuestion,
  validateRevision,
} from '../../src/features/content/domain/revisionValidation';
import {
  CloudManifestChunkSchema,
  CloudBookmarkSchema,
} from '../../src/features/study/data/cloudStudySchemas';
import { ReviewerSessionSchema, BookmarkSchema } from '../../src/features/study/domain/study';
import { studyEntry, studyQuestion, studySession, studyBookmark } from '../fixtures/study';

const opaqueId = 'comprehensive:V:Passage 3 – Feng Shui';
const withStimulus = (id: unknown, version: unknown = 1) => ({
  ...studyEntry(),
  stimulus: { id, version },
});
const cloudChunk = (entry: unknown) => ({
  uid: 'fixture-user',
  deviceId: 'fixture-device',
  sessionId: 'fixture-session',
  index: 0,
  items: [{ ordinal: 0, entry }],
  writtenAt: 100,
});
const cloudBookmark = (entry: unknown) => ({
  ...studyBookmark(),
  entry,
  serverRevision: 1,
  lastOperationId: 'fixture-operation',
  writtenAt: 100,
});

test('all 529 approved revisions retain their opaque stimulus identities through catalog and revision validation', () => {
  const bank = JSON.parse(readFileSync('data/questions.json', 'utf8')) as unknown[];
  expect(bank).toHaveLength(529);
  const questions = bank.map((raw) => QuestionSchema.parse(raw));
  const stimuli = questions.flatMap((question) =>
    question.stimulus ? [question.stimulus.id] : [],
  );
  expect(stimuli).toHaveLength(90);
  expect(new Set(stimuli).size).toBe(19);
  expect(stimuli).toContain(opaqueId);
  const entries = questions.map(catalogEntryForQuestion);
  for (let start = 0; start < entries.length; start += 200)
    expect(CatalogShardSchema.parse(entries.slice(start, start + 200))).toEqual(
      entries.slice(start, start + 200),
    );
  for (const [index, question] of questions.entries())
    expect(validateRevision(bank[index], entries[index]!)).toEqual(question);
});

test.each([
  opaqueId,
  'opaque/embedded identity',
  '__opaque__',
  'é'.repeat(750),
  '😀'.repeat(375),
  'passage: a\u00a0b',
])('opaque stimulus identity is preserved in revisions and personal DTOs (%#)', (id) => {
  const entry = withStimulus(id);
  expect(CatalogEntrySchema.parse(entry).stimulus?.id).toBe(id);
  const raw = { ...studyQuestion(), stimulus: { ...studyQuestion().stimulus!, id } };
  expect(validateRevision(raw, entry as ReturnType<typeof studyEntry>).stimulus?.id).toBe(id);
  expect(
    ReviewerSessionSchema.parse({ ...studySession(), items: [{ ordinal: 0, entry }] }).items[0]
      ?.entry.stimulus?.id,
  ).toBe(id);
  expect(BookmarkSchema.parse({ ...studyBookmark(), entry }).entry.stimulus?.id).toBe(id);
  expect(CloudManifestChunkSchema.parse(cloudChunk(entry)).items[0]?.entry.stimulus?.id).toBe(id);
  expect(CloudBookmarkSchema.parse(cloudBookmark(entry)).entry.stimulus?.id).toBe(id);
});

test.each([
  '',
  ' ',
  ' padded',
  'padded ',
  '\u00a0padded',
  'padded\uFEFF',
  'line\nbreak',
  'control\u0000',
  'control\u007f',
  'control\u0085',
  'line\u2028break',
  'a'.repeat(1501),
  'é'.repeat(751),
  '😀'.repeat(376),
  '\ud800',
  3,
  null,
])('malformed stimulus identity is rejected consistently without trimming (%#)', (id) => {
  const entry = withStimulus(id);
  expect(CatalogEntrySchema.safeParse(entry).success).toBe(false);
  expect(
    QuestionSchema.safeParse({ ...studyQuestion(), stimulus: { ...studyQuestion().stimulus!, id } })
      .success,
  ).toBe(false);
  expect(CloudManifestChunkSchema.safeParse(cloudChunk(entry)).success).toBe(false);
  expect(CloudBookmarkSchema.safeParse(cloudBookmark(entry)).success).toBe(false);
});

test.each([
  { id: opaqueId, version: 0 },
  { id: opaqueId, version: Number.MAX_SAFE_INTEGER + 1 },
  { id: opaqueId, version: 1, blocks: [] },
])('stimulus references retain strict keys and safe positive version bounds (%#)', (stimulus) => {
  const entry = { ...studyEntry(), stimulus };
  expect(CatalogEntrySchema.safeParse(entry).success).toBe(false);
  expect(CloudManifestChunkSchema.safeParse(cloudChunk(entry)).success).toBe(false);
  expect(CloudBookmarkSchema.safeParse(cloudBookmark(entry)).success).toBe(false);
});

test('opaque stimulus acceptance does not loosen question or asset document identities', () => {
  for (const id of [opaqueId, 'embedded/id', '__reserved__', ' padded ']) {
    expect(QuestionRefSchema.safeParse({ id, version: 1 }).success).toBe(false);
    expect(CatalogEntrySchema.safeParse({ ...studyEntry(), id }).success).toBe(false);
    expect(
      CatalogEntrySchema.safeParse({
        ...studyEntry(),
        supportedKinds: ['image'],
        assets: [{ id, version: 1, uri: 'https://example.test/a' }],
      }).success,
    ).toBe(false);
  }
});
