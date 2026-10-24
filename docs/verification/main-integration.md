# Main integration — 2026-10-24

Integrated `feat/mock-exam` at `39ab93a`, including its ancestor `feat/content-reviewer` at `f868fd6`, into main based on `c4a8eba`. Commit `39ab93a` preserves the previously uncommitted build-3 UI and release record.

Resolved conflicts in the briefing screen, mock-exam route and navigation tests in favor of the implemented feature flow. The merged application source, package manifest/lockfile and Firebase rules match the feature branch. Main-only briefing tests now expect the build-3 subject labels and permit entry during maintenance so an existing attempt can resume; preflight and service checks still block new starts. Updated product/surface notes and formatted two existing Markdown files.

Verification on the merged tree:

- Unit tests: 43 suites, 643 tests passed.
- Mobile tests: 28 suites, 284 tests passed.
- Typechecking, ESLint, Prettier and Git whitespace checks passed.
- Independent review found no blocking integration issues.
- Jest used `--modulePathIgnorePatterns '<rootDir>/.worktrees/'` to exclude duplicate local checkouts. Existing React `act` and experimental SQLite warnings remain.

Firebase integration tests were not rerun: existing local sessions occupy the configured isolated test ports (8180, 9199 and 8280). Those sessions and their persisted data were left untouched. No native rebuild, distribution upload, production deployment or production data import was performed. Existing device/release acceptance limitations remain documented in the feature verification records.

Worktree folders, ignored evidence, native configuration and local credentials remain in place; they are not part of this Git integration.
