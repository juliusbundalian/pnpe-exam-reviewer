import { historicalOverlays } from './historical-overlays';
import { coverageReport } from '../../tools/questions/coverage';
import { digestQuestions } from '../../tools/questions/import-plan';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  canonicalJson,
  reviewDigest,
  type EditorialOverlay,
} from '../../tools/questions/editorial';
import { contentDigest, publishable } from '../../tools/questions/publication';
import { QuestionSchema } from '../../src/features/content/domain/question';
import {
  loadApprovedPublication,
  loadOverlays,
  loadCandidates,
} from '../../tools/questions/source-workflow';

const root = resolve(__dirname, '../..');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

test('owner authorization publishes exactly the 509 reviewed revisions plus the immutable prior twenty', async () => {
  const manifest = await read('docs/verification/editorial-full-corpus/owner-review-manifest.json');
  expect(hash(manifest.revisions)).toBe(
    'befca02b985a7d07d83dfecd457571308304f07e95b87dd526144f7937b5c7fb',
  );
  expect(manifest.revisions).toHaveLength(509);
  const overlays = await loadOverlays(root);
  const authorized = new Map<
    string,
    { contentDigest: string; reviewDigest: string; overlayDigest: string }
  >(manifest.revisions.map((row: { sourceKey: string }) => [row.sourceKey, row]));
  const publication = await loadApprovedPublication(root);
  expect(publication).toHaveLength(529);
  expect(new Set(publication.map((q) => q.id)).size).toBe(529);
  expect(overlays.filter((o) => o.status === 'approved')).toHaveLength(529);
  expect(overlays.filter((o) => o.status === 'draft')).toHaveLength(145);
  expect(overlays.filter((o) => o.status === 'rejected')).toHaveLength(13);
  for (const overlay of overlays) {
    const row = authorized.get(overlay.sourceKey);
    if (row) {
      expect(overlay.status).toBe('approved');
      expect(overlay.approval).toEqual({
        reviewer: 'Project owner',
        at: '2026-10-08T01:48:03Z',
        digest: row.contentDigest,
        reviewDigest: row.reviewDigest,
      });
      expect(contentDigest(QuestionSchema.parse(overlay.proposed))).toBe(row.contentDigest);
      expect(reviewDigest(overlay.review!)).toBe(row.reviewDigest);
      const reviewed = { ...overlay };
      delete reviewed.approval;
      expect(hash({ ...reviewed, status: 'needsReview' })).toBe(row.overlayDigest);
    } else if (!overlay.sourceKey.startsWith('short:')) {
      expect(['draft', 'rejected']).toContain(overlay.status);
      expect(overlay.approval).toBeUndefined();
      expect(publication.some((q) => q.id === (overlay.proposed as { id: string }).id)).toBe(false);
    }
  }
  const index = await read('docs/verification/editorial-full-corpus/review-index.json');
  for (const entry of index.packets) {
    const historical = (await read(entry.paths.overlays)) as EditorialOverlay[];
    for (const previous of historical.filter((o) => o.status !== 'needsReview'))
      expect(overlays.find((o) => o.sourceKey === previous.sourceKey)).toEqual(previous);
  }
  const short = await readFile(resolve(root, 'data/editorial/short-initial.json'));
  expect(createHash('sha256').update(short).digest('hex')).toBe(index.initialApproved.sha256);
  const initial = JSON.parse(short.toString()) as EditorialOverlay[];
  for (const previous of initial)
    expect(publication.find((q) => q.id === (previous.proposed as { id: string }).id)).toEqual(
      previous.proposed,
    );
});

test('changing a reviewed revision after approval fails content and review gates independently', async () => {
  const overlay = (await loadOverlays(root)).find((o) => o.sourceKey === 'comprehensive:I:2')!;
  expect(publishable(overlay).ok).toBe(true);
  const changedContent = structuredClone(overlay);
  (changedContent.proposed as { prompt: { text: string }[] }).prompt[0]!.text += ' changed';
  expect(publishable(changedContent)).toEqual({ ok: false, issues: ['EDITORIAL_APPROVAL_STALE'] });
  const changedReview = structuredClone(overlay);
  changedReview.review!.factualVerification!.rationale += ' changed';
  expect(publishable(changedReview)).toEqual({ ok: false, issues: ['EDITORIAL_REVIEW_STALE'] });
});

test('historical comparisons reject changes beyond the exact authorized status and stamp', async () => {
  const overlay = (await loadOverlays(root)).find((o) => o.sourceKey === 'comprehensive:I:2')!;
  expect(historicalOverlays([overlay])[0]!.status).toBe('needsReview');
  for (const field of ['rationale', 'evidence', 'review', 'proposed', 'approval'] as const) {
    const changed = structuredClone(overlay);
    if (field === 'rationale') changed.rationale += ' changed';
    if (field === 'evidence') changed.evidence = [...changed.evidence, 'changed'];
    if (field === 'review')
      changed.review!.factualVerification!.verifiedAt = '2026-10-08T02:00:00Z';
    if (field === 'proposed')
      (changed.proposed as { updatedAt: string }).updatedAt = '2026-10-08T02:00:00Z';
    if (field === 'approval') changed.approval!.at = '2026-10-08T02:00:00Z';
    expect(() => historicalOverlays([changed])).toThrow(
      /Unexpected approval|Historical revision changed/,
    );
  }
});

test('recorded coverage describes the complete strict publication and all fifteen subcategories', async () => {
  const record = await read('docs/verification/editorial-full-corpus/approved-publication.json');
  const clock = () => new Date(record.observedAt);
  const questions = await loadApprovedPublication(root, undefined, clock);
  const coverage = coverageReport(
    await loadCandidates(root),
    await loadOverlays(root),
    questions,
    clock,
  );
  expect(coverage).toEqual(record.coverage);
  expect(digestQuestions(questions)).toBe(record.publicationDigest);
  expect(coverage.bySubcategory).toHaveLength(15);
  expect(coverage.quotas.map((row) => [row.eligible, row.required, row.shortage])).toEqual([
    [134, 35, 0],
    [276, 40, 0],
    [41, 25, 0],
    [78, 50, 0],
  ]);
  expect(coverage.defaultExamReady).toBe(true);
  expect(
    coverage.bySubcategory.find((row) => row.id === 'dataInterpretation')!.counts.approvedEligible,
  ).toBe(0);
  expect(
    coverage.bySubcategory.find((row) => row.id === 'publicServiceConduct')!.counts
      .approvedEligible,
  ).toBe(0);
  const currentEvent = questions.find((q) => q.isCurrentEvent)!;
  expect(currentEvent).toBeDefined();
  // A later snapshot must fail closed rather than silently exclude the authorized current-event row.
  await expect(
    loadApprovedPublication(root, undefined, () => new Date('2100-01-01T00:00:00Z')),
  ).rejects.toThrow('PUBLICATION_EXPIRED');
});
