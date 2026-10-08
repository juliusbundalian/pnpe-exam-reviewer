import { createHash } from 'node:crypto';
import manifest from '../../docs/verification/editorial-full-corpus/owner-review-manifest.json';
import { canonicalJson, type EditorialOverlay } from '../../tools/questions/editorial';

/** Recover only the exact authorized preapproval revision for immutable packet comparisons.
 * Other approvals and any content/review/rationale/stamp mutation must stay visible. */
export function historicalOverlays(overlays: readonly EditorialOverlay[]): EditorialOverlay[] {
  return overlays.map((overlay) => {
    const row = manifest.revisions.find((r) => r.sourceKey === overlay.sourceKey);
    if (!row || overlay.status !== 'approved') return overlay;
    const expected = {
      reviewer: 'Project owner',
      at: '2026-10-08T01:48:03Z',
      digest: row.contentDigest,
      reviewDigest: row.reviewDigest,
    };
    if (canonicalJson(overlay.approval) !== canonicalJson(expected))
      throw new Error(`Unexpected approval: ${overlay.sourceKey}`);
    const revision = { ...overlay };
    delete revision.approval;
    const historical = { ...revision, status: 'needsReview' as const };
    if (createHash('sha256').update(canonicalJson(historical)).digest('hex') !== row.overlayDigest)
      throw new Error(`Historical revision changed: ${overlay.sourceKey}`);
    return historical;
  });
}
