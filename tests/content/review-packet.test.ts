import * as fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, mkdir, symlink, link, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testQuestion } from '../fixtures/content/question';
import { normalize } from '../../tools/questions/normalize';
import { canonicalJson, type EditorialOverlay } from '../../tools/questions/editorial';
import { contentDigest } from '../../tools/questions/publication';
import { buildReviewPacket, writeReviewPacket } from '../../tools/questions/review-packet';

jest.mock('node:fs/promises', () => ({
  __esModule: true,
  ...jest.requireActual('node:fs/promises'),
}));

const question = testQuestion();
const lineage = question.sources[0]!;
const candidate = normalize({
  sourceKey: 'synthetic-test-only:fixture:1',
  sourceId: lineage.sourceId,
  section: lineage.section,
  ordinal: 1,
  pageStart: lineage.pages.start,
  pageEnd: lineage.pages.end,
  rawPrompt: 'What is 15% of 200?',
  rawChoices: [
    { label: 'A', text: '20' },
    { label: 'B', text: '30' },
  ],
  rawAnswer: lineage.originalAnswer,
  rawExplanation: null,
  stimulus: null,
  issues: [],
  evidence: {
    checksum: lineage.checksum,
    locator: lineage.evidenceLocator,
    links: [],
    imageLocations: [],
  },
});
candidate.issues = [];
const overlay: EditorialOverlay = {
  sourceKey: candidate.original.sourceKey,
  proposed: question,
  status: 'needsReview',
  rationale: 'Independent arithmetic derivation',
  evidence: ['15 × 200 / 100 = 30'],
  review: { issues: [], resolutions: [] },
};
const build = (value = overlay) => buildReviewPacket('fixture', [candidate], [value]);

test('exact revision binds content, review, authoritative source and markdown', () => {
  const first = build();
  expect(first.manifest.rows[0]?.contentDigest).toBe(contentDigest(testQuestion()));
  for (const text of [
    'What is 15% of 200?',
    '30',
    'c1',
    'c2',
    'Original answer',
    'Pages',
    'Corrections',
    'Authoritative issues',
    'Open issues',
    'quantitativeReasoning',
    'Complete JSON revision',
  ])
    expect(first.markdown).toContain(text);
  const changes: EditorialOverlay[] = [
    { ...overlay, rationale: 'Updated verification rationale' },
    { ...overlay, evidence: ['changed evidence'] },
    {
      ...overlay,
      review: {
        issues: [],
        resolutions: [{ code: 'example', rationale: 'verified', evidence: ['proof'] }],
      },
    },
    { ...overlay, proposed: testQuestion({ choices: [...question.choices].reverse() }) },
    {
      ...overlay,
      proposed: testQuestion({
        stimulus: {
          id: 's',
          version: 1,
          blocks: [{ kind: 'math', expression: 'x+1', accessibleText: 'x plus one' }],
        },
      }),
    },
    {
      ...overlay,
      proposed: testQuestion({
        prompt: [
          {
            kind: 'text',
            text: 'What is 15% of 200?',
            marks: [{ start: 0, end: 4, role: 'target' }],
          },
        ],
      }),
    },
  ];
  changes.forEach((value) =>
    expect(build(value).manifest.packetDigest).not.toBe(first.manifest.packetDigest),
  );
  for (const changed of [
    { ...candidate, issues: [{ code: 'source', blocking: true, message: 'source problem' }] },
    { ...candidate, original: { ...candidate.original, rawAnswer: 'A' } },
  ])
    expect(buildReviewPacket('fixture', [changed], [overlay]).manifest.packetDigest).not.toBe(
      first.manifest.packetDigest,
    );
  expect(() => buildReviewPacket('fixture', [candidate], [overlay, overlay])).toThrow();
  expect(() => buildReviewPacket('../bad', [candidate], [overlay])).toThrow();
  const body = first.markdown.slice(0, first.markdown.lastIndexOf('\nPacket digest:'));
  expect(first.manifest.packetDigest).toBe(
    createHash('sha256')
      .update(
        canonicalJson({
          batchId: 'fixture',
          rows: first.manifest.rows,
          overlays: first.overlays,
          originals: [candidate],
          markdown: body,
        }),
      )
      .digest('hex'),
  );
});

test('rows follow authoritative candidate order regardless of overlay order', () => {
  const second = {
    ...candidate,
    original: { ...candidate.original, sourceKey: 'synthetic-test-only:fixture:2', ordinal: 2 },
  };
  const packet = buildReviewPacket(
    'fixture',
    [candidate, second],
    [{ ...overlay, sourceKey: second.original.sourceKey }, overlay],
  );
  expect(packet.manifest.rows.map((row) => row.sourceKey)).toEqual([
    candidate.original.sourceKey,
    second.original.sourceKey,
  ]);
  expect(packet.overlays.map((row) => row.sourceKey)).toEqual([
    candidate.original.sourceKey,
    second.original.sourceKey,
  ]);
  const first = build({
    ...overlay,
    review: { resolutions: [{ code: 'x', rationale: 'r', evidence: ['before'] }] },
  });
  const changed = build({
    ...overlay,
    review: { resolutions: [{ code: 'x', rationale: 'r', evidence: ['after'] }] },
  });
  expect(changed.manifest.packetDigest).not.toBe(first.manifest.packetDigest);
  expect(changed.manifest.rows[0]?.reviewDigest).not.toBe(first.manifest.rows[0]?.reviewDigest);
});

test('authoritative issues remain open until the exact issue is reviewed and resolved', () => {
  const issue = { code: 'source', blocking: true, message: 'new source problem' };
  const source = { ...candidate, issues: [issue] };
  const resolution = { code: issue.code, rationale: 'checked', evidence: ['proof'] };
  const openSection = (review: EditorialOverlay['review']) => {
    const packet = buildReviewPacket('fixture', [source], [{ ...overlay, review }]);
    return packet.markdown.split('Open issues:\n')[1]!.split('\n\nSchema diagnostics:')[0]!;
  };
  expect(openSection({ resolutions: [resolution] })).toContain(issue.message);
  expect(
    openSection({
      issues: [{ ...issue, message: 'older source problem' }],
      resolutions: [resolution],
    }),
  ).toContain(issue.message);
  expect(openSection({ issues: [issue] })).toContain(issue.message);
  expect(openSection({ issues: [issue], resolutions: [resolution] })).not.toContain(issue.message);
});

test('invalid drafts remain visible, unsupported blocks blocked, delimiters escaped', () => {
  const draft = build({
    ...overlay,
    status: 'draft',
    proposed: { prompt: [{ kind: 'text', text: '*draft* [x]', marks: [] }] },
  });
  expect(draft.manifest.rows).toHaveLength(1);
  expect(draft.manifest.rows[0]?.contentDigest).toBeNull();
  expect(draft.markdown).toContain('Schema diagnostics');
  expect(draft.markdown).toContain('\\*draft\\* \\[x\\]');
  const blocked = build({
    ...overlay,
    proposed: testQuestion({ prompt: [{ kind: 'table', headers: ['a'], rows: [['b']] }] }),
  });
  expect(blocked.markdown).toContain('BLOCKED: unsupported table');
});

test('review metadata and originals are visible and input mutation cannot alter packet', () => {
  const input = {
    ...overlay,
    review: {
      factualVerification: {
        sourceUrl: 'https://example.com/proof',
        verifiedAt: '2026-10-07T00:00:00Z',
        rationale: 'verification',
      },
      issues: [{ code: 'open', blocking: true, message: 'unresolved' }],
      resolutions: [{ code: 'closed', rationale: 'corrected', evidence: ['proof'] }],
    },
  };
  const packet = build(input);
  for (const value of [
    'https://example.com/proof',
    '2026-10-07T00:00:00Z',
    'unresolved',
    'corrected',
    'proof',
  ])
    expect(packet.markdown).toContain(value);
  input.rationale = 'mutated';
  expect(packet.overlays[0]?.rationale).toBe(overlay.rationale);
});

test('writer reserves immutable directory and preserves existing symlink/hardlink evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'review-packet-'));
  try {
    const packet = build();
    const destination = await writeReviewPacket(root, packet);
    const names = ['review.md', 'manifest.json', 'overlays.json'];
    const before = await Promise.all(
      names.map((name) => readFile(join(destination, name), 'utf8')),
    );
    expect(before[0]).toBe(packet.markdown);
    expect(JSON.parse(before[1]!)).toEqual(packet.manifest);
    expect(JSON.parse(before[2]!)).toEqual(packet.overlays);
    await expect(writeReviewPacket(root, packet)).rejects.toThrow();
    expect(
      await Promise.all(names.map((name) => readFile(join(destination, name), 'utf8'))),
    ).toEqual(before);
    await rm(destination, { recursive: true });
    await symlink(root, destination);
    await expect(writeReviewPacket(root, packet)).rejects.toThrow();
    await rm(destination);
    await mkdir(destination);
    const owner = join(root, 'owner.json');
    await writeFile(owner, 'owner evidence');
    await link(owner, join(destination, 'manifest.json'));
    await expect(writeReviewPacket(root, packet)).rejects.toThrow();
    expect(await readFile(owner, 'utf8')).toBe('owner evidence');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('partial write failure preserves the first artifact and refuses retry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'review-packet-partial-'));
  const packet = build();
  const destination = join(root, 'evidence/editorial/fixture', packet.manifest.packetDigest);
  const realWrite = fs.writeFile;
  const injected = jest.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
    if (String(args[0]).endsWith(join(packet.manifest.packetDigest, 'manifest.json')))
      throw new Error('injected manifest write failure');
    return realWrite(...args);
  });
  try {
    await expect(writeReviewPacket(root, packet)).rejects.toThrow(
      'injected manifest write failure',
    );
    const surviving = await readFile(join(destination, 'review.md'));
    expect(surviving).toEqual(Buffer.from(packet.markdown));
    expect(await fs.readdir(destination)).toEqual(['review.md']);
    injected.mockRestore();
    await expect(writeReviewPacket(root, packet)).rejects.toThrow();
    expect(await readFile(join(destination, 'review.md'))).toEqual(surviving);
    expect(await fs.readdir(destination)).toEqual(['review.md']);
  } finally {
    injected.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});
