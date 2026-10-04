# PNPE Content Toolchain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a reproducible, editorially gated questionnaire normalization toolchain with safe Firestore import and reusable typed content contracts.

**Architecture:** Pure TypeScript contracts and normalization functions sit between read-only PDF extraction and developer-only Firebase Admin adapters. Extraction evidence, editorial overlays, and approved publication artifacts stay separate. No mobile or production deployment is required to test this subsystem.

**Tech Stack:** Node 24, TypeScript 6.0.3, Zod 4.6.5, Jest 29.7.0, ts-jest 29.4.14, tsx 4.23.15, Firebase Admin 14.5.0, Firebase Tools 15.32.1, PyMuPDF 1.28.2.

**Spec:** [Approved foundation/content specification](../specs/2026-10-04-foundation-and-content-design.md), principally sections 2, 6–8 and 10. Mobile delivery follows the [companion plan](2026-10-04-mobile-foundation.md).

## Global Constraints

- “Preserve the three PDFs byte-for-byte.”
- “Avoid `any`; narrow `unknown` at external boundaries with validated schemas.”
- “Structural validation is not editorial approval.”
- “Never overwrite an immutable revision or implicitly delete content.”
- “No Firebase project creation, rules deployment, production import, app-store submission, or automatic editorial approval is part of executing this slice.”
- Four categories, fifteen subcategories; 687 source occurrences, not approved-question counts.
- Reviewer covers all eligible questions and shows answers immediately; Mock Exam uses 150 items with quotas 35/40/25/50 and 180 minutes. This plan implements neither session engine.
- No Custom Practice, Diagnostic Exam, Weak Topics/recommendations, separate Mistake Review, Question Mastery, Search, or Study Goals.
- Test fixtures are explicitly synthetic and never enter `data/questions.json`.

## Review Focus

1. A changed PDF with the same filename must fail checksum validation before the old layout rules run — Task 3.
2. Re-extraction must not erase an editor's work or change stable IDs — Task 4.
3. Negation, mathematical grouping, and distinct passages must survive normalization/deduplication — Tasks 2 and 4.
4. An interrupted or competing import must not publish a partial generation — Tasks 6 and 7.
5. A syntactically valid but stale editorial approval must never publish changed answers — Task 5.

---

## Execution and compatibility preflight

Read both spec and plan; invoke using-git-worktrees at execution time, not during planning. The original `references/` directory is untracked. Copy only the three named PDFs into the isolated worktree after checking original hashes; do not move or delete originals or assume a new worktree contains them. Keep copied PDFs untracked pending the owner's source-content licensing decision. No blanket `git add .`.

Use Node 24 with pinned TypeScript 6.0.3 rather than npm's TypeScript 7: inspected ts-jest 29.4.14 declares TypeScript `<7`. Jest 29.7 aligns with the later jest-expo preset. Lock exact resolved dependencies. If a pinned install has incompatible peers, stop and investigate; do not use `--force` or `--legacy-peer-deps` to suppress the problem.

Host observed: Node 24.3.0, Xcode 26.5, Android platform 36, Java 17. Firestore's [emulator documentation](https://firebase.google.com/docs/emulator-suite/connect_firestore) warns of Java 21 requirements. Prefer a user-provided/local Java 21+ runtime for emulator tests; inspect availability and report a missing runtime rather than silently changing global Java or claiming tests passed.

## File responsibilities

| Location | Responsibility |
| --- | --- |
| `src/features/content/domain/taxonomy.ts` | Fixed IDs, labels, and category/subcategory validation |
| `src/features/content/domain/content.ts`, `src/features/content/domain/question.ts` | Zod external-data contracts and inferred domain types |
| `tools/questions/extract.py`, `tools/questions/requirements.txt` | Pinned developer-only PDF text/layout/image evidence extraction |
| `tools/questions/source-registry.ts`, `tools/questions/source-schema.ts` | Expected input hashes, page counts, source/section occurrence identities |
| `tools/questions/parsers/short.ts`, `large.ts`, `notes.ts` | Source-specific segmentation, shared context, and blocked-record accounting |
| `tools/questions/normalize.ts`, `tools/questions/identity.ts`, `tools/questions/duplicates.ts` | Conservative normalization and source lineage |
| `tools/questions/editorial.ts`, `tools/questions/publication.ts` | Review digests and publication eligibility |
| `tools/questions/import-plan.ts`, `tools/questions/import-store.ts`, `firebase-import-store.ts` | Target-bound manifest and staged publication |
| `tools/questions/cli.ts` | Explicit process/validate/import command boundary |
| `data/source-manifest.json`, `identity-registry.json`, `editorial/` | Preserved input inventory and reviewed transformations |
| `data/generated/`, `data/questions.json` | Reproducible evidence/reports and approved set |
| `tests/content/`, `tests/import/`, `tests/fixtures/content/` | Synthetic regression fixtures and reference accounting |

## Task 1: A strict, testable taxonomy package

**Files:** Create `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.tools.json`, `jest.config.cjs`, `eslint.config.mjs`, `.prettierrc.json`, `.nvmrc`, `src/features/content/domain/taxonomy.ts`, `tests/content/taxonomy.test.ts`; modify `.gitignore`.

**Interfaces:** Produces `CategoryId`, `SubcategoryId`, `taxonomy`, and `isTaxonomyPair(category: string, subcategory: string): boolean`. Define `CategoryDefinition = {readonly id:string; readonly label:string; readonly subcategories:readonly {readonly id:string;readonly label:string}[]}` beside the constant. Use camelCase IDs; subcategory IDs are globally unique.

- [ ] Add only the tools required for this task, preserving the current license/docs. Pin Zod 4.6.5, TypeScript 6.0.3, Jest 29.7.0, ts-jest 29.4.14, `@types/jest` 29, tsx 4.23.15, ESLint 9.39.5, typescript-eslint 8.71.0, Prettier 3.9.9, and Node 24 types. Save exact resolutions and lockfile. Scripts: `test:unit = jest --runInBand`, `typecheck = tsc --noEmit`, `lint = eslint .`, `format:check = prettier --check .`. Set `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `resolveJsonModule`; tools compile separately from later native JSX. Ignore node_modules, generated evidence, Python environments, secrets, and coverage; preserve `.superpowers/` exclusion.

```js
// jest.config.cjs
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/content/**/*.test.ts', '<rootDir>/tests/import/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.tools.json' }] },
};
```

- [ ] Write the failing test before the taxonomy implementation:

```ts
import { taxonomy, isTaxonomyPair } from '../../src/features/content/domain/taxonomy';
test('fifteen subcategories, without historical-trivia aliases', () => {
  expect(taxonomy).toHaveLength(4);
  expect(taxonomy.flatMap(category => category.subcategories)).toHaveLength(15);
  expect(isTaxonomyPair('communicationSkills', 'grammar')).toBe(true);
  expect(isTaxonomyPair('generalInformation', 'grammar')).toBe(false);
  expect(isTaxonomyPair('generalInformation', 'philippineHistory')).toBe(false);
});
```

- [ ] Run `npm run test:unit -- tests/content/taxonomy.test.ts`; require a missing-module/export failure, not a broken Jest setup.
- [ ] Implement the exact spec taxonomy using `as const satisfies readonly CategoryDefinition[]`; IDs: `constitutionAndLaws`, `pnpHistory`, `criminalJusticeSystem`, `currentEvents`, `publicServiceConduct`, `vocabulary`, `readingComprehension`, `grammar`, `basicConcepts`, `problemSolving`, `dataInterpretation`, `logicalReasoning`, `patternAnalysis`, `deduction`, `wordAnalogy`. Infer unions from the array; implement pair checking with category/subcategory membership.

```ts
export function isTaxonomyPair(category: string, subcategory: string): boolean {
  return taxonomy.some(item => item.id === category &&
    item.subcategories.some(child => child.id === subcategory));
}
```

- [ ] Run the targeted test, typecheck, lint, and formatting; fix failures before committing the named files as `feat: establish typed PNPE taxonomy and toolchain`.

## Task 2: Published question and rich-content contracts

**Files:** Create `src/features/content/domain/content.ts`, `src/features/content/domain/question.ts`, `tests/fixtures/content/question.ts`, `tests/content/question.test.ts`.

**Interfaces:** Produces `ContentBlockSchema`, `QuestionSchema`, inferred `ContentBlock` and `Question`, and `testQuestion(overrides?: Partial<Question>): Question` in test-only fixtures. Text blocks are `{kind:'text', text:string, marks: readonly {start:number,end:number,role:'target'|'emphasis'}[]}`. Math blocks have `expression` plus `accessibleText`; assets have stable ID/version, HTTPS URL or bundled URI, dimensions, and alt text. Tables have headers and consistent rows. Stimulus is optional `{id,version,blocks}`.

- [ ] Create a synthetic fixture with ID `fixture-percentage`, version 1, `quantitativeReasoning/basicConcepts`, prompt “What is 15% of 200?”, choices `c1:20`, `c2:30`, key `c2`, `fixed` policy, active status, non-current-event flag, and ISO created/updated dates. Mark source `synthetic-test-only`. Never emit this fixture into the publication set.

```ts
test('correct choice identity and taxonomy are structural invariants', () => {
  expect(QuestionSchema.safeParse(testQuestion()).success).toBe(true);
  expect(QuestionSchema.safeParse(testQuestion({ correctChoiceId: 'missing' })).success).toBe(false);
  expect(QuestionSchema.safeParse(testQuestion({ categoryId: 'generalInformation' })).success).toBe(false);
});
test('current events cannot activate with unknown dates', () => {
  expect(QuestionSchema.safeParse(testQuestion({ isCurrentEvent: true })).success).toBe(false);
});
```

- [ ] Run `npm run test:unit -- tests/content/question.test.ts` and observe missing schema failure.
- [ ] Implement Zod discriminated block unions and the question object, then `superRefine` for valid taxonomy pair, key membership, unique IDs, normalized duplicate choice text, current-event dates, and valid mark ranges. Validate timestamps, positive versions, and shared stimulus dependencies. Do not let unknown block kinds disappear during parsing.

```ts
// Within QuestionSchema.superRefine:
if (!q.choices.some(choice => choice.id === q.correctChoiceId)) {
  ctx.addIssue({ code: 'custom', path: ['correctChoiceId'], message: 'Unknown choice ID' });
}
```

- [ ] Add tests for duplicated choice IDs/text, dangling marks, a math expression retaining parentheses, missing asset descriptions, uneven table rows, and two identical prompts with distinct stimuli. Run targeted suite/typecheck/lint. Commit as `feat: validate versioned question and rich content contracts`.

## Task 3: Read-only reference evidence and occurrence inventory

**Files:** Create `tools/questions/extract.py`, `tools/questions/requirements.txt`, `tools/questions/source-registry.ts`, `tools/questions/source-schema.ts`, `data/source-manifest.json`, `tests/content/source-evidence.test.ts`, `tests/fixtures/content/source-pages.json`.

**Interfaces:** `SourcePage = {page:number,text:string,blocks:unknown[],links:string[],imageRefs:string[]}` validated at the boundary; `SourceDocument = {sourceId,sha256,pageCount,pages}`. `verifySource(sourceId:string, bytes:Uint8Array): void` checks registry SHA-256 before extraction. `extract.py --input PATH --output DIR` emits evidence JSON and source images only beneath a validated output directory.

- [ ] Register the three exact filenames/checksums from the audit with expected page counts 6/153/19 and occurrence counts 20/477/190. Add a checksum test using deliberately modified bytes, and a registry fixture test:

```ts
test('same filename is not evidence of the same reference', () => {
  expect(() => verifySource('short', new TextEncoder().encode('changed PDF'))).toThrow('checksum');
});
test('source accounting matches inspected evidence', () => {
  expect(sourceRegistry.map(source => source.expectedOccurrences)).toEqual([20, 477, 190]);
});
```

- [ ] Run `npm run test:unit -- tests/content/source-evidence.test.ts`; require failure before implementation.
- [ ] Implement hashing using Node crypto and read-only file access. Pin `PyMuPDF==1.28.2` in requirements. The extractor opens input with PyMuPDF, records each page's sorted text, layout blocks, URI links and image positions, and writes JSON evidence. Preserve raw extraction text before any cleanup. Record image-only page 150 as evidence, not an empty page. Use this extraction core:

```python
with pymupdf.open(args.input) as document:
    for index, page in enumerate(document):
        record = {"page": index + 1, "text": page.get_text("text", sort=True),
                  "blocks": page.get_text("blocks"),
                  "links": [link["uri"] for link in page.get_links() if "uri" in link],
                  "imageRefs": []}
        # Each image is extracted by xref into this document's evidence directory;
        # its filename and placement are attached before serializing the record.
```

Implement image extraction with `document.extract_image(xref)`, SHA-based filenames, and page bounding boxes; reject output paths nested inside `references/`. Extraction may overwrite only generated evidence, never source or editorial directories.

- [ ] Run the extractor against all three unchanged originals; validate evidence schemas, page totals, and before/after hashes. Store small representative fixtures in tests, not all PDF-derived material in a commit. Check PyMuPDF's distribution terms when packaging developer tooling; no Python component enters the mobile app.
- [ ] Run tests/typecheck/lint and commit named tooling/manifests/fixtures as `feat: preserve reference evidence and source checksums`.

## Task 4: Source-specific segmentation and conservative normalization

**Files:** Create `tools/questions/parsers/short.ts`, `large.ts`, `notes.ts`, `tools/questions/normalize.ts`, `tools/questions/identity.ts`, `tools/questions/duplicates.ts`, `tests/content/parsers.test.ts`, `tests/content/normalization.test.ts`, `data/identity-registry.json`.

**Interfaces:** `SourceRecord = {sourceKey,sourceId,section,ordinal,pageStart,pageEnd,rawPrompt,rawChoices,rawAnswer,rawExplanation,stimulus,issues}`; unknown fields are explicit nullable values, not fabricated strings. Parsers return `SourceRecord[]`. `normalize(record:SourceRecord): NormalizedCandidate`; `normalizeText(text:string):string`; `fingerprint(candidate:NormalizedCandidate):string`; `assignIdentity(sourceKey:string, registry:IdentityRegistry):string`. Candidate contains original record, proposed question fields, taxonomy proposal, and typed blocking/nonblocking issues.

- [ ] Add small synthetic page fixtures for each source pattern plus extracted regression snippets for the defects documented in the audit. Create these tests:

```ts
test('normalization preserves negation and mathematical grouping', () => {
  expect(normalizeText('Which is NOT correct?')).toContain('NOT');
  expect(normalizeText('(a + b) / c')).toBe('(a + b) / c');
});
test('a generic prompt in different passages is not a duplicate', () => {
  const base = normalize(paragraphFixture('Passage one'));
  const other = normalize(paragraphFixture('Passage two'));
  expect(fingerprint(base)).not.toBe(fingerprint(other));
});
test('re-extraction keeps source identity after editorial correction', () => {
  const registry = { 'large:VIII:33': 'q-stable-33' };
  expect(assignIdentity('large:VIII:33', registry)).toBe('q-stable-33');
});
```

Define `paragraphFixture(passage:string):SourceRecord` in the same fixture file using the five-position/sentence-set source shape and an explicit source key. Add real-reference accounting assertions in `tests/references/accounting.test.ts`, run separately with `jest.references.config.cjs` and `test:references`; these require the owner's three PDFs. Unit tests use checked-in representative fixtures and never silently skip source-dependent checks. Account for all 687 occurrences; do not satisfy the count by manufacturing blank candidates.

- [ ] Run the parser/normalization tests and observe failures.
- [ ] Implement separate section-aware state machines: short headings/numbered MCQs; large fifteen sections with repeated headers, cross-page buffers, shared paragraph groups, inline numbered grammar choices and image locators; notes five sections with `Answer:` boundaries and no assumed distractors. Emit a blocked source record for each unparseable known occurrence with page evidence. Reject unexplained count/number gaps.

```ts
export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\u200b/g, '').replace(/[\t ]+/g, ' ').trim();
}
```

Do not erase line structure before segmentation, punctuation, minus signs, superscripts, or grammar errors being tested. Source keys use file registry ID/section/occurrence, not mutable prompt text. Allocate new IDs only through registry updates; collisions are errors. Hash prompt + choices + complete stimulus for exact duplicate clusters. Near-duplicate reports may use token overlap, never automatic merge. No taxonomy assignment by answer alone.

- [ ] Assert known defects remain blocked: large I5 missing stem, IV2 duplicate alternative, V11–12 missing passage, VIII33/34 duplicate pair, X8 conflicting arithmetic/key, XII15 duplicate labels, image answer leakage, notes current dates missing. Preserve the 190 answer-only records as candidates, not active MCQs. Process twice and compare source IDs/normalized outputs; editorial files must remain untouched.
- [ ] Run tests/typecheck/lint and commit as `feat: normalize all reference formats with issue accounting`.

## Task 5: Editorial overlays and publication validation

**Files:** Create `tools/questions/editorial.ts`, `tools/questions/publication.ts`, `tests/content/publication.test.ts`, `data/editorial/README.md`, `data/questions.json`.

**Interfaces:** `EditorialOverlay = {sourceKey, proposed:unknown, rationale:string, evidence:readonly string[], status:'draft'|'needsReview'|'approved'|'rejected', approval?:{reviewer:string,at:string,digest:string}}`; `contentDigest(question:Question):string`; `publishable(overlay:EditorialOverlay):{ok:true,question:Question}|{ok:false,issues:readonly string[]}`. Digest canonical JSON with recursively sorted object keys, preserving array order; include content/taxonomy/dates/stimulus but exclude the approval itself.

- [ ] Write tests using the synthetic question, and a helper `approvedOverlay(q:Question):EditorialOverlay` whose approval is explicitly test-only:

```ts
test('editing an approved key invalidates approval', () => {
  const approved = approvedOverlay(testQuestion());
  approved.proposed = testQuestion({ correctChoiceId: 'c1' });
  expect(publishable(approved)).toMatchObject({ ok: false });
});
test('valid content without editorial approval does not publish', () => {
  expect(publishable({ sourceKey: 'test:1', proposed: testQuestion(),
    rationale: 'synthetic', evidence: [], status: 'draft' })).toMatchObject({ ok: false });
});
```

- [ ] Run `npm run test:unit -- tests/content/publication.test.ts`; require failure.
- [ ] Implement schema-first publication, then review-status/digest and unresolved-issue checks. Missing factual verification, asset review, or taxonomy blocks publication. Keep candidate corrections distinct from source answers. Re-extraction combines by sourceKey without changing overlay files.

```ts
if (overlay.status !== 'approved' || !overlay.approval) {
  return { ok: false, issues: ['EDITORIAL_APPROVAL_REQUIRED'] };
}
if (overlay.approval.digest !== contentDigest(question)) {
  return { ok: false, issues: ['EDITORIAL_APPROVAL_STALE'] };
}
```

- [ ] Add tests for reordered object keys producing the same digest, changed choices/dates/stimulus producing different digests, an empty approved set, draft corrections surviving processing, and source licensing notes not being mistaken for approval. Start `data/questions.json` at `[]` if no human-approved revisions exist. Document how to draft the notes conversions without attributing authored distractors to the PDFs.
- [ ] Run tests/typecheck/lint and commit as `feat: require exact editorial approval for question publication`.

## Task 6: Target-bound import manifest and immutable generation protocol

**Files:** Create `tools/questions/import-plan.ts`, `tools/questions/import-store.ts`, `tests/import/plan.test.ts`, `tests/import/memory-store.ts`.

**Interfaces:** `ImportStore` exposes `readRevision(id,version):Promise<Question|null>`, `readHead():Promise<{generation:string|null,revision:number}>`, `createRevision(question):Promise<void>`, `writeShard(generation,id,entries):Promise<void>`, `readShard(generation,id):Promise<readonly CatalogEntry[]>`, `publishHead(expectedRevision,generation):Promise<void>`. `CatalogEntry` contains id/version/taxonomy/validity/capability/stimulus references. `ImportManifest` contains projectId, inputDigest, expectedHead, generation, creates/noops, shardDigests, and manifestDigest. `planImport(projectId:string,questions:readonly Question[],store:ImportStore):Promise<ImportManifest>`; `applyImport(manifest,questions,store,confirm:{projectId:string,manifestDigest:string}):Promise<void>`.

- [ ] Build an in-memory test store with immutable-create behavior, a replaceable injected failure at a specific shard write, and CAS head publication. Seed revision/head state through constructor parameters, not production methods.

```ts
test('dry run performs no writes', async () => {
  const store = new MemoryImportStore();
  await planImport('demo-pnpe', [testQuestion()], store);
  expect(store.writes).toEqual([]);
});
test('wrong target confirmation rejects before writes', async () => {
  const store = new MemoryImportStore();
  const plan = await planImport('demo-pnpe', [testQuestion()], store);
  await expect(applyImport(plan, [testQuestion()], store,
    { projectId: 'other', manifestDigest: plan.manifestDigest })).rejects.toThrow('target');
  expect(store.writes).toEqual([]);
});
```

- [ ] Run `npm run test:unit -- tests/import/plan.test.ts`; require failure.
- [ ] Implement manifest construction only from validated publication input, compare existing revision digests, reject differing immutable content, and group catalog metadata into deterministic category/subcategory shards capped at 200 entries and 700 KiB serialized payload. Reject any revision over 700 KiB before writing. Generate a content-addressed generation ID.

```ts
if (confirm.projectId !== manifest.projectId) throw new Error('Import target mismatch');
if (confirm.manifestDigest !== manifest.manifestDigest) throw new Error('Manifest mismatch');
if (digestQuestions(questions) !== manifest.inputDigest) throw new Error('Input changed');
// Persist/recheck immutable revisions, write/recheck every shard, then CAS publishHead.
```

Define `digestQuestions` alongside manifest hashing: sort by logical ID/version, canonicalize with Task 5's digest rules, hash SHA-256. On rerun, identical revisions/shards are no-ops; mismatches fail. Read back and verify all shard digests before CAS publication. Use `questionCatalogs/current` for the head, `questionCatalogs/{generation}/shards/{shardId}` for shards, and `questions/{id}/versions/{version}` for immutable content. The catalog generation is the selection authority, not potentially stale question metadata. Concurrent head change fails publication and requires a new dry run.

- [ ] Add and pass tests for interrupted shard upload keeping the previous head, competing publish rejection, immutable revision conflict, oversized payload, changed input after dry run, deterministic no-op rerun, and exact category counts.
- [ ] Run tests/typecheck/lint and commit as `feat: plan immutable and resumable content publication`.

## Task 7: Admin adapter, command workflow, and proof of safety

**Files:** Create `tools/questions/firebase-import-store.ts`, `tools/questions/cli.ts`, `tests/import/firestore.integration.test.ts`, `tests/import/cli.test.ts`, `firebase.json`, `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `docs/content-workflow.md`, `.env.example`, `.github/workflows/content.yml`; modify `package.json`, `.gitignore`, `README.md` (create if absent).

**Interfaces:** `FirebaseImportStore` implements Task 6's ImportStore through Firebase Admin; `runCli(args:readonly string[], dependencies:CliDependencies):Promise<number>` routes process/validate/import with injectable streams/store factory. `CliDependencies` holds input/output/error streams, registry loader, and store factory; constructors receive explicit projectId and emulator/production mode. Production apply requires `--apply --project PROJECT --manifest FILE --confirm-digest DIGEST` and an explicit `--allow-production` flag. No hidden fallback project.

- [ ] Write CLI tests proving `import` defaults to dry run, missing project fails, process rejects source-directory outputs, validate exits nonzero for invalid published input, and production writes cannot occur through omitted flags. Before both dry run and apply, reconstruct the approved set from editorial overlays and compare its digest to `data/questions.json`; a structurally valid hand-edited question file without matching approval must fail. Integration tests use only `demo-pnpe`, localhost emulator endpoints, and no ADC credentials.

```ts
test('CLI import without apply cannot mutate remote state', async () => {
  const harness = createCliHarness();
  const code = await runCli(['import', '--project', 'demo-pnpe'], harness.dependencies);
  expect(code).toBe(0);
  expect(harness.store.writes).toHaveLength(0);
});
```

Define `createCliHarness` in `tests/import/cli.test.ts` from Task 6's MemoryImportStore and Node memory streams; seed input with the synthetic approved fixture, not `data/questions.json`.

- [ ] Run unit tests red, implement argument parsing and commands, then add Firebase Admin 14.5.0 and Firebase Tools 15.32.1 as dev dependencies. Use Firestore `create` for immutable revisions; on ALREADY_EXISTS compare digest, never overwrite. Publish catalog head in a transaction comparing expected generation revision; transactions perform reads before writes.

```ts
await db.runTransaction(async transaction => {
  const snapshot = await transaction.get(headRef);
  const revision = snapshot.exists ? snapshot.get('revision') : 0;
  if (revision !== expectedRevision) throw new Error('Catalog head changed');
  transaction.set(headRef, { generation, revision: revision + 1 });
});
```

- [ ] Create deny-all Firestore rules for this toolchain-only checkpoint; Admin emulator operations still work. Configure Firestore 8080 and Auth 9099, bound to localhost. Scripts: `process:references = tsx tools/questions/cli.ts process`, `validate:questions = tsx tools/questions/cli.ts validate`, `import:questions = tsx tools/questions/cli.ts import`, and `test:emulator = firebase emulators:exec --only firestore --project demo-pnpe "jest --config jest.integration.config.cjs --runInBand"`. Create `jest.integration.config.cjs` using the same transformer and only `*.integration.test.ts`; exclude those from `test:unit`. Never run `firebase deploy` in scripts/CI.
- [ ] Run emulator integration tests for staged import interruption, no-op retry, and stale CAS manifest. If the emulator cannot run with available Java, record that failed prerequisite and leave integration acceptance unchecked; do not downgrade CLI tooling merely to bypass it.
- [ ] Run process twice on all three sources; verify 687 accounted occurrences, unchanged hashes, stable IDs, and untouched overlays. Run validation on the approved set and a local emulator dry run; report eligible counts and all blocking editorial issues honestly.
- [ ] Document installation, pinned Python environment, credentials separation, commands, review-digest lifecycle, dry-run/apply workflow, no-delete policy, untracked source files, asset/licensing gates, and the fact that no mobile/session engine exists yet. CI runs unit/typecheck/lint/format; reference processing requires supplied PDFs and must not silently skip while claiming it passed.
- [ ] Run `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run format:check`, emulator integration, and reference hash checks. Review the staged file list for secret/source leakage and commit as `feat: expose safe reference validation and import commands`.

## Completion and handoff

Review the branch against spec sections 6–8 and the five Review Focus cases. Record command results, unresolved editorial counts, and any unavailable emulator prerequisites in `docs/verification/content-toolchain.md`. This plan is complete only when its toolchain acceptance checks pass; unavailable mandatory checks mean partial completion. Follow the selected execution skill's review/integration workflow. Do not merge or start the mobile plan solely because a budget is exhausted.
