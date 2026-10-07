# PNPE question content — editorial delivery design

Date: 2026-10-07

Status: approved by the owner on 2026-10-07. The owner approved the
sequence content → Reviewer/bookmarks → Mock Exam/results. This document defines
the content stage; it does not approve individual questions or production writes.

## 1. Purpose and delivery sequence

Prepare trustworthy questions for the existing Android/iOS foundation using the
three preserved reference PDFs. Success means reviewable editorial batches,
explicit approval of exact revisions, reproducible publication artifacts and
honest coverage counts. Structural validation alone cannot certify an answer.

The binding [foundation design](2026-10-04-foundation-and-content-design.md)
continues to govern taxonomy, rich-content contracts, authentication, publication
safeguards and later session behavior. Work starts from local main at 60c3fed.
The former implementation worktree has been removed; local dependencies, source
PDFs, extraction evidence and owner configuration are now in the original checkout.

Deliver in this order:

1. Prepare all 20 occurrences in `PNPE Reviewer.pdf` as the first review batch.
2. Expand reference-based coverage in bounded batches, prioritizing the four
   Mock Exam category pools and resolving shared-context defects together.
3. Validate the exact approved publication and prepare local demo imports.
4. Proceed to separate Reviewer/bookmark and Mock Exam/result specifications and
   plans. Content shortages must remain visible while those engines are built.

A 20-question batch cannot support the default 150-question Mock Exam. A smaller
development fixture is a test fixture, not a completed real exam or publication.

Owner clarification: the delivery target is the full usable reference question
bank. Process all 687 occurrences and publish every sound, explicitly approved
logical question. The exam quotas are readiness minimums, not a cap or a stopping
condition for editorial work. Reviewer includes all eligible questions in its
selected category/subcategory; each Mock Exam selects from the larger bank.

## 2. Inputs and preservation

Reuse verified `references/`, `evidence/reference-extraction/`,
`data/generated/candidates.json`, `data/source-manifest.json` and
`data/identity-registry.json`. Re-extraction is unnecessary unless evidence is
missing or fails validation. Check the registered PDF checksums before and after
the editorial work. Never modify the source PDFs or extraction evidence.

The current corpus accounts for 687 occurrences across 178 pages: 20 short MCQs,
477 comprehensive occurrences and 190 answer-only notes. The existing report
flags 482 occurrences with at least one blocking issue; issue totals overlap.
There are currently no editorial overlays and zero approved questions.

All occurrences remain accounted for as draft, needsReview, approved or rejected.
Unusable or unmapped material is recorded explicitly, never silently dropped.
Duplicate suggestions do not authorize removal or automatic merging. Confirmed
duplicates retain complete source lineage and one reviewed logical publication
identity through the existing registry/publication contracts.

## 3. First batch and editorial method

Prepare `data/editorial/short-initial.json` using the existing overlay schema.
Include one overlay for each of the 20 authoritative short-source keys. Proposed
questions reuse registry IDs and stable choice IDs; first unpublished revisions
use version 1. Resolve category/subcategory per item instead of trusting section
headings. Number patterns and word analogies belong to the applicable Critical
Thinking subcategories even when the PDF groups them elsewhere.

For every item:

- Read the original prompt, alternatives, answer, explanation and page evidence.
- Verify the key independently: arithmetic derivation for quantitative items,
  explicit reasoning for logic, and authoritative references for factual items.
- Preserve meaning, shared context, grammar targets and original alternatives
  when sound. Record every substantive correction and its rationale/evidence.
- Explain the correct answer clearly. Do not invent a source explanation or
  claim authored wording came from the PDF.
- Choose the exact taxonomy pair with a written rationale. Keep original source
  labels/section/number/page span/checksum and answer in lineage.
- Record every authoritative blocking issue in review metadata and resolve each
  code with specific evidence. Do not erase source issues to simulate review.
- Set `needsReview` when the proposed revision is complete; retain unresolved
  items as `draft` with their open issues. Do not create approval fields yet.

Short Q19 requires verification of departmental administration versus commission
control and corresponding wording/key consistency. Q20 requires current official
verification of appointment-age requirements and the former PO1 terminology.
If no unambiguous current revision can be supported, leave the item blocked.
Do not label a historical requirement as current.

## 4. Verification and content capabilities

For Constitution/law, PNP institutional and criminal-justice facts, use current
primary Philippine government sources appropriate to the claim: the Constitution,
statutes, Supreme Court decisions and official NAPOLCOM/PNP issuances. Distinguish
entry-examination eligibility from appointment qualifications. Embedded PDF links
and explanations are provenance, not independent verification.

Verification records identify the direct supporting URL, actual verification time,
the claim supported and a rationale. Retain as-of context where material. Do not
invent dates from filenames or file metadata. Current-event items additionally
meet the existing time-context, publication/as-of/expiry and verification schema.
Expired current-event items cannot enter a new session pool.

Use text, marked-text and supported math transport for this content delivery.
Image/diagram items remain blocked until a separately approved learner-asset
inventory and hosting/capability design exists. Do not reuse answer-key imagery.
Table-dependent items remain blocked until a reviewed versioned storage codec and
client renderer support them; do not flatten meaningful tables into misleading text.

For answer-only notes, authored MCQ conversions are clearly labeled as authored.
Each needs a complete stem, at least two distinct plausible alternatives, one
unambiguous correct choice and evidence/rationale for the conversion. Missing
"except" alternatives are not guessed. General Philippine history is not
automatically PNP History; unsupported taxonomy stays blocked.

## 5. Review packets and exact approvals

Produce an ignored Markdown review packet under
`evidence/editorial/short-initial/`, with a packet manifest and the corresponding
overlay artifact. Later batches follow the same structure with unique batch IDs.
Each packet contains the full proposed prompt, stimulus, alternatives, correct
choice, explanation, taxonomy, source pages, changes, supporting citations, open
issues, content digest and review digest. Show the source answer beside any
proposed correction. Include schema/issue status and category/subcategory totals.

The owner may approve a named batch or an explicit subset of its revision list.
Approval must refer to the exact packet and digest manifest already reviewed;
general permission to proceed with development is not editorial approval. A
batch approval covers only its enumerated exact revisions, not future changes
or unresolved rows. Record the owner-confirmed reviewer label and actual approval
timestamp in each approved overlay using the existing approval schema.

Any change to content or review metadata invalidates the corresponding approval.
Present the changed revision for a new approval instead of carrying the old stamp.
Rejected items remain accounted for with a rationale. Preserve previous packets
as review evidence; do not overwrite the only copy of an approved packet.

## 6. Publication and coverage

Use the existing source-reconstruction, overlay-reconciliation and canonical
digest checks. `data/questions.json` contains the entire approved eligible set,
not a manually edited delta. No fixture or unapproved draft enters that set.
Record approved counts separately from staged, blocked, expired and unavailable
content, by source, category and all fifteen subcategories.

Prepare an exact quota coverage report against the frozen product defaults:

| Category               | Minimum distinct eligible questions for the default exam |
| ---------------------- | -------------------------------------------------------: |
| General Information    |                                                       35 |
| Communication Skills   |                                                       40 |
| Quantitative Reasoning |                                                       25 |
| Critical Thinking      |                                                       50 |
| Total                  |                                                      150 |

There are no mandatory per-subcategory exam quotas. Report subcategory gaps,
including Data Interpretation, without implying every subcategory must contribute
to every exam. Never repeat logical questions, lower quotas silently, invent
approval or declare a full exam ready when a required pool is short. New authored
questions beyond the source corpus require their own explicit review batch.

Drafting and local artifact validation are in scope. After exact editorial
approval, local demo import uses the existing dry-run manifest, explicit
`demo-pnpe` target, emulator binding and exact apply digest. Local catalog
generation/revision readback must match the approved publication. Production
imports, public asset hosting, rules deployment and public redistribution are
separate actions requiring owner authorization; no production credentials are
needed for this content stage.

## 7. Verification and acceptance

The first batch is prepared when all 20 source occurrences have reviewable
overlays and packet rows, with every correction/taxonomy resolution evidenced and
any unresolved item visibly blocked. It is approved only when the owner approves
the exact eligible revision list. These are distinct checkpoints.

Required checks:

1. Reference accounting and registered PDF checksums still match.
2. Overlays validate, stable identities/choice IDs remain consistent, and source
   reconstruction rejects hand-edited publication or stale approval digests.
3. Mathematical and logical answers have independent derivations; factual/legal
   corrections have supporting current primary-source evidence.
4. The review packet and digest manifest exactly describe the overlay revisions.
5. Approved publication validation succeeds and reports actual eligible counts.
6. Local import dry-run/apply/readback is checked only for explicitly approved
   data, using the actual demo emulator and existing import safeguards.
7. Any tooling changes have focused regression tests and strict type/lint checks;
   do not add tests that merely assert the authored answer equals its own key.
8. No original PDF, owner asset, credential or unapproved publication is staged
   incidentally. Preserve editorial evidence and handoffs during any cleanup.

## 8. Boundaries and next handoff

This specification does not implement mobile retrieval, SQLite, Reviewer screens,
bookmarks, exam timers/navigation/results, progress or history. Those consume the
approved question contracts in subsequent delivery cycles. Existing architecture,
guest-first access, themes and authentication remain intact.

The unresolved decoder advisory remains a release gate. Rights to redistribute
the reference content remain a public-release gate. Neither blocks preparing
local drafts, but neither is resolved by editorial or engine test success.

After owner review of this written specification, write a concrete implementation
plan for first-batch preparation, review artifacts, publication and coverage.
Preserve the owner's selected subagent-driven execution method. Do not start
product/tooling implementation or stamp approvals before the required checkpoints.
