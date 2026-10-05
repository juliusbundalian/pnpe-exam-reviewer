# Content toolchain verification

Verified locally on 2026-10-04–05 in the isolated `pnpe-foundation` worktree. This is
the Task 7 toolchain checkpoint, awaiting the controller's broad review. It is not
mobile-foundation acceptance, production deployment, or publication approval.

## Commands and measured acceptance

| Command                                                                                                                                                                             | Result                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm ci` / pinned dependency install                                                                                                                                                | Admin 14.5.0, Tools 15.32.1; exact direct dev pins, no force/legacy peer options                                      |
| `npm run test:unit`                                                                                                                                                                 | 9 suites, 132 tests pass; integration excluded                                                                        |
| `npm run test:references`                                                                                                                                                           | 1 suite, 7 tests pass with all supplied originals/evidence; no missing-prerequisite skip                              |
| `npm run typecheck`                                                                                                                                                                 | Strict TypeScript passes, including dependency declarations                                                           |
| `npm run lint`                                                                                                                                                                      | Pass                                                                                                                  |
| `npm run format:check`                                                                                                                                                              | Pass                                                                                                                  |
| Explicit Prettier check of README and new docs with `--ignore-path /dev/null`                                                                                                       | Pass                                                                                                                  |
| `JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' GOOGLE_APPLICATION_CREDENTIALS='/nonexistent/pnpe-emulator-no-adc.json' npm run test:emulator`             | 1 suite, 6 integration tests pass on localhost demo-pnpe, Java 21.0.5, Firestore emulator 1.22.0 Standard edition     |
| Pinned cached PyMuPDF 1.28.2 interpreter rerun of `extract.py` for all three registered PDFs                                                                                        | 6/153/19 pages, 0/9/0 image placements; existing evidence compares identically                                        |
| Two independent `npm run process:references` runs                                                                                                                                   | 687 occurrences, 687 unique stable IDs; exact generated hashes and protected bytes unchanged                          |
| `npm run validate:questions`                                                                                                                                                        | `{"eligible":0}`; zero human-approved reference overlays                                                              |
| Java 21 `firebase emulators:exec --only firestore --project demo-pnpe 'npm run import:questions -- --project demo-pnpe --manifest evidence/content-toolchain/import-manifest.json'` | Read-only dry run passes; 0 creates/noops/questions/shards, previous head null/revision 0                             |
| `npm audit --omit=dev --json`                                                                                                                                                       | 0 production dependency findings; full dev tree reports 40 (5 moderate, 35 high), recorded without automatic upgrades |

Normal Python environment setup is documented in `docs/content-workflow.md`.
The cached interpreter used for this verification was
`/Users/juliusjervinbundalian/.cache/uv/archive-v0/fjIZT3XQbV2o90jQ/bin/python`.
Global Java remains 17.0.14; Java 21 is only a process-local emulator override.
No real production reads/writes, project creation, rules deployment, merge, or
push occurred. Emulator test cleanup deletes only the explicitly named
`demo-pnpe` local test database between cases; immutable-history retention is
asserted within tests and the importer itself has no delete operation.

## Content accounting and integrity

The final narrowed override also passed a fresh `npm ci` and
`npm ls google-gax google-auth-library gtoken --depth=5` (exit 0, valid tree).
Only Firestore API ancestry overrides authentication to 10.9.1; Tools SQL/pubsub
retain their legitimate 10.5.0 dependencies.

Sources account for short 20, comprehensive 477, and notes 190 occurrences (687,
178 pages). There are 482 occurrences with one or more blocking issues, 0 approved
reference questions, 1 exact duplicate group, and 196 near-duplicate pairs.
Suggestions never merge/delete occurrences. Every one of the 15 requested
subcategories has 0 approved items and is unavailable. Source/candidate counts
are not publishable or unique-question counts.

| Blocking issue           | Occurrences |
| ------------------------ | ----------: |
| taxonomy-review          |         249 |
| audited-source-defect    |          54 |
| missing-stem             |           1 |
| missing-prompt           |           9 |
| duplicate-alternative    |           5 |
| marked-target-review     |          90 |
| missing-passage          |           2 |
| confirmed-duplicate      |           2 |
| duplicate-label          |           1 |
| unresolved-key           |         200 |
| image-only               |           8 |
| image-answer-leakage     |           8 |
| missing-choices          |         199 |
| asset-review             |           1 |
| answer-only              |         190 |
| source-annotation-review |          17 |
| unmapped-taxonomy        |          50 |
| missing-time-context     |          35 |

Counts overlap; their sum is not the number of blocked occurrences. Machine and
human reports stay ignored at `evidence/content-toolchain/process-report.json`
and `.md`; candidates stay ignored at `data/generated/candidates.json`.

Before/after hashes match for originals under the main repository's `references/`,
the Downloads originals, and the worktree copies:

| Registered filename   | SHA-256                                                          |
| --------------------- | ---------------------------------------------------------------- |
| PNPE Reviewer.pdf     | ca25ecda36ab8db4036f6fb9a051d97a207178399fc850f1abe50a378bd4263d |
| PNPE Reviewer (1).pdf | cbd490cc60e4700912c1fc4e634a1e92f4231e1aa85687434837f7eb591ab169 |
| PNPE Reviewer (2).pdf | bd6e9a06be5bc48922fe784580d0bdd987a207881e3c317896488e995a04a70b |

Two measured processing runs preserve these exact hashes:

| Artifact                                          | SHA-256                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| candidates.json                                   | 2313a90657bd5868fe487aa4d6cf59fe0d897c4f9c44e6b3956a8dccb31df2c8 |
| process-report.json                               | 1910e99218a7d1cef68d5d7690aaa71a5617bbbb57489d94eb2ea114a464e57c |
| process-report.md                                 | c8550d1826ef9cb041de0cf194e98fc219d8d94db3fbc1380d83483b89ca3399 |
| identity-registry.json                            | 76dfdb31ef774865808d303ce592f786e6dea202ed08686a00aa03603232184b |
| questions.json (empty array)                      | 37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570 |
| editorial/README.md (only current editorial file) | 98f31652f8438327a3106aebf75309eec4ffc7c9e55520ae5924533e5fff0770 |

The empty snapshot's canonical input digest is
`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`;
the observed dry-run manifest digest is
`04e40991ecde2292ad13bb27d25281c5dda6ae4f677b9b00923a682ea126a6f6`.
Raw-file SHA and canonical content digest deliberately differ.

## Safety evidence and practical limits

Focused RED/GREEN cycles covered 8 CLI gate tests, 7 publication/path tests,
2 Firestore ID regressions, 4 unsupported table locations, a hard-link guard, and
a repeated-mark storage-size regression. Initial emulator run failed 4 adapter
cases and passed deny-all rules; implemented adapter then passed all cases.
Additional positive apply, wrong digest, process-output, approved-table, and shard
immutability checks exercise the final behavior. Full suites were rerun.

A full unit run exposed an old synthetic byte-bound fixture using 4,096-byte IDs;
that conflicts with the real 1,500-byte quota. The fixture now uses legal IDs and
large synthetic asset URI metadata to retain its independent shard-splitting
assertion. It is infrastructure-only test content and never runtime publication.
A temporary-path expectation was corrected for macOS `/var` → `/private/var`
canonical resolution. Watchman is disabled only in unit/integration Jest configs
to avoid recrawl warnings; the actual reference suite still ran successfully.

SDK declaration root cause: Admin → Firestore 9.3.1 → firestore-api 0.2.0 →
google-gax 5.0.8 → google-auth-library 10.5.0 → gtoken 8.0.0. The last ESM package
was imported by a CommonJS declaration, producing TS1479. A scoped override to
10.9.1 removes that dependency; strict TypeScript and emulator acceptance pass.
The first blanket google-gax override left an npm 11.4 stale nested Tools/pubsub
10.5.0 lock entry that `npm ls` reported as invalid even after deduplication.
The final override is limited to Firestore API 0.2.0 → google-gax 5.0.8 →
google-auth-library 10.9.1; unrelated Tools authentication packages are unchanged.
Production gax/auth behavior is unverified. Initial emulator metadata lookup was
eliminated using explicit dummy credentials/universe domain; acceptance also
passes with a nonexistent ADC credential path.

Every validate/dry-run/apply reconstructs approval from authoritative verified
sources plus overlays, checks real registry IDs and exact lineage, rejects invalid
approved overlays and hand-edited published content, and rejects fixture sources.
Tables in prompt/choices/explanation/stimulus fail before snapshot writes. Text,
marked text, and math have supported transport; images/diagrams are blocked until
an approved available learner-asset inventory exists. Key/evidence imagery is not
published. Domain table support remains for a later versioned Standard-compatible
codec. Domain shape support does not claim mobile rendering capability.

IDs/documents are checked before any import write. Bounds: safe ASCII IDs up to
1,500 bytes excluding reserved names; 700 KiB canonical JSON and independent
Firestore storage estimate including map/field/value overhead and a conservative
6 KiB document-name allowance; maximum 200 metadata entries per shard. Primary
references: [quotas](https://firebase.google.com/docs/firestore/quotas),
[storage calculations](https://firebase.google.com/docs/firestore/storage-size),
and [data types](https://firebase.google.com/docs/firestore/manage-data/data-types).
Large valid content may be conservatively rejected and needs reviewed tuning.

Immutable revisions/shards use create-and-compare, readback precedes publication,
and the transaction reads then compares the head revision before writing.
Interrupted staging retains the previous generation and all revisions; no-op
retry does not increment the head; stale manifests/CAS fail; client reads/writes
receive 403 under actual deny-all emulator rules. Empty replacement of an existing
catalog is blocked. Imports replace the complete current snapshot, preserve all
prior history, and never delete. Runtime store/project/mode and reviewed manifest
must agree; only localhost `demo-pnpe` is used for acceptance. All production apply
flags are required, but that path is deliberately unexecuted locally.

Public release still needs editorial approvals, source redistribution rights,
asset inventory/hosting/capabilities, transport/rendering implementation, and the
separate mobile plan's authentication/rules/device acceptance. Mandatory toolchain
checks are available and pass; whole-plan completion remains subject to review.

## Decision ledger retained for handoff

Ruling: add .prettierignore as Task 1 supporting configuration while preserving the exact format:check script — generated evidence, references, scratch, and approved existing docs need exclusion — if wrong, later documentation formatting needs explicit checks or a narrower ignore rule.

Ruling: use an explicit generic annotation in the supplied taxonomy flatMap test — TS6 heterogeneous literal tuples otherwise fail compilation; assertions and production unions unchanged — if wrong, only a test typing adjustment needs reversal.

Ruling: add parsers/types.ts, parsers/shared.ts, and tests/content/fixtures/source-records.ts as focused supporting files — three distinct parsers need one common evidence/record contract without duplicated buffers — if wrong, helper boundaries may need consolidation; format-specific rules remain separate.

Ruling: add minimal selected extracted regression-records.json fixture — brief requires actual defect regressions usable without all PDFs — if wrong, fixture selection needs reduction; raw parser snippets preferred for parser tests, parsed records only for normalization tests.

Ruling: extend editorial overlay with reviewed factual/asset/issue-resolution metadata and bind it with required reviewDigest when present; reconciliation supplies current candidate issues and rejects unknown/duplicate source keys — brief demands unresolved-issue and factual/asset gates without supplying their context — if wrong, editorial metadata/review tooling may need simplification; Question taxonomy remains the single approved taxonomy record.

Ruling: import input represents the complete desired approved catalog snapshot; preserve immutable revisions and all prior catalog generations, show previous head/new counts in manifest, and reject empty apply over a nonempty existing head — prescribed port cannot enumerate/merge external catalogs and spec calls for complete generation publication — if wrong, omitted questions could become absent from current catalog but remain recoverable in prior generations/revisions; operator must supply full approved set.

Ruling: add tools/questions/source-workflow.ts as a focused supporting module — verified filesystem processing/editorial reconstruction needs separation from command gates and Firebase adapter — if wrong, module boundaries may need consolidation, without changing exposed commands or publication rules.

Ruling: override only google-gax@5.0.8's google-auth-library dependency from10.5.0 to10.9.1 — npm metadata/tree confirms older10.5.0 pulls gtoken8 ESM and breaks TS1479 while compatible10.9.1 removesgtoken and is already in Tools tree; keep directAdmin/Tools pins and library checking — if wrong, live gax/auth compatibility may need a different patch; emulator/fulltypechecks must rerun and live verification remains pending.

Ruling: reject table blocks during real publication/import preflight until a versioned Firestore transport codec exists; preserve domain table contract — Firestore rejects directly nested string[][] rows and spec excludes unsupported required formats — if wrong, table publication is delayed unnecessarily; all staged content remains preserved and future codec can restore support.

Ruling: add focused firestore-limits.ts storage-size preflight using documented value/map overhead and conservative document-name allowance — a valid question with many marks can fit700KiB JSON yet exceed actualFirestore1MiB; brief requires sizevalidation beforewrites — if wrong, conservative estimates may reject valid largequestions and need tuning; oversizedpartialwrites are avoided.

Ruling: narrow the dependency override to @google-cloud/firestore-api@0.2.0 > google-gax@5.0.8 > google-auth-library10.9.1 — npm11.4 retained an invalid nestedTools/pubsub10.5 entry under blanketgaxoverride after freshci/dedupe; only Firestore API path consumes broken declarations — if wrong, Firestore path typing/runtime may need a different upstream patch; unrelatedTools dependency paths remain untouched.
