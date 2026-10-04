# PNPE Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tested guest-first Expo application shell with native Firebase authentication, validated configuration, category browsing, and the approved semantic light/dark design.

**Architecture:** Thin Expo Router routes render feature presentation components backed by application use cases and repository ports. Firebase lives only in data adapters composed at startup. Public Home is independent of authentication or network resolution; one coordinator controls protected intents.

**Tech Stack:** Expo 57.0.26, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3, Expo Router 57.0.24, React Native Firebase 26.4.0, Zustand 5.0.15, React Hook Form 7.89.0, Zod 4.6.5, AsyncStorage, Jest 29.7.0, jest-expo 57.0.5, React Native Testing Library 13.3.3.

**Spec:** [Approved foundation/content specification](../specs/2026-10-04-foundation-and-content-design.md), sections 1–5 and 8–11. Prerequisite: [content toolchain plan](2026-10-04-content-toolchain.md), which supplies taxonomy, question contracts, Node tooling, and initial Firebase emulator files.

## Global Constraints

- “Normal launch opens Home for guests and authenticated users; never automatically open Login.”
- “Avoid `any`; narrow `unknown` at external boundaries with validated schemas.”
- “No reviewer question-count cap or hide-answer switch remains.”
- Mock Exam configuration defaults: 150 items, 180 minutes, 75% application practice threshold, 35/40/25/50 category allocation.
- Reviewer content is read-through: all eligible questions, immediate correct answer/explanation, no reviewer scores.
- “No Firebase project creation, rules deployment, production import, app-store submission, or automatic editorial approval is part of executing this slice.”
- Dark/light/system themes, accessible state labels, and at least 44-point interactive targets.
- “Do not claim a working reviewer or exam engine in this slice.” Integration boundaries must explicitly state availability, never fabricate personal data.
- Exclude Custom Practice, Diagnostic Exam, Weak Topics/recommendations, separate Mistake Review, Question Mastery, Search, and Study Goals.

## Review Focus

1. Public launch must work when native Firebase configuration is missing or its promises never resolve — Tasks 3 and 9.
2. A stale auth callback after logout/account switching must not replay an old protected intent — Task 5.
3. Previously valid cached configuration with a newer unsupported cache schema must not crash or override safe defaults — Task 2.
4. Large text and long category/profile names must remain reachable without clipped actions in both themes — Tasks 1, 6, and 9.
5. Registration followed by profile-write failure must preserve the successful account and allow profile retry — Tasks 4 and 6.

---

## Dependency and environment decisions

Versions were inspected with npm metadata on 2026-10-04; these are planned pins, not a claim of a successful native build. [Expo's SDK matrix](https://docs.expo.dev/versions/latest/) pairs SDK 57 with RN 0.86 and React 19.2.3, Node 22.13+ and Xcode 26.4+. Local Node 24.3 and Xcode 26.5 meet those minimums; Android platform 36 exists. Verify CocoaPods, simulator runtimes, signing needs, and Android emulator availability during execution.

The inspected Expo template uses TypeScript 6.0.3. ts-jest 29.4.14 requires TypeScript below 7, and jest-expo uses Jest 29 dependencies. Keep Jest 29.7 and TypeScript 6.0.3. Use RNTL 13.3.3 with react-test-renderer 19.2.3; the newer RNTL 14 changes renderer requirements and is not needed for this plan.

Install matching RNFirebase app/auth/firestore/remote-config/analytics versions 26.4.0. [Remote Config requires Analytics](https://rnfirebase.io/remote-config/usage), but product analytics remains a no-op. Set `analytics_auto_collection_enabled:false` and `google_analytics_automatic_screen_reporting_enabled:false` before native initialization; do not request ad support or enable collection. [RNFirebase documents these switches](https://rnfirebase.io/analytics/usage). This is a required dependency, not approval to collect user analytics.

Use `npx expo install` for Expo/native supporting packages and commit the lockfile; run Expo dependency validation. Do not overwrite the existing package manifest with a template, install a second app tree, or use peer-dependency bypass flags. Keep Firebase Admin and web Firebase (rules tests only) in dev tooling; mobile code imports RNFirebase only.

Use the existing isolated implementation workspace, or invoke using-git-worktrees if starting separately. Preserve the user's untracked `references/` and `ic_pnpe_exam_reviewer.png`; the image is not a selected release icon and must not be modified/staged incidentally. No product dependency installation occurs before plan approval and execution-method selection.

## File responsibilities

| Files | Responsibility |
| --- | --- |
| `app.config.ts`, `babel.config.cjs`, `jest.mobile.config.cjs` | Expo/native and mobile test configuration |
| `src/core/theme/tokens.ts`, `src/core/theme/ThemeProvider.tsx` | Semantic palettes and persisted appearance |
| `src/core/components/*.tsx` | Focused accessible UI primitives |
| `src/core/config/schemas.ts`, `defaults.ts`, `ConfigRepository.ts` | All three JSON contracts and last-known-good fallback |
| `src/core/firebase/native.ts`, `NativeRemoteConfigService.ts` | Single native initialization and config adapter |
| `src/core/errors/AppError.ts`, `src/core/storage/KeyValueStore.ts` | Stable errors and versioned cache boundary |
| `src/features/auth/domain/*.ts`, `application/*.ts`, `data/*.ts` | Auth contracts, coordinator, SDK/profile adapters |
| `src/features/auth/presentation/*.tsx` | Forms and the single required-auth modal |
| `src/features/content/data/FirebaseCategoryRepository.ts` | Validated safe category overview reads |
| `src/features/home/presentation/*.tsx`, `menu/presentation/*.tsx`, `settings/presentation/*.tsx` | Real shell screens |
| `src/bootstrap/*.ts`, `AppProviders.tsx` | Dependency composition and public-ready initialization |
| `src/app/**/*.tsx` | Route wrappers and centralized route boundary |
| `tests/mobile/`, `tests/application/`, `tests/firebase/` | RNTL, pure application, emulator acceptance |

## Task 1: Guest Home with semantic theme primitives

**Files:** Create `app.config.ts`, `babel.config.cjs`, `jest.mobile.config.cjs`, `src/app/_layout.tsx`, `src/app/index.tsx`, `src/core/theme/tokens.ts`, `src/core/theme/ThemeProvider.tsx`, `src/core/components/AppScreen.tsx`, `src/core/components/AppText.tsx`, `src/core/components/AppButton.tsx`, `src/core/components/StateViews.tsx`, `src/features/home/presentation/HomeScreen.tsx`, `tests/mobile/home.test.tsx`, `tests/mobile/theme.test.tsx`; modify package/config files inherited from the content plan.

**Interfaces:** `Appearance = 'system'|'light'|'dark'`; `ThemeProvider({children,initialAppearance?,storage?})`; `useTheme():{colors:ThemeColors,appearance:Appearance,setAppearance(value:Appearance):Promise<void>}`. `HomeScreen({displayName?,onExplore,onMockExam,onProgress,onBookmarks})`; action props are `() => void`. `AppButton` uses a discriminated variant and standard Pressable accessibility props; `AppScreen` wraps safe-area/scroll/keyboard behavior. Create `src/core/storage/KeyValueStore.ts` here with async `get(key):Promise<string|null>`, `set(key,value):Promise<void>`, `remove(key):Promise<void>`, plus `src/core/storage/AsyncStorageKeyValueStore.ts` mapping to AsyncStorage getItem/setItem/removeItem. Task 2 consumes this same port, not a second storage interface.

- [ ] Add Expo/native runtime dependencies without disturbing the toolchain package scripts. Set main to `expo-router/entry`. Install the planned React/RN/Expo versions, Router, dev-client, splash-screen, status-bar, safe-area-context, screens, and AsyncStorage via compatible Expo resolution. Add Zustand 5.0.15 for narrow reactive presentation state, jest-expo 57.0.5, RNTL 13.3.3, and react-test-renderer 19.2.3. Separate `test:mobile = jest --config jest.mobile.config.cjs --runInBand` from Node tests; the mobile config uses `preset:'jest-expo'` and only `tests/mobile/**/*.test.tsx`. Keep strict checks in both tool and mobile tsconfigs; root `typecheck` must run both configurations after this task.
- [ ] Write the first failing Home/theme tests:

```tsx
test('guest Home offers content, not a login wall or invented statistics', () => {
  const action = jest.fn();
  render(<ThemeProvider><HomeScreen onExplore={action} onMockExam={action}
    onProgress={action} onBookmarks={action} /></ThemeProvider>);
  expect(screen.getByText('Explore reviewers')).toBeVisible();
  expect(screen.queryByText('Sign in to continue')).toBeNull();
  expect(screen.queryByText('Overall accuracy')).toBeNull();
});
```

Add a small ThemeProbe test component that renders `appearance` and an accessible button calling `setAppearance('dark')`. Assert storage receives a versioned dark value and a subsequent mount restores it. Corrupted values fall back to System. Mock `useColorScheme` to test live OS changes only in System mode.

- [ ] Run `npm run test:mobile -- tests/mobile/home.test.tsx tests/mobile/theme.test.tsx`; require meaningful missing-component failures before implementation.
- [ ] Implement the Home A hierarchy from the approved mockup using taxonomy from content Task 1: introduction, Explore Reviewers, restrained quick links, spaced category rows, and 150-item/180-minute exam invitation. No official badge/seal or fake statistics. Build semantic tokens, not blue cards everywhere.

```tsx
const mode = appearance === 'system' ? (systemScheme ?? 'light') : appearance;
const colors = palettes[mode];
// AppButton uses a minimum 44-point hit target and accessibilityRole="button".
// Home receives navigation callbacks; it neither imports Firebase nor owns auth checks.
```

- [ ] Add empty/error/loading views with explicit Retry actions. Exercise a long display name, large text, both themes, keyboard-safe scrolling, and one primary action per context. Add appearance UI tests instead of snapshot-only tests.
- [ ] Run mobile tests, tool tests, typecheck/lint/format, `npx expo install --check`, and `npx expo-doctor`; record unresolved native prerequisites honestly. Commit named files as `feat: add guest Home and semantic theme foundation`.

## Task 2: Remote Config contracts, defaults, and cache fallback

**Files:** Create `src/core/config/schemas.ts`, `src/core/config/defaults.ts`, `src/core/config/ConfigRepository.ts`, `src/core/errors/AppError.ts`, `tests/application/config.test.ts`, `tests/fixtures/config.ts`; consume Task 1's `src/core/storage/KeyValueStore.ts`; include `tests/application` in Node Jest matching.

**Interfaces:** `ConfigKey = 'app_info'|'data'|'config'`; `ConfigModels` maps those names to Zod-inferred types; `KeyValueStore` has async `get(key):Promise<string|null>`, `set(key,value):Promise<void>`, `remove(key):Promise<void>`. `RemoteConfigService.fetch():Promise<Record<ConfigKey,string>>`. `ConfigRepository.loadCached():Promise<void>`, `refresh():Promise<void>`, `get<K extends ConfigKey>(key:K):ConfigModels[K]`, `subscribe(listener:()=>void):()=>void`. `parseParameter<K>(key:K,raw:string):ConfigModels[K]` throws a stable validation error, not raw Zod errors to UI.

- [ ] Create tests from real spec defaults:

```ts
test('the default exam allocation sums to 150 without capping Reviewer', () => {
  expect(defaults.config.mockExam.questionCount).toBe(150);
  expect(Object.values(defaults.config.mockExam.distribution).reduce((a,b)=>a+b,0)).toBe(150);
  expect(defaults.config.reviewer).not.toHaveProperty('questionCount');
  expect(defaults.config.reviewer).not.toHaveProperty('showExplanationAfterAnswer');
});
test('incoherent exam JSON is rejected as a whole', () => {
  const bad = structuredClone(defaults.config);
  bad.mockExam.distribution.generalInformation = 34;
  expect(() => parseParameter('config', JSON.stringify(bad))).toThrow();
});
```

Implement `MemoryKeyValueStore` and `StubRemoteConfigService` in the fixture file for explicit test data/failure injection. Test that malformed remote `config` keeps prior validated config while valid `data` updates; cache version 999 falls back to defaults; invalid cached JSON does not crash; failed cache writes do not reject a valid in-memory update.

- [ ] Run `npm run test:unit -- tests/application/config.test.ts` red.
- [ ] Implement Zod schemas exactly matching spec section 5: HTTPS-or-empty URLs, semantic versions, email-or-empty support contact, bounded plain-text arrays, 256 KiB raw input bound, positive count/duration/quotas, distribution sum, and 0–100 threshold. Cache envelopes use `{schemaVersion:1,validatedAt:string,value:unknown}` and revalidate every read. Reviewer config contains only `shuffleQuestions:boolean`; answer visibility is not remotely disabled.

```ts
const parsed = schema.safeParse(JSON.parse(raw));
if (!parsed.success) throw new AppError('invalid-config');
// Refresh each parameter independently; preserve the last valid whole value on failure.
```

Define `AppError` in `src/core/errors/AppError.ts` with a typed code and safe user message; detailed causes remain private diagnostic metadata. Tests include expired announcement visibility, duplicate IDs, unsafe URLs, payload-size limits, and unsupported enum values.
- [ ] Run targeted tests/typecheck/lint and commit as `feat: validate and cache remote configuration safely`.

## Task 3: Central native Firebase setup and bounded bootstrap

**Files:** Create `src/core/firebase/native.ts`, `src/core/firebase/NativeRemoteConfigService.ts`, `src/bootstrap/initialize.ts`, `src/core/clock/Clock.ts`, `src/core/analytics/AnalyticsService.ts`, `src/bootstrap/environment.ts`, `tests/application/bootstrap.test.ts`, `tests/mobile/native-boundary.test.tsx`; modify `app.config.ts`, `.env.example`, `.gitignore`, `firebase.json`.

**Interfaces:** `FirebaseEnvironment` is a validated union `{mode:'unconfigured'}` or `{mode:'emulator'|'configured',projectId:string,emulatorHost?:string}`. `initializeNativeFirebase(environment):Promise<NativeServices>` caches one initialization; `NativeServices` stays in infrastructure. `initializePublicState({config,appearance,clock}):Promise<PublicState>` returns local-ready state independently of remote/auth. `Clock.now():number`; AnalyticsService exposes a typed `track(event:AnalyticsEvent):void` with a no-op implementation.

- [ ] Test that unconfigured Firebase never calls getAuth/getFirestore; public local state still becomes ready; a never-resolving refresh cannot hold Home. Use Jest fake timers and a deferred promise, not real sleeping.

```ts
test('network timeout cannot hold the public shell', async () => {
  const harness = bootstrapHarness({ remoteNeverResolves: true });
  await expect(harness.start()).resolves.toMatchObject({ publicReady: true });
  jest.advanceTimersByTime(5000);
  expect(harness.state().publicReady).toBe(true);
});
```

Create `bootstrapHarness` within the test using Task 2's memory storage/config stubs and a `Clock` backed by `Date.now`. No native SDK in domain tests.
- [ ] Run bootstrap tests red; implement module-level initialization promise, validated environment boundary, and config fetch budget of 5,000 ms. Resolve initial screen from local settings/defaults; catch storage failures and show public recovery messaging. Late valid fetches update config but cannot reset a future active session. Stop timers/subscriptions on teardown.

```ts
let servicesPromise: Promise<NativeServices> | undefined;
// Only infrastructure may create this promise or touch native Firebase instances.
// In unconfigured mode, compose an unavailable adapter, never a fake signed-in user.
```

- [ ] Add matching RNFirebase 26.4 modules, including Analytics solely as Remote Config's dependency. In root firebase.json preserve emulator settings and add disabled automatic analytics/screen reporting flags. Set Expo plugins for app/auth and the documented analytics config; use build-properties only if the pinned native setup requires it. Read the installed package config-plugin declarations and current native setup instructions before selecting plugins; do not list a plugin that the module does not export. Ignore local native Firebase files; `.env.example` documents mobile file paths separately from Admin ADC.
- [ ] NativeRemoteConfigService uses modular API calls, local defaults, fetch/activate, and returns the three raw string parameters; only ConfigRepository parses them. Screens must not call SDK getValue. Emulator mode returns deterministic configured defaults for Remote Config with an explicit “not live Remote Config” test mode; Auth and Firestore still use their actual emulators. Real Remote Config smoke testing requires the owner's configured project, never invented credentials.
- [ ] Add a native-boundary test that renders the public shell under missing native configuration and checks the no-op analytics adapter emits nothing. Run unit/mobile tests/typecheck/lint and commit as `feat: centralize Firebase initialization and public bootstrap`.

## Task 4: Firebase Auth and owner-profile repositories

**Files:** Create `src/features/auth/domain/AuthenticationRepository.ts`, `src/features/auth/domain/ProfileRepository.ts`, `src/features/auth/data/FirebaseAuthenticationRepository.ts`, `src/features/auth/data/FirebaseProfileRepository.ts`, `src/features/auth/data/mapAuthError.ts`, `tests/application/auth-repositories.test.ts`.

**Interfaces:** `AuthUser = {uid:string,email:string|null,displayName:string|null}`. `AuthState` is `{status:'resolving'|'guest'}` or `{status:'authenticated',user:AuthUser}` or `{status:'recoveryRequired',previousUid:string|null}`. AuthenticationRepository has `observe(listener:(state:AuthState)=>void):()=>void`, `signIn(email,password):Promise<AuthUser>`, `register(email,password):Promise<AuthUser>`, `requestPasswordReset(email):Promise<void>`, `signOut():Promise<void>`. ProfileRepository has `get(uid):Promise<{displayName:string}|null>`, `save(uid,{displayName}):Promise<void>`.

- [ ] Write adapter tests against injected modular SDK facades, not native global mocks scattered across screens:

```ts
test('network error is friendly and not interpreted as signed out', async () => {
  const harness = authAdapterHarness({ signInError: { code: 'auth/network-request-failed' } });
  await expect(harness.repo.signIn('user@example.test','password')).rejects.toMatchObject({code:'network'});
  expect(harness.observed).not.toContainEqual({status:'guest'});
});
```

Define `authAdapterHarness` in the test file with the facade methods consumed by the repository. Table-test invalid credentials, throttling, weak passwords, disabled accounts, and unknown errors; no raw SDK message may become displayed text. Verify unsubscribe removes the SDK listener.
- [ ] Run tests red; implement modular SDK facade mapping and typed DTO conversion. Never persist passwords or Firebase tokens in application storage. Use neutral password-reset completion; do not query account existence. Profile documents use validated allowlisted fields and server timestamps, with Auth authoritative for email.

```ts
const authCodes = { 'auth/network-request-failed':'network',
  'auth/too-many-requests':'rate-limited', 'auth/invalid-credential':'invalid-credentials' } as const;
// Unknown codes map to 'authentication-unavailable', never the SDK error.message.
```

- [ ] Test registration success followed by profile-write rejection as two independent operations: returned AuthUser survives and retry invokes profile save only. Run tests/typecheck/lint; commit as `feat: isolate native authentication and profile persistence`.

## Task 5: Central protected-action coordinator and safe return intents

**Files:** Create `src/features/auth/application/intents.ts`, `src/features/auth/application/AuthenticationCoordinator.ts`, `src/navigation/routePolicy.ts`, `tests/application/auth-coordinator.test.ts`, `tests/fixtures/auth-harness.ts`.

**Interfaces:** `ProtectedAction` is a discriminated union: startReviewer(categoryId, optional subcategoryId), startMockExam, openProgress, openBookmarks, openHistory, openProfile, openAttempt(attemptId,requiredOwnerUid), setBookmark(questionId,saved). `SafeOrigin` is a closed public-route union, never an arbitrary URL. `PendingIntent = {id,action,origin,createdAtMs,expiresAtMs}`. Coordinator consumes AuthenticationRepository, KeyValueStore, Clock, and `{resume(action,user,operationId):Promise<void>,returnTo(origin):void}` handlers; exposes `requireAuthentication(action,origin):Promise<void>`, `chooseSignIn()`, `chooseRegistration()`, `cancel()`, `signOut():Promise<void>`, `subscribe(listener):()=>void`, `getSnapshot():CoordinatorState`, and `dispose()`.

- [ ] Implement a typed auth test harness with a fake AuthRepository that can emit states, a controllable clock, memory store, and recorded navigation/handler calls. Use it for red tests:

```ts
test('Maybe Later preserves the origin and removes the intent', async () => {
  const h = createAuthHarness({ now: 1000, state: {status:'guest'} });
  await h.coordinator.requireAuthentication({type:'startMockExam'}, {type:'mockOverview'});
  expect(h.coordinator.getSnapshot().promptOpen).toBe(true);
  await h.coordinator.cancel();
  expect(h.store.values.size).toBe(0);
  expect(h.resume).not.toHaveBeenCalled();
});
test('duplicate authenticated callbacks consume only one intent', async () => {
  const h = createAuthHarness({ now: 1000, state: {status:'guest'} });
  await h.coordinator.requireAuthentication({type:'startMockExam'}, {type:'mockOverview'});
  await h.emitAuthenticated('user-a');
  await h.emitAuthenticated('user-a');
  expect(h.resume).toHaveBeenCalledTimes(1);
});
```

- [ ] Run `npm run test:unit -- tests/application/auth-coordinator.test.ts` red.
- [ ] Implement schema-validated intent persistence with 30-minute expiry, a serialized transition queue, and an auth-generation counter. The handler receives stable intent ID as operationId. Ignore stale callback generations after logout/dispose. Navigation handlers resolve action unions to whitelisted routes; no persisted callback or raw URL. Expiry clears intent and returns to safe origin without a side effect.

```ts
const expiresAtMs = clock.now() + 30 * 60 * 1000;
if (intent.expiresAtMs <= clock.now()) { await clearIntent(); returnTo(intent.origin); return; }
if (requiresOwner(intent.action) && intent.action.requiredOwnerUid !== user.uid) {
  await clearIntent(); returnTo({type:'home'}); return;
}
```

Define `requiresOwner` as a type guard for openAttempt in `intents.ts`; owner-bound future resume variants must use the same policy. While resolving, wait with cancel/retry; do not open Login. Failed sign-in, reset-password round trips, and switching auth forms retain intent. Explicit exit cancels it. Voluntary Menu login uses a separate safe origin with no protected intent.
- [ ] Add tests for unknown action/invalid ID, timestamp expiry, corrupted cache, repeated taps, same-account restore, different-user restore, logout racing an authenticated callback, and failed intent persistence. A persistence failure must not report a durable saved intent; allow safe in-memory continuation with visible recovery messaging or cancel. No session/attempt side effects exist yet.
- [ ] Run tests/typecheck/lint and commit as `feat: centralize authentication prompts and protected intent recovery`.

## Task 6: Real auth forms and the shared prompt

**Files:** Create `src/core/components/AppInput.tsx`, `src/core/components/AppModal.tsx`, `src/features/auth/presentation/AuthRequiredModal.tsx`, `src/features/auth/presentation/SignInScreen.tsx`, `src/features/auth/presentation/RegistrationScreen.tsx`, `src/features/auth/presentation/ForgotPasswordScreen.tsx`, `src/features/auth/presentation/authFormSchemas.ts`, `tests/mobile/auth-forms.test.tsx`, `tests/mobile/auth-prompt.test.tsx`.

**Interfaces:** Form screens receive `AuthenticationRepository`, `ProfileRepository` where needed, and coordinator/navigation callbacks from providers. `AuthRequiredModal({visible,title,message,onSignIn,onRegister,onCancel})`; Form schemas trim email, validate format, require passwords, and compare registration confirmation without trimming passwords. Name is bounded to 100 characters. Install React Hook Form 7.89.0 and @hookform/resolvers 5.9.1; import only the Zod resolver, not other optional schema engines.

- [ ] Write RNTL tests for all three prompt buttons, form validation, hidden password fields, pending-submit disabled state, friendly errors, and successful account creation with failed profile save:

```tsx
test('Maybe Later dismisses without navigating to login', async () => {
  const cancel = jest.fn(); const signIn = jest.fn();
  render(<ThemeProvider><AuthRequiredModal visible title="Sign in to continue"
    message="Save your progress with an account." onCancel={cancel}
    onSignIn={signIn} onRegister={jest.fn()} /></ThemeProvider>);
  await userEvent.setup().press(screen.getByRole('button',{name:'Maybe Later'}));
  expect(cancel).toHaveBeenCalledTimes(1); expect(signIn).not.toHaveBeenCalled();
});
```

- [ ] Run mobile tests red; implement forms with React Hook Form + Zod resolver and narrow submitting/error state. Successful registration proceeds as authenticated even when profile save needs retry. Password reset uses the same neutral acknowledgement for known/unknown addresses. Use textContentType/autocomplete appropriately, keyboard avoidance, accessible field errors, and modal focus restoration.

```tsx
const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });
const submit = form.handleSubmit(async values => {
  try { await auth.signIn(values.email, values.password); }
  catch (error: unknown) { form.setError('root', {message: toFriendlyAuthMessage(error)}); }
});
```

Create `src/core/errors/userMessage.ts` with `toFriendlyAuthMessage(error:unknown):string`, accepting only mapped AppError codes and returning approved messages plus a generic fallback. Presentation imports this core formatter, not the SDK error mapper in the data layer. Auth state drives navigation through the coordinator; forms must not independently redirect Home on success.
- [ ] Test form switching/reset routes preserve the intent, explicit back exit clears it, registration does not run twice on retry-profile, and long error text/large fonts do not hide controls. Run tests/typecheck/lint and commit as `feat: add accessible email authentication flows`.

## Task 7: Public category reads and least-privilege Firestore rules

**Files:** Create `src/features/content/domain/CategoryRepository.ts`, `src/features/content/data/FirebaseCategoryRepository.ts`, `src/features/auth/data/profileSchema.ts`, `tests/application/categories.test.ts`, `tests/firebase/rules.integration.test.ts`; modify `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `jest.integration.config.cjs`, `package.json`.

**Interfaces:** `Availability = {status:'known',eligibleCount:number,asOf:string}|{status:'unknown'}`; `CategoryOverview = {categoryId:CategoryId,availability:Availability,subcategories:readonly {subcategoryId:SubcategoryId,availability:Availability}[]}`; `CategoryRepository.list():Promise<readonly CategoryOverview[]>`. Bundled taxonomy is the authoritative display structure; Firestore supplies validated availability metadata. Reject mismatched category/subcategory IDs; stale metadata may display its timestamp but cannot authorize session selection. Profile schema allows displayName, createdAt, updatedAt only; createdAt is immutable after create.

- [ ] Test malformed category counts, missing remote categories, unavailable Firestore, and unknown/expired availability metadata. Public browsing must retain all four categories without inventing zero counts.
- [ ] Add Firebase JS 12.19.0 and rules-unit-testing 5.0.2 as dev dependencies; add `tests/firebase/**/*.integration.test.ts` to the integration config and Auth to the emulator test command alongside Firestore. Write emulator tests before relaxing the deny-all rules:

```ts
test('a guest reads categories but cannot read official answers', async () => {
  const guest = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(guest,'categories/generalInformation')));
  await assertFails(getDoc(doc(guest,'questions/q-one/versions/1')));
});
test('an owner cannot add an admin flag to their profile', async () => {
  const own = env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(own,'users/alice'), {displayName:'Alice',admin:true}));
});
```

Initialize `env` via `initializeTestEnvironment` with project `demo-pnpe`, the actual rules file, and localhost emulator; seed official content using `withSecurityRulesDisabled`, clear between tests, and cleanup afterward. Never use a production project in tests.
- [ ] Run emulator tests red; implement public categories, authenticated official read-only content/catalog paths, owner profiles with field/type/length/timestamp allowlists, and default deny. Do not add recursive owner write permissions for unimplemented session subcollections.

```text
function isOwner(uid) { return request.auth != null && request.auth.uid == uid; }
function profileFields() {
  return request.resource.data.keys().hasOnly(['displayName','createdAt','updatedAt']);
}
```

Complete create/update rules with displayName string size ≤100, timestamps, immutable createdAt, updatedAt equal to request.time; profile delete is denied in this slice. All client writes to questions/versions/categories/catalogs are denied. Integration tests cover guest/signed-in queries, cross-user reads/writes, unauthorized added fields, immutable createdAt, and all unimplemented paths.
- [ ] Implement CategoryRepository over injected Firestore reads with schema validation and bundled fallback. No official questions are fetched at startup. Run unit/emulator/typecheck/lint and commit as `feat: secure public content metadata and owner profiles`.

## Task 8: Route composition, public screens, and seven auth scenarios

**Files:** Create `src/bootstrap/AppProviders.tsx`, `src/bootstrap/composition.ts`, `src/navigation/ProtectedRoute.tsx`, `src/features/content/presentation/CategoryOverviewScreen.tsx`, `src/features/content/presentation/SubcategoryOverviewScreen.tsx`, `src/features/menu/presentation/MenuScreen.tsx`, `src/features/settings/presentation/AppearanceScreen.tsx`, `src/features/settings/presentation/AboutScreen.tsx`, `src/features/settings/presentation/LegalScreen.tsx`, `src/features/auth/presentation/ProfileScreen.tsx`, `src/core/components/FeatureAvailabilityScreen.tsx`, `tests/mobile/navigation.test.tsx`, `tests/mobile/menu.test.tsx`, `tests/fixtures/app-harness.tsx`; create/modify thin routes listed below.

**Routes:** `src/app/(tabs)/_layout.tsx`, `(tabs)/index.tsx`, `(tabs)/review.tsx`, `(tabs)/mock-exam.tsx`, `(tabs)/progress.tsx`, `(tabs)/menu.tsx`; `src/app/review/[categoryId]/index.tsx`, `review/[categoryId]/[subcategoryId].tsx`, `auth/sign-in.tsx`, `auth/register.tsx`, `auth/forgot-password.tsx`, `profile.tsx`, `bookmarks.tsx`, `exam-history.tsx`, `appearance.tsx`, `about.tsx`, `privacy.tsx`, `terms.tsx`. Remove Task 1's standalone `src/app/index.tsx` after moving its Home wrapper into the tab group to avoid duplicate `/` routes.

**Interfaces:** `AppDependencies` composes config/category/auth/profile repositories, coordinator, analytics, and settings storage; `AppProviders({dependencies,children})`. `ProtectedRoute({action,children})` delegates to the central policy. `createAppHarness({initialAuth?,config?,profileFailure?})` exposes injected dependencies, router-event assertions, and auth emitters for tests; do not use the harness in production.

- [ ] Write the seven acceptance tests using Expo Router's test renderer with actual route wrappers and injected dependencies:

```tsx
test('guest cold launch opens Home without Login', async () => {
  const h = createAppHarness({ initialAuth: {status:'guest'} });
  h.render('/');
  expect(await screen.findByText('Explore reviewers')).toBeVisible();
  expect(screen.queryByText('Sign in to continue')).toBeNull();
});
test('Mock Exam login returns to preflight without starting a timer', async () => {
  const h = createAppHarness({ initialAuth: {status:'guest'} });
  h.render('/mock-exam');
  await userEvent.setup().press(screen.getByRole('button',{name:'Start Mock Exam'}));
  expect(screen.getByText('Sign in to continue')).toBeVisible();
  await h.authenticate('alice');
  expect(await screen.findByText('150 questions')).toBeVisible();
  expect(h.createdSessions).toHaveLength(0);
});
```

Also cover public category/subcategory browsing, guest Start Reviewer prompt, guest Start Mock Exam prompt, voluntary Menu auth, and authenticated relaunch Home. Test Progress interception preserves the preceding tab after Maybe Later; protected direct links do not flash personal content.
- [ ] Run navigation tests red; compose real repositories/coordinator once and keep route files as thin wrappers. Route start actions into the shared prompt first; authenticated starts reach explicit development availability boundaries until later slices, never a fake session. Mock overview states approved duration/count/distribution and practice threshold. Reviewer overview says all eligible questions and immediate answers, not an answering quiz.

```tsx
// Route wrapper pattern:
export default function MenuRoute() {
  const dependencies = useAppDependencies();
  return <MenuScreen coordinator={dependencies.coordinator} />;
}
```

Define `useAppDependencies` in AppProviders; presentation receives needed ports/view models without SDK imports. Profile displays real identity/validated profile and retry states. Menu observes coordinator state; no second SDK subscription. Unknown category/subcategory/deep-link IDs show a safe Not Found/back action.
- [ ] Implement appearance settings, exact independence disclaimer, app version, and legal links. Before external URL open, parse with the validated HTTPS schema; errors show Retry. Empty legal URLs show honest unavailability. Use the selected Home direction; no unauthorized new icons/branding assets. FeatureAvailabilityScreen states the unreleased slice boundary and Back action without fake data.
- [ ] Test invalid deep links, rapid tab/action taps, logout callbacks, profile loading errors, legal URL failures, and maintenance notices that preserve Home. Run all unit/mobile/emulator checks and commit as `feat: compose guest-first navigation and protected entry points`.

## Task 9: Native verification, boundaries, CI, and handoff documentation

**Files:** Create `tests/application/import-boundaries.test.ts`, `tests/mobile/accessibility.test.tsx`, `docs/verification/mobile-foundation.md`, `.github/workflows/mobile.yml`, `eas.json`; modify README and `.env.example` with verified setup/build steps.

**Interfaces:** No new runtime contracts. This task proves integration rather than adding session engines.

- [ ] Add an import-boundary test scanning src TS/TSX: disallow `firebase-admin` and tools imports anywhere in mobile code, and RNFirebase imports outside `core/firebase` or feature data adapters. Use ESLint restrictions for domain/application/presentation boundaries as well. Verify the product AnalyticsService remains no-op and native collection flags remain false.

```ts
test('mobile source never imports Admin SDK or question tooling', () => {
  const violations = findForbiddenImports('src', ['firebase-admin','tools/questions']);
  expect(violations).toEqual([]);
});
```

Implement `findForbiddenImports` in the same test using Node file walking and TypeScript's parser for import/export/dynamic-import declarations, not a regex that mistakes comments for dependencies. Keep the scanner narrowly scoped to architecture enforcement.
- [ ] Test screen-reader names for prompts/buttons/inputs, missing config public startup, long names/category text, theme restoration, and form errors. Run tests before fixes; make minimal changes and rerun. Do not accept snapshots as proof that dynamic text or focus works.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm run test:mobile`, emulator tests, `npx expo install --check`, and `npx expo-doctor`. Use demo project emulator mode for actual Auth/Firestore integration; Remote Config uses its explicit default stub in that environment.
- [ ] Check native configuration without printing credentials, then build with `npx expo run:ios` and `npx expo run:android` using local development IDs `dev.pnpe.reviewer` unless owner-supplied IDs exist. Do not register store identities or upload builds. If real native Firebase configuration is unavailable, verify the unconfigured public shell and report real Firebase device acceptance as blocked, not passed. Never substitute fake config and claim production integration works.
- [ ] On available Android/iOS devices or simulators, exercise Home cold launch guest/authenticated, public categories, prompt cancellation, Menu login/reset/registration, return intent, logout/account switching, dark/light/System, large text, keyboard overlap, VoiceOver/TalkBack modal focus, and network failure. Record platform/runtime/screenshots and observed failures in the verification document. Actual Remote Config fetch requires the owner's project; leave that check explicit if unavailable.
- [ ] Document architecture/folders, installed versions, Firebase setup, native file locations, emulator endpoints (Android emulator host differs from iOS localhost), all three JSON examples, disabled analytics dependency, environment separation, legal/release gates, tests, builds, scope status, offline future-session contracts, and the approved Reviewer/Mock Exam distinction. Include existing content toolchain instructions rather than replacing them. EAS profiles are local configuration only; no remote build submission.
- [ ] Run final gates after fixes, review staged files for secrets and user-owned assets, and commit named changes as `test: verify and document mobile foundation boundaries`. Request the selected execution workflow's whole-branch review. Follow finishing-a-development-branch to choose integration; do not silently merge or deploy.

## Specification coverage and completion

| Specification requirement | Owning tasks |
| --- | --- |
| Public shell/themes/accessibility | 1, 6, 8, 9 |
| Auth repositories and safe intent | 4, 5, 6, 8 |
| Remote Config/fallback/startup | 2, 3, 9 |
| Fixed taxonomy/content contracts/import | Content toolchain plan Tasks 1–7 |
| Firestore rules/category/profile data | 4, 7 |
| No-op analytics/secrets/native isolation | 3, 9 |
| Seven auth acceptance scenarios | 8 |
| Documentation/native evidence | 9 plus content Task 7 |
| Reviewer/exam/progress/history engines | Explicitly reserved for subsequent delivery-slice specifications; not claimed complete here |

Report actual command results and missing credentials/device prerequisites. The foundation is not complete if mandatory verification remains unavailable. No publication, editorial approvals, deployed rules, or production writes are implied by a successful local build.
