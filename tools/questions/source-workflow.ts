import { readFile, readdir, lstat, realpath, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, join, sep } from 'node:path';
import { QuestionSchema, type Question } from '../../src/features/content/domain/question';
import { normalize, type NormalizedCandidate } from './normalize';
import {
  canonicalJson,
  combineBySourceKey,
  EditorialOverlaySchema,
  type EditorialOverlay,
} from './editorial';
import { assignIdentity, type IdentityRegistry } from './identity';
import { publicationSet } from './publication';
import { digestQuestions } from './import-plan';
import { sourceRegistry, verifySource } from './source-registry';
import { sourceDocumentSchema } from './source-schema';
import { parseShort } from './parsers/short';
import { parseLarge } from './parsers/large';
import { parseNotes } from './parsers/notes';
import { duplicateReport } from './duplicates';
import { taxonomy } from '../../src/features/content/domain/taxonomy';

export function approvedPublication(
  candidates: readonly NormalizedCandidate[],
  overlays: readonly EditorialOverlay[],
  registry: IdentityRegistry,
  sources: readonly { sourceId: string; sha256: string }[],
  published: unknown,
): Question[] {
  const result = publicationSet(combineBySourceKey(candidates, overlays));
  if (result.errors.length) throw new Error(`Publication errors: ${canonicalJson(result.errors)}`);
  for (const entry of overlays.filter((overlay) => overlay.status === 'approved')) {
    const q = QuestionSchema.parse(entry.proposed);
    if (assignIdentity(entry.sourceKey, registry) !== q.id)
      throw new Error('Published identity mismatch');
    const primary = candidates.find(
      (candidate) => candidate.original.sourceKey === entry.sourceKey,
    )!;
    if (
      !q.sources.some(
        (source) =>
          `${source.sourceId}:${source.section}:${source.originalNumber}` ===
          primary.original.sourceKey,
      )
    )
      throw new Error('Missing primary source lineage');
    for (const source of q.sources) {
      const registered = sources.find((item) => item.sourceId === source.sourceId);
      if (!registered || registered.sha256 !== source.checksum)
        throw new Error('Unregistered source publication');
      const record = candidates.find(
        (candidate) =>
          candidate.original.sourceKey ===
          `${source.sourceId}:${source.section}:${source.originalNumber}`,
      )?.original;
      if (
        !record ||
        source.checksum !== record.evidence.checksum ||
        source.pages.start !== record.pageStart ||
        source.pages.end !== record.pageEnd ||
        source.evidenceLocator !== record.evidence.locator ||
        source.originalAnswer !== record.rawAnswer ||
        canonicalJson(source.originalChoiceLabels) !==
          canonicalJson(record.rawChoices?.map((choice) => choice.label) ?? []) ||
        canonicalJson(source.links) !== canonicalJson(record.evidence.links) ||
        canonicalJson(source.imageLocations) !== canonicalJson(record.evidence.imageLocations)
      )
        throw new Error('Source lineage mismatch');
    }
    const blocks = [
      ...q.prompt,
      ...q.choices.flatMap((choice) => choice.blocks),
      ...(q.explanation ?? []),
      ...(q.stimulus?.blocks ?? []),
    ];
    if (blocks.some((block) => block.kind === 'table'))
      throw new Error(
        'Unsupported table transport: a Standard-compatible versioned codec is required',
      );
    if (blocks.some((block) => block.kind === 'image' || block.kind === 'diagram'))
      throw new Error(
        'Unsupported asset: no approved available learner asset inventory; evidence/key images cannot publish',
      );
  }
  if (!Array.isArray(published)) throw new Error('Published input must be an array');
  const parsed = published.map((q: unknown) => QuestionSchema.parse(q));
  // Compare the exact on-disk JSON structure too: schema defaults/transforms cannot mask edits.
  if (
    canonicalJson(parsed) !== canonicalJson(published) ||
    digestQuestions(result.questions) !== digestQuestions(parsed)
  )
    throw new Error('Published approval digest mismatch');
  return result.questions;
}
export async function safeGeneratedPath(root: string, path: string): Promise<string> {
  const base = await realpath(root);
  const output = resolve(base, path);
  const inside = (candidate: string) => {
    const child = relative(base, candidate);
    return child.startsWith(`evidence${sep}`) || child.startsWith(`data${sep}generated${sep}`);
  };
  if (!inside(output)) throw new Error('Unsafe output: use evidence/ or data/generated/ child');
  let current = output;
  while (current !== base) {
    try {
      const stat = await lstat(current);
      if (
        stat.isSymbolicLink() ||
        (stat.isFile() && stat.nlink > 1) ||
        !inside(await realpath(current))
      )
        throw new Error('Unsafe output symlink or hard link');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // The two allowed parent directories are not themselves valid output files.
        if (
          current !== join(base, 'evidence') &&
          current !== join(base, 'data') &&
          current !== join(base, 'data/generated')
        )
          throw error;
        if ((await lstat(current)).isSymbolicLink()) throw error;
      }
    }
    current = dirname(current);
  }
  return output;
}
export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}
export async function writeGenerated(root: string, path: string, value: unknown): Promise<void> {
  const output = await safeGeneratedPath(root, path);
  await mkdir(dirname(output), { recursive: true });
  await safeGeneratedPath(root, output);
  await writeFile(output, `${JSON.stringify(value, null, 2)}\n`, { flag: 'w' });
}
export async function loadCandidates(root: string): Promise<NormalizedCandidate[]> {
  const parsers = { short: parseShort, comprehensive: parseLarge, notes: parseNotes };
  const candidates: NormalizedCandidate[] = [];
  for (const source of sourceRegistry) {
    verifySource(source.sourceId, await readFile(join(root, 'references', source.filename)));
    const document = sourceDocumentSchema.parse(
      await readJson(join(root, 'evidence/reference-extraction', source.sourceId, 'document.json')),
    );
    if (
      document.sourceId !== source.sourceId ||
      document.sha256 !== source.sha256 ||
      document.pageCount !== source.expectedPageCount
    )
      throw new Error('Extracted source metadata mismatch');
    const parser = parsers[source.sourceId as keyof typeof parsers];
    if (!parser) throw new Error('Unsupported source adapter');
    const records = parser(document);
    if (records.length !== source.expectedOccurrences)
      throw new Error('Source accounting mismatch');
    candidates.push(...records.map(normalize));
  }
  return candidates;
}
export async function loadOverlays(root: string): Promise<EditorialOverlay[]> {
  const directory = join(root, 'data/editorial');
  const overlays: EditorialOverlay[] = [];
  for (const filename of (await readdir(directory))
    .filter((file) => file.endsWith('.json'))
    .sort()) {
    const raw = await readJson(join(directory, filename));
    overlays.push(
      ...(Array.isArray(raw) ? raw : [raw]).map((overlay: unknown) =>
        EditorialOverlaySchema.parse(overlay),
      ),
    );
  }
  return overlays;
}
export async function loadIdentityRegistry(root: string): Promise<IdentityRegistry> {
  const raw = await readJson(join(root, 'data/identity-registry.json'));
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    Object.values(raw).some((id) => typeof id !== 'string')
  )
    throw new Error('Invalid identity registry');
  return raw as IdentityRegistry;
}
export async function loadApprovedPublication(
  root: string,
  registry?: IdentityRegistry,
): Promise<Question[]> {
  return approvedPublication(
    await loadCandidates(root),
    await loadOverlays(root),
    registry ?? (await loadIdentityRegistry(root)),
    sourceRegistry,
    await readJson(join(root, 'data/questions.json')),
  );
}
export async function processReferences(root: string, output = 'data/generated/candidates.json') {
  await safeGeneratedPath(root, output);
  const candidates = await loadCandidates(root);
  const registry = await loadIdentityRegistry(root);
  const assigned = candidates.map((candidate) => ({
    id: assignIdentity(candidate.original.sourceKey, registry),
    ...candidate,
  }));
  if (new Set(assigned.map((candidate) => candidate.id)).size !== assigned.length)
    throw new Error('Duplicate identities');
  const overlays = await loadOverlays(root);
  const publication = publicationSet(combineBySourceKey(candidates, overlays));
  if (publication.errors.length)
    throw new Error(`Publication errors: ${canonicalJson(publication.errors)}`);
  const issues: Record<string, number> = {};
  for (const candidate of candidates)
    for (const issue of candidate.issues.filter((item) => item.blocking))
      issues[issue.code] = (issues[issue.code] ?? 0) + 1;
  const report = {
    occurrences: assigned.length,
    eligible: publication.questions.length,
    approvedOverlays: overlays.filter((overlay) => overlay.status === 'approved').length,
    blockingOccurrences: candidates.filter((candidate) =>
      candidate.issues.some((issue) => issue.blocking),
    ).length,
    blockingIssues: issues,
  };
  const duplicates = duplicateReport(candidates);
  const coverage = taxonomy.flatMap((category) =>
    category.subcategories.map((subcategory) => ({
      categoryId: category.id,
      subcategoryId: subcategory.id,
      approved: publication.questions.filter(
        (question) =>
          question.categoryId === category.id && question.subcategoryId === subcategory.id,
      ).length,
    })),
  );
  await writeGenerated(root, output, { report, candidates: assigned });
  await writeGenerated(root, 'evidence/content-toolchain/process-report.json', {
    ...report,
    coverage,
    duplicates,
  });
  const human = await safeGeneratedPath(root, 'evidence/content-toolchain/process-report.md');
  await writeFile(
    human,
    `# Reference processing\n\nOccurrences: ${report.occurrences}. Approved eligible: ${report.eligible}. Blocked occurrences: ${report.blockingOccurrences}.\n\n${Object.entries(
      issues,
    )
      .map(([code, count]) => `- ${code}: ${count}`)
      .join(
        '\n',
      )}\n\nExact duplicate groups: ${duplicates.exact.length}. Near duplicate pairs: ${duplicates.near.length}. Suggestions preserve all occurrences.\n\n${coverage.map((item) => `- ${item.categoryId}/${item.subcategoryId}: ${item.approved} approved${item.approved === 0 ? ' (unavailable)' : ''}`).join('\n')}\n`,
  );
  return report;
}
