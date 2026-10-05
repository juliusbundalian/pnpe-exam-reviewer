# Task 6 implementation report

Implemented accessible email sign-in, registration, neutral password reset, and the shared authentication prompt. Registration account completion and profile recovery live in an externally owned application controller and survive form unmounts. Forms never redirect Home; the existing authentication coordinator owns routing and protected-intent consumption.

## Files

- `src/core/components/AppInput.tsx`: semantic-theme input, visible label, error hint/announcement, font scaling, intrinsic sizing and 44-point minimum target.
- `src/core/components/AppModal.tsx`: scrollable themed modal; initial heading accessibility focus, iOS dismissal restoration, Android hidden-transition restoration, native Back callback.
- `src/core/components/AppText.tsx`: native text ref forwarding needed by modal accessibility focus; existing theme/font behavior retained.
- `src/core/errors/userMessage.ts`: only approved mapped AppError codes yield approved messages; unknown errors and forged plain objects get a generic message. Ignores raw/mutated Error messages.
- `src/features/auth/presentation/AuthRequiredModal.tsx`: Sign In, Register, Maybe Later callbacks; optional launching-control ref for focus restoration.
- `src/features/auth/presentation/SignInScreen.tsx`, `RegistrationScreen.tsx`, `ForgotPasswordScreen.tsx`: React Hook Form controls, Zod resolver, validation, secure password inputs, keyboard/autofill configuration, narrow submit/error states and disabled pending controls.
- `src/features/auth/presentation/authFormSchemas.ts`: trimmed valid email, required untrimmed password, untrimmed confirmation equality, trimmed required name bounded by the domain's 100-character maximum.
- `src/features/auth/application/RegistrationController.ts`: stable observable application state, account result/profile recovery ownership, profile-only retry, duplicate-register prevention, stale-result/account-switch/logout invalidation and provider-lifetime disposal. No password stored in fields or snapshots.
- `tests/mobile/auth-forms.test.tsx`, `auth-prompt.test.tsx`; `tests/application/registration-controller.test.ts`, `auth-user-message.test.ts`: behavioral coverage listed below.
- `package.json`, `package-lock.json`: exact `react-hook-form@7.89.0`, `@hookform/resolvers@5.9.1`, installed without peer bypass. Only the Zod resolver is imported. npm also adjusted transitive dependency placement/resolution while preserving native SDK/configuration.

## RED / GREEN evidence

Runnable empty public-interface scaffolds were used to make initial failures behavioral rather than missing-module errors. Each production behavior followed the corresponding failing test.

1. `npm run test:mobile -- --runTestsByPath tests/mobile/auth-prompt.test.tsx`: RED **2 failed, 1 passed**, “Unable to find an element with role: button, name: Maybe Later”; GREEN **3 passed** after actual modal controls.
2. `npm run test:mobile -- --runTestsByPath tests/mobile/auth-forms.test.tsx`: RED **7 failed**, missing real Sign In/Email controls; GREEN **7 passed** after sign-in/reset forms.
3. `npm run test:unit -- --runTestsByPath tests/application/registration-controller.test.ts`: RED **4 failed, 1 passed**, idle state instead of profileRecovery and no registration/profile calls; GREEN **5 passed** after application controller implementation.
4. Same mobile auth-forms command with registration tests: RED **2 failed, 7 passed**, missing registration Email controls; GREEN **9 passed** after registration form.
5. Modal focus test initially exposed a native Jest namespace-spy setup issue. Corrected the spy to the actual native module (no production behavior bypass); runnable RED then failed **expected 2 focus calls, received 1** because Android hide did not restore focus. GREEN **4 passed** after Android restoration. Final characterization also covers iOS onDismiss (**5 prompt tests**).
6. Guest-observation cancellation test: RED **1 failed, 5 passed**, late profile save occurred after guest observation; GREEN **6 controller tests passed** after invalidation. Formatter focused tests **6 passed**.
7. Added real-control coordinator round trip and success-waits-for-observer coverage, profile retry UI, pending reset, and structural font/error checks. Initial structural tests used a host-only matcher on composite ScrollView/Text, causing **2 matcher errors, 16 passed**; corrected assertions to inspect those native boundary props. Focused mobile GREEN **18 passed** before the added iOS characterization; no production fix was needed for those test harness errors.

## Actual coverage and limits

31 new behavioral tests: 14 form tests, 5 prompt tests, 6 controller tests, 6 friendly-message tests. Tests exercise real controls in RNTL, with repository doubles at the external-operation boundary and mocked native focus handles only for the accessibility API boundary. No coverage percentage was collected.

Covered: both prompt themes and all three callbacks; hidden prompt; initial modal focus and iOS/Android launcher restoration; sign-in themes, invalid fields, password hiding, email trimming/password whitespace preservation, successful password clearing, pending input/button disabling, mapped/unknown friendly errors; actual form switching/reset return preserving the coordinator intent and explicit Back clearing it; successful sign-in promise does not itself consume intent; registration name bound/confirmation mismatch, pending controls, trimmed name, unmount completion retention, account-success recovery notice, profile retry without second registration; account switches, logout/guest observation, stale completion and concurrent register; known/unknown reset acknowledgement equality, reset validation/pending/rate limiting; unknown/forged/mutated error safety.

Font/error checks verify font scaling stays enabled, no fixed field/error height is imposed, actual controls remain rendered with 44-point minimum targets, and the form uses scrolling/keyboard avoidance. A long synthetic AppInput error is checked separately alongside the real form. Jest does not prove on-device layout, actual keyboard overlap, screen-reader focus timing, scrolling reachability, or native SDK behavior; those remain Task 9 device checks.

## Final gates (run once after implementation)

- `npm run test:unit`: exit 0; **17 suites, 277 tests passed**, no failures.
- `npm run test:mobile`: exit 0; **7 suites, 48 tests passed**, no failures.
- `npm run typecheck`: exit 0; strict tools and mobile checks both passed.
- `npm run lint`: exit 0, no findings.
- `npm run format:check`: exit 0, “All matched files use Prettier code style!”.
- `npx expo install --check`: exit 0, “Dependencies are up to date”.
- `npm ls --depth=0`: exit 0; pinned form/resolver versions and current React/Zod/native dependencies present, no peer-invalid entries.
- npm install reported 80 audit vulnerabilities (15 moderate, 65 high) across the dependency tree. No broad audit fix or SDK upgrade was performed.

## Task 8 integration API

Create one `new RegistrationController(authRepository, profileRepository)` at app-provider lifetime. Do not create it inside RegistrationScreen or a route. Forward each **actual auth repository observation**, including resolving/guest/recovery states, via `(state) => registration.synchronizeAuth(state)`; initialize from the current observed auth state before showing forms. This synchronization must remain active after auth-driven navigation/unmount. Do not repeatedly forward guest snapshots for unrelated coordinator UI updates, since an actual guest observation during registration intentionally invalidates the pending result. Unsubscribe the provider's observation and call `registration.dispose()` only when the app-provider instance is disposed.

Subscribe with `useSyncExternalStore(registration.subscribe, registration.getSnapshot)`. Snapshot status is `idle | registering | savingProfile | complete | profileRecovery`, with `user`, `displayName`, and safe `message`. For authenticated routes, render the app-level account-success/profile-recovery notice whenever status is `profileRecovery`; its Retry control calls `registration.retryProfile()`. Disable Retry while `savingProfile`. `register(email,password,displayName)` rejects auth failures for the form formatter; after successful Auth registration, profile failures resolve and retain `user` plus recovery. `retryProfile()` never calls Auth registration. `complete` retains the account result until auth identity changes/provider disposal. No global singleton or persistent credential storage exists.

`SignInScreen({ auth, onRegister, onPasswordReset, onCancel })`: chooseRegistration, choosePasswordReset and explicit coordinator cancel callbacks.

`RegistrationScreen({ registration, onSignIn, onCancel })`: chooseSignIn and explicit cancel callbacks. The application controller owns the repositories; the form receives that controller rather than creating recovery state from repository calls.

`ForgotPasswordScreen({ auth, onSignIn, onCancel })`: chooseSignIn for reset return (preserves intent); explicit cancel clears it.

`AuthRequiredModal({ visible,title,message,onSignIn,onRegister,onCancel,restoreFocusTarget? })`: coordinator chooseSignIn/chooseRegistration/cancel. Pass a live native Text/View ref for the initiating control as `restoreFocusTarget` to restore focus on dismissal. The shared AppButton already accepts its native Pressable ref through PressableProps. Preserve the initiating control while the modal is shown.

Actual AppProviders/routes and app-level recovery notice composition remain Task 8; none were composed here.

## Self-review and concerns

Reviewed separation of presentation/application/domain, public SDK import boundary, password handling, controller race guards, profile retry path and coordinator callback contracts. No raw SDK messages, stack traces, logging, password persistence, fake personal production data, review/exam engine, excluded features, reference/icon/config changes, project/user creation, production writes, rules deploys or ledger changes were introduced.

Provider synchronization is required to invalidate recovery across account changes. A profile write already dispatched for its explicitly captured UID cannot be cancelled by this repository interface; a later account change suppresses its result and prevents subsequent retry, and it never writes the new user's UID. Account creation itself is also not cancellable through the domain repository; stale completion is ignored for profile/routing purposes. Native/device accessibility and keyboard review remain Task 9. No implementation blocker remains.
