import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { QuestionSchema } from '../../src/features/content/domain/question';
import {
  canonicalJson,
  combineBySourceKey,
  reviewDigest,
  type EditorialOverlay,
} from './editorial';
import type { NormalizedCandidate } from './normalize';
import { contentDigest } from './publication';
import { safeGeneratedPath } from './source-workflow';

export interface PacketRow {
  sourceKey: string;
  overlayDigest: string;
  contentDigest: string | null;
  reviewDigest: string | null;
}
export interface ReviewPacket {
  manifest: { batchId: string; packetDigest: string; rows: PacketRow[] };
  markdown: string;
  overlays: readonly EditorialOverlay[];
}
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
function validateBatchId(batchId: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(batchId)) throw new Error('Invalid editorial batch ID');
}
const escape = (text: string): string => text.replace(/[\\`*_{}\[\]()<>#+.!|~\-]/g, '\\$&');
function jsonFence(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  const runs = json.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return `${fence}json\n${json}\n${fence}`;
}
/** Render partial drafts as well as valid revisions without discarding unsupported blocks. */
function render(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string') return escape(value);
  if (Array.isArray(value)) return value.map(render).join('\n\n');
  if (typeof value !== 'object') return escape(String(value));
  const item = value as Record<string, unknown>;
  if (item.kind === 'text')
    return `${render(item.text)}${Array.isArray(item.marks) && item.marks.length ? `\nMarks: ${render(item.marks)}` : ''}`;
  if (item.kind === 'math')
    return `Math: ${render(item.expression)}\nAccessible text: ${render(item.accessibleText)}`;
  const blocked = item.kind ? `BLOCKED: unsupported ${escape(String(item.kind))}\n` : '';
  return (
    blocked +
    Object.entries(item)
      .map(([key, child]) => `${escape(key)}: ${render(child)}`)
      .join('\n')
  );
}

export function buildReviewPacket(
  batchId: string,
  candidates: readonly NormalizedCandidate[],
  overlays: readonly EditorialOverlay[],
): ReviewPacket {
  validateBatchId(batchId);
  // Snapshot JSON content so caller mutations cannot change a packet's bound revision.
  const originalsInput = JSON.parse(canonicalJson(candidates)) as NormalizedCandidate[];
  const revisions = JSON.parse(canonicalJson(overlays)) as EditorialOverlay[];
  const order = new Map(
    originalsInput.map((candidate, index) => [candidate.original.sourceKey, index]),
  );
  const reconciled = combineBySourceKey(originalsInput, revisions).sort(
    (a, b) => order.get(a.overlay.sourceKey)! - order.get(b.overlay.sourceKey)!,
  );
  const originals = reconciled.map(({ overlay }) => originalsInput[order.get(overlay.sourceKey)!]!);
  const sortedOverlays = reconciled.map(({ overlay }) => overlay);
  const rows: PacketRow[] = reconciled.map(({ overlay }) => {
    const parsed = QuestionSchema.safeParse(overlay.proposed);
    return {
      sourceKey: overlay.sourceKey,
      overlayDigest: hash(overlay),
      contentDigest: parsed.success ? contentDigest(parsed.data) : null,
      reviewDigest: overlay.review ? reviewDigest(overlay.review) : null,
    };
  });
  const sections = reconciled.map(({ overlay, issues }, index) => {
    const parsed = QuestionSchema.safeParse(overlay.proposed);
    const proposed =
      overlay.proposed !== null && typeof overlay.proposed === 'object'
        ? (overlay.proposed as Record<string, unknown>)
        : {};
    const original = originals[index]!.original;
    const open = [...issues, ...(overlay.review?.issues ?? [])].filter(
      (issue) => !overlay.review?.resolutions?.some((resolution) => resolution.code === issue.code),
    );
    return [
      `## ${escape(overlay.sourceKey)}`,
      `Status: ${escape(overlay.status)}`,
      `Rationale: ${render(overlay.rationale)}`,
      `Evidence: ${render(overlay.evidence)}`,
      `Prompt:\n${render(proposed.prompt)}`,
      `Stimulus:\n${render(proposed.stimulus)}`,
      `Choices (IDs and text):\n${render(proposed.choices)}`,
      `Correct choice: ${render(proposed.correctChoiceId)}`,
      `Explanation:\n${render(proposed.explanation)}`,
      `Taxonomy: ${render(proposed.categoryId)} / ${render(proposed.subcategoryId)}`,
      `Original answer: ${render(original.rawAnswer)}`,
      `Pages: ${original.pageStart}–${original.pageEnd}`,
      `Corrections and source lineage:\n${render(proposed.sources)}`,
      `Verification URL/time and review metadata:\n${render(overlay.review)}`,
      `Authoritative issues:\n${render(issues)}`,
      `Resolutions:\n${render(overlay.review?.resolutions)}`,
      `Open issues:\n${render(open)}`,
      `Schema diagnostics:\n${parsed.success ? 'Valid question schema' : render(parsed.error.issues)}`,
      `Digests:\n${render(rows[index])}`,
      `Complete JSON revision:\n${jsonFence(overlay)}`,
      `Authoritative original and issues:\n${jsonFence(originals[index])}`,
    ].join('\n\n');
  });
  const markdown = [
    `# Editorial review packet: ${escape(batchId)}`,
    'This packet records proposed revisions. It does not grant editorial approval.',
    ...sections,
  ].join('\n\n');
  const packetDigest = hash({ batchId, rows, overlays: sortedOverlays, originals, markdown });
  return {
    manifest: { batchId, packetDigest, rows },
    markdown: `${markdown}\nPacket digest: ${packetDigest}\n`,
    overlays: sortedOverlays,
  };
}

export async function writeReviewPacket(root: string, packet: ReviewPacket): Promise<string> {
  validateBatchId(packet.manifest.batchId);
  if (!/^[a-f0-9]{64}$/.test(packet.manifest.packetDigest))
    throw new Error('Invalid packet digest');
  const path = `evidence/editorial/${packet.manifest.batchId}/${packet.manifest.packetDigest}`;
  const destination = await safeGeneratedPath(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await safeGeneratedPath(root, path);
  await mkdir(destination);
  // Failure leaves the reserved directory as evidence; it is never reused.
  for (const [name, text] of [
    ['review.md', packet.markdown],
    ['manifest.json', JSON.stringify(packet.manifest, null, 2) + '\n'],
    ['overlays.json', JSON.stringify(packet.overlays, null, 2) + '\n'],
  ]) {
    const output = await safeGeneratedPath(root, join(destination, name!));
    await writeFile(output, text!, { flag: 'wx' });
  }
  return destination;
}
