# Content and Reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated learners read the complete eligible category/subcategory bank, bookmark questions, and resume durable viewed progress through offline gaps.

**Architecture:** Validated native Firestore adapters discover immutable catalogs and fetch revisions progressively. SQLite repositories own cached content, owner/device sessions, bookmarks and an atomic outbox. Application services depend on ports; thin protected routes render accessible presentation state.

**Tech Stack:** Existing Expo 57.0.27, React Native 0.86.3, RNFirebase 26.4.0, TypeScript 6.0.3, Zod 4.6.5 and Jest 29.7.0. Add SDK-compatible expo-sqlite and expo-crypto for durable storage, content fingerprints and safe identifiers.

**Spec:** [Approved content/Reviewer design](../specs/2026-10-08-content-reviewer-design.md), all sections, preserving the [foundation design](../specs/2026-10-04-foundation-and-content-design.md).

**Status:** Prepared for owner review; execution method remains the established subagent implementation and independent review workflow. No product implementation or dependency installation has started.

## Global Constraints

- Reviewer includes every eligible question in its selected scope; no question cap, answer selection, submission, score, accuracy or mastery.
- Correct answer and supplied explanation appear immediately. Choices retain original order; question shuffle is frozen once.
- One active Reviewer session per account per device; replacement requires confirmation and durable new-session readiness.
- SQLite owns personal state and atomic pending operations. Normal guest Home never awaits study storage or question-bank retrieval.
- Support published text, marked spans and math. Exclude required image/diagram/table blocks until separate transport/asset/render acceptance.
- Cache fallback handles network gaps only; permission/authentication failures trigger recovery. All personal access derives from observed Auth UID/epoch.
- Preserve 529 approved questions, 145 deferred drafts, editorial evidence and original reference PDFs. No reimport, push, production write, deployment or store upload.
- Never run destructive integration tests against Firestore 8080 or Auth 9099. Dedicated test endpoints: 127.0.0.1:8180 and 127.0.0.1:9199.
- Mock Exam/results/history stay outside this slice; preserve defaults 150 questions, 180 minutes and quotas 35/40/25/50.

## Review Focus

1. Head churn and pagination failure must not activate a partial catalog — Task 4.
2. Force-close between local commit and remote acknowledgement must not lose or duplicate work — Tasks 3 and 8.
3. Rapid navigation, backgrounding and delayed renders must not mark the wrong question viewed — Tasks 5 and 6.
4. Account switching during retrieval, a transaction or sync acknowledgement must never expose or mutate another owner's records — Tasks 5, 8 and 9.
5. Long passages, overlapping marks, Unicode and large text must preserve reading meaning and reachable actions — Tasks 2 and 6.

## File responsibilities and dependencies

| Location                                                                                                      | Responsibility                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `tests/fixtures/integrationEnvironment.ts`, `firebase.study-tests.json`, `tools/tests/run-study-emulators.ts` | Fail-closed isolated emulator runner shared by existing/new integration suites |
| `src/features/content/domain/catalog.ts`, `ContentRepository.ts`, `eligibility.ts`, `revisionValidation.ts`   | Mobile-safe external contracts and eligibility                                 |
| `src/core/random/RandomSource.ts`, `src/core/identity/IdentitySource.ts`, `src/core/content/Fingerprint.ts`   | Injected randomness, IDs and fingerprints                                      |
| `src/core/storage/sqlite/SqlDatabase.ts`, `nativeSqlDatabase.ts`, `studyMigrations.ts`                        | Serialized SQL connection, native facade and migrations                        |
| `src/features/study/domain/study.ts`, `StudyRepository.ts`, `StudySyncRemote.ts`                              | Session/bookmark/outbox contracts and DTOs                                     |
| `src/features/study/data/SqliteStudyRepository.ts`, `FirebaseStudySyncRemote.ts`                              | Local transactions and validated cloud transport                               |
| `src/features/content/data/FirebaseContentRemote.ts`, `SqliteContentCache.ts`, `CachedContentRepository.ts`   | Remote catalog/revisions, cache and retrieval policy                           |
| `src/features/reviewer/application/ReviewerService.ts`, `ReviewerController.ts`                               | Frozen sessions, foreground render receipts and UI state                       |
| `src/features/content/presentation/ContentBlocks.tsx`, `QuestionReadingView.tsx`                              | Accessible complete content rendering                                          |
| `src/features/reviewer/presentation/ReviewerScreen.tsx`, `ProgressScreen.tsx`                                 | Read-through and viewed progress flows                                         |
| `src/features/bookmarks/application/BookmarkService.ts`, `presentation/BookmarksScreen.tsx`                   | Pinned bookmark listing/toggle/open                                            |
| `src/features/study/application/StudySyncWorker.ts`                                                           | Owner-bound ordered retries and acknowledgement                                |
| `src/bootstrap/studyComposition.ts`, existing providers/navigation                                            | Lazy dependency wiring and protected route integration                         |

Implement tasks in order. Each task runs red/green tests, typechecks, commits explicit paths and receives independent spec/quality review before its dependents start. Tests may use shared fixtures from Task 2; fixtures must never enter the real bank.

## Shared contracts

Define these names in Task 2; later tasks consume them rather than inventing replacements:

- `OwnerContext = { uid: string; deviceId: string; epoch: number }`.
- `StudyScope = { categoryId: CategoryId; subcategoryId?: SubcategoryId }`.
- `QuestionRef = { id: string; version: number }`; `ManifestItem = { ordinal: number; entry: CatalogEntry }`.
- `CatalogSnapshot = { generation: string; revision: number; validatedAt: number; entries: readonly CatalogEntry[] }`.
- `ReviewerSession = { id: string; uid: string; deviceId: string; scope: StudyScope; generation: string; createdAt: number; shuffleQuestions: boolean; items: readonly ManifestItem[]; position: number; viewedOrdinals: readonly number[]; sequence: number; status: 'active' | 'completed' | 'archived' }`.
- `Bookmark = { uid: string; questionId: string; entry: CatalogEntry; createdAt: number; updatedAt: number; deleted: boolean; serverRevision: number }`.
- `StudyOperation` is a strict discriminated union: `publishSession` carries frozen manifest/config, `sessionState` carries sequence/position/status/viewed ordinals, `bookmarkState` carries desired pinned entry/deleted flag/base server revision. All have `id`, `uid`, `deviceId`, `recordId`, `localSequence`, `createdAt`, `attempts`, `nextAttemptAt`.
- `StudyError` codes: `auth-required`, `permission-denied`, `network`, `invalid-content`, `empty-scope`, `storage-unavailable`, `storage-corrupt`, `conflict`. User messages are fixed plain language; SDK errors never surface verbatim.

Cloud transport timestamps are mapped separately from local numeric times. Schemas enforce safe IDs, finite safe integers, valid taxonomy, bounded strings/payloads and immutable identity. Generations/revision fingerprints are not proof of owner editorial approval.

## Task 1: Isolate every destructive integration test

**Files:** Create `tests/fixtures/integrationEnvironment.ts`, `tests/application/integration-environment.test.ts`, `firebase.study-tests.json`, `tools/tests/run-study-emulators.ts`. Modify `tests/firebase/rules.integration.test.ts`, `tests/import/firestore.integration.test.ts`, `package.json` and `tsconfig.tools.json` if needed for the runner.

**Interfaces:** `integrationEnvironment(env: NodeJS.ProcessEnv): { projectId: 'demo-pnpe'; firestoreHost: '127.0.0.1'; firestorePort: 8180; authPort: 9199 }`. Runner supplies an explicit isolation acknowledgement plus both emulator endpoints; helper rejects absent/mismatching endpoints before rules initialization or any clear request. Existing import CLI contract requires `demo-pnpe`; isolate by ports, not a changed CLI target.

Required regression assertion:

```ts
expect(() =>
  integrationEnvironment({
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199',
    PNPE_ISOLATED_TESTS: '1',
  }),
).toThrow();
```

- [ ] Write `rejects_live_and_missing_endpoints` and `accepts_only_explicit_isolated_endpoints`: assert undefined endpoint, 8080, 9099, remote host and missing acknowledgement throw; exact test endpoints succeed.
- [ ] Run `npm run test:unit -- --runTestsByPath tests/application/integration-environment.test.ts`; expect failure before helper exists.
- [ ] Implement helper and runner. Dedicated config copies current rules/index paths and uses 8180/9199, disabled UI, separate hub/logging ports. Runner checks ports are free, invokes local firebase executable with `--config firebase.study-tests.json --project demo-pnpe`, and sets explicit env for Jest. Change `test:emulator` to the guarded runner and add `test:study-emulator` as its alias. Route every existing suite's initialization/clear URL through the helper; no fallback to default ports.
- [ ] Run helper tests, then guarded `npm run test:emulator` with process-local Java 21. Assert existing rules/import integration tests pass; inspect live revision-2 head read-only before/after, without resetting services. Store command outputs under ignored `evidence/content-reviewer/task1/`.
- [ ] Commit explicit runner/config/test changes as `test: isolate destructive Firebase integration suites`.

## Task 2: Content and personal domain contracts

**Files:** Create catalog/eligibility/revision-validation and shared ports listed above; `src/features/study/domain/study.ts`, `StudyRepository.ts`, `StudySyncRemote.ts`; `tests/fixtures/study.ts`, `tests/content/mobile-catalog.test.ts`, `tests/content/revision-validation.test.ts`, `tests/application/study-contracts.test.ts`. Extend import-boundary tests to cover these new layers.

**Interfaces:** `eligibleEntries(entries: readonly CatalogEntry[], scope: StudyScope, now: number): readonly CatalogEntry[]`; `validateRevision(raw: unknown, entry: CatalogEntry): Question`; `RandomSource.next(): number` in [0,1); `IdentitySource.nextId(): string`; `Fingerprint.digest(value: unknown): Promise<string>` over deterministic canonical JSON.

- [ ] Write contract tests asserting mobile/tool catalog parity, invalid IDs/taxonomy/current-event metadata rejection, duplicate IDs, incompatible kinds and expiry-at-now exclusion. Use synthetic validated question/entry fixtures with a shared passage, marked grammar and math; retain exact UTF-16 mark offsets for Unicode.
- [ ] Write revision tests asserting ID/version/stimulus/assets/kinds/validity mismatch rejection, and strict personal-schema tests for unknown fields, invalid positions/sequences and duplicate ordinals.
- [ ] Run `npm run test:unit -- --runTestsByPath tests/content/mobile-catalog.test.ts tests/content/revision-validation.test.ts tests/application/study-contracts.test.ts`; expect absent-module failures.
- [ ] Implement mobile-safe schemas, entry comparison and capability eligibility. Define `ContentRepository.catalog(owner): Promise<CatalogSnapshot>` and `question(owner, entry): Promise<Question>`; `ContentCache` reads/writes complete catalog snapshots and immutable revisions. Define `StudyRepository.active(owner)`, `session(owner,id)`, `replaceActive(owner,session)`, `recordView(owner,id,ordinal)`, `move(owner,id,ordinal)`, `listBookmarks(owner)`, `setBookmark(owner,entry,deleted)`, `pending(owner,now)`, `acknowledge(owner,operationId,remoteRevision?)`, `retry(owner,operationId,nextAttemptAt)`, each returning a Promise of its named record(s) or void. No UI/native imports.
- [ ] Define `StudySyncRemote.publishSession(owner,session,operationId)`, `writeSessionState(owner,session,operationId)`, `writeBookmark(owner,bookmark,operationId,baseRevision)` returning `{ revision: number; appliedOperationId: string }`, and `listBookmarks(owner)`; conflicts return a typed error carrying validated remote bookmark state. Pass owner explicitly everywhere.
- [ ] Run all new suites and both typechecks, including mobile/tool import-boundary tests; commit as `feat: define validated content and study contracts`.

Port signatures fixed for repository implementers:

```ts
interface ContentCache {
  catalog(): Promise<CatalogSnapshot | null>;
  saveCatalog(snapshot: CatalogSnapshot): Promise<void>;
  question(ref: QuestionRef): Promise<Question | null>;
  saveQuestion(entry: CatalogEntry, question: Question): Promise<void>;
}
interface StudyRepository {
  active(owner: OwnerContext): Promise<ReviewerSession | null>;
  session(owner: OwnerContext, id: string): Promise<ReviewerSession | null>;
  replaceActive(owner: OwnerContext, session: ReviewerSession): Promise<void>;
  recordView(owner: OwnerContext, id: string, ordinal: number): Promise<ReviewerSession>;
  move(owner: OwnerContext, id: string, ordinal: number): Promise<ReviewerSession>;
  listBookmarks(owner: OwnerContext): Promise<readonly Bookmark[]>;
  setBookmark(owner: OwnerContext, entry: CatalogEntry, deleted: boolean): Promise<Bookmark>;
  mergeRemoteBookmark(owner: OwnerContext, bookmark: Bookmark): Promise<void>;
  pending(owner: OwnerContext, now: number): Promise<readonly StudyOperation[]>;
  acknowledge(owner: OwnerContext, operationId: string, remoteRevision?: number): Promise<void>;
  retry(owner: OwnerContext, operationId: string, nextAttemptAt: number): Promise<void>;
}
```

`listBookmarks` includes tombstones for synchronization; presentation filters
deleted rows. `mergeRemoteBookmark` never overwrites a pending local desired
state. `ContentCache` validates/fingerprints on each read and rejects immutable
conflicts; its adapter exposes `evictUnreferenced(): Promise<void>` for Task 3.
Define `OwnerGuard.isCurrent(owner: OwnerContext): boolean` and check it before
local commit as well as after asynchronous work. Epochs are ephemeral guards,
not stable database keys. Task 2's `StudySyncRemote` uses Promise return types:
session publication/state methods return void; bookmark writes return the stated
acknowledgement; bookmark listing returns `readonly Bookmark[]`.

## Task 3: SQLite transactions, repositories and recovery

**Files:** Create SQL facade/migrations/local repositories listed above, `src/core/content/nativeFingerprint.ts`, `tests/fixtures/nodeSqlDatabase.ts`, `tests/application/study-sqlite.test.ts`, `tests/application/content-cache.test.ts`; modify package manifest/lockfile and ESLint infrastructure boundaries if needed.

**Interfaces:** `SqlDatabase.run(sql, params): Promise<{ changes: number }>`; `all(sql, params): Promise<readonly Record<string, unknown>[]>`; `exclusive<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T>`; `close(): Promise<void>`. `SqlValue = string | number | null`; all data is bound. Implement Task 2 repository/cache ports with this facade, injected clock, identity and fingerprint.

Required test `committed_view_survives_reopen_before_ack` asserts
`expect((await reopened.session(alice, saved.id))?.viewedOrdinals).toEqual([0])`
and `expect(await reopened.pending(alice, clock.now())).toHaveLength(2)` after
publishing a session and recording its first view without acknowledgements.
`failed_outbox_insert_rolls_back_view` asserts unchanged view membership and
operation count after an injected SQL error.

- [ ] Write real SQL tests using Node 24 `node:sqlite` behind a test-only facade: close/reopen retains session/order/viewed/bookmark/outbox; forced statement failure rolls back both mutation and outbox; repeated viewed ordinal increments once; replacement archives prior session atomically; Alice/Bob rows stay isolated. Migration failure/future schema version preserves the file and reports storage recovery.
- [ ] Write immutable cache tests for incomplete catalog rejection, payload/fingerprint corruption, conflicting existing revisions and cache eviction preserving active/bookmarked references and all pending operations.
- [ ] Run those suites; expect missing implementations.
- [ ] Install compatible packages in the isolated worktree with its own dependency directory, replacing the borrowed `node_modules` symlink first so the main checkout is not changed. The inspected Expo bundle recommends `expo-sqlite ~57.0.4` and `expo-crypto ~57.0.3`; resolve exact patch versions through Expo install and lock them, without peer bypasses. Validate with `npx expo install --check`. SDK references: [SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) and [Crypto](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/).
- [ ] Implement serialized native exclusive transactions, foreign keys and migration version checks. Tables: `catalogs`, `catalog_items`, `question_revisions`, `device_identity`, `reviewer_sessions`, `reviewer_items`, `reviewer_views`, `bookmarks`, `study_outbox`; UID/device participate in personal keys. Keep question payloads separate. Record desired state + operation in the same transaction, monotonically sequence mutations, retain tombstones. Parse every stored JSON/row before use. Fingerprint via native SHA-256; test fixture uses Node crypto only.
- [ ] Run new SQL/cache suites, unit tests, typechecks and dependency validation. Native SQLite behavior is additionally checked in Task 10; Node SQL tests alone do not prove native acceptance. Commit as `feat: persist study state and content in SQLite`.

## Task 4: Native catalog discovery and cached retrieval

**Files:** Create remote/cache-coordination adapters listed above plus `nativeContentFacade.ts`; `tests/application/content-repository.test.ts`, `tests/application/content-remote.test.ts`.

**Interfaces:** `ContentRemote.readHead(): Promise<{ generation: string; revision: number }>`; `listShards(generation, afterId: string | null, limit: number): Promise<readonly { id: string; entries: unknown }[]>`; `revision(ref: QuestionRef): Promise<unknown>`. `CachedContentRepository` implements Task 2 `ContentRepository` with remote/cache/clock and owner-epoch guard.

Required test `permission_denial_does_not_use_cache` uses a seeded valid cache,
a remote permission error and
`await expect(repository.catalog(alice)).rejects.toMatchObject({ code: 'permission-denied' })`.
`partial_catalog_is_never_saved` asserts `expect(cache.saveCatalog).not.toHaveBeenCalled()`
when the final page fails.

- [ ] Write tests for multi-page discovery, exact-page-size terminal pagination, duplicate IDs, nonascending cursor, malformed shard, interrupted last page, 700-KiB payload bound, changed head and server permission denial. Assert no cache publish on partial failure, no mixed generations, and at most three discovery attempts on head churn.
- [ ] Write tests proving complete offline catalog fallback with its validation time, no permission fallback, fetched revision/entry agreement, fingerprint validation and stale owner result rejection.
- [ ] Run focused suites; expect failure before adapters exist.
- [ ] Implement server-source native reads with document-ID ordering, page size 50 and validated generation/shard paths. Read head before/after full pagination; save only a complete snapshot. Separate known network errors from permission/auth/content errors. Fetch and validate individual revisions; do not query whole question collections or import tooling.
- [ ] Run focused tests, typechecks and import boundaries; commit as `feat: load validated catalogs and revisions progressively`.

## Task 5: Reviewer session lifecycle and controller

**Files:** Create Reviewer application service/controller listed above; `tests/application/reviewer-service.test.ts`, `reviewer-controller.test.ts`.

**Interfaces:** `ReviewerService.prepare(owner,scope,shuffleQuestions): Promise<{ kind: 'ready'; session: ReviewerSession } | { kind: 'existing'; session: ReviewerSession }>`; `replace(owner,scope,shuffleQuestions): Promise<ReviewerSession>`; `resume(owner,id): Promise<ReviewerSession>`. `ReviewerController` exposes `subscribe(listener)`, `snapshot()`, `open(owner,id)`, `move(ordinal)`, `rendered(receipt)`, `retry()`, `dispose()`. Receipt carries session ID, ordinal and page-load token; controller consumes explicit foreground/focus state.

Required test `reviewer_has_no_count_cap`:

```ts
const result = await service.prepare(alice, { categoryId: 'communicationSkills' }, false);
expect(result.kind).toBe('ready');
expect(result.session.items).toHaveLength(276);
expect(result.session.viewedOrdinals).toEqual([]);
```

Its fixture supplies 276 distinct active supported entries in this scope.
`ReviewerController.move` and `rendered` return `Promise<void>`; `open` and
`retry` return `Promise<void>`, `subscribe` returns an unsubscribe function,
`setVisibility(focused: boolean, foreground: boolean): void` records UI context.
`snapshot(): ReviewerState` returns a discriminated union for the six states
specified below, always including session identity/current ordinal when loaded.
`RenderedReceipt = { sessionId: string; ordinal: number; pageToken: string }`.
`prepare` returning `existing` never replaces state; replacement always enters
through the explicitly confirmed `replace` action.

- [ ] Write tests asserting all 276 synthetic eligible category entries survive without a cap, subcategory filtering, stable original choice order, one-time Fisher-Yates shuffle, empty-scope error and idempotent repeated start. Use deterministic clock/random/ID ports.
- [ ] Write lifecycle tests proving same/different scope returns existing session, cancellation does not archive, failed first-page/replacement commit preserves old session, resume freezes old revisions after catalog/expiry changes, completion occurs only after all viewed ordinals.
- [ ] Write controller tests for rapid next/previous with out-of-order fetch completion, delayed receipt for the previous page, background/prefetch receipt exclusion, failed durable move and account-epoch change during mutation. Assert missing offline page preserves position and manifest count.
- [ ] Run focused suites; expect missing-service/controller failures.
- [ ] Implement owner-bound serialized lifecycle mutations and stale-result guards; first validated question + full manifest must be durably ready before activation/replacement. Prefetch at most two subsequent pages, without recording views. Expose loading/reading/missing/error/completed state with retry and storage failure messages; keep lifecycle state in the repository.
- [ ] Run focused tests and typechecks; commit as `feat: implement durable read-through reviewer sessions`.

## Task 6: Complete question rendering and Reviewer UI

**Files:** Create content/Reviewer presentation files listed above, `tests/mobile/content-rendering.test.tsx`, `reviewer.test.tsx`. Reuse semantic theme/components and protected navigation primitives.

**Interfaces:** `ContentBlocks({ blocks, onReady, onError })`; `QuestionReadingView({ question, onReady, onError })`; `ReviewerScreen({ controller, onBack, onBookmark, bookmarked })`. Ready callbacks fire only after complete supported content layout; foreground/focus receipts go through Task 5.

Required test `answer_is_visible_without_interaction` asserts
`expect(screen.getByText('Correct answer')).toBeOnTheScreen()` and
`expect(screen.queryByText('Submit Answer')).toBeNull()` immediately after rendering
the fixture. `unsupported_stimulus_never_reports_ready` asserts
`expect(onReady).not.toHaveBeenCalled()` after layout. Accessibility tests assert
the grammar target and math `accessibleText` are present in accessible labels.

- [ ] Write rendering tests with shared passage before prompt, all choices in original order, immediately labeled correct answer, optional explanation, overlapping grammar marks, surrogate-pair offsets, multiline math and accessible text. Unsupported required block must produce a visible error with no ready callback. Correctness color always has text/semantic labels.
- [ ] Write UI tests for Previous/Next bounds, item/viewed counts, no selectable answer or submission/score controls, offline missing page, durable-save failure, completion and cached-content refresh date. Large-font long passages must retain scrollable controls; test both semantic themes and focus/background changes.
- [ ] Run `npm run test:mobile -- --runTestsByPath tests/mobile/content-rendering.test.tsx tests/mobile/reviewer.test.tsx`; expect failure before components exist.
- [ ] Implement safe segmented text rendering using the union of mark boundaries (never duplicate overlapping text); render exact math expressions with supplied accessible descriptions, no HTML/WebView execution. Capture successful complete layout and current page token; no view event from hidden/prefetched renders. Show time context for saved historical current-event revisions.
- [ ] Run mobile suites/typecheck/lint; commit as `feat: render accessible reviewer questions and reading navigation`.

## Task 7: Bookmarks and viewed-progress screens

**Files:** Create bookmark service/screens and `ProgressScreen.tsx`; `tests/application/bookmarks.test.ts`, `tests/mobile/bookmarks.test.tsx`, `progress.test.tsx`.

**Interfaces:** `BookmarkService.list(owner): Promise<readonly Bookmark[]>`; `toggle(owner,entry): Promise<Bookmark>`; `open(owner,questionId): Promise<Question>`. `BookmarksScreen` receives service/owner/onBack; `ProgressScreen` receives active session and resume callback. Bookmark reading uses Task 6's question view without Reviewer render receipts.

Required test `opening_bookmark_does_not_change_reviewer` seeds a bookmarked
question and asserts `expect(await study.active(alice)).toEqual(before)` and
`expect(await study.pending(alice, clock.now())).toEqual(beforePending)` after
`await bookmarks.open(alice, entry.id)`. `list` filters tombstones; `toggle`
consults the unfiltered repository rows to support restoration after removal.

- [ ] Write tests for persisted pin, tombstone removal, rapid toggle ordering, failed transaction rollback, newer catalog not replacing pin, missing uncached page preserving bookmark and cross-owner access rejection.
- [ ] Write mobile tests for list/open/remove/retry, historical time context, missing explanation, empty bookmarks, viewed-only progress and Resume. Assert opening a bookmark never creates a session or records views; feature-disabled records remain accessible while new mutations are disabled.
- [ ] Run focused unit/mobile suites; expect absent-service/screens failures.
- [ ] Implement local-first service and screens; show pending state only from durable outbox, preserve bookmarks during missing content and expose actionable storage/network errors. Progress uses actual session state and never fabricates statistics.
- [ ] Run focused suites/typechecks; commit as `feat: add pinned bookmarks and viewed progress`.

## Task 8: Owner-bound synchronization and cloud DTOs

**Files:** Create study sync worker/remote adapter listed above plus `nativeStudySyncFacade.ts`, `cloudStudySchemas.ts`; `tests/application/study-sync.test.ts`, `study-remote.test.ts`.

**Interfaces:** `StudySyncWorker.start(owner)`, `wake()`, `stop()`, `subscribe(listener)`; inject repository, remote, clock and owner-epoch checker. Define strict cloud DTOs shared with Task 9 tests. Manifest chunk size 100 entries; max canonical document size 64 KiB (flush earlier as needed), string IDs at most 128 ASCII characters. Session root stores manifest chunk count, item count, device/scope/config, generation, sequence/position/status and ready flag; item documents carry ordinal + entry metadata, never full prompts/keys.

Required test `late_ack_does_not_touch_next_owner` resolves Alice's deferred remote
call after switching the guard to Bob, then asserts
`expect(await study.pending(alice, clock.now())).toEqual(alicePending)` and
`expect(await study.pending(bob, clock.now())).toEqual(bobPending)`.
`replayed_bookmark_operation_keeps_revision` retries the same operation ID and
asserts equal first/second remote revisions. `start`, `wake`, `stop` return void;
`subscribe` returns unsubscribe. Worker status includes pending count and a typed
recovery state; expose `flush(): Promise<void>` for deterministic tests and manual
retry, without allowing concurrent flushes.

- [ ] Write tests for restart after successful upload/before local ack, retry duplicate operation, out-of-order sequence, partial manifest, tombstone re-download, simultaneous bookmark CAS conflicts and rebase. Assert conflict retries bounded at three per wake, then remain pending.
- [ ] Write auth-race tests for switching account during remote transaction/acknowledgement and late listener callbacks. Assert stale owner cannot upload using new credentials or acknowledge another owner's operation; permission failures pause with recovery, network retries preserve local actions.
- [ ] Run focused suites; expect missing-worker/remote failures.
- [ ] Implement root preparing -> bounded immutable chunk uploads -> ready publication. Session state transactions compare sequence and ignore stale duplicates; viewed item membership uses stable ordinal documents. Bookmark transactions compare server revision/operation ID; conflicts validate/rebase desired state without dropping newer local operations. Poll/download cloud bookmarks on authenticated startup and successful wake, merge only into rows without newer pending local mutations. Persist retry counts and use exponential 1-second to 60-second backoff; wake on foreground/manual retry. No wall-clock conflict ordering.
- [ ] Implement worker serialization by record, owner rechecks before every call and acknowledgement, and pending/error status subscription. Detach timers/listeners on stop; repository acknowledgement verifies operation identity and current desired-state sequence.
- [ ] Run focused suites/typechecks; commit as `feat: synchronize durable study operations safely`.

## Task 9: Rules and protected application integration

**Files:** Modify `firebase/firestore.rules`, `src/bootstrap/composition.ts`, `AppProviders.tsx`, `src/navigation/ReviewerRoute.tsx`, `PersonalRoute.tsx`, `destinations.ts`, auth intents only if needed; create `src/bootstrap/studyComposition.ts`, `tests/firebase/study-rules.integration.test.ts`, `tests/mobile/study-navigation.test.tsx`; extend existing composition/navigation tests and fixtures.

**Interfaces:** `composeStudyDependencies(nativeServices, authOwnerSource): Promise<{ content; reviewer; bookmarks; sync; dispose }>` is lazy/recovery-aware. Auth source provides observed UID/epoch, not router params. Preserve existing `startReviewer` intent and compatibility for `stage=availability`, routing it to real study start after gates. Session/open-bookmark params must be validated against owner repository records.

- [ ] Write rules tests for owner create/read/update/query, cross-owner/guest denial, unknown fields, malformed chunk size/ordinal, changed immutable identity/config, ready marker with invalid root fields, sequence regressions, bookmark revision/tombstone transitions and official-content write denial. Rules cannot attest native device identity or full catalog completeness; prove enforceable bounded DTO/transition constraints and leave application validation explicit. Task 8 separately proves that the uploader never publishes ready before all chunks succeed.
- [ ] Write mobile tests for public Home with never-resolving storage/native services; guest overview/auth prompt/intended return; same-scope resume and replace confirmation; deep-link ownership; maintenance/minimum-version gates versus saved-work access; account switch during loading; feature flag toggles preserving work.
- [ ] Run mobile tests (red), then rules suites only through Task 1 guarded runner (red for new allowed paths).
- [ ] Implement exact personal-path rules without recursive wildcard, bounded fields and server timestamps. Ready publication requires each declared bounded chunk to have been uploaded by application protocol; do not claim rules can iterate arbitrary chunk counts. Deny updates to immutable chunks; restrict session-root immutable fields and monotonic sequence. Expose authenticated study dependencies lazily, cancel/dispose on auth loss, and replace only Reviewer/bookmarks/progress placeholders. Preserve Mock Exam/history availability routes.
- [ ] Run guarded rules/import suites, mobile tests, typechecks and lint; read live catalog head again. Commit as `feat: connect protected reviewer flows and owner-only study rules`.

## Task 10: Full verification and native acceptance

**Files:** Update `README.md`, `docs/content-workflow.md`; create `docs/verification/content-reviewer.md` and ignored `evidence/content-reviewer/`; update task execution ledger and this plan's checkboxes.

**Interfaces:** No new runtime interfaces. Whole-branch independent reviewer reads approved spec, plan, code and evidence; unresolved findings return to their owning implementer before completion.

- [x] Run `npm run test:unit`, `npm run test:mobile`, `npm run typecheck`, `npm run lint`, `npm run format:check`, new document explicit Prettier checks, `npx expo install --check`, and guarded `npm run test:emulator`. No editorial extraction/regeneration is needed. Hash tracked content bank/editorial files against branch base to prove unchanged.
- [ ] Rebuild development binaries with the new native dependencies in the feature worktree. Use a separate Metro port from live 8081/8082; preserve credentials/native config outside tracked files. Run on Android and iOS: actual authenticated catalog reading, marked passage/math rendering, SQLite persistence after force-close, full category inclusion, missing offline page with stable position, bookmark retry/sync and account switching. Record exact platforms/build IDs and observations; unavailable checks remain explicitly outstanding.
- [ ] Verify root cache/startup recovery, long text at enlarged font scale, dark/light/system appearance, accessible focus and disabled feature/maintenance recovery. No whole-bank load on public launch; measure catalog versus progressively loaded question requests.
- [ ] Obtain whole-branch independent review; fix findings with focused red/green checks and review again where changed. Document remaining material limitations and native acceptance evidence rather than claiming inferred passes.
- [ ] Commit docs/evidence references as `docs: record content reviewer verification`. Follow finishing workflow only after required acceptance is met; preserve worktree/evidence and do not push/deploy. Mock Exam is the next separately designed slice.

Task 10 checkpoint (2026-10-09): fresh unit 554, mobile 223 and isolated emulator
72 tests pass; static, online Expo dependency and explicit document-format checks
pass. All 33 tracked content/editorial/publication-evidence files and three
original PDF hashes are preserved; live catalog head matches the Task 1 snapshot.
Native builds/acceptance remain blocked by repeated approximately 1.0 GiB free
disk inventory and controller resource ruling. No feature binary, device
observations, corpus insertion timings or cap-2 upload latency were produced.
Documentation is committed separately; finishing/integration and whole-branch
independent review remain open. See
[the verification record](../../verification/content-reviewer.md) and ignored
`evidence/content-reviewer/task10/` for evidence and outstanding checks.

## Plan self-review

Spec coverage: retrieval/capability checks (Tasks 2/4), durability and isolation
(Tasks 3/5/8), lifecycle/viewed semantics (Tasks 5/6), bookmarks/progress (Task 7),
sync/rules (Tasks 8/9), composition/acceptance (Tasks 9/10). Shared interfaces are
defined before consumers; review-focus cases have tests in their owning tasks.
Current remote schema lacks approval digests, native device identity is not a
server trust primitive, and arbitrary complete manifests cannot be proven by
rules alone: the plan retains these limits without claiming stronger guarantees.

The plan is ready for owner review. Implementation starts after that review,
using the previously requested subagent and independent-review method.
