# Content workflow

This workflow validates content and stages immutable Firestore snapshots. It
does not create a Firebase project, deploy rules, or implement the mobile/session
engine. All questions remain staged until exact human approvals exist.

The owner confirmed that delivery covers the full usable reference corpus,
not just the minimum needed for one Mock Exam. There are 687 extracted source
occurrences: 20 short MCQs, 477 comprehensive entries and 190 answer-only notes.
All 687 occurrences now have an editorial disposition: 529 approved eligible,
145 drafts and 13 rejected duplicates. The owner approved the exact 509 new
revisions in manifest `befca02b985a7d07d83dfecd457571308304f07e95b87dd526144f7937b5c7fb`
as `Project owner`, observed/recorded at `2026-10-08T01:48:03Z`.
The initial twenty remain byte-identical. The
[approved publication and coverage](verification/editorial-full-corpus/approved-publication.md)
records the complete strict 529-question publication and read-only local demo
import plan. All four category pools meet their unchanged quotas; Public Service
Conduct and Data Interpretation remain empty. The
[review index](verification/editorial-full-corpus/README.md) and its linked
preapproval packets/manifest are immutable historical review evidence; their
20-approved/509-needsReview counts describe the checkpoint before this approval.
Publish every sound, approved logical question, continuing after the
150-question exam quotas are met.
Retain duplicate lineage and visibly blocked material; do not invent missing
alternatives or assume occurrences equal unique publishable questions.

Reviewer consumes all eligible questions in the selected category/subcategory.
A Mock Exam selects 150 from the larger bank under its category quotas.

## Local prerequisites

Install Node 24, Python 3, uv, and Java 21 for Firebase emulators. Run
`npm ci`; Firebase Admin 14.5.0 and Firebase Tools 15.32.1 are pinned development
dependencies. A narrow override updates Google authentication 10.5.0 to 10.9.1
only under Firestore API 0.2.0 → google-gax 5.0.8 because the older declaration imports ESM gtoken from
CommonJS and fails strict TypeScript. Direct Firebase pins and strict library
checks remain enabled. This compatibility is tested locally, not on production.

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r tools/questions/requirements.txt
.venv/bin/python tools/questions/extract.py --input "references/PNPE Reviewer.pdf" --output evidence/reference-extraction
.venv/bin/python tools/questions/extract.py --input "references/PNPE Reviewer (1).pdf" --output evidence/reference-extraction
.venv/bin/python tools/questions/extract.py --input "references/PNPE Reviewer (2).pdf" --output evidence/reference-extraction
npm run process:references
npm run validate:questions
npm run test:references
```

PyMuPDF is pinned to 1.28.2. Review its AGPL/commercial licensing before packaging
or redistribution; see [the primary license documentation](https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright).
Place all three byte-identical originals under ignored `references/` with the
registered filenames. The extractor verifies the original SHA-256 before writing
evidence, and rejects unknown/changed sources. The CLI independently verifies
each original PDF and the extracted document schema, checksum, ordered pages,
page count, and occurrence accounting before parsing. Missing PDFs/evidence fail;
CI does not claim that reference acceptance has run without supplied PDFs.

Extraction is a separate explicit step because its pinned Python environment
belongs to developer tooling. Processing consumes verified extraction evidence,
preserves all 687 source occurrences, uses checked-in identity allocations, and
writes `data/generated/candidates.json` plus machine/human issue reports under
`evidence/content-toolchain/`. `--output` can select a child of `evidence/` or
`data/generated/`; source/editorial paths, symlink escapes, and hard-linked output
files are rejected. Original PDFs, overlays, and identity allocations are never
rewritten. Generated reports contain sensitive reference content and stay ignored.

## Editorial review

Author JSON overlays separately in `data/editorial/`, keyed by stable `sourceKey`.
No regeneration creates approval. Preserve each source's checksum, section,
original occurrence number, page span, labels, original answer, evidence locator,
links, and image locations. Corrections and authored MCQ conversions require
explicit rationale/evidence; notes do not supply distractors. Stable question IDs
come from `data/identity-registry.json`; corrections retain IDs and increment
immutable versions. Do not publish synthetic test sources or multiple revisions
of the same logical ID in one snapshot.

Resolve blocking source issues in review metadata. Legal/current-event content
requires factual verification against appropriate primary sources. Approval binds
the reviewer/time to `contentDigest(proposed)` and, when review metadata exists,
`reviewDigest(review)`. Any content or review change invalidates approval.
Before validation, dry run, and apply, the CLI reparses authoritative sources,
reconciles current issues with overlays, reconstructs the approved publication,
and compares its canonical digest to the exact `data/questions.json` input.
Invalid approved overlays are fatal; schema-valid hand edits cannot bypass review.

Text, marked text, and math have supported Standard-compatible storage transport.
Tables remain in the domain/candidates but cannot publish until a versioned codec
handles their nested row arrays. Firestore Standard edition does not accept
arrays directly inside arrays; see [the primary data-types documentation](https://firebase.google.com/docs/firestore/manage-data/data-types).
Images/diagrams cannot publish in this checkpoint because there is no approved,
available learner-asset inventory. Editorial asset review alone is insufficient.
Answer-key/evidence images must never become learner prompt assets. Hosting,
availability, licensing, and client capability review precede future asset support.

## Preparing the first owner packet

Run `npx tsx tools/questions/prepare-review.ts short-initial` once for the exact
unapproved revision set. This positional command accepts no extra arguments. It
loads all authoritative occurrences and overlays and validates the entire on-disk
approved publication before computing coverage or reserving a packet directory.
It requires all twenty short overlays and rejects approval fields. It creates
immutable `review.md`, `manifest.json`, `overlays.json` and `coverage.json` under
`evidence/editorial/short-initial/<packetDigest>/`; repeating an identical run
fails exclusive directory creation. It does not publish or connect to Firebase.

Coverage assigns one disposition per occurrence and reports source, category,
all fifteen subcategories and unmapped material. Parser answers and taxonomy
hints do not make absent overlays publishable. Approved expired revisions are
separate from other approved blockers, including unsupported assets/tables.
Quota readiness uses distinct validated eligible logical IDs and the frozen
35/40/25/50 requirements. Duplicate or unsupported eligible input fails.

The [first editorial verification record](verification/editorial-content.md)
links the exact packet, digest manifest, open rows and real shortages. The owner
must approve that exact batch or an explicit subset plus a reviewer label before
approval stamps, publication or import. Development authorization does not grant
editorial approval. Packet artifacts are ignored and never committed.

## Dry run and explicit apply

The input is the **entire approved publication snapshot, not a delta**. Omitted
questions become absent from the next current catalog. Prior generations and all
immutable revisions are retained for recovery; nothing is deleted. An empty
initial snapshot is a no-op. Empty replacement of an existing catalog is blocked.

```sh
# Start a demo-only local emulator in another terminal (Java 21).
npx firebase emulators:start --only firestore --project demo-pnpe
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run import:questions -- --project demo-pnpe --manifest evidence/content-toolchain/import-manifest.json
# Review the manifest's project, previous head/revision, complete counts,
# creates/noops, generation, input digest, shard digests, and manifestDigest.
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run import:questions -- --apply --project demo-pnpe --manifest evidence/content-toolchain/import-manifest.json --confirm-digest EXACT_MANIFEST_DIGEST
```

Import without `--apply` is read-only. Every project is explicit; no hidden default
or credential-derived target exists. The concrete store is independently bound to
the manifest target and an explicit emulator/production mode. Emulator endpoints
must be localhost with a valid port and project `demo-pnpe`. Emulator credentials
are explicit dummy credentials and never ADC. A mismatching environment endpoint
is rejected because the SDK otherwise gives it precedence over constructor options.

Production apply additionally requires `--allow-production`, after removing the
emulator environment. It still requires `--apply --project PROJECT --manifest FILE
--confirm-digest EXACT_MANIFEST_DIGEST`. Production ADC credentials belong outside
the checkout and only in the administrator's process, never in client/Expo env
variables or bundles. No production command was executed for acceptance.

Revision and shard uploads use immutable `create`; already-existing documents
must match canonical content. Readback must match before the catalog head changes.
The head uses a transaction that reads before writing and compares the expected
revision. Interrupted uploads leave the prior head valid and can resume. A stale
manifest or conflicting immutable revision requires a new reviewed dry run.

Question IDs are restricted safe ASCII, at most 1,500 bytes, excluding reserved
`__...__` IDs. Revisions and shards are bounded to 700 KiB canonical UTF-8 JSON;
shards also have at most 200 metadata entries. An independent storage-size bound
counts Firestore map/field/value overhead and reserves 6 KiB for the document name,
using the [primary storage-size formula](https://firebase.google.com/docs/firestore/storage-size);
many small marked spans cannot evade the limit merely by fitting JSON. All snapshot preflight checks run
before any write. These conservative limits leave room under Firestore's 1 MiB
document and 6 KiB document-name limits; see [primary quotas](https://firebase.google.com/docs/firestore/quotas).
Index exemptions prevent indexing full version/shard payloads. Rules deny all
client reads/writes at this toolchain-only checkpoint; Admin bypasses rules and
uses independent command gates. Future application rules need their own tests.

## Verification

Run unit/typecheck/lint/format, reference acceptance with supplied sources, and
`npm run test:emulator` with Java 21. On this Mac Java 21 is available through
Android Studio; use a process-local override only:

```sh
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' npm run test:emulator
```

This leaves global Java 17 unchanged. New documents are checked explicitly with
`npx prettier --check --ignore-path /dev/null README.md docs/content-workflow.md
docs/verification/content-toolchain.md` because existing docs are ignored by the
repository's general formatting command. Check PDF hashes, generated output
digests, stable IDs, and exact overlay bytes before/after two processing runs.
Before public release, resolve editorial shortages and publication rights,
implement asset/transport capability gates and mobile rendering, verify actual
authentication/rules, and perform device/development-build acceptance.
