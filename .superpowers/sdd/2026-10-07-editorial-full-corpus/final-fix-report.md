# Final whole-branch fix wave

Base: `8e49474`. Status: DONE. All four final-review findings addressed in one wave. No approval, publication, import, registry, reference, shared generated output, service, asset, native, build or install changes.

## Changes

1. XV6 uses ordinary spaces and explicit option labels, preserving every algebraic identity. Related Task2 explanation inspection found compressed duration, anniversary-year, variable-domain and calendar notation in XIV5/21/22/23/27; those five explanations and their repeated rationale/review/audit prose received bounded spacing/label cleanup. No new logic, key, stem, alternative, taxonomy or stimulus was authored.
2. XIII15 explains the supported commercial implication from the speaker liking the soap. It no longer asserts actual use. Repeated rationale and audit prose agree.
3. Task4 regression now reads all four actual linked immutable files for each of twenty sections. Manifest and overlay JSON match reconstructed expected objects; Markdown matches exact expected bytes; coverage matches the scoped reconstructed report. A missing file rejects readFile; altered content fails the comparisons. Existing immutable files were not replaced.
4. Primary workflow records all687 dispositions (20 approved/509 proposals/145 drafts/13 rejected) and links the final index, with exact owner review as the next step.

Seven amended unapproved questions have actual proposed.updatedAt `2026-10-08T01:34:49.479Z`. Fresh immutable final-fix-v1 packets were generated through existing generic APIs for XIII/XIV/XV only; seventeen old packets are retained as current, and every prior evidence directory remains. Current owner manifest digest is `befca02b985a7d07d83dfecd457571308304f07e95b87dd526144f7937b5c7fb`, enumerating exactly509 needsReview revisions. Index and README links/digests agree. Deferred minor prose now references this fix report. The archived generator records the affected-section generation and fail-on-unexpected-change check for retained sections; temporary executable was removed.

## Fresh command evidence

- `npx tsx docs/verification/editorial-full-corpus/packet-generator.ts`: exit0; totals approved20/needsReview509/draft145/rejected13, packets20, packetRows667, revisions509, approved20, manifestDigest as above. Initial invocation caught an invalid top-level updatedAt (Zod unrecognized key) before writing any packet; corrected to the established proposed.updatedAt field and reran successfully.
- `npm run test:references -- --runTestsByPath tests/references/editorial-full-corpus-task2.test.ts tests/references/editorial-full-corpus-task4.test.ts`: exit0; both suites PASS, 3/3 tests passing, final run2.107s. This includes actual readback of all80 current packet files, manifest membership/digests, duplicate lineage and six preservation hashes.
- `npm run typecheck:tools`: exit0, tsc --noEmit -p tsconfig.tools.json, no diagnostics.
- `npm run lint`: exit0, eslint ., no diagnostics.
- `npm run format:check`: exit0, All matched files use Prettier code style!
- `npx prettier --check --ignore-path /dev/null` on three amended overlays, regression, workflow, Task2 audit and final README/reconciliation/index/manifest: exit0, All matched files use Prettier code style!
- `npm run validate:questions`: exit0, {"eligible":20}. Validation reconstructs strict approved publication; no unsupported --strict flag was used.
- Python read-only base/current comparison: exactly XIII15, XIV5/21/22/23/27, XV6 differ; stripping explanation/updatedAt and rationale/review makes all seven overlays identical. Every occurrence original digest, sourceRefs, counts and other index metadata preserved after stripping dispositionRationale. All old80 snapshot paths still exist. All six preservation hashes pass (three PDFs, identity registry, approved short-initial overlays, questions publication).
- `git diff --check`: exit0, no whitespace errors.

No new feature implementation or TDD requirement applies to this prose/documentation/readback review fix; the retained regression meaningfully verifies actual on-disk evidence. The unchanged345 unit/130 mobile suites were not repeated, per scoped instruction.

## Self-review

Reviewed the full diff, confirmed only the seven bounded question prose/metadata amendments, kept all historical research verification timestamps, and checked exact original/source lineage and six byte-preservation hashes. Caught and restored the historical README verification section during self-review; historical evidence remains distinguished from these fresh checks. No outstanding concerns.

Changed files: three section overlays, Task2 audit, content workflow, Task4 reference regression, final README/index/owner manifest/reconciliation, archived packet generator and this report. Ignored new packet artifacts remain unstaged.
