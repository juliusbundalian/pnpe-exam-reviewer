import { historicalOverlays } from './historical-overlays';
import { resolve } from 'node:path';
import { QuestionSchema } from '../../src/features/content/domain/question';
import { readFile } from 'node:fs/promises';
import { buildReviewPacket } from '../../tools/questions/review-packet';
import { contentDigest, publishable, publicationSet } from '../../tools/questions/publication';
import { sourceRegistry } from '../../tools/questions/source-registry';
import { canonicalJson, combineBySourceKey, reviewDigest } from '../../tools/questions/editorial';
import {
  loadCandidates,
  loadOverlays,
  loadIdentityRegistry,
  approvedPublication,
} from '../../tools/questions/source-workflow';

it('accounts for all approved short occurrences without inventing lineage', async () => {
  const root = resolve(__dirname, '../..');
  const candidates = (await loadCandidates(root)).filter((c) => c.original.sourceId === 'short');
  const overlays = (await loadOverlays(root)).filter((o) => o.sourceKey.startsWith('short:'));
  const registry = await loadIdentityRegistry(root);
  expect(candidates).toHaveLength(20);
  expect(overlays.map((o) => o.sourceKey).sort()).toEqual(
    candidates.map((c) => c.original.sourceKey).sort(),
  );
  expect(new Set(overlays.map((o) => o.sourceKey)).size).toBe(20);
  for (const overlay of overlays) {
    expect(overlay.status).toBe('approved');
    expect(
      publishable(overlay, {
        issues: candidates.find((c) => c.original.sourceKey === overlay.sourceKey)!.issues,
      }).ok,
    ).toBe(true);
    expect(overlay.approval?.digest).toBe(contentDigest(QuestionSchema.parse(overlay.proposed)));
    expect(overlay.approval?.reviewDigest).toBe(reviewDigest(overlay.review!));
    const question = QuestionSchema.parse(overlay.proposed);
    const original = candidates.find((c) => c.original.sourceKey === overlay.sourceKey)!.original;
    expect(question.id).toBe(registry[overlay.sourceKey]);
    expect(question.version).toBe(1);
    expect(question.sources).toHaveLength(1);
    expect(question.sources[0]).toMatchObject({
      sourceId: original.sourceId,
      checksum: original.evidence.checksum,
      section: original.section,
      originalNumber: String(original.ordinal),
      pages: { start: original.pageStart, end: original.pageEnd },
      originalChoiceLabels: original.rawChoices!.map((c) => c.label),
      originalAnswer: original.rawAnswer,
      evidenceLocator: original.evidence.locator,
      links: original.evidence.links,
      imageLocations: original.evidence.imageLocations,
    });
    for (const issue of candidates.find((c) => c.original.sourceKey === overlay.sourceKey)!
      .issues) {
      if (!issue.blocking) continue;
      expect(overlay.review?.issues?.some((i) => canonicalJson(i) === canonicalJson(issue))).toBe(
        true,
      );
      expect(overlay.review?.resolutions?.some((r) => r.code === issue.code)).toBe(true);
    }
  }
});

it('publishes the exact owner-reviewed revisions through whole-corpus reconstruction', async () => {
  const root = resolve(__dirname, '../..');
  const candidates = await loadCandidates(root);
  const overlays = historicalOverlays(await loadOverlays(root));
  const digest = '547ce4e6164e2ad39a978beb6c112600d629f61d311fe8df62048bb4bf4198d8';
  const evidence = resolve(root, 'evidence/editorial/short-initial', digest);
  const snapshot = JSON.parse(await readFile(resolve(evidence, 'overlays.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(resolve(evidence, 'manifest.json'), 'utf8'));
  const packet = buildReviewPacket('short-initial', candidates, snapshot);
  expect(packet.manifest).toEqual(manifest);
  expect(packet.manifest.packetDigest).toBe(digest);
  expect(packet.markdown).toBe(await readFile(resolve(evidence, 'review.md'), 'utf8'));
  const selected = new Set<string>(
    manifest.rows.map((row: { sourceKey: string }) => row.sourceKey),
  );
  expect(selected.size).toBe(20);
  for (const overlay of overlays) {
    if (!selected.has(overlay.sourceKey)) {
      expect(overlay.status).not.toBe('approved');
      expect(overlay.approval).toBeUndefined();
      continue;
    }
    const { approval, ...revision } = overlay;
    expect({ ...revision, status: 'needsReview' }).toEqual(
      snapshot.find((row: { sourceKey: string }) => row.sourceKey === overlay.sourceKey),
    );
    expect(approval?.at).toBe('2026-10-07T09:16:03Z');
    expect(approval?.reviewer).toBe('Project owner');
    const changedReview = JSON.parse(JSON.stringify(overlay));
    changedReview.review.issues.push({
      code: 'POST_APPROVAL_CHANGE',
      blocking: false,
      message: 'Changed after approval',
    });
    expect(publishable(changedReview).ok).toBe(false);
    const changedContent = JSON.parse(JSON.stringify(overlay));
    changedContent.proposed.prompt[0].text += ' changed after approval';
    expect(publishable(changedContent).ok).toBe(false);
  }
  const reconstructed = publicationSet(combineBySourceKey(candidates, overlays));
  expect(reconstructed.errors).toEqual([]);
  const questions = approvedPublication(
    candidates,
    overlays,
    await loadIdentityRegistry(root),
    sourceRegistry,
    reconstructed.questions,
  );
  expect(questions).toHaveLength(20);
  expect(
    JSON.parse(await readFile(resolve(root, 'data/questions.json'), 'utf8')).filter(
      (q: { sources: { sourceId: string }[] }) => q.sources[0]?.sourceId === 'short',
    ),
  ).toEqual(questions);
});
