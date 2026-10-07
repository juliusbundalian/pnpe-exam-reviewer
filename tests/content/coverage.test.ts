import { coverageReport } from '../../tools/questions/coverage';
import { normalize } from '../../tools/questions/normalize';
import { contentDigest } from '../../tools/questions/publication';
import { reviewDigest, type EditorialOverlay } from '../../tools/questions/editorial';
import { taxonomy } from '../../src/features/content/domain/taxonomy';
import { testQuestion } from '../fixtures/content/question';
import { paragraphFixture } from './fixtures/source-records';

const clock = () => new Date('2026-12-01T00:00:00Z');
function fixture(index = 0, question = testQuestion({ id: `fixture-${index}` })) {
  question = testQuestion({
    ...question,
    sources: question.sources.map((s) => ({ ...s, originalNumber: String(index) })),
  });
  const candidate = normalize(paragraphFixture('Synthetic context'));
  candidate.original.evidence.checksum = question.sources[0]!.checksum;
  candidate.original.evidence.locator = question.sources[0]!.evidenceLocator;
  candidate.original.sourceKey = `synthetic-test-only:fixture:${index}`;
  candidate.original.sourceId = 'synthetic-test-only';
  candidate.original.section = 'fixture';
  candidate.original.rawAnswer = question.sources[0]!.originalAnswer;
  candidate.original.rawChoices = question.sources[0]!.originalChoiceLabels.map((label) => ({
    label,
    text: 'Synthetic alternative',
  }));
  candidate.issues = [];
  const overlay: EditorialOverlay = {
    sourceKey: candidate.original.sourceKey,
    proposed: question,
    status: 'approved',
    rationale: 'Synthetic only',
    evidence: [],
    approval: {
      reviewer: 'test-only',
      at: '2026-10-04T00:00:00Z',
      digest: contentDigest(question),
    },
  };
  return { candidate, overlay, question };
}
test('absent overlays are unavailable; all quotas and subcategories remain visible', () => {
  const { candidate } = fixture();
  const report = coverageReport([candidate], [], [], clock);
  expect(report.occurrences).toBe(1);
  expect(report.unmapped.unavailable).toBe(1);
  expect(report.quotas.map((q) => [q.required, q.eligible, q.shortage])).toEqual([
    [35, 0, 35],
    [40, 0, 40],
    [25, 0, 25],
    [50, 0, 50],
  ]);
  expect(report.bySubcategory).toHaveLength(15);
  expect(report.bySubcategory.find((r) => r.id === 'dataInterpretation')).toBeDefined();
  expect(report.defaultExamReady).toBe(false);
});
test.each(['needsReview', 'rejected', 'draft'] as const)(
  'retains %s without eligibility',
  (status) => {
    const { candidate, overlay } = fixture();
    overlay.status = status;
    delete overlay.approval;
    expect(coverageReport([candidate], [overlay], [], clock).bySource[0]!.counts[status]).toBe(1);
  },
);
test('invalid proposals remain draft and unmapped', () => {
  const { candidate, overlay } = fixture();
  overlay.status = 'draft';
  overlay.proposed = {};
  expect(coverageReport([candidate], [overlay], [], clock).unmapped.draft).toBe(1);
});
test('stale approval and unsupported transport are blocked', () => {
  const { candidate, overlay } = fixture();
  overlay.approval!.digest = 'a'.repeat(64);
  expect(
    coverageReport([candidate], [overlay], [], clock).bySource[0]!.counts.approvedBlocked,
  ).toBe(1);
  const q = testQuestion({ prompt: [{ kind: 'table', headers: ['h'], rows: [['v']] }] });
  const table = fixture(1, q);
  expect(
    coverageReport([table.candidate], [table.overlay], [], clock).bySource[0]!.counts
      .approvedBlocked,
  ).toBe(1);
});
test('sound expired current-event approval is counted separately', () => {
  const q = testQuestion({
    categoryId: 'generalInformation',
    subcategoryId: 'currentEvents',
    isCurrentEvent: true,
    reviewedTimeContext: 'Synthetic dated event',
    publishedAt: '2026-10-04T00:00:00Z',
    asOfDate: '2026-10-04',
    expiresAt: '2026-11-04T00:00:00Z',
    verification: {
      sourceUrl: 'https://example.com/primary',
      verifiedAt: '2026-10-04T00:00:00Z',
      asOfDate: '2026-10-04',
    },
  });
  const { candidate, overlay } = fixture(1, q);
  overlay.review = {
    factualVerification: {
      sourceUrl: 'https://example.com/primary',
      verifiedAt: '2026-10-04T00:00:00Z',
      rationale: 'Synthetic verification',
    },
  };
  overlay.approval!.reviewDigest = reviewDigest(overlay.review);
  expect(
    coverageReport([candidate], [overlay], [], clock).bySource[0]!.counts.approvedExpired,
  ).toBe(1);
});
test('eligible IDs must be unique and match sound approvals', () => {
  const { candidate, overlay, question } = fixture();
  expect(() => coverageReport([candidate], [overlay], [question, question], clock)).toThrow();
  expect(() => coverageReport([candidate], [], [question], clock)).toThrow();
  expect(() => coverageReport([candidate], [overlay], [testQuestion()], clock)).toThrow();
});
test('150 distinct approved fixtures satisfy quotas; 149 are short in one category', () => {
  const required = [35, 40, 25, 50];
  const fixtures = taxonomy.flatMap((category, i) =>
    Array.from({ length: required[i]! }, (_, j) =>
      fixture(
        i * 100 + j,
        testQuestion({
          id: `quota-${i}-${j}`,
          categoryId: category.id,
          subcategoryId: category.subcategories.find(
            (s) => !['constitutionAndLaws', 'currentEvents'].includes(s.id),
          )!.id,
        }),
      ),
    ),
  );
  const report = (rows: typeof fixtures) =>
    coverageReport(
      rows.map((r) => r.candidate),
      rows.map((r) => r.overlay),
      rows.map((r) => r.question),
      clock,
    );
  expect(report(fixtures).defaultExamReady).toBe(true);
  expect(report(fixtures.slice(0, -1)).quotas.map((q) => q.shortage)).toEqual([0, 0, 0, 1]);
});

test('unregistered additional source lineage cannot support eligibility', () => {
  const q = testQuestion({
    sources: [...testQuestion().sources, { ...testQuestion().sources[0]!, sourceId: 'unknown' }],
  });
  const { candidate, overlay, question } = fixture(2, q);
  expect(() => coverageReport([candidate], [overlay], [question], clock)).toThrow();
});
test('authoritative blocking issues prevent eligible or expired classification', () => {
  const { candidate, overlay, question } = fixture();
  candidate.issues = [{ code: 'missing-context', blocking: true, message: 'Missing context' }];
  expect(
    coverageReport([candidate], [overlay], [], clock).bySource[0]!.counts.approvedBlocked,
  ).toBe(1);
  expect(() => coverageReport([candidate], [overlay], [question], clock)).toThrow();
});
test('reviewed image remains blocked without supported learner transport', () => {
  const asset = {
    kind: 'image' as const,
    id: 'figure',
    version: 1,
    uri: 'bundled://figure.png',
    width: 10,
    height: 10,
    alt: 'Synthetic figure',
  };
  const { candidate, overlay } = fixture(
    3,
    testQuestion({ stimulus: { id: 's', version: 1, blocks: [asset] } }),
  );
  overlay.review = {
    assets: [
      {
        id: asset.id,
        version: asset.version,
        uri: asset.uri,
        status: 'reviewed',
        evidence: ['Synthetic review'],
      },
    ],
  };
  overlay.approval!.reviewDigest = reviewDigest(overlay.review);
  expect(
    coverageReport([candidate], [overlay], [], clock).bySource[0]!.counts.approvedBlocked,
  ).toBe(1);
});

test('same eligible ID with changed content rejects the revision mismatch', () => {
  const { candidate, overlay, question } = fixture();
  expect(
    coverageReport([candidate], [overlay], [question], clock).bySource[0]!.counts.approvedEligible,
  ).toBe(1);
  const changed = testQuestion({
    ...question,
    explanation: [{ kind: 'text', text: 'Changed explanation', marks: [] }],
  });
  expect(changed.id).toBe(question.id);
  expect(() => coverageReport([candidate], [overlay], [changed], clock)).toThrow(
    `Eligible revision mismatch: ${question.id}`,
  );
});
