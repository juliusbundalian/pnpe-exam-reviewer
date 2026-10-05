import { createHash } from 'node:crypto';
import { z } from 'zod';
import { QuestionSchema, type Question } from '../../src/features/content/domain/question';
import { canonicalJson } from './editorial';
import { contentDigest } from './publication';
import type { CatalogEntry, ImportStore } from './import-store';
import { assertFirestoreDocument, firestoreDocumentBytes } from './firestore-limits';
import { eligibilityIssues, productionClock, type EvaluationClock } from './eligibility';

const limit = 700 * 1024;
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const bytes = (value: unknown) => Buffer.byteLength(canonicalJson(value), 'utf8');
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const refSchema = z.strictObject({
  id: z.string().min(1),
  version: z.number().int().positive(),
  digest,
});
export const ImportManifestSchema = z.strictObject({
  projectId: z.string().min(1),
  inputDigest: digest,
  expectedHead: z.strictObject({
    generation: z.string().min(1).nullable(),
    revision: z.number().int().nonnegative(),
  }),
  generation: digest,
  creates: z.array(refSchema),
  noops: z.array(refSchema),
  questionCount: z.number().int().nonnegative(),
  categoryCounts: z.record(z.string(), z.number().int().nonnegative()),
  shardDigests: z.array(
    z.strictObject({
      id: z.string().min(1),
      digest,
      count: z.number().int().positive().max(200),
      bytes: z.number().int().positive().max(limit),
    }),
  ),
  manifestDigest: digest,
});
export type ImportManifest = z.infer<typeof ImportManifestSchema>;
function validated(questions: readonly Question[]): Question[] {
  const sorted = questions
    .map((q) => QuestionSchema.parse(q))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.version - b.version));
  const ids = new Set<string>();
  const stimuli = new Map<string, string>();
  for (const q of sorted) {
    if (q.stimulus) {
      const key = canonicalJson([q.stimulus.id, q.stimulus.version]);
      const content = canonicalJson(q.stimulus.blocks);
      const previous = stimuli.get(key);
      if (previous !== undefined && previous !== content)
        throw new Error('Stimulus identity/version content conflict');
      stimuli.set(key, content);
    }
    if (
      !/^[A-Za-z0-9_-]+$/.test(q.id) ||
      Buffer.byteLength(q.id, 'utf8') > 1500 ||
      /^__.*__$/.test(q.id)
    )
      throw new Error('Unsafe question document ID');
    if (ids.has(q.id)) throw new Error('Duplicate logical question ID in snapshot');
    ids.add(q.id);
    if (bytes(q) > limit) throw new Error('Revision exceeds 700 KiB');
    const blocks = [
      ...q.prompt,
      ...q.choices.flatMap((choice) => choice.blocks),
      ...(q.explanation ?? []),
      ...(q.stimulus?.blocks ?? []),
    ];
    if (blocks.some((block) => block.kind === 'table'))
      throw new Error(
        'Unsupported table transport: Standard edition cannot store nested row arrays',
      );
    assertFirestoreDocument(q);
  }
  return sorted;
}
export function digestQuestions(questions: readonly Question[]): string {
  return hash(validated(questions));
}
function catalog(q: Question): CatalogEntry {
  const blocks = [
    ...q.prompt,
    ...q.choices.flatMap((c) => c.blocks),
    ...(q.explanation ?? []),
    ...(q.stimulus?.blocks ?? []),
  ];
  const assets = blocks
    .filter((b) => b.kind === 'image' || b.kind === 'diagram')
    .map((b) => ({ id: b.id, version: b.version, uri: b.uri }));
  return {
    id: q.id,
    version: q.version,
    categoryId: q.categoryId,
    subcategoryId: q.subcategoryId,
    status: q.status,
    isCurrentEvent: q.isCurrentEvent,
    ...(q.publishedAt ? { publishedAt: q.publishedAt } : {}),
    ...(q.asOfDate ? { asOfDate: q.asOfDate } : {}),
    ...(q.expiresAt ? { expiresAt: q.expiresAt } : {}),
    supportedKinds: [...new Set(blocks.map((b) => b.kind))].sort(),
    ...(q.stimulus ? { stimulus: { id: q.stimulus.id, version: q.stimulus.version } } : {}),
    assets: [...new Map(assets.map((a) => [canonicalJson(a), a])).values()].sort((a, b) => {
      const left = canonicalJson(a),
        right = canonicalJson(b);
      return left < right ? -1 : left > right ? 1 : 0;
    }),
  };
}
function snapshot(questions: readonly Question[]) {
  const shards: { id: string; entries: CatalogEntry[] }[] = [];
  const groups = new Map<string, CatalogEntry[]>();
  const categoryCounts: Record<string, number> = {};
  for (const q of questions) {
    categoryCounts[q.categoryId] = (categoryCounts[q.categoryId] ?? 0) + 1;
    const key = `${q.categoryId}-${q.subcategoryId}`;
    const entries = groups.get(key) ?? [];
    entries.push(catalog(q));
    groups.set(key, entries);
  }
  for (const key of [...groups.keys()].sort()) {
    let entries: CatalogEntry[] = [],
      index = 0;
    const flush = () => {
      if (entries.length)
        shards.push({ id: `${key}-${String(index++).padStart(4, '0')}`, entries });
      entries = [];
    };
    for (const entry of groups.get(key)!) {
      if (
        bytes({ entries: [entry] }) > limit ||
        firestoreDocumentBytes({ entries: [entry] }) > limit
      )
        throw new Error('Catalog entry exceeds 700 KiB');
      if (
        entries.length === 200 ||
        bytes({ entries: [...entries, entry] }) > limit ||
        firestoreDocumentBytes({ entries: [...entries, entry] }) > limit
      )
        flush();
      entries.push(entry);
    }
    flush();
  }
  const shardDigests = shards.map((s) => ({
    id: s.id,
    digest: hash(s.entries),
    count: s.entries.length,
    bytes: bytes({ entries: s.entries }),
  }));
  const inputDigest = hash(questions);
  return {
    shards,
    inputDigest,
    generation: hash({ inputDigest, shardDigests }),
    shardDigests,
    questionCount: questions.length,
    categoryCounts,
  };
}
/** Full approved publication snapshot, never a delta. CLI reconstructs human approvals. */
export async function planImport(
  projectId: string,
  questions: readonly Question[],
  store: ImportStore,
  clock: EvaluationClock = productionClock,
): Promise<ImportManifest> {
  if (!projectId.trim()) throw new Error('Import target required');
  const qs = validated(questions);
  const now = clock();
  for (const q of qs) {
    const issues = eligibilityIssues(q, now);
    if (issues.length) throw new Error(issues.join('; '));
  }
  const { shards, ...metadata } = snapshot(qs);
  void shards;
  const creates: ImportManifest['creates'] = [],
    noops: ImportManifest['noops'] = [];
  for (const q of qs) {
    const existing = await store.readRevision(q.id, q.version);
    const ref = { id: q.id, version: q.version, digest: contentDigest(q) };
    if (existing && contentDigest(QuestionSchema.parse(existing)) !== ref.digest)
      throw new Error('Immutable revision conflict');
    (existing ? noops : creates).push(ref);
  }
  const body = { projectId, ...metadata, expectedHead: await store.readHead(), creates, noops };
  return ImportManifestSchema.parse({ ...body, manifestDigest: hash(body) });
}
export async function applyImport(
  rawManifest: unknown,
  questions: readonly Question[],
  store: ImportStore,
  confirm: { projectId: string; manifestDigest: string },
  clock: EvaluationClock = productionClock,
): Promise<void> {
  const parsed = ImportManifestSchema.safeParse(rawManifest);
  if (!parsed.success) throw new Error('Manifest invalid');
  const manifest = parsed.data;
  if (confirm.projectId !== manifest.projectId) throw new Error('Import target mismatch');
  const { manifestDigest, ...body } = manifest;
  if (confirm.manifestDigest !== manifestDigest || hash(body) !== manifestDigest)
    throw new Error('Manifest mismatch');
  const qs = validated(questions);
  const now = clock();
  for (const q of qs) {
    const issues = eligibilityIssues(q, now);
    if (issues.length) throw new Error(issues.join('; '));
  }
  const { shards, ...metadata } = snapshot(qs);
  if (metadata.inputDigest !== manifest.inputDigest) throw new Error('Input changed');
  for (const key of Object.keys(metadata) as (keyof typeof metadata)[])
    if (canonicalJson(metadata[key]) !== canonicalJson(manifest[key]))
      throw new Error('Manifest snapshot mismatch');
  const refs = [...manifest.creates, ...manifest.noops].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : a.version - b.version,
  );
  if (
    canonicalJson(refs) !==
    canonicalJson(qs.map((q) => ({ id: q.id, version: q.version, digest: contentDigest(q) })))
  )
    throw new Error('Manifest revision mismatch');
  const head = await store.readHead();
  if (canonicalJson(head) !== canonicalJson(manifest.expectedHead))
    throw new Error('Head changed; new dry run required');
  if (!qs.length) {
    if (head.generation !== null) throw new Error('Empty catalog replacement rejected');
    return;
  }
  for (const q of qs) {
    const prior = await store.readRevision(q.id, q.version);
    if (prior && contentDigest(QuestionSchema.parse(prior)) !== contentDigest(q))
      throw new Error('Immutable revision conflict');
  }
  for (const q of qs) {
    if (!(await store.readRevision(q.id, q.version))) await store.createRevision(q);
    const readback = await store.readRevision(q.id, q.version);
    if (!readback || contentDigest(QuestionSchema.parse(readback)) !== contentDigest(q))
      throw new Error('Revision readback mismatch');
  }
  for (const shard of shards) {
    const existing = await store.readShard(manifest.generation, shard.id);
    if (existing.length && hash(existing) !== hash(shard.entries))
      throw new Error('Immutable shard conflict');
    if (!existing.length) await store.writeShard(manifest.generation, shard.id, shard.entries);
  }
  for (const shard of manifest.shardDigests)
    if (hash(await store.readShard(manifest.generation, shard.id)) !== shard.digest)
      throw new Error('Shard readback mismatch');
  if (head.generation === manifest.generation) {
    if (canonicalJson(await store.readHead()) !== canonicalJson(manifest.expectedHead))
      throw new Error('Head changed; new dry run required');
    return;
  }
  await store.publishHead(manifest.expectedHead.revision, manifest.generation);
}
