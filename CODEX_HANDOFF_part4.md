WHO THIS IS FOR

This handoff is for a new Codex session working with Julius Jervin Bundalian on PNPE Exam Reviewer, a native Android and iOS app for Philippine National Police Entrance Examination preparation. The owner prefers autonomous execution of approved Superpowers designs and plans, strict TypeScript, feature-first Clean Architecture, accessible light and dark themes, meaningful tests, and independent reviews. On October 10, 2026, the owner interrupted Android acceptance near the five-hour usage limit and specifically requested this detailed CODEX_HANDOFF_part4.md. Stop work at this handoff; resume the saved checkpoint when the owner requests continuation. Do not ask the owner to explain the project again or approve already authorized Reviewer tasks again.

Snapshot time is approximately October 10, 2026, 10:00 AM Asia/Manila. This file supersedes Part 3's statements that content loading and Reviewer are unimplemented, while preserving its editorial facts and authorization boundaries. Part 3 remains at the main checkout as codex_handoff_part3.md.

WHAT WE COVERED

The original goal was to inspect codex_handoff_part3.md and continue its remaining tasks. Part 3 handed off a completed, approved 529-question publication and an existing mobile foundation, and asked for content retrieval, rich rendering, durable Reviewer sessions, bookmarks, viewed progress and resume, followed by a separately designed Mock Exam/results/history slice. We prepared a new Content Reviewer design and implementation plan, received the owner's explicit approve, and implemented Tasks 1 through 9 in an isolated worktree with implementers and independent task reviews. Task 10 covers automated verification, native Android/iOS acceptance, documentation and finishing. Full automated checks and the whole-branch review were performed, one final fix wave and its scoped rereview were completed, and Android native acceptance is currently in progress. Mock Exam/results/history are still outside this implemented slice; do not pretend their existing menu destinations implement exams.

The current feature worktree is /Users/juliusjervinbundalian/Documents/GitHub/pnpe-exam-reviewer/.worktrees/content-reviewer on feat/content-reviewer. Main remains /Users/juliusjervinbundalian/Documents/GitHub/pnpe-exam-reviewer at 159221d3fe8972b3fcc0d25f6add178e6ab92264. Current feature HEAD is 7e66178d93a4a6a8fcc0966e22efff15f15771bb. The approved implementation-plan base is 6309fa82734a4752ee53eb59ff385d478e23a707. Feature tracked state was clean at the stop checkpoint. Main originally retained untracked .DS_Store, codex_handoff_part3.md and ic_pnpe_exam_reviewer.png; preserve them. This new handoff is written in main and is not a product-code commit.

Task 1, 11c879d, introduced a destructive-test guard and separate Firebase emulator endpoints, including tools/tests/run-study-emulators.ts and firebase.study-tests.json. Task 2, 6410f2c, established mobile-safe validated catalog/revision, owner, session, bookmark and outbox contracts and reused the catalog schema in the import tool. Task 3, ea0600f, added Expo SQLite 57.0.4 and Crypto 57.0.3, serialized native/Node SQL adapters, migrations, durable identity, cache and personal state. Task 4, 99d43a4, implemented server-source catalog discovery, document-ID ordered shard paging, revision validation, cache fallback and owner guards. Task 5, 0bd9203, implemented durable read-through ReviewerService and ReviewerController, full-scope manifests, immediate answers, navigation, rendered-view receipts and bounded prefetch. Task 6, 4fb6059, added text/marked-span/math rendering and accessible Reviewer controls, layout barriers and lifecycle visibility. Task 7, fe6c8bc and 87727a4, implemented pinned bookmarks and viewed Progress with actual SQL execution/precommit authorization. Task 8, b1b70d1, 24a56e5 and 2a9c904, implemented durable ordered study sync, strict cloud DTOs, chunk publication, bookmark CAS/receipts, timestamp handling, retry and owner guards. Task 9, 5cad0b5 and a463230, connected lazy native composition, protected routes, start/feature gates, replacement confirmation, page-bound bookmark actions, focused Progress refresh and owner-only study rules. All nine tasks have independent approvals. Trust the completion lines in the ledger over its older checkbox block; Task 9 is complete even if an old checkbox remains unchecked.

Task 10's first documentation checkpoint is f75c0e0. Its automated checks passed, but builds were deferred at about 1 GiB free. The whole-branch review found two Important and three Minor issues. A single final wave, f4a5dac, fixed excessive viewed-state replay, stale bookmark intent inversion, local-only Bookmarks Refresh, stale plan status and old-owner prefetch-slot starvation. Its single scoped rereview found every issue addressed and no new implementation breakage. Do not repeat that broad review or dispatch a second whole-branch fix wave. A server/usage interruption occurred during that one wave; the resume was continuation, not another wave.

Android was subsequently built successfully when space improved to 6.9 GiB. The build finished after an interruption, and this session recovered the successful APK rather than rebuilding it. Actual native seeding then exposed a new compatibility bug: the consolidated catalog schema incorrectly applied document-ID rules to embedded stimulus identities. Ninety approved questions use nineteen opaque passage IDs containing colons, internal spaces or Unicode. This blocked the real catalog, despite previous synthetic fixtures passing. The narrowly scoped Task 10 bugfix 7e66178 introduced a dedicated bounded opaque stimulus contract, matching revision validation and personal rules, without changing approved data. Independent scoped review passed with zero findings. This new native-discovered bugfix is separate from the already completed whole-branch fix wave.

Current implementation provides public guest Home and category overviews; lazily constructed native protected Reviewer, Progress and Bookmarks; complete category/subcategory Reviewer manifests; immutable selected order and original choice order; immediately visible correct answer and supplied explanation; durable viewed progress, position, pinned revisions, bookmarks and atomic pending changes; progressive question retrieval and valid cache fallback; owner/config/foreground guarded sync and owner-only rules. It does not implement active Mock Exam selection, timer, answers/flags, submission, results, submitted-exam review or history.

The commit sequence for this slice, including design and plan, is recorded below. These commits exist locally; no push, merge, release, deployment or store upload was authorized or performed.

5665fa7 docs: propose content loading and reviewer design
6309fa8 docs: plan approved content and reviewer slice
11c879d test: isolate destructive Firebase integration suites
6410f2c feat: define validated content and study contracts
ea0600f feat: persist study state and content in SQLite
99d43a4 feat: load validated catalogs and revisions progressively
0bd9203 feat: implement durable read-through reviewer sessions
4fb6059 feat: render accessible reviewer questions and reading navigation
fe6c8bc feat: add pinned bookmarks and viewed progress
87727a4 fix: authorize bookmark mutations at SQLite commit
b1b70d1 feat: synchronize durable study operations safely
24a56e5 fix: report durable pending count before sync polling
2a9c904 fix: preserve sync timestamp and drain ordering guarantees
5cad0b5 feat: connect protected reviewer flows and owner-only study rules
a463230 fix: refresh saved progress and bind bookmarks to pages
f75c0e0 docs: record content reviewer verification
f4a5dac fix: bound study sync and preserve explicit bookmark intent
7e66178 fix: preserve opaque embedded stimulus identities

The exact tracked files added or modified relative to original main 159221d are recorded below. A means added and M means modified. Generated android, SQLite snapshots, diagnostic scripts and evidence are ignored and do not appear in this list. This is a git-derived inventory, not a guess.

M README.md
M app.config.ts
M docs/content-workflow.md
A docs/superpowers/plans/2026-10-08-content-reviewer.md
A docs/superpowers/specs/2026-10-08-content-reviewer-design.md
A docs/verification/content-reviewer.md
A firebase.study-tests.json
M firebase/firestore.rules
M package-lock.json
M package.json
M src/bootstrap/composition.ts
M src/bootstrap/environment.ts
A src/bootstrap/studyComposition.ts
A src/core/content/Fingerprint.ts
A src/core/content/nativeFingerprint.ts
M src/core/firebase/native.ts
A src/core/identity/IdentitySource.ts
A src/core/random/RandomSource.ts
A src/core/storage/sqlite/SqlDatabase.ts
A src/core/storage/sqlite/nativeSqlDatabase.ts
A src/core/storage/sqlite/rows.ts
A src/core/storage/sqlite/serialSqlDatabase.ts
A src/core/storage/sqlite/studyMigrations.ts
M src/features/auth/application/intents.ts
A src/features/bookmarks/application/BookmarkService.ts
A src/features/bookmarks/presentation/BookmarksScreen.tsx
A src/features/content/data/CachedContentRepository.ts
A src/features/content/data/FirebaseContentRemote.ts
A src/features/content/data/SqliteContentCache.ts
A src/features/content/data/nativeContentFacade.ts
A src/features/content/domain/ContentRemote.ts
A src/features/content/domain/ContentRepository.ts
A src/features/content/domain/catalog.ts
A src/features/content/domain/eligibility.ts
M src/features/content/domain/question.ts
A src/features/content/domain/revisionValidation.ts
A src/features/content/domain/stimulus.ts
A src/features/content/presentation/ContentBlocks.tsx
A src/features/content/presentation/QuestionReadingView.tsx
A src/features/reviewer/application/ReviewerController.ts
A src/features/reviewer/application/ReviewerService.ts
A src/features/reviewer/presentation/ProgressScreen.tsx
A src/features/reviewer/presentation/ReviewerScreen.tsx
A src/features/study/application/StudySyncWorker.ts
A src/features/study/data/FirebaseStudySyncRemote.ts
A src/features/study/data/SqliteStudyRepository.ts
A src/features/study/data/cloudStudySchemas.ts
A src/features/study/data/nativeStudySyncFacade.ts
A src/features/study/data/studySqlRows.ts
A src/features/study/domain/StudyRepository.ts
A src/features/study/domain/StudySyncRemote.ts
A src/features/study/domain/study.ts
M src/navigation/PersonalRoute.tsx
M src/navigation/ReviewerRoute.tsx
A src/navigation/StudyRoute.tsx
M src/navigation/destinations.ts
A src/navigation/useReviewerBookmark.ts
A tests/application/bookmarks.test.ts
A tests/application/content-cache.test.ts
A tests/application/content-remote.test.ts
A tests/application/content-repository.test.ts
M tests/application/import-boundaries.test.ts
A tests/application/integration-environment.test.ts
M tests/application/native-configuration.test.ts
A tests/application/reviewer-controller.test.ts
A tests/application/reviewer-service.test.ts
A tests/application/study-contracts.test.ts
A tests/application/study-remote.test.ts
A tests/application/study-sqlite.test.ts
A tests/application/study-sync.test.ts
A tests/content/mobile-catalog.test.ts
A tests/content/opaque-stimulus.test.ts
A tests/content/revision-validation.test.ts
A tests/firebase/opaque-stimulus-nonreset.integration.test.ts
M tests/firebase/rules.integration.test.ts
A tests/firebase/study-rules.integration.test.ts
M tests/fixtures/app-harness.tsx
A tests/fixtures/integrationEnvironment.ts
A tests/fixtures/nodeSqlDatabase.ts
A tests/fixtures/reviewer.ts
A tests/fixtures/study-navigation.tsx
A tests/fixtures/study.ts
A tests/fixtures/studyCloudSdk.ts
M tests/import/firestore.integration.test.ts
A tests/mobile/bookmarks.test.tsx
A tests/mobile/content-rendering.test.tsx
M tests/mobile/native-boundary.test.tsx
A tests/mobile/native-content.test.tsx
A tests/mobile/native-study-storage.test.tsx
A tests/mobile/native-study-sync.test.tsx
M tests/mobile/navigation.test.tsx
A tests/mobile/progress.test.tsx
A tests/mobile/reviewer.test.tsx
A tests/mobile/study-composition.test.tsx
A tests/mobile/study-navigation.test.tsx
M tools/questions/import-store.ts
A tools/tests/run-study-emulators.ts

WHAT WAS CONFIRMED

The authoritative approved bank is data/questions.json: 529 approved distinct questions, with category pools General Information 134, Communication Skills 276, Quantitative Reasoning 41 and Critical Thinking 78. There are 145 explicitly deferred drafts and 13 rejected duplicates retained in editorial records. Do not re-extract PDFs, regenerate content, rewrite stimulus identities, change approval stamps, process deferred drafts, or reimport the live demo. All 33 tracked bank/editorial/publication-evidence paths and three original PDFs have repeatedly matched their preservation hashes. The latest independent stimulus review recomputed all 36 preservation hashes with zero mismatches. The owner's original approval manifest and publication evidence remain authoritative in docs/verification/editorial-full-corpus. Public Service Conduct and Data Interpretation have no eligible questions. The default future Mock Exam remains 150 unique questions, 180 minutes, with frozen quotas 35/40/25/50; question and choice shuffling must follow the approved overall design rather than any new assumption.

The live main demo is preserved on Firestore 8080, Auth 9099 and Metro 8081. A read-only head GET at this handoff still returned revision 2, generation 7f8f7ded0edcea40cbba7a5180b9713f6c0edec8f76eac7f60558e8a13a0775b, createTime 2026-10-07T09:31:53.168500Z and updateTime 2026-10-08T02:09:22.327411Z. These timestamps must remain unchanged absent a separately authorized change. Never run default reset/rules integration operations against 8080. There is no Metro 8082 listener in the fresh inventory; inspect rather than assuming Part 3's older service inventory.

Persistent native acceptance is a separate demo-pnpe lifetime on Firestore 127.0.0.1:8180, Auth 127.0.0.1:9199, hub 4440, logging 4540 and websocket 9250. It contains disposable A/B accounts, the authorized approved 529-question copy, native personal sessions/bookmark data and unique-UID rule-test fixtures. Its catalog generation matches live, but its head revision is 1, which is expected for this new isolated lifetime. Do not run npm run test:emulator or another destructive reset while this acceptance lifetime is active. The guarded runner clears isolated test data; sharing the port is not enough to make concurrent execution safe. The six later opaque-stimulus rules regressions ran nonreset with unique UIDs against this persistent lifetime and did not clear native state. Preserve services across the handoff. If they have died in a new session, inventory first, then recreate only the isolated endpoints and rerun the guarded idempotent approved-copy seed; never fall back to live endpoints. Auth/personal data would need reconstruction if the ephemeral acceptance services were lost, which is not the same as a product persistence failure.

Fresh PID inventory at handoff: live Firebase parent node 33310 with main Firestore java 33383; live Metro node 33425. Owned acceptance Python wrapper 18883, Firebase node 18901 and Firestore java 18923. Owned feature Metro Python wrapper 22779, npm 22797 and node 22814. Existing Android AVD process 17047 is Medium_Phone_API_36 with -no-boot-anim and -no-audio. PIDs are snapshot facts, not stable IDs for a later session; inspect commands and ports before operating them. No Gradle or Xcode build is running. Do not stop all node/java processes or any main service.

The current Android target is emulator-5554, Android 16/API 36 ARM64, package com.pnpe.exam.reviewer. New generated native project is ignored under the feature worktree android directory. The actual APK is android/app/build/outputs/apk/debug/app-debug.apk, approximately 93 MiB, versionName 0.1.0, versionCode 1, SHA-256 94ae7f7e6cc1bae9bcc02dee194bb2321ee681e9592842caaf430a9139806ca6. It was prebuilt and compiled from f4a5dac with Expo SQLite 57.0.4 and Crypto 57.0.3. Java 21 Gradle assembleDebug completed in 1m56s, wrapper 117.93 seconds, exit 0, 566 tasks with 281 executed and 285 from cache. adb install -r succeeded without uninstall, wipe or data clear. The running Metro JavaScript bundle is the reviewed 7e66178 fix; no native dependency changed in that JS-only fix, so no rebuild was needed. Record this APK-versus-JS distinction rather than claiming the APK was compiled from 7e66178.

Feature Metro runs separately on 8083 with emulator host 10.0.2.2 and explicit Auth 9199/Firestore 8180. ADB reverse host-16 tcp:8083 to tcp:8083 is active to keep Metro/inspector reachable when device Wi-Fi is disabled. Firebase SDK endpoints remain 10.0.2.2:9199/8180; the reverse is only Metro. Development-client URI uses scheme pnpe and explicitly selects 8083. First Expo run command rejected --port together with --no-bundler before compilation, so the successful build used direct Gradle. Initial Metro --host localhost bound IPv6 only and Android IPv4 refused it; restarting only the owned Metro with --host lan fixed setup. These are preserved setup failures, not native compile defects.

Java 21.0.5 is /Applications/Android Studio.app/Contents/jbr/Contents/Home. Android SDK is /Users/juliusjervinbundalian/Library/Android/sdk with platform/build tools 36. Xcode is 27.0/27A266a, CocoaPods 1.16.2, Node 24.3.0. Dependencies use Expo 57.0.27, React Native 0.86.3, React 19.2.3, RN Firebase 26.4.0, Zod 4.6.5 and TypeScript 6.0.3; package.json and lockfile are authoritative. Owner Google configuration files remain ignored in main as google-services.json and GoogleService-Info.plist. Paths and package/bundle/project agreement were checked without printing credentials. Use their absolute paths through GOOGLE_SERVICES_ANDROID/GOOGLE_SERVICES_IOS. Do not print, commit or overwrite them.

About 2.8 GiB free remains after Android. No user/global caches or historical native outputs were deleted. On being asked about enough room for iOS, the owner explicitly answered continue with android for now. Therefore do not begin iOS prebuild/pods/build until the owner resumes that platform. iOS acceptance stays pending, not passed or waived. Installed iPhone 16 Pro iOS 18.5 simulator UUID is FFC1BAA2-881B-4513-B947-39F5374FF480; there is no new feature iOS project, binary, build, install or native acceptance. Historical foundation binaries do not establish SQLite/Crypto feature acceptance. Android TalkBack and iOS VoiceOver testing were separately explicitly owner-deferred; never enable global screen readers or claim those passes. Structural labels/focus and ordinary font/theme observations are separate requirements.

Architectural decisions are binding. The approved slice is docs/superpowers/specs/2026-10-08-content-reviewer-design.md and docs/superpowers/plans/2026-10-08-content-reviewer.md, together with the original overall foundation-and-content design. Use mobile-safe domain schemas rather than tool/Node imports in runtime. A catalog snapshot is usable only after server head, document-ID ordered shard pages and final matching head validation; bounded three-attempt churn handling permits explicit last-complete-cache selection. Head/catalog metadata does not prove editorial owner approval because the official remote schema lacks an approval digest. Question revision identity and fingerprints are validated, and shared stimulus identity/content agreement is enforced. Text and supported math/marked spans are accepted; images/diagrams/tables remain excluded from this supported-content slice pending separate transport/rendering acceptance.

Reviewer includes every eligible item in the selected scope with no 100-question cap. Questions are frozen in the manifest, optional question shuffle is frozen, and choice order is unchanged. Viewed means a complete current page laid out while focused and foreground, not answering or scrolling to the end. Correct answer/explanation is immediately present. The completed session keeps its final page and navigation; it does not disappear. A new session requires first-page readiness and a confirmed durable replacement; blocked activation preserves existing session/archive/outbox.

SQLite is the authority for local personal state, installation device ID and atomic pending work. Database schema is version 3. Version 2 added nullable catalogValidatedAt, preserving legacy sessions; version 3 adds reviewer_view_acknowledgements. The native adapter serializes actual SQL on one connection with foreign keys enabled, transactions and rollback. Owner guard checks at request, actual execution and immediately before COMMIT are required, because queued work may outlive an account epoch. New session activation and bookmark mutations also recheck their live config gate at actual SQL execution/precommit. Installation identity is durable and not a server trust primitive. Account changes invalidate old owner epochs and late responses, and public guest Home must not eagerly open study storage or load the whole bank.

Sync uses preparing-root, immutable chunks and ready-root publication, then ordered state/view writes and bookmark CAS with atomic receipts. Strict nested rules could not reliably support 100 entries: the unrolled 100 candidate failed compilation, strict 5 compiled but exceeded the runtime 1000-expression limit, and tested strict 2 is the final shared manifest cap. This is a cloud document batching cap, not a Reviewer/session question cap. A 276-item manifest has 138 chunks plus two publication root writes. Personal cloud metadata supports text/math and assets=[], while official catalog/cache/general domain data remains broader; unsupported retained pins remain local/recoverable. Rules cannot prove arbitrary global manifest continuity, duplicate IDs across arbitrary chunks or editorial approval, and must not be described as doing so.

The final replay fix stores exact durable acknowledged viewed membership. The worker subtracts only successful-operation acknowledgements from its validated snapshot and sends incremental viewed deltas. The repository unions that operation's viewed set and deletes its outbox operation atomically, with only new acknowledgement inserts. Lost acknowledgement/partial commit/restart/old-owner/legacy-upgrade tests protect replay. Stale/equal remote sequences exit before full membership reads; first legacy catchup can safely resend once. No rules weakening or cloud schema change was needed for this fix. Bookmarks use setSaved with explicit displayed Add/Remove intent; stale remote additions or tombstones cannot invert Remove into Add. Manual Refresh wakes and awaits the captured owner's sync, rechecks the owner and reloads local rows, with offline local access and permission recovery. Ordinary automatic flush respects durable nextAttemptAt; explicit wake/foreground/manual Retry attempts ordered work once immediately. Progress refreshes on return/focus, and its resume uses the persisted scoped stack route so Back returns to Progress.

The native-discovered stimulus fix intentionally separates question/document IDs from embedded metadata IDs. StimulusRefSchema in src/features/content/domain/stimulus.ts accepts exact opaque Unicode/colon/slash/internal whitespace strings of 1 through 1500 UTF-8 bytes without trimming or normalizing. It rejects padding, blank/control/line-separator IDs, malformed local surrogate strings, invalid versions and unknown fields. QuestionSchema, CatalogEntrySchema, revisionValidation and strict personal rules use this contract. Firestore rules use toUtf8().size(), not character size, and real tests prove 1500-byte accented/emoji boundaries. Document-safe question/asset/owner/device/session/operation contracts remain strict. Do not normalize ninety approved questions to work around the prior bug.

Actual Android evidence now establishes public Home rendering, guest sign-out, native form sign-in A, and absence of a SQLite database before protected entry. The ordinary uninstrumented UI created Communication Item 1 of 276/View 1, shared Boracay passage, immediate correct answer and supplied explanation. SQLite has all 529 catalog metadata entries but initially only three question revisions, proving progressive retrieval rather than loading all revision bodies. Device/session hashes, complete manifest, position/view membership and acknowledgement survived force-close. Later actual Progress showed Viewed 4 and Resume at item 4 of 276 after a clean restart.

With actual Wi-Fi/mobile disabled, cached Items 3 and 4 rendered, with the marked ambulant target represented in native accessibility text. Uncached Item 5 settled to the explicit offline-unavailable message at saved position 4; Retry left position and viewed membership unchanged. Previous returned to cached content. An actual offline Bookmark became Remove bookmark and queued durable work. Restoring exact network settings and actual Retry sync drained outbox to zero, acknowledged ordinals 0 through 3 and synced the pinned version-1 bookmark as server revision 1/deleted false. SQLite and isolated remote agree.

An actual confirmed same-scope replacement preserved the old 276-item session as archived and created a new full 276 session. Native publishSession measured 1870.86 milliseconds with 140 logical transactions, 140 document gets and 140 document sets: 138 immutable chunks plus two root writes. Each remote chunk has two entries. This counts logical calls observed by wrappers, not billable RPCs or every native SDK retry. Catalog refresh measured two head reads and one shard page; first/prefetch retrieval measured three question revision fetches. SQL then had fourteen total revision cache entries. A later single new viewed state measured 139.72 milliseconds, three logical transactions/five gets/two sets, one view plus one root and zero manifest rewrites. These are debug-AVD observations, not release-device performance guarantees.

Foreground receipt evidence is saved: actual Next followed immediately by Android Home left new session position 1 with only viewed ordinal 0; returning MainActivity foreground added ordinal 1. This establishes background layout was not credited. Explicit Light and Dark appearance were observed. The stop report additionally confirms System selected with OS night yes produced a dark Home, and OS night no produced a light Appearance screen while System remained selected. The initial unsettled System captures did not prove this, but the later settled captures do. Full enlarged-font long-passage/control traversal and final font restoration remain unfinished; do not unnecessarily redo the completed System response observation. The final pre-stop saved settled Reviewer screenshot at 09:58 is Communication Item 2 of 276/View 2 with font scale 1.5. The app's original preference Dark was restored through UI; OS night mode no and Wi-Fi/mobile both 1 were restored. Font scale remains 1.5, not its original 1.0, because the owner stopped work before that last restoration. Restore font to 1.0 first on resumption; activity recreation requires explicit settled reload rather than treating blank/restored frames as verification.

Native diagnostics are a material checkpoint. No source instrumentation was committed. Ephemeral Hermes CDP wrappers record method names/counts/durations and bounded sanitized standard errors, with no credentials, keys, values, config or full state dumps and no direct product mutation calls. The first loop-generated Runtime.evaluate wrappers captured the last loop binding, causing actual Next to call acknowledge and produce invalid-content. Those injected failures and their timings are INVALID acceptance evidence, not product bugs. They were removed by force-close and integrity checked. Factory wrappers with formal per-invocation parameters were then verified against actual UI method names and SQL positions. Do not reuse cdp-study-counters.js.txt or any old loop-generated wrapper. CDP module IDs can change after Metro restart; discover limited export names again rather than assuming 1720/1771/etc.

At stop, approved factory diagnostics ARE ACTIVE: globals __pnpeFactoryStats and __pnpeSqlWork are objects. Earlier __pnpeNativeStats and __pnpeVerified are undefined. Thirteen method wrappers plus remote.transaction and SQL access timing remain attached; Android font/activity recreation did not remove them. Only an actual app force-stop/new JavaScript runtime clears them. Preserve existing saved factory results before force-stop if more data is needed. Remove them on resumption by force-stop and explicit 8083 dev-client reload, then verify global types with the safe cdp-stop-check expression. Do not assume activity recreation creates a fresh JS runtime.

Latency evidence includes an initial move at 4594.93 milliseconds, three settled move samples 2383/5529/3917 milliseconds and view samples about 1.3 to 1.9 seconds. Warm instrumented traces later improved to move 651 then 356 milliseconds and view 414 then 211 milliseconds without a product change. SQL statement wall times were small relative to callback work. Read-only native-performance-diagnosis.md finds four complete manifest-validation passes per successful move/view, 1104 catalog-entry validations for 276 entries, plus serialized shared DB/outer transaction overhead and further sync materialization. These are optimization candidates, not established attribution of cold multi-second latency. Residual work time is not pure CPU and total-minus-work is not pure queue time. No urgent optimization or unreviewed schema weakening was authorized. Cumulative counter files must be diffed by appended observations, not double-counted as independent sample sets.

The exact stop image is evidence/content-reviewer/native/android-owner-stop.png, captured at 10:00. Good measurement files include factory-publication-checkpoint.json, measured-publication-sql-summary.json, background-next-sql-summary.json, foreground-next-sql-summary.json, reconnect-retry-sql-summary.json, sql-trace1-results.json, sql-trace2-results.json, factory-trace1-results.json and factory-trace2-results.json. The appended Owner stop checkpoint in native-acceptance-report.md is newer than that report's earlier provisional paragraphs; trust the appended checkpoint and this handoff when they differ. Active original tool sessions were 41180 for services and 73716 for Metro, but new sessions should use PID/port inventory rather than assuming these handles remain valid. No export or shutdown was performed, so the isolated emulator state is still in memory.

Authoritative execution workspace is .superpowers/sdd/2026-10-08-content-reviewer inside the feature worktree. Read progress.md, contracts.md, constraints.md, file-map.md, native-acceptance-report.md, native-stimulus-fix-report.md, native-stimulus-fix-review.md, native-performance-diagnosis.md, final-fix-report.md and final-fix-rereview.md. Reports are ignored but retained. Task-specific reports/reviews and diff packages are also there. Whole-branch-review.md is historical at f75c0e0; all five findings were resolved by f4a5dac. Native-acceptance-preparation.md is historical read-only inventory before GO, not current build state. Task-10-report.md and tracked docs/verification/content-reviewer.md are earlier automated checkpoints and are stale about native absence/pending rereview; do not use those stale paragraphs to overwrite newer evidence. No final Android documentation commit or independent documentation checkpoint review has occurred yet. Task 10 remains open.

Superpowers subagent-driven development was the approved execution method and authorizes the implementer/reviewer delegation used here. At resume, apply its ledger-based recovery and avoid re-dispatching completed tasks. The available skill installation may differ between sessions; this session used /Users/juliusjervinbundalian/.codex/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills. The owner explicitly requires preserving the isolated worktree, execution workspace and evidence; that overrides generic skill deletion/cleanup guidance. Controller records rulings in progress.md; rulings.md is an exported roll-up and should be refreshed from every Ruling line before eventual finishing. Do not merge, push, deploy, delete the worktree or clean ignored artifacts without separate authorization. Skills for verification and independent scoped review are required before claims/commits. New real native bugs can receive narrow reviewed fixes, but do not repeat finished broad review work. Agents may not create their own review subagents.

Automated verification already run and results: Task 1 passed 63 isolated integrations and 347 unit tests. Task 2 passed 404 units. Task 3 passed 431 units. Task 4 passed 470 units. Task 5 passed 504 units. Task 6 reported 170 mobile tests. Task 8 passed 549 units with focused sync tests. Task 9 passed 554 units, final covering mobile route tests, and 72 guarded integrations with the strict two-item rules. The first Task 10 fresh full checkpoint passed 554 units in 35 suites, 223 mobile tests in 20 suites, 72 guarded integrations in three suites, both typechecks, lint, formatting, online Expo dependency check, explicit docs formatting and git diff --check. Its evidence is evidence/content-reviewer/task10.

The final whole-branch fix passed 567 units in 35 suites, 229 mobile tests in 20 suites, both typechecks, lint, general/doc formatting and whitespace checks. The 276-item deterministic online sync experiment improved from 76727 state transactions/229079 gets/827 writes to 1103 transactions/1655 gets/827 writes, with unchanged 140 publication operations and exactly 276 acknowledgement inserts. Real native metrics above separately confirm bounded per-update behavior; do not substitute deterministic SDK mock results for native latency. Initial i1-green-initial.log had 53 passing and two migration-fixture failures overall, despite the intended-size protocol suites passing; corrected fixtures and later 77 focused/full 567 runs resolved them. The report includes a controller clarification. Do not misreport that initial whole command as green.

Latest 7e66178 stimulus fix passed 595 units in 36 suites, 58.907 seconds; 229 mobile tests in 20 suites, 16.427 seconds; six actual nonreset isolated rules tests, 2.195 seconds; tools/mobile typechecks, full lint, formatting and git diff --check. Focused schema RED was 20 failures/8 passes and GREEN 28 passes, including every raw approved revision, all nineteen opaque identities, personal manifests/bookmarks, UTF-8 bounds and negative cases. Nonreset rules RED was five failures/one pass and final GREEN six passes. An intermediate negative fixture accidentally replaced its unsafe question ID with a safe bookmark ID; corrected fixture, not production code, resolved that intermediate failure. An initial full lint failure came from an unused binding in an ignored native diagnostic .js helper; the worker corrected/archived it as .js.txt, and full lint passed. No warnings were suppressed. Node SQLite ExperimentalWarning and Firebase shared-demo multiple-suite warning remain disclosed. Task 9's earlier unreproduced Bookmarks Refresh timing failure later passed standalone, covering and full runs; no root cause was claimed.

No full automated suites need to be rerun merely for resumption on unchanged HEAD. A real new runtime change requires covering red/green and appropriate crosscut checks plus scoped independent review. Destructive integrations must wait until acceptance services have been safely exported/stopped or use a genuinely separate guarded lifetime; never clear active native fixtures. Exact unchanged rules were covered by earlier 72 tests; only six new nonreset tests ran after stimulus rule edits, not a new full destructive 78-test runner.

STILL IN PROGRESS

Task 10 is incomplete and the current work is Android acceptance only. The immediate interrupted action was settling the font-scale-1.5 System-theme/Reviewer flow and capturing long passage controls after activity recreation, followed by actual math rendering, bookmark removal/CAS/tombstone behavior and account A/B isolation. Latest screenshot is enlarged Reviewer Item 2/View 2; Dark preference and OS/network restored, font still 1.5, factory wrappers active. The handoff checkpoint is not a completed Android acceptance report.

Remaining Android checks are actual math rendering and a complete enlarged-font long-passage/control/focus matrix; reconciliation of the completed System light/dark response evidence and final original-font restoration; bookmark Remove with tombstones/CAS/cross-client refresh and switching A to B and back without leaked personal work; complete failure/recovery observation for cold authentication and offline sync; intended-full-corpus shared-stimulus cache insertion/scan timing; and any native start/feature/maintenance transitions that can honestly be tested. Foreground/view receipt, force-close session/device/position durability, full 276 membership, missing-offline stable position, offline bookmark retry, cap-two upload and progressive reads now have actual evidence and should not be restarted unnecessarily.

Cold launches repeatedly showed Authentication unavailable and recovered through actual Retry. Their initial cause is unproven; a pending navigation/storage banner also cleared through actual Retry, with an original AsyncStorage remove call succeeding in 294.55 milliseconds. Do not claim those causes fixed. Offline page messaging was correct, but the sync-status banner used generic invalid-content wording during network outage. Need capture underlying standard native SDK error code before changing classification; injected wrapper failures must not be confused with this potential product issue. No speculative runtime fix has been made.

The full 529-question shared-stimulus cache scan benchmark is not done; small-cache save timings of 76–287 milliseconds do not establish intended-corpus performance. The controller suggested a possible narrowly scoped native benchmark harness warming only validated approved public questions through existing native content/cache methods after ordinary startup/offline evidence is preserved. No concrete benchmark harness or direct product-method invocation has been approved yet. A new controller must inspect an exact minimal proposal and record a ruling before allowing such direct diagnostic invocation. No personal/session/bookmark mutations, credentials/config/owner dumps or source instrumentation are authorized by the earlier wrapper permissions. Ordinary UI automation is already authorized.

Emulator mode Remote Config intentionally uses bundled fixed defaults, so natural maintenance/start-feature transitions cannot currently be claimed. Supplemental gate injection is not authorized, was not performed and must not be silently counted as real backend behavior. If proposed later, record exact scope and separate supplemental native-provider observations from genuine Remote Config ingestion evidence. Images/diagrams/tables, production redistribution/hosting, dependency advisory remediation and release/store work remain separate future work. Manual TalkBack/VoiceOver and iOS are explicitly deferred, and Mock Exam/results/history await their own design/approval slice.

Tracked verification docs need reconciliation with current evidence. Update docs/verification/content-reviewer.md, relevant README/content-workflow statements, plan Task 10 checkboxes and the ignored native report/ledger only after finishing the Android observations. Distinguish earlier automated checkpoint, completed broad/final-fix review, reviewed new stimulus fix, exact APK/JS heads, actual Android passes and outstanding iOS/gates/corpus checks. Run explicit doc formatting and whitespace checks and obtain a narrow independent review of the documentation checkpoint; do not order a redundant whole-branch review. Required both-platform acceptance is still unmet, so do not use finishing-a-development-branch or mark overall Task 10 complete now.

NEXT STEPS

First recover the isolated worktree and ledger, inventory existing services/device state and remove active diagnostic wrappers with an actual app force-stop before relying on clean ordinary UI. Restore original Android font scale 1.0. OS night no and Wi-Fi/mobile 1 are already restored; app preference Dark was restored through actual UI. Explicitly reload the development client on 8083, wait for settled Home/auth state, use actual Retry if necessary and resume saved Progress/Reviewer. Do not reinstall, clear data, recreate the session, reseed or restart services unless fresh inventory proves a need.

Run the following commands from a terminal in order for read-only recovery. The first cd is essential: product work belongs in the feature worktree, not main.

cd /Users/juliusjervinbundalian/Documents/GitHub/pnpe-exam-reviewer/.worktrees/content-reviewer
pwd
git status --short
git rev-parse HEAD
git worktree list
df -h .
cat .superpowers/sdd/2026-10-08-content-reviewer/native-acceptance-report.md
cat .superpowers/sdd/2026-10-08-content-reviewer/native-performance-diagnosis.md
tail -n 65 .superpowers/sdd/2026-10-08-content-reviewer/progress.md
lsof -nP -iTCP -sTCP:LISTEN
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb devices -l
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb reverse --list
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb shell settings get system font_scale
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb shell cmd uimode night
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb shell settings get global wifi_on
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb shell settings get global mobile_data
node evidence/content-reviewer/native/cdp-evaluate.mjs evidence/content-reviewer/native/cdp-stop-check.js.txt evidence/content-reviewer/native/resume-part4-wrapper-inventory.json

The final command captures only diagnostic-global type strings, not credentials or state. If the feature inspector is unavailable, do not treat that as an app failure or turn off its security checks; explicitly load the 8083 client and inspect again. The CDP helper supplies the installed inspector's required localhost Origin, which previously resolved an HTTP 401 without altering security settings.

After inventory and saving any wanted existing counter results, restore the font and remove the wrappers. These are authorized local acceptance cleanup actions, not a device reset. The app's scheme is pnpe. Preserve the installed APK and all app data.

/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb shell settings put system font_scale 1.0
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb shell am force-stop com.pnpe.exam.reviewer
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb reverse tcp:8083 tcp:8083
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb shell am start -a android.intent.action.VIEW -d 'pnpe://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8083' -p com.pnpe.exam.reviewer

Wait through actual Metro/auth/lazy-module loading and check settled screenshots, not the first splash/restored activity frame. Safe helper commands for ordinary UI observations and navigation are below. Each observation writes a PNG/XML in ignored evidence; tap labels must be chosen from current actual XML rather than assuming an old screen.

python3 evidence/content-reviewer/native/android-observe.py resume-part4-settled
python3 evidence/content-reviewer/native/ui-tap.py Progress
python3 evidence/content-reviewer/native/ui-tap.py Resume
python3 evidence/content-reviewer/native/android-observe.py resume-part4-reviewer
python3 evidence/content-reviewer/native/sql-snapshot.py resume-part4-durable
node evidence/content-reviewer/native/cdp-evaluate.mjs evidence/content-reviewer/native/cdp-stop-check.js.txt evidence/content-reviewer/native/resume-part4-clean-runtime.json

The SQL helper copies the existing device database plus WAL/SHM and analyzes only the copy read-only; it reports hashed IDs and bounded counts and reads isolated remote metadata with the same local emulator Admin bearer-owner convention used for seeding. It never mutates device SQL or the live demo. It captures files while the app is live, so treat snapshots as observational and verify quick_check and agreement rather than claiming a transactional backup. The UI helper scrolls to visible enabled labels and may take several attempts; inspect the current screen first. The ignored acceptance-accounts.json is the local A/B email/UID metadata fixture and contains no password/token. The known disposable emulator-only test sign-in credential is preserved separately at evidence/content-reviewer/native/acceptance-test-signin.txt with mode 0600. Use those two files locally to drive the actual sign-in forms without asking the owner for a test password; do not print their contents or copy credentials into reports. Neither fixture is committed, and no account reset was performed at handoff.

Next finish the interrupted enlarged-font observations if the latest captures are insufficient, then restore font 1.0, app Dark, OS night no and network 1/1 again. Capture math through an actual quantitative Reviewer route with normal confirmed replacement, preserving archived sessions; perform actual bookmark Remove/refresh and account switching with the disposable accounts. Coordinate any nonreset remote-client fixture writes strictly on 8180/9199 with unique UIDs and honest actual-client evidence. Do not use CDP to invoke session/bookmark/gate mutations directly. Only then consider the exact proposed public-cache benchmark, preserving startup/progressive/offline evidence before warming the cache.

The following service commands are CONDITIONAL recovery commands only. Do not run them if the existing services are healthy or their ports are occupied. The ignored run-native.py sets absolute owner Google paths, Java21, Android SDK, mode emulator, project demo-pnpe, ports 9199/8180 and Android host 10.0.2.2; it logs command/exit/duration. Use a new stage name so prior logs are not overwritten.

python3 evidence/content-reviewer/native/run-native.py android android-metro-part4 npx expo start --dev-client --host lan --port 8083

If and only if the acceptance emulators are gone and the isolated auxiliary ports are free, start a new isolated lifetime. Personal fixtures from a lost unexported lifetime will need reconstruction, but original native SQL must be preserved.

python3 evidence/content-reviewer/native/run-native.py android acceptance-services-part4 node_modules/.bin/firebase emulators:start --config firebase.study-tests.json --project demo-pnpe --only auth,firestore

After verifying that hub 4440 reports only Firestore 8180/Auth 9199, the existing seed script can recreate the approved official copy idempotently. It validates main approved publication against feature data/questions.json, requires exactly 529, checks explicit endpoints and applies a digest-confirmed manifest. It reads preserved main extraction artifacts through the existing ignored references link/location, and must never trigger regeneration. No seed is needed while the current healthy lifetime exists.

FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 ./node_modules/.bin/tsx evidence/content-reviewer/native/seed-acceptance.ts

This helper writes acceptance-manifest.json. Preserve earlier manifest/logs before a conditional reseed if necessary; create a fresh log label rather than overwriting historic evidence. Do not run against 8080 or change its hard guard. Recreating A/B accounts after a lost lifetime is separate isolated test setup; preserve native owner/device data and explain epoch/profile consequences.

A new Android native rebuild is NOT the next task. If a later native dependency/config change actually requires one and disk permits, reuse the existing project, owner files and caches rather than regenerating unnecessarily. The known working build command is below; use the helper only with a fresh log stage and only after verifying required space. No --port/--no-bundler combination.

python3 evidence/content-reviewer/native/run-native.py android android-build-part4 android/gradlew -p android :app:assembleDebug --build-cache --max-workers=2 --no-daemon -PreactNativeDevServerPort=8083 -PreactNativeArchitectures=arm64-v8a
/Users/juliusjervinbundalian/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk

Do not run npm install, dependency upgrades, pod install, iOS builds, gradle clean, git clean -fdx or cache deletion merely to resume. Do not kill services by broad process-name patterns. Preserve all raw evidence and generated Android output.

After the remaining Android observations, update the native report and tracked documentation checkpoint. For documentation-only changes, the exact fresh checks to run are below; do not rerun full test suites just because a new session began. For new runtime edits, use the relevant red/green test and fresh appropriate complete/crosscut checks. Current full lint globbing can see ignored .js diagnostic helpers; archive diagnostic source as .js.txt rather than adding a production lint ignore or suppressing errors.

npx prettier --check --ignore-path /dev/null README.md docs/content-workflow.md docs/verification/content-reviewer.md docs/superpowers/plans/2026-10-08-content-reviewer.md
git diff --check
git status --short

If a real runtime fix is made, these are the project's automated checks already known to work, not mandatory repeat work on unchanged HEAD.

npm run test:unit
npm run test:mobile
npm run typecheck
npm run lint
npm run format:check
npx expo install --check

The six new rules regressions can be rerun without resetting persistent native state only when a rules change requires them. They use unique UIDs and strict isolated endpoint guards.

PNPE_ISOLATED_TESTS=1 FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 ./node_modules/.bin/jest --config jest.integration.config.cjs --runInBand --runTestsByPath tests/firebase/opaque-stimulus-nonreset.integration.test.ts

DO NOT run the following destructive command while persistent acceptance is active. It is documented only so a later session knows the correct guarded command AFTER safely ending/exporting the acceptance lifetime and checking the endpoints.

JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' npm run test:emulator

The next independent review should be narrowly scoped to the new Android documentation checkpoint and any actual new bugfix diff, using its exact recorded base/head and report. The already completed whole-branch/final-fix/stimulus reviews are not unfinished work. Example package-generation command after a new documentation commit, replacing NEW_DOC_HEAD with its actual commit, is below.

bash /Users/juliusjervinbundalian/.codex/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/subagent-driven-development/scripts/review-package docs/superpowers/plans/2026-10-08-content-reviewer.md 7e66178d93a4a6a8fcc0966e22efff15f15771bb NEW_DOC_HEAD

Keep overall Task 10 open while iOS or required native gates/benchmark observations are outstanding. When the owner later resumes iOS, recheck disk and tool versions, use 127.0.0.1:9199/8180 with a free separate Metro 8084, inspect tracked diffs immediately after prebuild and build sequentially using ignored absolute owner Google config. Do not use stale historical builds as acceptance. Only after required acceptance and reviews are met should finishing/integration be considered; keep this worktree and evidence, and obtain separate authorization for merge/push/deploy. Then start the separately designed Mock Exam/results/history slice with its original quotas/deadline semantics rather than silently expanding this Reviewer plan.
