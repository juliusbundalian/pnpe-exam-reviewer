# Editorial overlays

No reference revisions have human approval. `data/questions.json` is deliberately empty.

Keep separately authored overlays keyed by immutable extracted `sourceKey`. Each overlay contains `proposed` (complete Question), `rationale`, evidence locator strings, and `status` (`draft`, `needsReview`, `approved`, `rejected`). Preserve source records and original answers. Reprocessing reconciles overlays in memory without writing them.

Notes entries contain answers only. Separately author conversion stems and distractors, record rationale and evidence, and preserve the original source answer in lineage. Never claim authored alternatives were supplied by a PDF. Resolve each blocker explicitly; never remove extraction issues to simulate review.

Optional `review` records `issues` (code, blocking, message), `resolutions` (code, nonempty rationale, nonempty evidence array), `factualVerification` (primary source URL, verifiedAt ISO timestamp, rationale), and `assets` (id, version, URI, status `reviewed`, nonempty evidence). Legal/current-event questions require factual verification. Every image/diagram including stimulus assets requires review of exact identity, version and URI. Source answer-key imagery must not become learner prompt assets. Publication rights and hosting must be established before public release; software licensing is not content approval.

Approval records reviewer identity, ISO timestamp and SHA-256 `digest` from `contentDigest(question)`. Review metadata requires matching `approval.reviewDigest` from `reviewDigest(review)`. Canonical JSON sorts object keys recursively and preserves array order. Changes to choices, key, taxonomy, dates, stimulus or other content invalidate approval. Review changes also invalidate approval. A taxonomy-review source blocker requires evidenced resolution; structural taxonomy validity alone never approves a revision.

`combineBySourceKey(candidates, overlays)` rejects duplicate/unknown keys and exposes authoritative current candidate issues. `publishable(overlay, {issues})` checks structure before editorial gates. `publicationSet(combined)` returns approved questions and explicit errors for invalid approved revisions. Empty approved sets are valid. These APIs never create approvals or write overlays. Unit-test approvals are synthetic only.
