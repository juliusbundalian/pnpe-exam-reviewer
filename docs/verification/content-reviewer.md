# Content Reviewer verification

Recorded 2026-10-09 on `feat/content-reviewer`, implementation checkpoint
`a4632300f5ea88770046db9a2c919ac760e11ced`, approved branch base
`6309fa82734a4752ee53eb59ff385d478e23a707`.

Status: **partially verified; native acceptance blocked**. Tasks 1–9 received
independent scoped review. Fresh automated checks below pass; they do not prove
Android/iOS behavior. Task 10 and whole-branch independent review remain open.
No release, merge, push, deployment or store upload was performed.

## Implemented behavior

Protected Reviewer entry lazily composes native SQLite, content retrieval and
owner-bound sync. Public guest Home does not start this graph. Sessions freeze
every eligible question in their scope and any question shuffle; original choice
order remains intact. Correct answers and supplied explanations are immediately
readable. Text, marked spans and math are supported; required images, diagrams
and tables remain excluded pending separate acceptance.

SQLite owns session position, viewed membership, pinned bookmarks and atomic
pending operations. Replacement requires confirmation and durable readiness;
viewed progress requires the current complete, focused, foreground render.
Network gaps permit validated cache fallback; auth/permission failures require
recovery. Account changes invalidate old owner epochs and late personal results.
Saved work remains readable under start/feature gates. Mock Exam, results and
history are the next separately approved slice; their defaults remain 150
questions, 180 minutes and category quotas 35/40/25/50.

## Fresh automated evidence

Commands ran in the feature worktree with Node 24.3.0. Raw logs remain ignored
under `evidence/content-reviewer/task10/`; they are local review artifacts, not
committed distributable content.

| Command                                                                                                                 | Observed result                                                                        | Local evidence              |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| `npm run test:unit`                                                                                                     | Exit 0; 35 suites, 554 tests; 20.200 s                                                 | `test-unit.log`             |
| `npm run test:mobile`                                                                                                   | Exit 0; 20 suites, 223 tests; 16.841 s                                                 | `test-mobile.log`           |
| `npm run typecheck`                                                                                                     | Exit 0; tools and strict mobile checks, no diagnostics                                 | `typecheck.log`             |
| `npm run lint`                                                                                                          | Exit 0; no diagnostics                                                                 | `lint.log`                  |
| `npm run format:check`                                                                                                  | Exit 0; all matched files formatted                                                    | `format-check.log`          |
| `npx expo install --check`                                                                                              | Exit 0; online default check reports dependencies up to date                           | `expo-install-check.log`    |
| `JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' npm run test:emulator`                         | Exit 0; 3 suites, 72 tests; 9.742 s; importer, existing rules and study rules included | `test-emulator.log`         |
| `npx prettier --check --ignore-path /dev/null README.md docs/content-workflow.md docs/verification/content-reviewer.md` | Exit 0; explicit document formatting                                                   | `document-format-check.log` |
| `git diff --check`                                                                                                      | Exit 0; no whitespace errors                                                           | `diff-check.log`            |

The mobile suite exercises actual routes/controllers/services with injected
native boundaries and real Node SQLite fixtures. It covers lazy public startup,
storage recovery, complete rendering receipts, marked/math content, offline
missing pages, durable retry, account invalidation, feature/maintenance recovery,
Progress return/focus refresh and page-bound bookmark callbacks. These are
automated structural and behavioral checks, not device or screen-reader passes.

Unit/mobile logs retain Node's SQLite ExperimentalWarning. The emulator runner
retains Firebase's multiple-suite warning because the live demo uses the same
demo project ID; its Firestore/Auth/hub/logging/websocket endpoints are isolated.
No warning suppression was introduced. Task 9's first covering run had an
unreproduced Bookmarks Refresh timing failure; standalone and covering reruns
passed, and this fresh complete mobile run also passed. Its cause remains
unproven; it is not described as fixed.

## Preservation and isolation

`preservation-before.json` and `preservation-after.json` record SHA-256 comparisons
for all 33 tracked data/editorial/publication-evidence paths against base
`6309fa8`; all are byte-identical. The three original PDFs in the main checkout
match their registered SHA-256 values. There was no extraction, regeneration,
editorial edit or approved-bank import. The 529 approved questions, 145 deferred drafts,
duplicate lineage and historical evidence remain preserved.

Read-only GETs before and after the guarded runner match Task 1's original live
head snapshot: revision 2, generation
`7f8f7ded0edcea40cbba7a5180b9713f6c0edec8f76eac7f60558e8a13a0775b`,
create time `2026-10-07T09:31:53.168500Z`, update time
`2026-10-08T02:09:22.327411Z`. Responses are in `live-head-before.json` and
`live-head-after.json`. Live Firestore 8080, Auth 9099 and Metro 8081 were
preserved. The destructive runner used only Firestore 8180/Auth 9199 with isolated
auxiliary ports and shut down before any possible acceptance seed. No persistent
acceptance emulator, seed, new Metro or device lifetime was started.

## Native acceptance outstanding

Repeated `df -h .` inventory showed approximately 1.0 GiB available. The
controller ruled against full native builds at this capacity; no build was
attempted and no compiler failure is implied. No global/user caches were deleted.
The feature worktree has no generated `ios/` or `android/` projects and no new
feature binary/build ID. Owner Google configuration files remain ignored at the
main checkout root and were not printed, copied or modified. Read-only validation
reported Android package match, iOS bundle match and matching project IDs;
`native-inventory.log` records only boolean agreement and public device/service
inventory.

Available inventory: Xcode 27.0 (27A266a); installed iPhone 16 Pro iOS 18.5
simulator `FFC1BAA2-881B-4513-B947-39F5374FF480` was Shutdown; Android
`Medium_Phone_API_36` AVD is installed, but `adb devices` was empty. Devices were
not booted, wiped, uninstalled or cleared. Historical foundation builds do not
establish acceptance of the new SQLite/crypto/native dependencies.

| Required observation on both Android and iOS                                                   | Current evidence/status                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Feature prebuild, build, install and authenticated catalog read                                | Outstanding; resource-blocked, no feature binary             |
| Actual passage/grammar marks and math; immediate answer/explanation                            | Outstanding; automated rendering coverage only               |
| Full category inclusion, including 276-item scope without a cap                                | Outstanding; automated no-cap coverage only                  |
| Force-close/reopen SQLite position, viewed membership and installation identity                | Outstanding; real Node SQLite reopen tests only              |
| Offline cached navigation and uncached page at a stable position                               | Outstanding; automated controller/routes only                |
| Bookmark CAS, retry, tombstones and account switching across clients                           | Outstanding; automated protocol/rules coverage only          |
| Root cache/startup recovery and guest Home without bank/storage wait                           | Outstanding on device; automated boundaries only             |
| Foreground/focus receipts, accessible controls, enlarged-font long text                        | Outstanding on device; structural/focus tests only           |
| Light/dark/system appearance and disabled-feature/maintenance recovery                         | Outstanding on device; automated coverage only               |
| Catalog versus progressive question request counts on public/protected entry                   | Outstanding; no native request instrumentation measured      |
| Shared-stimulus insertion scan cost across the intended cached corpus                          | Outstanding; no native corpus timing measured                |
| First upload of 276 items with 138 cap-2 chunks; document/RPC count, latency and offline queue | Outstanding; format/rules tested, native upload not measured |

Android TalkBack and iOS VoiceOver acceptance were explicitly deferred by the
owner. No global screen reader was enabled. Structural focus/labels and actual
font/theme checks remain separate requirements; no manual AT pass is claimed.

When resources permit, rebuild using the ignored owner Google files through
absolute `GOOGLE_SERVICES_ANDROID`/`GOOGLE_SERVICES_IOS` paths. Explicitly use:

```sh
EXPO_PUBLIC_FIREBASE_MODE=emulator
EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-pnpe
EXPO_PUBLIC_FIREBASE_AUTH_PORT=9199
EXPO_PUBLIC_FIREBASE_FIRESTORE_PORT=8180
# iOS simulator: 127.0.0.1; Android emulator: 10.0.2.2
EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1
```

Finish the destructive test runner before starting a separate lifetime with
`firebase.study-tests.json` and seeding the authorized approved-bank copy. Check
a new free Metro port immediately before use; never fall back to live defaults
8080/9099 or existing Metro 8081/8082. Rebuild and restart Metro with matching
environment. Preserve existing device data. Record exact binaries, platforms,
screenshots, scenario observations and restored temporary settings in local
evidence before marking any native checkbox complete.

## Material limitations and review gates

The remote official schema has no editorial approval digest, so client
fingerprints cannot prove owner approval. Device identity is not a server trust
primitive. Rules validate bounded immutable metadata and transitions; they do
not prove an arbitrary complete manifest. Personal cloud metadata supports
text/math and empty assets; unsupported retained pins remain local/recoverable.

Strict nested rules require at most two manifest entries per chunk. A 276-item
manifest therefore needs 138 immutable chunk documents plus root publication
and later state/view documents. This increases upload operations without
limiting questions; measured native latency remains a gate.

Task 5's deferred prefetch scheduling edge remains for whole-branch review:
after an account/epoch change with both old requests outstanding, completion of
those requests may leave the new speculative window idle until another
successful foreground page load. Visible retrieval, durable state and the
two-request bound have scoped review/test coverage; no unsolicited runtime fix
was made in this documentation task. The earlier migration rollback concern was
resolved with an actual successful DDL mutation followed by rollback coverage.

Whole-branch independent review is controller-owned and remains outstanding.
Native acceptance, performance measurements and any resulting focused fixes
must be reviewed before finishing/integration. The worktree, SDD ledger and
ignored evidence are preserved for continuation.
