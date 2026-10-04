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

PyMuPDF 1.28.2 and MuPDF offer AGPL or commercial licenses according to the
[primary distribution documentation](https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright).
Review the applicable terms before redistributing or packaging this developer
tooling; a commercial license may be needed if AGPL obligations cannot be met.
No Python dependency belongs in the mobile application.
