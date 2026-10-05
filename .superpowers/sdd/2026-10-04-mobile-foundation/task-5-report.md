# Task 5 implementation report

## Implementation and files

- `src/features/auth/application/intents.ts`: strict Zod action/origin/cache schemas, exported discriminated unions, exact 30-minute expiry, `requiresOwner` type guard. Cache envelope is `{version: 1, intent}`. Unknown keys/actions, malformed IDs, inconsistent taxonomy pairs, invalid lifetimes, and future-created cached intents are rejected.
- `src/features/auth/application/AuthenticationCoordinator.ts`: domain-only dependencies, serialized transitions, separately ordered storage operations with a 1.5-second UI wait bound, immediate auth-generation and intent-revision invalidation, restoration, cancellation, voluntary auth origins, form selection, storage recovery/retry, and single callback consumption using the persisted operation ID.
- `src/navigation/routePolicy.ts`: pure `resolveIntent(intent, user, now)` returns a closed resume/return decision. No SDK or route-library dependency. Owner mismatch returns Home; expiry returns the original public origin.
- `tests/fixtures/auth-harness.ts`: typed fake repository, controllable clock, deferred operations, real in-memory store behavior, recorded handler calls.
- `tests/application/auth-coordinator.test.ts`: 36 behavioral cases, including failures, restoration, malformed external values, rapid taps, cancellation during hung storage, late-write cleanup, account changes through recovery, and startup ordering.

## Contract integration for Tasks 6 and 8

Construct `new AuthenticationCoordinator(repository, store, clock, {resume, returnTo})`. Task 8 owns the single app-lifetime instance, subscribes with `subscribe(listener)` / stable `getSnapshot`, calls `dispose()` on teardown, and maps the closed callback values to actual destinations. Normal launch without an explicit or restored pending request performs no navigation and opens no authentication form.

`CoordinatorState` contains `auth: AuthState`, `promptOpen`, `screen: 'none' | 'signIn' | 'registration' | 'passwordReset'`, `pendingIntent`, `origin`, `persistence: 'none' | 'saving' | 'saved' | 'memoryOnly'`, `recoveryMessage`, and `busy`. Consumers must treat snapshots as read-only. The resolving/recovery auth state must show wait/retry/cancel, never a guest/login fallback. `busy` identifies consumption; persistence `saving` identifies the storage phase.

Protected entry is `requireAuthentication(action, origin): Promise<void>`. Rapid calls retain the first operation/origin. `chooseSignIn()`, `chooseRegistration()`, and `choosePasswordReset()` select forms while preserving the operation. Repository sign-in/register/reset methods remain the form application's responsibility; unsuccessful attempts produce no auth-state transition and retain the intent. Explicit exit / Maybe Later calls `cancel(): Promise<void>`; origin return and in-memory invalidation happen synchronously before storage cleanup settles.

Voluntary Menu entry uses `beginSignIn({type: 'menu'})` or `beginRegistration({type: 'menu'})`, with no protected intent. If auth is resolving, the explicitly requested form waits for guest resolution. `retry(): Promise<void>` retries restoration, pending persistence, removal, or repository observation as applicable. `signOut(): Promise<void>` invalidates callbacks immediately and calls the repository independently of blocked storage. A failed sign-out leaves a visible recovery state.

Approved closed origins: home, mockOverview, reviewerOverview (optional valid category and subcategory; subcategory requires category), menu, appearance, about, privacyPolicy, terms. Actions: startReviewer (required valid category, optional paired subcategory), startMockExam, openProgress, openBookmarks, openHistory, openProfile, openAttempt (attemptId plus requiredOwnerUid), setBookmark (questionId plus saved). No raw URL or persisted callback is accepted. `resolveIntent` is a policy boundary, not an Expo routing implementation.

## Behavioral RED / GREEN evidence

All focused commands were `npm run test:unit -- tests/application/auth-coordinator.test.ts`.

1. Initial runnable skeleton RED: 5 failed / 5 total. Representative actual output: `Expected: true; Received: false` for Maybe Later prompt; stable ID was `undefined`; selected forms remained `none`. Implemented core transitions: GREEN 5 passed.
2. Safety RED: 21 failed / 26 total, 5 passed. Invalid actions/origins resolved rather than rejected; corrupt cache remained; restoration callback absent; expired intent resumed; logout/dispose/account changes resumed stale callbacks; hung-storage cancel had not returned the origin. First implementation iteration: 25 passed / 1 failed (recovery message incorrectly cleared). Fixed recovery state handling: GREEN 26 passed and both strict typechecks passed.
3. Self-review RED: 4 failed / 34 total, 30 passed. Authenticated startup left one replayable cache entry; cancel retry left durable entry; memory-only retry did not save; voluntary registration during resolution stayed `none`. Fixed sequencing and retries: GREEN 34 passed.
4. Account recovery regression RED: 1 failed / 36 total, 35 passed. Actual stale resume used `user-b` after `user-a → recoveryRequired → user-b`. Retained known UID across recovery/resolving states: GREEN 36 passed / 36 total.

## Self-review and limits

- No `any`, credentials, arbitrary URLs, native SDK imports, session/attempt creation, exam engine, deployment, or remote operations were added.
- Stable operation IDs are delivered once after durable removal succeeds. Handler rejection is visible and does not replay the consumed operation or poison the next transition. This is callback consumption, not a claim of atomic exactly-once downstream effects across process crashes; future session/attempt handlers must implement idempotency using the supplied ID.
- A permanently unavailable store cannot guarantee durable deletion. Cancellation remains usable immediately, reports storage recovery, and offers retry; queued removals run after late writes eventually finish. An interrupted app cannot guarantee clearing an inaccessible device cache. No timeout ever declares a durable write successful.
- Already-invoked downstream callbacks cannot be revoked; generation checks prevent stale callbacks from starting after cancellation/logout/account changes become known. Task 8 handlers must honor their own lifecycle for work they start.
- Skills used: official Superpowers 6.4.1 using-superpowers (subagent exemption), test-driven-development including writing-good-tests, and verification-before-completion. Behavioral RED preceded new implementation; the complete unit suite is reserved for one final gate.

## Final gates

- `npm run test:unit` — exit 0; `Test Suites: 15 passed, 15 total`; `Tests: 258 passed, 258 total`. Run once at the final gate, including all 36 coordinator cases.
- `npm run typecheck` — exit 0; both `tsc --noEmit -p tsconfig.tools.json` and `tsc --noEmit -p tsconfig.mobile.json` passed.
- `npm run lint` — exit 0, no lint findings.
- `npm run format:check` — exit 0; `All matched files use Prettier code style!`.
- No mobile presentation files changed; pure application tests cover this task. Native/runtime routing integration remains Task 8.
