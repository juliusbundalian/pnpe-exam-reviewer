import { QuestionSchema, type Question } from '../../src/features/content/domain/question';
import { taxonomy, type CategoryId } from '../../src/features/content/domain/taxonomy';
import { canonicalJson, combineBySourceKey, type EditorialOverlay } from './editorial';
import { eligibilityIssues, productionClock, type EvaluationClock } from './eligibility';
import type { NormalizedCandidate } from './normalize';
import { contentDigest, publishable } from './publication';

export type Disposition =
  | 'unavailable'
  | 'draft'
  | 'needsReview'
  | 'rejected'
  | 'approvedEligible'
  | 'approvedBlocked'
  | 'approvedExpired';
export interface CoverageRow {
  id: string;
  counts: Record<Disposition, number>;
}
export interface CoverageReport {
  occurrences: number;
  bySource: CoverageRow[];
  byCategory: CoverageRow[];
  bySubcategory: CoverageRow[];
  unmapped: Record<Disposition, number>;
  quotas: { categoryId: CategoryId; required: number; eligible: number; shortage: number }[];
  defaultExamReady: boolean;
}
const empty = (): Record<Disposition, number> => ({
  unavailable: 0,
  draft: 0,
  needsReview: 0,
  rejected: 0,
  approvedEligible: 0,
  approvedBlocked: 0,
  approvedExpired: 0,
});
const row = (id: string): CoverageRow => ({ id, counts: empty() });
export function coverageReport(
  candidates: readonly NormalizedCandidate[],
  overlays: readonly EditorialOverlay[],
  eligible: readonly Question[],
  clock: EvaluationClock = productionClock,
): CoverageReport {
  const now = clock();
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid eligibility clock');
  const entries = new Map(
    combineBySourceKey(candidates, overlays).map((entry) => [entry.overlay.sourceKey, entry]),
  );
  const eligibleById = new Map<string, Question>();
  for (const question of eligible) {
    if (eligibleById.has(question.id)) throw new Error(`Duplicate eligible ID: ${question.id}`);
    eligibleById.set(question.id, QuestionSchema.parse(question));
  }
  const matched = new Set<string>();
  const bySource = [...new Set(candidates.map((c) => c.original.sourceId))].map(row);
  const byCategory = taxonomy.map((c) => row(c.id));
  const bySubcategory = taxonomy.flatMap((c) => c.subcategories.map((s) => row(s.id)));
  const unmapped = empty();
  for (const candidate of candidates) {
    const entry = entries.get(candidate.original.sourceKey);
    const parsed = QuestionSchema.safeParse(entry?.overlay.proposed);
    let disposition: Disposition =
      entry?.overlay.status === 'approved'
        ? 'approvedBlocked'
        : (entry?.overlay.status ?? 'unavailable');
    if (entry?.overlay.status === 'approved') {
      disposition = 'approvedBlocked';
      const result = publishable(entry.overlay, { issues: entry.issues });
      if (result.ok) {
        const q = result.question;
        const blocks = [
          ...q.prompt,
          ...q.choices.flatMap((c) => c.blocks),
          ...(q.explanation ?? []),
          ...(q.stimulus?.blocks ?? []),
        ];
        const unsupported = blocks.some((b) => ['table', 'image', 'diagram'].includes(b.kind));
        const soundSource =
          q.sources.some(
            (s) =>
              `${s.sourceId}:${s.section}:${s.originalNumber}` === candidate.original.sourceKey,
          ) &&
          q.sources.every((source) => {
            const original = candidates.find(
              (c) =>
                c.original.sourceKey ===
                `${source.sourceId}:${source.section}:${source.originalNumber}`,
            )?.original;
            return (
              original &&
              source.checksum === original.evidence.checksum &&
              source.pages.start === original.pageStart &&
              source.pages.end === original.pageEnd &&
              source.evidenceLocator === original.evidence.locator &&
              source.originalAnswer === original.rawAnswer &&
              canonicalJson(source.originalChoiceLabels) ===
                canonicalJson(original.rawChoices?.map((c) => c.label) ?? []) &&
              canonicalJson(source.links) === canonicalJson(original.evidence.links) &&
              canonicalJson(source.imageLocations) ===
                canonicalJson(original.evidence.imageLocations)
            );
          });
        const issues = eligibilityIssues(q, now);
        if (!unsupported && soundSource) {
          if (issues.length === 1 && issues[0] === 'PUBLICATION_EXPIRED')
            disposition = 'approvedExpired';
          else if (!issues.length && eligibleById.has(q.id)) {
            if (contentDigest(eligibleById.get(q.id)!) !== contentDigest(q))
              throw new Error(`Eligible revision mismatch: ${q.id}`);
            if (matched.has(q.id))
              throw new Error(`Multiple approved occurrences for eligible ID: ${q.id}`);
            matched.add(q.id);
            disposition = 'approvedEligible';
          }
        }
      }
    }
    bySource.find((r) => r.id === candidate.original.sourceId)!.counts[disposition]++;
    if (parsed.success) {
      byCategory.find((r) => r.id === parsed.data.categoryId)!.counts[disposition]++;
      bySubcategory.find((r) => r.id === parsed.data.subcategoryId)!.counts[disposition]++;
    } else unmapped[disposition]++;
  }
  if (matched.size !== eligibleById.size)
    throw new Error('Eligible set lacks sound approved source context');
  const required: Record<CategoryId, number> = {
    generalInformation: 35,
    communicationSkills: 40,
    quantitativeReasoning: 25,
    criticalThinking: 50,
  };
  const quotas = taxonomy.map((c) => {
    const count = eligible.filter((q) => q.categoryId === c.id).length;
    return {
      categoryId: c.id,
      required: required[c.id],
      eligible: count,
      shortage: Math.max(0, required[c.id] - count),
    };
  });
  return {
    occurrences: candidates.length,
    bySource,
    byCategory,
    bySubcategory,
    unmapped,
    quotas,
    defaultExamReady: quotas.every((q) => q.shortage === 0),
  };
}
