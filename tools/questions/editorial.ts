import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SourceIssue } from './parsers/types';
import type { NormalizedCandidate } from './normalize';

const nonempty = z.string().trim().min(1);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const EditorialOverlaySchema = z.strictObject({
  sourceKey: nonempty,
  proposed: z.unknown(),
  rationale: nonempty,
  evidence: z.array(nonempty).readonly(),
  status: z.enum(['draft', 'needsReview', 'approved', 'rejected']),
  approval: z
    .strictObject({
      reviewer: nonempty,
      at: z.iso.datetime({ offset: true }),
      digest,
      reviewDigest: digest.optional(),
    })
    .optional(),
  review: z
    .strictObject({
      factualVerification: z
        .strictObject({
          sourceUrl: z.url(),
          verifiedAt: z.iso.datetime({ offset: true }),
          rationale: nonempty,
        })
        .optional(),
      assets: z
        .array(
          z.strictObject({
            id: nonempty,
            version: z.number().int().positive(),
            uri: nonempty,
            status: z.literal('reviewed'),
            evidence: z.array(nonempty).min(1),
          }),
        )
        .optional(),
      issues: z
        .array(z.strictObject({ code: nonempty, blocking: z.boolean(), message: nonempty }))
        .optional(),
      resolutions: z
        .array(
          z.strictObject({
            code: nonempty,
            rationale: nonempty,
            evidence: z.array(nonempty).min(1),
          }),
        )
        .optional(),
    })
    .optional(),
});
export type EditorialOverlay = z.infer<typeof EditorialOverlaySchema>;
export type EditorialReview = NonNullable<EditorialOverlay['review']>;

/** Recursively sort object keys; preserve array order because it is content. */
export function canonicalJson(value: unknown): string {
  function sort(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(sort);
    if (item !== null && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, child]) => child !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, child]) => [key, sort(child)]),
      );
    return item;
  }
  const result = JSON.stringify(sort(value));
  if (result === undefined) throw new Error('Canonical input must be JSON content');
  return result;
}
export function reviewDigest(review: EditorialReview): string {
  return createHash('sha256').update(canonicalJson(review)).digest('hex');
}
export interface ReconciledOverlay {
  overlay: EditorialOverlay;
  issues: readonly SourceIssue[];
}
export function combineBySourceKey(
  candidates: readonly NormalizedCandidate[],
  overlays: readonly EditorialOverlay[],
): ReconciledOverlay[] {
  const sources = new Map<string, NormalizedCandidate>();
  for (const candidate of candidates) {
    const key = candidate.original.sourceKey;
    if (sources.has(key)) throw new Error(`Duplicate candidate sourceKey: ${key}`);
    sources.set(key, candidate);
  }
  const seen = new Set<string>();
  return overlays.map((overlay) => {
    if (seen.has(overlay.sourceKey))
      throw new Error(`Duplicate overlay sourceKey: ${overlay.sourceKey}`);
    seen.add(overlay.sourceKey);
    const candidate = sources.get(overlay.sourceKey);
    if (!candidate) throw new Error(`Unknown overlay sourceKey: ${overlay.sourceKey}`);
    return { overlay, issues: candidate.issues };
  });
}
