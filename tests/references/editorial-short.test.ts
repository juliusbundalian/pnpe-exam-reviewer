import { resolve } from 'node:path';
import { QuestionSchema } from '../../src/features/content/domain/question';
import { canonicalJson } from '../../tools/questions/editorial';
import {
  loadCandidates,
  loadOverlays,
  loadIdentityRegistry,
} from '../../tools/questions/source-workflow';

it('accounts for all short occurrences without inventing lineage or approval', async () => {
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
    expect(overlay.approval).toBeUndefined();
    expect(['draft', 'needsReview']).toContain(overlay.status);
    if (overlay.status === 'draft') continue;
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
