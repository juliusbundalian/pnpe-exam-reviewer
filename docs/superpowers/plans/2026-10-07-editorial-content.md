# First Editorial Content Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner already selected this execution method.

**Goal:** Prepare all 20 short-source occurrences for exact editorial review, produce immutable review evidence and honest coverage counts, and publish/import only owner-approved eligible revisions.

**Architecture:** Keep source reconstruction, stable identities, schemas, approval digests and import safeguards authoritative. Add small offline packet/coverage helpers beside the existing question tools; author overlays rather than changing parser output. Publication and emulator writes follow an explicit exact-revision editorial checkpoint.

**Tech Stack:** Existing TypeScript 6 strict mode, Zod 4, Node crypto/filesystem, Jest 29, tsx, existing Firebase demo emulator/import tools. No new dependencies or native rebuilds.

**Spec:** [Approved editorial content design](../specs/2026-10-07-editorial-content-design.md), with the binding [foundation design](../specs/2026-10-04-foundation-and-content-design.md).

## Global Constraints

- Prepare `data/editorial/short-initial.json` with one overlay for each of the 20 authoritative short-source keys. First unpublished revisions use version 1.
- Preserve 687 occurrences across 178 pages: 20 short MCQs, 477 comprehensive occurrences and 190 answer-only notes.
- Never modify the source PDFs or extraction evidence. Do not allocate replacement IDs for existing source keys.
- Set `needsReview` when a proposed revision is complete; retain unresolved items as `draft`. Do not create approval fields before exact owner approval.
- General permission to proceed with development is not editorial approval. Approval refers to an exact packet and digest manifest already reviewed.
- `data/questions.json` contains the entire approved eligible set, not a manually edited delta.
- Default Mock Exam quotas: General Information 35, Communication Skills 40, Quantitative Reasoning 25, Critical Thinking 50; total 150. No mandatory per-subcategory quotas.
- Use text, marked-text and supported math transport. Image/diagram and table-dependent items remain blocked under this specification.
- Local import uses explicit `demo-pnpe`, a localhost emulator endpoint, a dry-run manifest and exact apply digest. No production import, rules deployment, public hosting, push or redistribution.
- No mobile retrieval, SQLite, Reviewer/bookmarks, exam engine/results, progress or history implementation in this plan. Continue to their separate designs after this content checkpoint.
- Preserve owner assets, ignored credentials and existing emulator data. Keep SDK 57 pins unchanged; the decoder advisory and redistribution rights remain public-release gates.

## Review Focus

1. Changed content, review rationale or overlay evidence after packet generation must invalidate exact approval — Task 2 snapshot/digest tests and Task 4 pre-stamp comparison.
2. Drafts, malformed proposals, stale approvals and expired current events must never inflate eligible exam counts — Task 3 classification tests and existing publication regression tests.
3. Duplicate logical identities or missing short-source occurrences must fail preparation rather than silently reduce accounting — Task 1 structural checks and Task 3 duplicate-ID test.
4. Q19/Q20 must distinguish administration/control and examination/appointment requirements; conflicting or unsupported current claims remain blocked — Task 1 primary-source verification audit.
5. An existing packet directory, symlink or hard-linked file must not be overwritten — Task 2 filesystem tests using real temporary directories and existing safe-path guards.

---

## Files and responsibilities

| File | Responsibility |
| --- | --- |
| `data/editorial/short-initial.json` | Versioned 20-item editorial overlay batch; source lineage, revisions and review evidence |
| `tools/questions/review-packet.ts` | Pure packet manifest/Markdown construction and immutable filesystem writing |
| `tools/questions/coverage.ts` | Full-corpus disposition accounting and distinct eligible quota coverage |
| `tools/questions/prepare-review.ts` | Offline runner: authoritative loaders, requested overlay batch, packet writer and coverage output |
| `tests/content/review-packet.test.ts` | Snapshot binding, readable content, unsafe overwrite and malformed-input regression tests |
| `tests/content/coverage.test.ts` | Approved/staged/blocked/expired accounting, all taxonomy rows, distinct quotas |
| `tests/references/editorial-short.test.ts` | Opt-in real-corpus structural/lineage checks; no tautological answer assertions |
| `jest.references.config.cjs` | Include the new real-corpus suite if its existing match pattern does not already include it |
| `docs/content-workflow.md` | Packet commands, exact approval protocol and interpretation of counts |
| `docs/verification/editorial-content.md` | Evidence, reviewed decisions, remaining shortages and conditional demo readback |
| `data/questions.json` | Existing authoritative full publication, changed only after exact editorial approval |
| `evidence/editorial/short-initial/<packetDigest>/` | Ignored immutable `review.md`, `manifest.json`, `overlays.json` and coverage evidence |

Keep packet evidence ignored; do not stage source PDFs, credentials or owner assets. Use an isolated checkout only if it fits current storage constraints; inspect the using-git-worktrees skill at execution time and avoid duplicating node_modules/native artifacts. Preserve current service paths when choosing isolation.

## Task 1: Author and independently verify the 20 short-source revisions

**Files:** Create `data/editorial/short-initial.json`, `tests/references/editorial-short.test.ts`; modify reference Jest match only if necessary. Update `docs/verification/editorial-content.md` with actual research evidence.

**Interfaces:** Consume `loadCandidates(root): Promise<NormalizedCandidate[]>`, `loadIdentityRegistry(root): Promise<IdentityRegistry>`, `assignIdentity(key, registry): string`, `EditorialOverlaySchema`, `QuestionSchema`, and `canonicalJson`. Produce a JSON array of 20 `EditorialOverlay` values. No approval fields; valid completed proposals have `Question` shape, incomplete ones remain visibly draft.

- [ ] Run `git status --short`, `npm run test:references`, and inspect existing source/extraction hashes before edits. Read every short-source original in authoritative parser output, not just a proposed key. Retain the baseline outputs under ignored evidence.
- [ ] Add this real-corpus structural test, then run it before authoring:

```ts
import { resolve } from 'node:path';
import { QuestionSchema } from '../../src/features/content/domain/question';
import { canonicalJson } from '../../tools/questions/editorial';
import {
  loadCandidates, loadOverlays, loadIdentityRegistry,
} from '../../tools/questions/source-workflow';

it('accounts for all short occurrences without inventing lineage or approval', async () => {
  const root = resolve(__dirname, '../..');
  const candidates = (await loadCandidates(root)).filter(c => c.original.sourceId === 'short');
  const overlays = (await loadOverlays(root)).filter(o => o.sourceKey.startsWith('short:'));
  const registry = await loadIdentityRegistry(root);
  expect(candidates).toHaveLength(20);
  expect(overlays.map(o => o.sourceKey).sort()).toEqual(
    candidates.map(c => c.original.sourceKey).sort(),
  );
  expect(new Set(overlays.map(o => o.sourceKey)).size).toBe(20);
  for (const overlay of overlays) {
    expect(overlay.approval).toBeUndefined();
    expect(['draft', 'needsReview']).toContain(overlay.status);
    if (overlay.status === 'draft') continue;
    const question = QuestionSchema.parse(overlay.proposed);
    const original = candidates.find(c => c.original.sourceKey === overlay.sourceKey)!.original;
    expect(question.id).toBe(registry[overlay.sourceKey]);
    expect(question.version).toBe(1);
    expect(question.sources).toHaveLength(1);
    expect(question.sources[0]).toMatchObject({
      sourceId: original.sourceId, checksum: original.evidence.checksum,
      section: original.section, originalNumber: String(original.ordinal),
      pages: { start: original.pageStart, end: original.pageEnd },
      originalChoiceLabels: original.rawChoices!.map(c => c.label),
      originalAnswer: original.rawAnswer, evidenceLocator: original.evidence.locator,
      links: original.evidence.links, imageLocations: original.evidence.imageLocations,
    });
    for (const issue of candidates.find(c => c.original.sourceKey === overlay.sourceKey)!.issues) {
      if (!issue.blocking) continue;
      expect(overlay.review?.issues?.some(i => canonicalJson(i) === canonicalJson(issue))).toBe(true);
      expect(overlay.review?.resolutions?.some(r => r.code === issue.code)).toBe(true);
    }
  }
});
```

Run: `npm run test:references -- --runTestsByPath tests/references/editorial-short.test.ts`. Expected initial failure: zero overlays. After owner approval in Task 4, replace the pre-approval status assertions with publication digest/readback assertions; preserve the separate draft-no-approval unit tests.

- [ ] Author the overlay file directly, using actual authoritative records. Start each complete question with this exact construction pattern; the research decisions supply `categoryId`, `subcategoryId`, explanation and corrections, never guessed values:

```ts
const text = (value: string) => [{ kind: 'text' as const, text: value, marks: [] }];
const original = candidate.original;
const lineage = {
  sourceId: original.sourceId,
  checksum: original.evidence.checksum,
  section: original.section,
  originalNumber: String(original.ordinal),
  pages: { start: original.pageStart, end: original.pageEnd },
  originalChoiceLabels: original.rawChoices?.map(c => c.label) ?? [],
  originalAnswer: original.rawAnswer,
  evidenceLocator: original.evidence.locator,
  links: original.evidence.links,
  imageLocations: original.evidence.imageLocations,
  corrections: [],
};
const stableId = assignIdentity(original.sourceKey, registry);
```

Use `choice-1` through the existing choice count in original order, `choiceOrderPolicy: 'fixed'`, active status only for complete sound revisions, actual ISO authoring timestamps and `isCurrentEvent: false` unless genuinely time-sensitive. Preserve marked targets when needed. A correction adds its reason and evidence locator to lineage; the overlay rationale/evidence also identifies authored explanation and taxonomy reasoning. Copy source issues verbatim into review metadata; specific resolutions explain what was verified, not merely “reviewed.”

- [ ] Independently derive arithmetic and logic before comparing PDF answers: Q6 percentage; Q7 ratio allocation; Q8 number pattern; Q9 rate; Q10 simultaneous age equations; Q11 syllogism; Q12 letter sequence; Q13 classification; Q14 contrapositive; Q15 differences; Q16 orientation. Record worked derivations, including why ambiguous alternatives are excluded. Language items require lexical/grammar reasoning. Do not write tests comparing the selected key to another copy of that same selected key.
- [ ] Browse current primary sources for Q17–Q20 and record direct URLs, supporting claims and actual verification timestamps. Verify Q18 against the Constitution. For Q19, verify departmental administration and NAPOLCOM control and revise wording/key together if necessary. For Q20, verify current appointment age/rank terminology separately from NAPOLCOM examination eligibility. Unresolved conflicting requirements remain draft with an explicit open issue; do not modernize the key from memory.
- [ ] Audit taxonomy per item. Word analogy and number/letter patterns must not inherit their PDF section's category automatically. Cite the foundation taxonomy IDs; do not invent a new PNP-history mapping for general history.
- [ ] Run the real-corpus test and `npm run typecheck:tools`; independently inspect all 20 originals against overlays and derivations. Document unresolved rows and before/after PDF checksums. Commit only the overlay, structural test/config if changed and verification document:

```bash
git add data/editorial/short-initial.json tests/references/editorial-short.test.ts docs/verification/editorial-content.md
git commit -m "content: prepare short-source questions for editorial review"
```

## Task 2: Generate immutable exact-revision review packets

**Files:** Create `tools/questions/review-packet.ts`, `tests/content/review-packet.test.ts`.

**Interfaces:** Consume `EditorialOverlay[]`, `NormalizedCandidate[]`, `QuestionSchema`, existing canonical/digest helpers and `safeGeneratedPath`. Produce the interfaces below. A packet digest binds all proposed content, rationale, evidence, statuses, review metadata, authoritative originals/issues and rendered review text. No synthetic approval is written or treated as human review.

```ts
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
export function buildReviewPacket(
  batchId: string,
  candidates: readonly NormalizedCandidate[],
  overlays: readonly EditorialOverlay[],
): ReviewPacket;
export function writeReviewPacket(root: string, packet: ReviewPacket): Promise<string>;
```

- [ ] Add failing tests using `testQuestion()` and a corresponding synthetic candidate. The candidate has sourceKey `synthetic-test-only:fixture:1`, original fields copied from the fixture's source lineage and `issues: []`. The unapproved overlay uses that key, fixture question, `status: 'needsReview'`, rationale `Independent arithmetic derivation`, evidence `['15 × 200 / 100 = 30']`, review `{ issues: [], resolutions: [] }`.

```ts
const first = buildReviewPacket('fixture', [candidate], [overlay]);
expect(first.manifest.rows[0]?.contentDigest).toBe(contentDigest(testQuestion()));
expect(first.markdown).toContain('What is 15% of 200?');
expect(first.markdown).toContain('30');
const changed = { ...overlay, rationale: 'Updated verification rationale' };
expect(buildReviewPacket('fixture', [candidate], [changed]).manifest.packetDigest)
  .not.toBe(first.manifest.packetDigest);
expect(() => buildReviewPacket('fixture', [candidate], [overlay, overlay])).toThrow();
```

Also test changed review evidence, source issue/source answer, choice order, stimulus, marks and malformed proposed question. An incomplete draft must still have a visible row, null content digest and schema diagnostics; it cannot disappear. Markdown must contain the full prompt/stimulus/choice IDs and text, correct choice, explanation, taxonomy, original answer/pages, corrections, verification URL/time, authoritative issues, resolutions, open issues and digests. Escape Markdown delimiters without losing displayed text.

- [ ] Run: `npm run test:unit -- --runTestsByPath tests/content/review-packet.test.ts`. Expected failure: module missing.
- [ ] Implement packet construction with these core operations, using explicit types from the interface block:

```ts
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const reconciled = combineBySourceKey(candidates, overlays);
const rows = reconciled.map(({ overlay }) => {
  const parsed = QuestionSchema.safeParse(overlay.proposed);
  return {
    sourceKey: overlay.sourceKey,
    overlayDigest: hash(overlay),
    contentDigest: parsed.success ? contentDigest(parsed.data) : null,
    reviewDigest: overlay.review ? reviewDigest(overlay.review) : null,
  };
});
```

Sort by authoritative source order. Render rich text/math in human-readable form plus a fenced complete JSON revision so marks and structured content are reviewable. Unsupported blocks render explicit blocked diagnostics, not stripped content. Build the manifest digest from `{ batchId, rows, overlays, originals, markdown }`, where `originals` are the reconciled candidates including their issues, and `markdown` is the exact final review text before adding the packet digest footer. Validate batch IDs with `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.

- [ ] Add filesystem regression tests using `mkdtemp` and `finally` cleanup. Generate one packet, write it twice and expect the second write to reject without changing any first file. Create symlink destinations and a hard-linked existing manifest; reject before overwriting. Check all three files match the packet object and manifest digest. Use existing path guard tests as reference, without modifying owner paths.
- [ ] Implement an immutable directory writer. Resolve `evidence/editorial/${batchId}/${packetDigest}` through `safeGeneratedPath` using a child path, create parent directories, then reserve the digest directory with non-recursive `mkdir`; existing destination is an error. Write `review.md`, `manifest.json`, `overlays.json` with `flag: 'wx'`. If a write fails retain the incomplete directory as failed evidence; never present it as a completed packet or silently reuse it. Do not use `writeGenerated`'s overwrite behavior for approved packet files.
- [ ] Run packet tests, `npm run typecheck:tools`, lint on changed files, and format them. Commit named files:

```bash
git add tools/questions/review-packet.ts tests/content/review-packet.test.ts
git commit -m "feat: generate immutable editorial review packets"
```

## Task 3: Report truthful coverage and prepare the first owner packet

**Files:** Create `tools/questions/coverage.ts`, `tools/questions/prepare-review.ts`, `tests/content/coverage.test.ts`; modify `docs/content-workflow.md`, `docs/verification/editorial-content.md`.

**Interfaces:** Consume all authoritative candidates, all overlays, and the entire validated eligible publication returned by `loadApprovedPublication(root)`. Consume Task 2 `buildReviewPacket`/`writeReviewPacket`. Produce a coverage object and console summary. No publication writes or Firebase connection in the preparation runner.

```ts
export type Disposition = 'unavailable' | 'draft' | 'needsReview' | 'rejected' |
  'approvedEligible' | 'approvedBlocked' | 'approvedExpired';
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
export function coverageReport(
  candidates: readonly NormalizedCandidate[],
  overlays: readonly EditorialOverlay[],
  eligible: readonly Question[],
  clock?: EvaluationClock,
): CoverageReport;
```

Every occurrence has exactly one disposition. Category/subcategory totals only use schema-valid proposed taxonomy; invalid/unmapped proposals appear in `unmapped`. An absent overlay is unavailable for publication, even if parser output suggests a key. Approved expired means a sound approved revision excluded by expiry; other failed approval/schema/source checks mean approvedBlocked. Distinct eligible logical IDs, not occurrence totals, determine quota readiness.

- [ ] Add failing tests with synthetic fixture candidates/overlays. Test no overlays → unavailable, unapproved complete question → needsReview with eligible zero, invalid proposal → draft/unmapped, rejected retained, stale approved digest → approvedBlocked, valid current-event fixture expired at a fixed clock → approvedExpired. Use existing publication/current-event fixtures for complete required verification/time fields rather than weakening schemas. Feed deliberately duplicated eligible IDs and require failure; never count duplicates twice.

```ts
const report = coverageReport([candidate], [overlay], []);
expect(report.occurrences).toBe(1);
expect(report.quotas.map(q => [q.required, q.eligible, q.shortage])).toEqual([
  [35, 0, 35], [40, 0, 40], [25, 0, 25], [50, 0, 50],
]);
expect(report.bySubcategory).toHaveLength(15);
expect(report.defaultExamReady).toBe(false);
expect(report.bySubcategory.find(r => r.id === 'dataInterpretation')).toBeDefined();
expect(() => coverageReport([candidate], [], [testQuestion(), testQuestion()])).toThrow();
```

Test an exactly satisfied 150-distinct-question synthetic eligible set and a 149-question set short in one category. They are isolated fixtures only and never enter editorial or publication files.

- [ ] Run: `npm run test:unit -- --runTestsByPath tests/content/coverage.test.ts`. Expected failure: missing module.
- [ ] Implement dispositions using `combineBySourceKey`, `QuestionSchema.safeParse`, `publishable(overlay, { issues })` and `eligibilityIssues` with the fixed clock. Include transport limitations in approvedBlocked classification; do not claim an image/table is eligible because its domain schema parses. Enforce unique eligible IDs and require every eligible ID to correspond to a sound approved overlay/source context. Use the authoritative full publication loader to reject registry/lineage/transport mismatches before generating the production report.

```ts
const required: Record<CategoryId, number> = {
  generalInformation: 35,
  communicationSkills: 40,
  quantitativeReasoning: 25,
  criticalThinking: 50,
};
const quotas = taxonomy.map(category => {
  const count = eligible.filter(q => q.categoryId === category.id).length;
  return { categoryId: category.id, required: required[category.id],
    eligible: count, shortage: Math.max(0, required[category.id] - count) };
});
const defaultExamReady = quotas.every(q => q.shortage === 0);
```

- [ ] Implement `prepare-review.ts` as a positional runner with exactly one supported batch ID, `short-initial`. Reject extra/unknown arguments. Load all candidates and overlays using authoritative loaders; select the 20 keys belonging to sourceId `short`; require exactly one selected overlay per key. Load publication, build coverage, build packet, write immutable packet, then write `coverage.json` with exclusive creation inside the new packet directory. Print packet path/digest, eligible count and all four shortages. Reject unexpected pre-existing approval fields in this first pre-approval run.

```ts
const root = resolve(__dirname, '../..');
if (process.argv.length !== 3 || process.argv[2] !== 'short-initial') {
  throw new Error('Use prepare-review.ts short-initial');
}
const candidates = await loadCandidates(root);
const overlays = await loadOverlays(root);
const eligible = await loadApprovedPublication(root);
const shortKeys = new Set(candidates.filter(c => c.original.sourceId === 'short')
  .map(c => c.original.sourceKey));
const batch = overlays.filter(o => shortKeys.has(o.sourceKey));
if (batch.length !== 20 || new Set(batch.map(o => o.sourceKey)).size !== 20)
  throw new Error('First packet requires all 20 short occurrences');
if (batch.some(o => o.approval)) throw new Error('Preparation cannot stamp approvals');
const coverage = coverageReport(candidates, overlays, eligible);
const packet = buildReviewPacket('short-initial', candidates, batch);
const directory = await writeReviewPacket(root, packet);
await writeFile(join(directory, 'coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`,
  { flag: 'wx' });
```

Use imports for Node path/fs and the exact earlier interfaces; wrap entry-point errors to stderr and nonzero exit. Compute/validate coverage before creating the directory so invalid accounting does not leave an apparently reviewable packet.

- [ ] Run packet/coverage focused tests, `npm run test:unit`, `npm run test:references`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate:questions`, and `git diff --check`. Resolve failures only within this slice. Run `npx tsx tools/questions/prepare-review.ts short-initial`; confirm all 20 packet rows against originals and manifest digests. At this point eligible remains zero unless there were independently approved prior batches; never imply 20 drafts support a real default exam.
- [ ] Document the actual packet path/digest, all open rows and category shortages. Propose the next bounded corpus batch from the verified shortages; shared-context defects stay together. Commit only helpers/tests/docs, never ignored packet files:

```bash
git add tools/questions/coverage.ts tools/questions/prepare-review.ts tests/content/coverage.test.ts docs/content-workflow.md docs/verification/editorial-content.md
git commit -m "feat: report editorial coverage and prepare first review packet"
```

- [ ] Present the exact packet link and manifest to the owner, identify eligible revision candidates versus blocked rows, and request approval of that packet's batch or explicit subset plus reviewer label. **Stop dependent Task 4/5 actions until that answer arrives.** This checkpoint is required by the approved spec section 5: “Approval must refer to the exact packet and digest manifest already reviewed”; development approval does not satisfy it. Independent planning for subsequent corpus batches may continue; no approval stamps or publication writes may proceed.

## Task 4: Materialize only the owner's exact approved revisions

**Files:** Modify approved rows in `data/editorial/short-initial.json`, the existing `data/questions.json`, the real-corpus test and verification record. No new approval CLI or automatic acceptance policy.

**Interfaces:** Consume the owner's explicit selected source keys, packet digest and reviewer label; Task 2 manifest rows/snapshot; existing `publicationSet`, `approvedPublication`, registry/source-manifest and `contentDigest`/`reviewDigest`. Produce the full approved eligible question array, validated by existing reconstruction before writing.

- [ ] Record the actual owner reply and approval timestamp in the verification record. Read the preserved `manifest.json` and `overlays.json`, reconstruct the packet using the same authoritative sources, and compare its digest and every current selected overlay digest with the reviewed packet. If any differs, produce a new packet and request new exact approval. A blocked/draft row cannot be promoted solely because a batch name was approved.
- [ ] Extend real-corpus tests to assert each approved row passes `publishable` with authoritative source issues, its content/review digest matches, and unapproved rows remain unapproved. Retain a unit regression that modifying review metadata or proposed text after approval causes publication rejection. Run these tests before stamping: approved-publication acceptance assertions should fail on selected unapproved rows.
- [ ] Stamp only exact approved `needsReview` revisions, using owner-confirmed label and actual ISO approval time. Do not change question timestamps, explanation, taxonomy or review metadata while applying the stamp:

```ts
const question = QuestionSchema.parse(overlay.proposed);
const approved = EditorialOverlaySchema.parse({
  ...overlay,
  status: 'approved',
  approval: {
    reviewer: reviewerLabel,
    at: approvedAt,
    digest: contentDigest(question),
    ...(overlay.review ? { reviewDigest: reviewDigest(overlay.review) } : {}),
  },
});
```

`reviewerLabel` and `approvedAt` are recorded values from this checkpoint, not filenames or fabricated identities. Compare the pre-stamp overlay with the packet before executing this code. Reject nonselected IDs and duplicate selection.

- [ ] Reconstruct the entire publication from **all** overlays, never the first batch alone:

```ts
const candidates = await loadCandidates(root);
const overlays = await loadOverlays(root);
const reconstructed = publicationSet(combineBySourceKey(candidates, overlays));
if (reconstructed.errors.length) throw new Error(JSON.stringify(reconstructed.errors));
const registry = await loadIdentityRegistry(root);
const sources = sourceRegistry; // existing export from tools/questions/source-registry.ts
const questions = approvedPublication(
  candidates, overlays, registry, sources, reconstructed.questions,
);
await writeFile(join(root, 'data/questions.json'), `${JSON.stringify(questions, null, 2)}\n`);
```

Import `sourceRegistry` from `./source-registry`; preserve the authoritative full-set order. Expired/inactive approved rows must be visibly accounted for and excluded using the existing eligibility contract rather than silently overwritten. If the current full-publication contract rejects an approved expired revision, surface that failure and preserve the prior publication; do not weaken it for this batch.

- [ ] Run `npm run validate:questions`, reference tests, publication/import/source-workflow focused unit suites, typecheck and whitespace check. Recompute coverage after approval; record exact eligible counts and remaining shortages. Commit only selected overlay revisions, full publication, test updates and verification:

```bash
git add data/editorial/short-initial.json data/questions.json tests/references/editorial-short.test.ts docs/verification/editorial-content.md
git commit -m "content: publish exact owner-approved short-source revisions"
```

## Task 5: Validate the approved catalog in the existing local demo emulator

**Files:** Update `docs/verification/editorial-content.md`; ignored import manifests/readback under `evidence/editorial/short-initial/`. No mobile code changes.

**Interfaces:** Consume Task 4 validated full publication and existing `import:questions` CLI/`FirebaseImportStore`. Produce exact manifest/apply/readback evidence for demo only. If no eligible revisions were approved, report zero and skip apply rather than manufacture data.

- [ ] Inspect running emulator/Metro services, preserve their current imported accounts/data, and confirm Auth/Firestore are bound to `demo-pnpe` on localhost. Reuse current emulator services; do not start a second instance against occupied ports or clear their state. Current service discovery, not stale session IDs, establishes availability.
- [ ] Run existing import/Firestore integration tests against a separate test execution only when their setup will not erase the running user's demo data. If isolation is needed, use a temporary alternate-port emulator with no copied node_modules and stop it afterward. Existing unit tests cover stale manifest, target mismatch, immutable revisions and interrupted publication; rerun those before any apply.
- [ ] Produce the demo dry-run manifest using the existing guarded CLI:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run import:questions -- --project demo-pnpe --manifest evidence/editorial/short-initial/demo-import.json
```

Use a unique manifest filename if that file already exists. Inspect the exact project, full publication digest, intended revisions and current catalog changes. Never pass `--allow-production`.
- [ ] Apply through `runCli` with the actual inspected manifest digest, avoiding shell interpolation of untrusted values:

```ts
await runCli([
  'import', '--project', 'demo-pnpe', '--apply',
  '--manifest', manifestPath, '--confirm-digest', manifestDigest,
], dependencies);
```

Here `dependencies` are the existing CLI main wiring, with `emulatorHost: '127.0.0.1:8080'`; alternatively invoke the existing CLI with the same literal inspected arguments. This is authorized local demo publication after exact editorial approval, not production authorization.
- [ ] Read back catalog generation plus immutable revision documents through `ImportStore.readHead()`, `readShard(generation, id)` and `readRevision(id, version)`; compare IDs, versions and canonical payload digests to the approved full publication. Use the inspected import manifest's `generation` and `shardDigests`:

```ts
const head = await store.readHead();
if (head.generation !== manifest.generation) throw new Error('Catalog generation mismatch');
const entries = (await Promise.all(manifest.shardDigests.map(shard =>
  store.readShard(manifest.generation, shard.id)))).flat();
if (entries.length !== questions.length) throw new Error('Catalog count mismatch');
for (const question of questions) {
  if (!entries.some(entry => entry.id === question.id && entry.version === question.version))
    throw new Error(`Missing catalog revision: ${question.id}`);
  const revision = await store.readRevision(question.id, question.version);
  if (!revision || contentDigest(revision) !== contentDigest(question))
    throw new Error(`Revision readback mismatch: ${question.id}`);
}
```

 Run a second dry-run to demonstrate no unexpected content changes. Preserve evidence without exposing tokens or credentials. Do not claim visible Reviewer/Mock functionality from successful import.
- [ ] Run final changed-slice gates: unit/reference suites, both typechecks, lint, format, question validation and whitespace. Run mobile regression suite if shared domain behavior changed. Record actual totals, packet/publication/import digests, readback results, unresolved rows and all four shortages. Commit verification only:

```bash
git add docs/verification/editorial-content.md
git commit -m "docs: verify approved editorial demo catalog"
```

## Completion and continuation

The prepared checkpoint is all 20 overlays plus the immutable packet, actual research and honest coverage. It is not approved publication. The publication checkpoint requires the exact owner reply and passing digest/source checks; demo readiness additionally requires matching catalog readback.

Choose later bounded batches from actual category shortages; every later batch repeats preparation, packet generation, exact owner approval and full-publication validation. Do not pretend a fixed number of reviewed source occurrences guarantees 150 distinct eligible questions. If the preserved corpus cannot fill a category or needs unsupported assets, report the shortage and seek a separately reviewed authored batch/capability design.

Once this first content checkpoint is resolved, continue the user's requested Reviewer/bookmarks and Mock Exam/results sequence through their own specifications and implementation plans. Preserve all foundation constraints, especially read-through Reviewer behavior, frozen exam manifests, 150/180/75 practice defaults, local persistence and idempotent finalization. Do not reduce exam quotas to fit this initial content batch.

## Plan self-review

- Spec coverage: input preservation/687 accounting → Tasks 1/3; all 20 revisions/independent research → Task 1; immutable packets/exact approvals → Tasks 2/4; full publication and 35/40/25/50 coverage → Tasks 3/4; explicit local demo import/readback → Task 5; later engine boundaries → Completion and continuation.
- Type consistency: helpers consume existing `NormalizedCandidate`, `EditorialOverlay`, `Question`, `EvaluationClock` and taxonomy IDs; packet/coverage interfaces are defined before consumers. Source lineage consumes the existing `sourceRegistry` export; readback uses `ImportStore.readHead`, `readShard` and `readRevision`. No competing schemas are introduced.
- Five review-focus risks have assigned tests or independent factual audits; editorial correctness is not certified by copying source keys into tests.
- No production writes, approval fabrication, native rebuilds or unrelated cleanup are included. Exact editorial approval is the only dependent checkpoint during implementation.
