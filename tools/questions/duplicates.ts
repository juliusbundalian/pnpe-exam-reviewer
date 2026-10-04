import type { NormalizedCandidate } from './normalize';
import { createHash } from 'node:crypto';
export function fingerprint(candidate: NormalizedCandidate): string {
  // Source lineage and stimulus identity are intentionally excluded; complete stimulus content is included.
  return createHash('sha256')
    .update(
      JSON.stringify([
        candidate.proposed.prompt,
        candidate.proposed.choices?.map((choice) => choice.blocks) ?? null,
        candidate.proposed.stimulus?.blocks ?? null,
        candidate.original.evidence.imageLocations.length
          ? candidate.original.evidence.imageLocations
          : null,
      ]),
    )
    .digest('hex');
}
function tokens(candidate: NormalizedCandidate): Set<string> {
  return new Set(
    JSON.stringify([
      candidate.proposed.prompt,
      candidate.proposed.choices,
      candidate.proposed.stimulus?.blocks,
    ])
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [],
  );
}
export function duplicateReport(candidates: NormalizedCandidate[]): {
  exact: string[][];
  near: string[][];
} {
  const clusters = new Map<string, string[]>();
  for (const candidate of candidates) {
    const hash = fingerprint(candidate);
    const keys = clusters.get(hash) ?? [];
    keys.push(candidate.original.sourceKey);
    clusters.set(hash, keys);
  }
  const exact = [...clusters.values()].filter((keys) => keys.length > 1);
  const near: string[][] = [];
  const sets = candidates.map(tokens);
  for (let i = 0; i < candidates.length; i++)
    for (let j = i + 1; j < candidates.length; j++) {
      if (fingerprint(candidates[i]!) === fingerprint(candidates[j]!)) continue;
      const first = sets[i]!;
      const second = sets[j]!;
      const intersection = [...first].filter((token) => second.has(token)).length;
      const union = new Set([...first, ...second]).size;
      if (union && intersection / union >= 0.85)
        near.push([candidates[i]!.original.sourceKey, candidates[j]!.original.sourceKey]);
    }
  return { exact, near };
}
