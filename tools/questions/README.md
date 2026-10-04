# Reference evidence

This is developer tooling, independent of the mobile app. Set up a local
environment with `uv venv .venv` and
`uv pip install --python .venv/bin/python -r tools/questions/requirements.txt`.
Run `.venv/bin/python tools/questions/extract.py --input "references/PNPE Reviewer.pdf" --output evidence/reference-extraction`
and repeat for the other registered filenames. Python 3 is also needed for the
unit tests of CLI guards; those tests do not require PyMuPDF.

The manifest fixes the inspected SHA-256, page total and occurrence inventory.
Occurrences are audit totals, not counts inferred by this extractor. JSON includes
unmodified sorted text, raw layout blocks, URI links and SHA-named embedded image
files with page placements. No OCR or question parsing takes place. Blank text on
page 150 therefore retains two image references and bounding boxes.

Output must be a descendant of this checkout's `evidence/` directory. Canonical
paths and generated-file symlinks are checked. Existing differing files are
refused; identical generated evidence can be rerun. Originals are read as bytes,
verified before opening, and never written. Generated material stays ignored;
only a small image-only page fixture is committed.

## Source segmentation and conservative candidates

`parseShort`, `parseLarge`, and `parseNotes` accept a `SourceDocument` and return
evidence-linked `SourceRecord[]`. The large adapter uses the actual registry ID
`comprehensive`; lineage keys are `sourceId:section:originalOccurrence`.
Verify PDF bytes with `verifySource` and parse extracted JSON through
`sourceDocumentSchema` before calling an adapter. Registered-document count and
number gaps are errors. Small synthetic documents support offline unit fixtures;
they do not replace the reference accounting suite.

The reference run accounts for 20 + 477 + 190 occurrences. Eight visually
observed raster-only items require matching page/xref/bbox/image evidence and
remain blocked; image answer keys are never learner assets. Shared paragraph
sentences and reading passages remain complete context. Numbered grammar
segments retain their marks and require visual target review. Answer-only notes
retain nullable choices and require authored editorial conversions.

`normalize` produces an incomplete `needsReview` candidate containing its source
record, proposed text blocks, opaque choice IDs, nullable resolved key, taxonomy
proposal and blocking/nonblocking issues. It never approves or publishes a
record. `normalizeText` applies NFC, removes zero-width spaces and collapses only
horizontal whitespace; it retains negation, grouping, punctuation and line breaks.
`fingerprint` includes the prompt, alternatives and complete stimulus. Exact and
token-overlap near duplicate reports preserve every occurrence and never merge.

`assignIdentity` only resolves checked-in allocations; `allocateIdentity` returns
an updated registry and rejects collisions. The 687 initial opaque IDs were
allocated in inspected source order through this API. Keep
`data/identity-registry.json` across re-extraction and editorial revisions; do not
rebuild it from mutable prompt text or a fingerprint.

Run `npm run test:unit` for synthetic and selected extracted-record fixtures.
Run `npm run test:references` separately with all three original PDFs under
`references/` and all extracted documents under `evidence/reference-extraction/`.
Missing evidence is a failure, never a skipped test. Reference tests assert full
accounting, known unresolved defects, paragraph context, stable identities and
two independent deterministic parsing/normalization runs. Selected regression
fixtures are small staging excerpts with locators, not a published question bank.

PyMuPDF 1.28.2 and MuPDF offer AGPL or commercial licenses according to the
[primary distribution documentation](https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright).
Review the applicable terms before redistributing or packaging this developer
tooling; a commercial license may be needed if AGPL obligations cannot be met.
No Python dependency belongs in the mobile application.
