import { mkdtemp, mkdir, symlink, rm, realpath, link, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approvedPublication, safeGeneratedPath } from '../../tools/questions/source-workflow';
import { contentDigest } from '../../tools/questions/publication';
import { normalize } from '../../tools/questions/normalize';
import { testQuestion } from '../fixtures/content/question';

const question = testQuestion();
const sourceKey = 'synthetic-test-only:fixture:1';
const record = {
  sourceKey,
  sourceId: 'synthetic-test-only',
  section: 'fixture',
  ordinal: 1,
  pageStart: 1,
  pageEnd: 1,
  rawPrompt: 'What is 15% of 200?',
  rawChoices: [
    { label: 'A', text: '20' },
    { label: 'B', text: '30' },
  ],
  rawAnswer: 'B',
  rawExplanation: null,
  stimulus: null,
  issues: [],
  evidence: {
    checksum: '0'.repeat(64),
    locator: 'tests/fixtures/content/question.ts',
    links: [],
    imageLocations: [],
  },
};
const candidate = { ...normalize(record), issues: [] };
const overlay = {
  sourceKey,
  proposed: question,
  rationale: 'Synthetic test approval',
  evidence: ['fixture'],
  status: 'approved' as const,
  approval: {
    reviewer: 'fixture reviewer',
    at: '2026-10-04T00:00:00Z',
    digest: contentDigest(question),
  },
};
const sources = [{ sourceId: 'synthetic-test-only', sha256: '0'.repeat(64) }];
test('publication is reconstructed from authoritative overlays', () => {
  expect(
    approvedPublication([candidate], [overlay], { [sourceKey]: question.id }, sources, [question]),
  ).toEqual([question]);
});
test('unapproved hand edit is rejected even when question schema remains valid', () => {
  expect(() =>
    approvedPublication([candidate], [overlay], { [sourceKey]: question.id }, sources, [
      testQuestion({ correctChoiceId: 'c1' }),
    ]),
  ).toThrow('digest');
});
test('approved overlay cannot publish an unallocated question identity', () => {
  expect(() =>
    approvedPublication([candidate], [overlay], { [sourceKey]: 'different' }, sources, [question]),
  ).toThrow('identity');
});
test('synthetic source is rejected against runtime source registry', () => {
  expect(() =>
    approvedPublication(
      [candidate],
      [overlay],
      { [sourceKey]: question.id },
      [{ sourceId: 'short', sha256: 'f'.repeat(64) }],
      [question],
    ),
  ).toThrow('source');
});
test('changed authoritative source issues invalidate otherwise current approval', () => {
  expect(() =>
    approvedPublication(
      [{ ...candidate, issues: [{ code: 'missing-key', message: 'No key', blocking: true }] }],
      [overlay],
      { [sourceKey]: question.id },
      sources,
      [question],
    ),
  ).toThrow('Publication');
});
test('source lineage cannot be invented by a signed overlay', () => {
  const changed = testQuestion({
    sources: [{ ...question.sources[0]!, evidenceLocator: 'invented' }],
  });
  expect(() =>
    approvedPublication(
      [candidate],
      [
        {
          ...overlay,
          proposed: changed,
          approval: { ...overlay.approval, digest: contentDigest(changed) },
        },
      ],
      { [sourceKey]: question.id },
      sources,
      [changed],
    ),
  ).toThrow('lineage');
});
test('approved table is rejected at the publication boundary', () => {
  const changed = testQuestion({
    prompt: [{ kind: 'table', headers: ['Heading'], rows: [['Value']] }],
  });
  expect(() =>
    approvedPublication(
      [candidate],
      [
        {
          ...overlay,
          proposed: changed,
          approval: { ...overlay.approval, digest: contentDigest(changed) },
        },
      ],
      { [sourceKey]: question.id },
      sources,
      [changed],
    ),
  ).toThrow('Unsupported');
});
test('generated output rejects hard links to protected source files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnpe-link-'));
  try {
    await mkdir(join(root, 'evidence'));
    const source = join(root, 'original.pdf');
    await writeFile(source, 'original bytes');
    await link(source, join(root, 'evidence/output.json'));
    await expect(safeGeneratedPath(root, 'evidence/output.json')).rejects.toThrow('output');
  } finally {
    await rm(root, { recursive: true });
  }
});
test('generated output rejects sources and symlink escapes before writing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnpe-path-'));
  try {
    await mkdir(join(root, 'evidence'));
    await mkdir(join(root, 'references'));
    await symlink(join(root, 'references'), join(root, 'evidence', 'escape'));
    await expect(safeGeneratedPath(root, 'references/generated')).rejects.toThrow('output');
    await expect(safeGeneratedPath(root, 'evidence/escape/generated')).rejects.toThrow('output');
    expect(await safeGeneratedPath(root, 'evidence/run')).toBe(
      join(await realpath(root), 'evidence/run'),
    );
  } finally {
    await rm(root, { recursive: true });
  }
});
