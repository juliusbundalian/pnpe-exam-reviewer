import { createHash } from 'node:crypto';
import { QuestionSchema, type Question } from '../../src/features/content/domain/question';
import {
  canonicalJson,
  EditorialOverlaySchema,
  reviewDigest,
  type EditorialOverlay,
  type ReconciledOverlay,
} from './editorial';
import type { SourceIssue } from './parsers/types';

export function contentDigest(question: Question): string {
  return createHash('sha256').update(canonicalJson(question)).digest('hex');
}
export function publishable(
  overlay: EditorialOverlay,
  context?: { issues: readonly SourceIssue[] },
): { ok: true; question: Question } | { ok: false; issues: readonly string[] } {
  const parsed = QuestionSchema.safeParse(overlay.proposed);
  if (!parsed.success) return { ok: false, issues: ['QUESTION_SCHEMA_INVALID'] };
  if (!EditorialOverlaySchema.safeParse(overlay).success)
    return { ok: false, issues: ['EDITORIAL_SCHEMA_INVALID'] };
  const question = parsed.data;
  if (overlay.status !== 'approved' || !overlay.approval)
    return { ok: false, issues: ['EDITORIAL_APPROVAL_REQUIRED'] };
  if (overlay.approval.digest !== contentDigest(question))
    return { ok: false, issues: ['EDITORIAL_APPROVAL_STALE'] };
  if (
    (overlay.review && overlay.approval.reviewDigest !== reviewDigest(overlay.review)) ||
    (!overlay.review && overlay.approval.reviewDigest)
  )
    return { ok: false, issues: ['EDITORIAL_REVIEW_STALE'] };
  const issues: string[] = [];
  const review = overlay.review;
  for (const issue of [...(context?.issues ?? []), ...(review?.issues ?? [])].filter(
    (issue) => issue.blocking,
  )) {
    const reviewed = review?.issues?.some((item) => canonicalJson(item) === canonicalJson(issue));
    const resolved = review?.resolutions?.some((item) => item.code === issue.code);
    if (!reviewed || !resolved) issues.push(`UNRESOLVED_SOURCE_ISSUE:${issue.code}`);
  }
  if (
    (question.isCurrentEvent || question.subcategoryId === 'constitutionAndLaws') &&
    !review?.factualVerification
  )
    issues.push('FACTUAL_VERIFICATION_REQUIRED');
  const blocks = [
    ...question.prompt,
    ...question.choices.flatMap((choice) => choice.blocks),
    ...(question.explanation ?? []),
    ...(question.stimulus?.blocks ?? []),
  ];
  for (const asset of blocks.filter(
    (block) => block.kind === 'image' || block.kind === 'diagram',
  )) {
    if (
      !review?.assets?.some(
        (item) => item.id === asset.id && item.version === asset.version && item.uri === asset.uri,
      )
    )
      issues.push(`ASSET_REVIEW_REQUIRED:${asset.id}@${asset.version}`);
  }
  return issues.length ? { ok: false, issues: [...new Set(issues)] } : { ok: true, question };
}
export function publicationSet(entries: readonly ReconciledOverlay[]): {
  questions: Question[];
  errors: { sourceKey: string; issues: readonly string[] }[];
} {
  const questions: Question[] = [];
  const errors: { sourceKey: string; issues: readonly string[] }[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.overlay.sourceKey)) {
      errors.push({ sourceKey: entry.overlay.sourceKey, issues: ['DUPLICATE_SOURCE_KEY'] });
      continue;
    }
    seen.add(entry.overlay.sourceKey);
    if (entry.overlay.status !== 'approved') continue;
    const result = publishable(entry.overlay, { issues: entry.issues });
    if (result.ok) questions.push(result.question);
    else errors.push({ sourceKey: entry.overlay.sourceKey, issues: result.issues });
  }
  return { questions, errors };
}
