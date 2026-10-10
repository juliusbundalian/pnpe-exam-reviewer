# Content Reviewer verification

Updated 2026-10-10 on `feat/content-reviewer`, runtime checkpoint
`94df1f5` (independently reviewed native offline fix), approved branch base
`6309fa82734a4752ee53eb59ff385d478e23a707`.

Status: **partially verified; native acceptance outstanding**. Tasks 1–9 received
independent scoped review. Whole-branch review at `f75c0e0` required I1/I2 and
M1/M2/M3; all five were addressed by `f4a5dac` and its scoped rereview.
The native-discovered stimulus fix `7e66178` also received independent approval.
Automated checks do not prove Android/iOS behavior. Task 10 remains open.
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

## Earlier automated checkpoint (2026-10-09)

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

## Native offline transaction fix checkpoint (2026-10-10)

Actual offline native error evidence led to `94df1f5`, which catches only
transaction-get rejection in `nativeStudySyncFacade`. It checks current owner
first, then normalizes exact `firestore/unknown` plus a native string containing
the standard `UNAVAILABLE` token to network recovery. Other unknown errors,
message-only tokens, nonstring/token substrings, permission/authentication and
invalid content keep their existing classifications. Shared content error
classification and strict payload validation are unchanged.

TDD boundary tests first failed for the two retryable-token cases and owner
change (three expected failures, 16 passes), then passed 19/19. Fresh full unit
595/595 (36 suites), mobile 241/241 (20 suites), both typechecks, scoped ESLint,
Prettier and whitespace checks passed. The unit run retains Node's experimental
SQLite warning. Logs are
`part4-native-network-{red,green-focused,unit,mobile,typecheck,lint,format,diffcheck}.log`
in ignored native evidence. Only facade and boundary tests are committed.
Independent scoped review approved with zero findings. The first device recheck
used a stale lazy facade: bounded device/served source hashes matched, but both
lacked all four reviewed guard markers. The local facade matched `94df1f5` and
contained them. Only feature Metro 8083 was restarted with `expo start --clear`;
the fresh served facade contains the guards. Native behavior is recorded below.
Earlier unchanged-runtime tests are not new verification of this fix.

## Resumed native source and final recovery checkpoint (2026-10-10)

The first resumed observation showed Quantitative Viewed 4/41. Before new UI
mutations, copied SQLite already contained five sessions, 23 viewed/acknowledged
rows and 33 cached bodies. The intervening change has no established cause;
this new baseline was preserved rather than overwritten. Guarded same-A SDK
restored the original pin from tombstone revision 7 to 8, and actual native
Refresh established visible/local/remote agreement at revision 8.

The approved bounded stage observer captured one ordinary offline Remove:
native transaction-get, callback and outer transaction all rejected with
`firestore/unknown` and a native `UNAVAILABLE` token. It collected bounded stage
names and classification booleans only, retained no raw messages or payloads,
and added Promise observation overhead. Force-stop removed it. Retry drained
at tombstone 9; the authenticated helper restored pin 10 and actual Refresh
proved local/remote agreement. All eight diagnostic globals were undefined.
This observation did not establish execution of the reviewed catch.

Read-only source provenance then established stale lazy code. Device and served
JavaScript were byte-identical (SHA-256
`3aa0a7d3235f0656b690d27f47a60e6e92dee5616266fe48554513d168809ae1`),
with readable module/facade/get markers, but all four reviewed guard markers
absent. The bounded facade region was 3,635 bytes. Local source matched reviewed
commit `94df1f5` and contained the guards. Only isolated feature Metro 8083 was
gracefully restarted with `expo start --dev-client --host lan --port 8083 --clear`;
Firestore, Auth, main services, APK, AVD and native data were retained.

The fresh served-only facade region is 5,516 bytes, SHA-256
`8499937b824f40b22cd2d18c9f1104e540204590fd345cd3a013694023eb494a`, with all
four guard markers present. Post-clear device script enumeration returned no
matching lazy script, so that separate provenance check is inconclusive. Actual
settled Saved Questions and the ordinary offline cycle supply device behavior
evidence: Remove showed network recovery text, invalid-content copy absent and a
durable bookmark operation based on revision 10. No wrapper or injected failure
was installed. An earlier text-label tap was a setup no-op, preserved
separately; the actual button accessibility label was used for the one
successful Remove.

Reconnected actual Retry drained outbox to zero and coherent tombstone 11.
The same-A authenticated SDK helper restored the original revision-1 pin at
server revision 12. Actual Refresh and a final settled capture show enabled
Open without Pending, error or loading; SQLite and remote revision 12 agree,
deleted false, integrity ok. A first immediate restore capture retained the
Pending label; the subsequent actual Refresh cleared it. Native Auth UID
matches A and not B. All eight diagnostic globals are undefined. Font 1.0,
OS night no, Wi-Fi/mobile 1/1 and last selected Dark appearance are preserved.
Session/item/view/acknowledgement rows are unchanged from the resumed baseline.

Evidence is retained under `evidence/content-reviewer/native/`:
`part4-resume2-stage-*`, `part4-resume2-source-provenance-body-confirmed.json`,
`part4-resume2-cacheclear-served-only.json`,
`part4-resume2-cacheclear-offline-actual-observation.json`,
`part4-resume2-cacheclear-drained-remote-proof.json`, and
`part4-resume2-cacheclear-final*` (settled UI, SQL/remote, owner, globals and
preservation/settings). Initial/loading/setup captures are not acceptance
passes. No new runtime mapping, rebuild or repeated broader suite was needed.
Task 10 remains open for iOS, dedicated math-block rendering, native gate
transitions and startup/performance limits; screen readers remain deferred.

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
acceptance lifetime was started during that earlier automated checkpoint.
The later Android lifetime and recovery are recorded below.

## Android development build and partial acceptance

The ignored feature Android project was prebuilt and compiled from `f4a5dac`.
Java 21 `:app:assembleDebug` completed in 1m56s, exit 0, with 566 tasks
(281 executed, 285 cached). `adb install -r` preserved existing app data.
The JS-only stimulus fix is `7e66178`; the current reviewed native sync facade
is `94df1f5`. Both use the same APK without native dependency changes. Feature
Metro 8083 was cleared and restarted after stale lazy source was established.

- Device: `Medium_Phone_API_36`, emulator-5554, Android 16/API 36 ARM64.
- Package: `com.pnpe.exam.reviewer`, version 0.1.0, versionCode 1.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`, approximately 93 MiB;
  SHA-256 `94ae7f7e6cc1bae9bcc02dee194bb2321ee681e9592842caaf430a9139806ca6`.
- Backend: isolated `demo-pnpe`, Android host `10.0.2.2`, Firestore 8180,
  Auth 9199. Metro 8083 uses an ADB reverse; no live fallback occurred.

Initial Expo CLI rejected `--port` with `--no-bundler`; direct Gradle then
succeeded. An IPv6-only localhost Metro binding required restarting only the
owned feature Metro with LAN binding. These are setup failures, not compiler
failures. Build/platform metadata and logs remain in ignored
`evidence/content-reviewer/native/`.

| Android observation                  | Recorded device evidence/status                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protected reading and complete scope | Actual A form sign-in; Communication session with all 276 items, shared Boracay passage and immediate answer/explanation.                                                                                                                                                                                                                                                                                                                    |
| Progressive retrieval                | 529 catalog metadata entries; initially only three cached revision bodies. A later refresh observed two head reads, one shard-page call and three revision reads; later cache counts 14/15.                                                                                                                                                                                                                                                  |
| SQLite durability                    | Force-close/reopen retained installation/session hashes, complete manifest, position and viewed membership. Part 4 recovery snapshot passed `quick_check`, with active position 1 and viewed/acknowledged ordinals [0,1]; settled Progress showed Viewed 2 / Resume at item 2.                                                                                                                                                               |
| Offline reading and queue            | Cached Items 3/4 remained readable, including the marked ambulant target. Uncached Item 5 showed explicit offline-unavailable recovery at stable position 4; Retry did not add a view. Offline bookmark queued, then actual reconnect/Retry drained outbox and synced pinned revision 1.                                                                                                                                                     |
| Foreground receipt                   | Next followed immediately by Android Home saved position 1 with viewed [0]; returning foreground credited [0,1].                                                                                                                                                                                                                                                                                                                             |
| Appearance and enlarged text         | Explicit Light/Dark observed. Settled System selection responded to OS night yes/no. Part 4 font 1.5 shared-passage Item 6 was traversed through wrapped prompt/choices/explanation to enabled Bookmark/Previous/Next; enlarged Item 1 showed disabled Previous. Font 1.0 restored.                                                                                                                                                          |
| Guest startup and recovery           | Public Home rendered with no SQLite database before protected entry. Cold launches repeatedly showed authentication-unavailable and recovered through actual Retry. Initial cause remains unproven.                                                                                                                                                                                                                                          |
| Bookmark/account matrix              | Actual offline Remove queued base revision 1. Authenticated same-account client tombstone advanced remote to 2; native reconnect captured conflict, rebase and acknowledgement, draining outbox at revision 3. Client add advanced to 4; actual Refresh restored the original revision-1 pin. Actual B sign-in, native UID check and settled empty Progress/bookmarks establish isolation; A SQLite retains three sessions and one bookmark. |
| Math, gates and corpus cache scan    | Actual Quantitative replacement created all 41 items and rendered text computations/choices/immediate answer/explanation. Dedicated math-block rendering and maintenance/feature transitions remain outstanding; the separate 529-row native cache benchmark completed with the limitations below. Natural emulator Remote Config uses fixed defaults; no gate injection occurred.                                                           |

Part 4 actual Quantitative Start Reviewer → Replace → Confirm replacement
created a 41-item session, retaining both earlier 276-item Communication
sessions as archived. `part4-quantitative-confirmed-sql-summary.json` records
`quick_check` ok and outbox zero. The first item rendered the 600-feet-to-yards
prompt, choices, correct answer and supplied division explanation. A read-only
walk (`python3 evidence/content-reviewer/native/part4-count-approved-blocks.py`)
of `data/questions.json` counted 3,431 blocks, all `kind: text`, and no math
blocks in any of the 529 questions. Thus quantitative text rendering is observed;
the dedicated math-block renderer has automated coverage but no native pass.
No synthetic public content or gate injection was introduced to fill this gap.

Part 4 bookmark evidence correlates actual UI, durable outbox and remote state:
`part4-offline-remove-outbox.json` records base revision 1 before reconnect;
`part4-cas-errors.json` captures the actual typed conflict, successful rebase,
subsequent write and acknowledgement. The next authenticated SDK client read
base revision 3 before adding at revision 4. `part4-cross-client-refresh-remote-proof.json`
then confirms local/remote revision 4, deleted false and the unchanged question
revision-1 pin. The two clients deliberately share A's UID for this conflict
scenario; unrelated fixtures were not reused. Personal writes used authenticated
SDK calls, never Admin REST or direct CDP mutations.

`part4-b-native-auth-readback-confirmed.json` confirms the native named demo app
is signed in as B and not A. Settled `part4-b-progress-confirmed` and
`part4-b-bookmarks-confirmed` captures show no saved Reviewer session and no
bookmarks. `part4-account-isolation-sql-proof.json` reports integrity ok, A's
three sessions/one bookmark and B's zero sessions/bookmarks. Session, position,
sequence and view rows are unchanged across Quantitative confirmation,
cross-client Refresh and the B checkpoint: opening the pinned bookmark did not
create a Reviewer or add a view. Earlier files labeled B that show Guest User
or a sign-in modal remain setup evidence only.

An actual confirmed full-276 replacement retained the old session as archived.
Native publication took 1870.86ms, with 140 logical transactions/140 document
gets/140 sets: 138 immutable two-entry chunks plus two root writes. Native SQL
and isolated remote metadata agree. A later new viewed state took 139.72ms,
three logical transactions/five gets/two sets, with no manifest rewrites.
These are observed debug-AVD method calls, not billed RPCs or all SDK retries.

Initial movement samples measured 2383/5529/3917ms; later warmed traces measured
651/356ms, with viewed receipts 414/211ms. Small-cache saves of 76–287ms do not
establish intended-corpus scan performance. Read-only diagnosis identified
repeated manifest validation as a candidate cost, without proving attribution
or authorizing optimization. No performance fix or schema weakening was made.

The first loop-generated diagnostics delegated to the wrong captured method.
Their induced invalid-content failures and timings are invalid acceptance
evidence. They were removed by force-close. Approved per-invocation factory
wrappers were then correlated with actual UI names and SQL positions. They
captured method/count/duration and bounded standard error metadata, without
payloads, credentials or direct personal mutations. Part 4 force-stop and
`part4-clean-runtime.json` confirm all prior diagnostic globals undefined.

The approved clean transaction signature wrapper recorded an actual offline
Remove rejection as `firestore/unknown`, with a native `UNAVAILABLE` token.
Native offline exact/suffix/phrase and deadline booleans were false; no raw
messages were captured (`part4-signature-offline-results.json`). Installed
RNFirebase bridge source erases the native code to unknown in this exception
path; the captured token does not authorize treating every unknown error as a
network error. The observed pre-fix runtime used generic invalid-content
recovery wording. The later reviewed fix and post-clear ordinary device check
are recorded above. Actual reconnect/Retry drained the outbox at tombstone
revision 5; an authenticated client restored the pin at revision 6. The screen
retained its pending label after SQL outbox reached zero; actual Refresh cleared
it and restored the row. This is a recorded UI refresh limitation, not evidence
that durable sync failed.

### Part 4 service recovery and resource checkpoint

At resume, only acceptance Firestore Java PID 18923 remained; its in-memory
catalog/personal records were retained. Missing Auth/hub/logging were recovered
with Firebase CLI `--only auth` on 9199/4440/4540. That hub intentionally does
not list the separately surviving Firestore, so diagnostics use explicit 8180
endpoint/process checks; the seed guard was not weakened and no reseed ran.
Auth's disposable A/B profiles were reconstructed through the isolated Auth API
with their original UIDs. The first recovery helper mistakenly used the whole
two-line credential note as the password. It was corrected from the unique `Test
sign-in password:` label using an isolated Auth update that retained both UIDs;
all credential helpers now use the same bounded parser. Earlier sign-in failures
and the initial SDK probe are setup observations, not original-credential or
account-isolation passes. The corrected SDK probe and actual native B form
sign-in passed. This new Auth lifetime is test setup recovery, distinct from the
surviving native SQLite and Firestore persistence.

The existing AVD was booted normally, without wipe, reinstall or data clear;
feature Metro 8083 was recovered and the installed client explicitly reloaded.
An Android System UI nonresponse dialog appeared during cold boot; actual Wait
allowed continuation. This setup instability has no established product cause.

Host disk fell from approximately 5 GiB to 291 MiB, with 10 GiB swap fully used;
a small evidence-log write failed with no-space. Heavy work was paused and
font 1.0, OS night no and Wi-Fi/mobile 1/1 were verified restored. Space then
recovered to approximately 3 GiB and UI work resumed. No user/global caches,
AVD state, old evidence or unrelated apps were deleted/stopped. The cause of
the resource change is unproven. The matrix above distinguishes settled UI
from intermediate loading/Activity frames.

The exact controller-approved `part4-cache-benchmark-proposal.js.txt` ran once
against separate native database `pnpe-acceptance-public-scan-part4.db`, using
the unchanged adapter/cache/fingerprint and strict validation. It asserted 529
catalog entries: 439 without stimulus and 90 with stimulus before saving. Final
count was 529, `quick_check` ok, close successful and errors empty. The 532
isolated Admin REST public fixture reads bypass Auth, rules and native SDK
ingestion. Artificial 439-then-90 ordering measures native save/scan cost at
439–528 cached bodies; it does not establish ordinary navigation, native
transport ingestion or release-device latency.

`part4-cache-benchmark-final.json` preserves every sample;
`part4-cache-benchmark-summary.json` reports these observed debug-AVD timings:

| Native save samples                    | Count |    Median | p95 (nearest rank) |    Maximum |
| -------------------------------------- | ----: | --------: | -----------------: | ---------: |
| No stimulus                            |   439 |   3.26 ms |            5.22 ms |   12.90 ms |
| Shared stimulus, cached bodies 439–528 |    90 | 330.31 ms |         2976.22 ms | 3442.51 ms |

The final stimulus save took 3274.54 ms. Total elapsed 53.20 seconds includes
fixture retrieval and validation outside the timed save calls. These samples
show material scan cost in this run but do not prove its sole cause or justify
weakening validation. No performance optimization was made.
`part4-benchmark-original-db-preservation.json` confirms all rows of the
original public/personal database are identical before/after, including 22
progressively cached bodies, three sessions, 16 viewed memberships and zero
outbox. The app was force-stopped after completion to remove all wrappers and
benchmark globals; the separate benchmark database/evidence were retained.

Fresh controller checks in `part4-preservation-controller.json` matched all
36 recorded corpus/PDF hashes; `part4-live-head-controller.json` matched the
live revision-2 generation and original create/update times exactly. These are
fresh preservation checks, independent of historical automated test results.

### iOS and remaining acceptance

The owner explicitly chose Android for now. No feature iOS project, pods,
binary, build/install attempt or compiler failure exists. Historical foundation
binaries do not establish this slice's SQLite/Crypto acceptance. iOS remains
pending, with installed iPhone 16 Pro iOS 18.5 simulator available for later work.
Android TalkBack and iOS VoiceOver were explicitly deferred; neither was enabled
or claimed passed. Structural labels/focus and ordinary font/theme observations
remain separate from screen-reader acceptance.

Do not run the destructive emulator test runner against this persistent
acceptance lifetime, restart surviving Firestore or seed while it is healthy.
Preserve the installed APK, app data and isolated accounts. Owner Google files
remain ignored; absolute configuration paths were used without printing or
modifying their contents. Task 10 and finishing/integration remain open.

## Material limitations and review gates

The remote official schema has no editorial approval digest, so client
fingerprints cannot prove owner approval. Device identity is not a server trust
primitive. Rules validate bounded immutable metadata and transitions; they do
not prove an arbitrary complete manifest. Personal cloud metadata supports
text/math and empty assets; unsupported retained pins remain local/recoverable.

Strict nested rules require at most two manifest entries per chunk. A 276-item
manifest therefore needs 138 immutable chunk documents plus root publication
and later state/view documents. This increases upload operations without
limiting questions; measured debug-AVD publication is recorded above, with
remaining corpus/performance limits explicit.

Whole-branch review and its single scoped final-fix rereview are complete.
The separate stimulus fix also received scoped approval. Native acceptance
and performance measurements remain open before
finishing/integration. The worktree, SDD ledger and ignored evidence are preserved
for continuation.

## Final fix checkpoint (2026-10-10)

This is the continuation of one fix wave after a server restart, based on the
whole-branch review at `f75c0e0`. Earlier logs remain intact. Local evidence is
under `evidence/content-reviewer/final-fix/`.

- I1: SQLite v3 stores acknowledged viewed membership. The worker subtracts only
  durable successful-operation acknowledgements from each validated snapshot.
  Acknowledgement unions that exact operation's viewed set and deletes its outbox
  row in one guarded transaction. Inserts cover only new membership. Version-two
  records upgrade without clearing sessions/outbox; their empty acknowledgement
  set permits one safe catchup. The remote rejects stale/equal sequences before
  membership reads, checks owner/root/manifest for each new member, and advances
  the root only after all membership commits. Remote DTOs and rules are unchanged.
- I2: Bookmarks and Reviewer use explicit displayed Add/Remove intent. A background
  tombstone or addition cannot invert that action. Pinned revision, live gate and
  atomic outbox behavior are retained and covered by real SQLite/worker/remote
  and route regressions.
- M1: manual Bookmarks Refresh wakes and awaits the captured owner's sync worker,
  then reloads local rows. Offline refresh keeps local access usable; permission
  errors show safe retry, and stale-owner completion cannot merge personal data.
- M2: plan Tasks 1–9 now reflect their completed ledger state; native acceptance
  and finishing remain open; scoped rereview subsequently approved all five fixes.
- M3: released old-owner prefetch slots resume the current valid window. The
  two-outstanding-request bound and rejection of old results remain covered.

The deterministic 276-item online read-through runs the actual worker, real Node
SQLite repository and actual remote adapter against an in-memory SDK boundary.
State traffic falls from **76,727 transactions / 229,079 document gets** in the
saved failing regression to **1,103 transactions / 1,655 document gets**, with
827 writes unchanged. First publication remains 140 transactions/gets/writes
(138 chunks plus preparing/ready root writes). SQLite acknowledgement inserts
are exactly 276. Position-only updates use one root transaction; stale/equal
replay uses one root read. These are protocol call counts, not measured native
latency, billed Firestore reads or whole-app traffic; bookmark polling is outside
these session-state counters. Full snapshot storage and local acknowledgement
scans still require native measurement.

Recovery coverage includes partial membership commit before root advancement,
lost local acknowledgement, durable restart, exact-operation union, transaction
rollback, owner change after upload and immediately before SQL commit, legacy v2
catchup, publication/state ordering and stale replay. The corrected M1 RED uses
the composition owner UID; the earlier RED used an incorrect fixture UID and is
retained as a test setup failure. An additional initial recovery test run lacked
a StudyError import; the corrected covering run passes. Neither setup failure is
claimed as evidence of the product bug.

Fresh full unit/mobile and static results are recorded below. Unchanged cloud
rules, dependency versions and emulator infrastructure did not warrant repeating
the earlier 72-test guarded emulator run or online Expo check. No emulator, live
backend, native build, device, credential or user cache operation was performed
in this fix wave. All 33 tracked preservation paths were rehashed and match the
prior baseline (`preservation.json`). Original-PDF/live-head checks above remain
historical evidence and were not rerun.

| Command                                                     | Observed result                        | Final-fix log               |
| ----------------------------------------------------------- | -------------------------------------- | --------------------------- |
| `npm run test:unit`                                         | Exit 0; 35 suites, 567 tests; 58.499 s | `test-unit.log`             |
| `npm run test:mobile`                                       | Exit 0; 20 suites, 229 tests; 16.835 s | `test-mobile.log`           |
| `npm run typecheck`                                         | Exit 0; tools/mobile, no diagnostics   | `typecheck.log`             |
| `npm run lint`                                              | Exit 0; no diagnostics                 | `lint.log`                  |
| `npm run format:check`                                      | Exit 0; all matched files formatted    | `format-check.log`          |
| Explicit Prettier check of the plan and verification record | Exit 0                                 | `document-format-check.log` |
| `git diff --check`                                          | Exit 0                                 | `diff-check.log`            |

Node SQLite's ExperimentalWarning remains disclosed in unit/mobile output.

The approximately 1 GiB build boundary and 5.9 GiB recovery inventory are
historical; the later Android build/device checkpoint above supersedes native
absence. Its unfinished acceptance rows remain open.

## Native-discovered stimulus fix checkpoint

The actual approved catalog exposed a reference-contract defect: 90 questions
carry 19 opaque embedded passage identities with spaces, colons or Unicode.
`7e66178` introduces a separate strict bounded stimulus reference without
normalizing approved content; document-path identities remain strict. Matching
personal rules retain the cap-two budget and UTF-8 bounds. Independent scoped
review reported no findings.

Recorded checks under `evidence/content-reviewer/native-stimulus-fix/` passed
595 unit tests in 36 suites, 229 mobile tests in 20 suites, six isolated nonreset
real-SDK rules tests, tools/mobile typechecks, lint, formatting and whitespace.
Focused schema RED was 20 failed/8 passed, then GREEN 28 passed; rules RED was
5 failed/1 passed, then final GREEN six passed. Intermediate faulty negative
fixtures and an ignored diagnostic-helper lint failure were corrected and
preserved as setup evidence. All 36 preservation hashes matched. These checks
were not rerun merely to resume unchanged runtime.
