# PNPE Exam Reviewer

This checkpoint provides a developer content toolchain: source evidence,
conservative candidates, stable identities, editorial approval validation, and
guarded Firestore import. It accounts for 687 source occurrences across three
references; no reference question has human approval, so the published bank is
empty. Source counts are not counts of unique or publishable questions.

There is no mobile app, authentication shell, reviewer/session engine, mock exam,
or deployed service yet. The planned practice experience uses the approved
taxonomy and preserves the later session contracts; this checkpoint does not
claim those experiences work.

Use Node 24 and `npm ci`. Unit tests require Python 3; extraction requires
the pinned Python environment described in [the content workflow](docs/content-workflow.md).
Firebase Admin 14.5.0 and Firebase Tools 15.32.1 are developer dependencies only.
No production project or credentials are needed for local acceptance.

```sh
npm run test:unit
npm run typecheck
npm run lint
npm run format:check
npm run test:emulator # Java 21 required
```

With all original PDFs and extraction evidence supplied, run
`npm run process:references`, `npm run validate:questions`, and
`npm run test:references`. Missing reference prerequisites fail explicitly.
See [the workflow](docs/content-workflow.md) for extraction, approval lifecycle,
dry-run/apply safeguards, credentials separation, and no-delete recovery.
Measured acceptance results are in [the verification record](docs/verification/content-toolchain.md).

The software license does not establish rights to redistribute the PDFs or their
content. Originals, generated evidence, credentials, and import manifests remain
untracked. No deployment command is included in scripts or CI.
