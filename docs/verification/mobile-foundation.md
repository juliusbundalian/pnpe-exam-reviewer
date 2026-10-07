# Mobile foundation verification and handoff

Status: **device checks verified and final source review approved; Expo
compatibility checks failing**. This is an implementation
checkpoint, not a completed foundation or release approval. Automated JS tests
cannot establish native Firebase integration, screen-reader focus, keyboard
visibility, or physical-device behavior. No publication, editorial approval,
deployed rules, store identity registration, remote build, or production writes
are implied.

The user deferred Android TalkBack and iOS VoiceOver verification on 2026-10-06.
These checks are excluded from current acceptance and are not blockers for this
slice. Existing accessibility behavior and recorded evidence remain; deferred
checks are not claimed as passed. The user resumed iOS build and Firebase work on
2026-10-07; the earlier iOS setup blocker is resolved, as recorded below.

## Scope and architecture

Normal guest and authenticated launches go to Home. Public category browsing
covers the fixed four-category/fifteen-subcategory taxonomy. Protected actions
use one central prompt, explicit cancellation, validated origin, and a pending
intent resumed only after observed authentication. Menu offers voluntary sign-in,
registration, and password reset. Account switching/logout invalidate personal
state and stale results. There are no fabricated scores or personal statistics.

`src/app` contains Expo Router routes; `src/navigation` owns typed route policy and
availability gates. `src/bootstrap/PublicBootstrapProvider` owns the single
native/config/theme/recovery-aware-storage lifetime. Composition owns one
AuthenticationCoordinator and RegistrationController, forwarding the single
native auth observation to registration. `src/features/*/domain` contains ports
and models, `application` orchestration, `data` Firebase adapters, and
`presentation` UI. `src/core` contains semantic light/dark/System tokens, accessible
44-point controls, validated configuration, errors, storage, and native Firebase.
Admin and web Firebase SDKs are developer-only; mobile imports use RNFirebase
only in `core/firebase` or feature data adapters. AST tests and ESLint enforce
boundaries. `tools/questions` retains the independent content workflow.

Reviewer remains a future read-through experience: ALL eligible questions,
immediate correct answer/explanation, no selection, submission, quiz score, or
question cap. Mock Exam remains a future timed assessment: 150 questions,
180 minutes, 35 General Information / 40 Communication / 25 Quantitative /
50 Critical Thinking. 75% is an app practice threshold, not a verified official
passing threshold. Neither timer nor question navigator/session engine ships
here. Future offline contracts reserve SQLite snapshots/outbox, account isolation,
idempotent synchronization, and timestamp-based timer recovery; they are not
implemented. Custom Practice, Diagnostic, Weak Topics, Mistake Review, Question
Mastery, Search, and Study Goals are excluded.

## Toolchain and native setup

Installed pins: Expo 57.0.26, Expo Router 57.0.24, React Native 0.86.3,
React 19.2.3, all five RNFirebase packages 26.4.0, TypeScript 6.0.3,
Zustand 5.0.15, Zod 4.6.5, React Hook Form 7.89.0. Node 24.3.0/npm 11.4.2,
Xcode 26.5, CocoaPods 1.16.2, Java 21, Android SDK platform/build-tools 36.
Use `npm ci`. Python 3 remains required for content unit tests; preserve the
[content workflow](../content-workflow.md) and its extraction prerequisites.

Owner native files are ignored at the original checkout root:
`google-services.json` and `GoogleService-Info.plist`. Use explicit absolute paths
in `GOOGLE_SERVICES_ANDROID` / `GOOGLE_SERVICES_IOS` rather than copying them into
this worktree. Both were checked locally without printing credentials: matching
project IDs and `com.pnpe.exam.reviewer` identities. The owner's identity overrides
the provisional `dev.pnpe.reviewer` suggestion. Never print/stage their contents.
`GOOGLE_APPLICATION_CREDENTIALS` is separate Admin ADC for developer tools only;
never put it in Expo/client configuration.

With both files absent, prebuild omits native app/auth configuration and boots
the public-only shell. With both present use `EXPO_PUBLIC_FIREBASE_MODE=configured`
and matching `EXPO_PUBLIC_FIREBASE_PROJECT_ID`. Emulator mode requires
`demo-pnpe` and a safe explicit host, creates the named `pnpe-emulator` app and
connects Auth :9099 / Firestore :8080 before use. Android emulator host is
`10.0.2.2`; iOS simulator uses `127.0.0.1`. Live Remote Config is never simulated
by this mode: its service is explicitly `emulator-defaults-not-live`.

RNFirebase's pinned CocoaPods integration uses `ios.disableSPM: true`, static
frameworks and all five `forceStaticLinking` entries. The unconfigured-only
plugin applies the pinned Podfile transform without unconditional Firebase
configure. Verify that internal helper when upgrading. No peer-dependency bypass
or native SDK override is permitted. `firebase.json` deactivates analytics and
sets every collection flag false. Product AnalyticsService is a no-op, with no
console/network event path; the analytics package exists for the native dependency
graph, not tracking.

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:mobile
# Select Java 21 in this command's environment; no Admin credentials required.
GOOGLE_APPLICATION_CREDENTIALS=/nonexistent/pnpe-emulator-no-adc.json npm run test:emulator
npx expo install --check
npx expo-doctor
npx expo prebuild
npx expo run:ios
npx expo run:android
```

Supply native file paths/environment only in the local shell. Restart Metro with
the same environment and regenerate native projects when changing configuration.
Native projects/build outputs are ignored. `eas.json` is configuration only:
development/internal, preview/internal, production; no remote submission.
Mobile CI runs automated gates and local demo emulators without credentials.
Device/manual gates must still be performed locally.

## Remote Config JSON examples

These are the actual three parameter names and bundled schemas. No renamed keys
or live publication is implied. Each parameter validates independently and uses
last-good cache/default fallback; invalid values cannot replace accepted values.
UTF-8 payload size is bounded; cache writes may fail without blocking public UI.

`app_info`:

```json
{
  "appName": "PNPE Exam Reviewer",
  "latestVersion": "0.1.0",
  "minimumSupportedVersion": "0.1.0",
  "maintenanceMode": false,
  "maintenanceMessage": "",
  "supportEmail": "",
  "privacyPolicyUrl": "",
  "termsUrl": ""
}
```

`data`:

```json
{
  "announcements": [],
  "studyTips": [],
  "faq": [],
  "reviewerInstructions": [],
  "examInformation": []
}
```

`config`:

```json
{
  "mockExam": {
    "durationMinutes": 180,
    "questionCount": 150,
    "passingPercentage": 75,
    "shuffleQuestions": true,
    "shuffleAnswers": true,
    "distribution": {
      "generalInformation": 35,
      "communicationSkills": 40,
      "quantitativeReasoning": 25,
      "criticalThinking": 50
    }
  },
  "reviewer": { "shuffleQuestions": true },
  "features": { "bookmarks": true, "progress": true, "examHistory": true }
}
```

## Dependency triage, 2026-10-06

`npm audit --json` reports 81 aggregate findings: 66 high, 15 moderate,
0 critical. This is not 81 independent device-runtime defects and is not a clean
release gate. Installed advisory-bearing packages were inspected against the
lockfile, dependency paths, and actual router source:

| Package/version | Reachability and disposition |
| --- | --- |
| decode-uri-component 0.2.2 | Installed/bundled dependency path: expo-router 57.0.24 → query-string 7.1.3 → decoder. Active Expo inbound parsing delegates to URLSearchParams; its queryString.parse block is commented out. The vendored React Navigation parser still calls queryString.parse, and Expo serializers import query-string. Active inbound exploitation has not been demonstrated; dependency remediation and reachability verification remain release gates. |
| @grpc/grpc-js 1.9.16 | Dev web Firebase plus RNFirebase app's web fallback dependency; mobile uses native bridges, not a gRPC JS server. Do not classify as all-dev merely from declaration; web/server paths need separate remediation. |
| braces 3.0.3 | Metro/Jest/chokidar tooling transitive path; hostile patterns can exhaust stack. Restrict development inputs; compatible dependency maintenance still outstanding. |
| node-forge 1.4.0 | Expo CLI/code-signing tooling signature verification, not product analytics; build-tool trust remains relevant. |
| uuid 9.0.1 / 7.0.3 | Firebase tools / Xcode project generation; buffer-boundary advisory, tooling exposure. |
| basic-ftp 5.3.1 | Firebase tools proxy/get-uri path, developer-only listing-parser DoS. |
| @opentelemetry/core 1.30.1 | Firebase tools/pubsub, developer-only baggage allocation. |
| re2 1.24.1 | Developer tooling, native regex crash/memory advisories; no mobile source import. |

Source inspection distinguishes dependency presence from execution: the active
`expo-router/build/fork/getStateFromPath.js` delegates to `parseQueryParams` in
`getStateFromPath-forks.js`, which uses the URL's `searchParams`. The vendored
`build/react-navigation/core/getStateFromPath.js` retains `queryString.parse`;
`build/fork/getPathFromState.js` and `getPathFromState-forks.js` import query-string.
These installed paths justify retaining the release gate, but do not establish
that a malformed inbound link reaches the vulnerable decoder in this app.

The [decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
identifies 0.5.0 as patched. That release is ESM-only; installed query-string uses
a CommonJS function import with `^0.2.2`. A blind override is incompatible and
outside the supported range. npm's proposed router 58 major upgrade is outside
this pinned SDK slice. No forced audit fix/major replacement was performed.
A reviewed upstream-compatible decoder/router remedy is required before release.
Other aggregate paths require planned compatible updates, not a claim that native
collection flags make dependencies safe.

## Acceptance evidence

On 2026-10-06, automated gates passed: typecheck (tools/mobile), ESLint, Prettier,
unit 305/305 (19 suites), mobile 92/92 (10 suites), and actual demo-pnpe
Auth/Firestore emulator integration 63/63 (2 suites). Expo dependency check
reported up to date. Expo Doctor initially failed because `.expo/` was not
ignored; after adding the ignore, 21/21 checks passed. Test output contained no
warnings. Android native dependencies emit deprecation/unchecked-operation
warnings, separately from passing JS gates.

Deferred regression coverage now includes rejected/serialized appearance writes,
unsubscribe after successful configuration refresh, valid multibyte JSON byte
limits, configured project match/mismatch before Auth/Firestore construction,
and deferred profile-save success/failure after logout or account switch. These
tests passed against existing guards; no runtime fix was required. Accessible
labels/alerts, long category/profile text, and modal semantics have explicit
component assertions without snapshots. Existing theme restoration and missing
configuration Home tests remain included. These do not prove actual speech or
layout/focus behavior on devices.

iOS command `npx expo run:ios --device <local iPhone 16 Pro UDID> --no-bundler`
generated the unconfigured native project and installed CocoaPods successfully,
then failed with xcodebuild code 70: no matching destination; Xcode reports
“iOS 26.5 is not installed.” Only iOS 18.5 runtime exists. `xcodebuild -showsdks`
lists 26.5 SDKs, but both normal and explicit simulator `-showdestinations` show
only the ineligible placeholder. The 18.5 iPhone 16 Pro is booted and its
deployment minimum is 16.4, so a shut-down simulator or app minimum is not the
cause. First-launch check succeeded. No other Xcode is installed. Host component
repair/installation or compatible Xcode/runtime selection requires owner
direction; no global developer path, native SDK pin, or host installation was
changed. iOS app launch, configured Firebase and VoiceOver checks are BLOCKED.

Initial Android command `npx expo run:android --no-bundler --device Medium_Phone_API_36`
(process-local Java 21 and Android SDK) booted the API 36 AVD and ran 527 Gradle
tasks, but failed after 7m28s with failed cache writes/daemon disconnect while
the host disk reached 100% (116 MiB available). A documentation patch also failed
to write at that point. No app was installed or observed. On continuation the
host had 7.0 GiB free; no files were deleted by this task. One bounded-worker
Android retry is recorded separately below.

The Android retry passed: same `expo run:android` command with process-local
`GRADLE_OPTS='-Dorg.gradle.workers.max=2 -Dorg.gradle.caching=false -Dorg.gradle.daemon=false'`,
Java 21 and Android SDK location. Gradle reported **BUILD SUCCESSFUL in 2m19s**,
565 tasks (55 executed, 510 up to date), APK installed, exit 0. The Expo wrapper
still supplies its own build-cache option; this is evidence of bounded workers
and a single-use daemon, not a claim that every cache was disabled. The host
had 9.8 GiB free after build. No files/caches were deleted by this task.

On Android 16/API36 `Medium_Phone_API_36` (`sdk_gphone64_arm64`), the installed
unconfigured app rendered actual public subcategory content with an
authentication-unavailable notice. Screenshots were captured and visually read
at ignored local paths `evidence/mobile-foundation/android-unconfigured-initial.png`
and `evidence/mobile-foundation/android-unconfigured-cold-home.png`. The latter
filename describes the intended check, **not a Home pass**: its actual image shows
Norms of Conduct, while the first shows Constitution. The user confirmed they
were interacting with the emulator; those route changes are not a demonstrated
runtime navigation defect. A cold `am start -W` was observed, but overlapping
user navigation prevents proving cold Home. UIAutomator exposed only the
development Tools overlay, so it did not establish app accessibility semantics.
The unavailable-auth notice appears against/over the status bar in these images;
safe-area placement needs a dedicated visual check. No runtime fix was inferred
from the uncontrolled interaction sequence.

## Controlled Android continuation, 2026-10-06

The user authorized a dedicated Android emulator session and temporary settings,
and explicitly chose to leave iOS blocked. The earlier uncontrolled observations
above are superseded by these controlled checks. Local screenshots/XML/build logs
are retained under ignored `evidence/mobile-foundation/continuation/`.

A configured native Android prebuild and build using the owner's ignored native
file paths succeeded: Gradle **BUILD SUCCESSFUL in 3m15s**, 566 tasks (412 executed,
122 from cache, 32 up to date), APK installed. Runtime Auth/Firestore testing used
only the named `pnpe-emulator` app against local `demo-pnpe` services. No production
account/profile writes, deployment, Remote Config publication or content import
occurred.

| Controlled Android check | Observed result |
| --- | --- |
| Guest and authenticated cold launch | Both launch Home; guest has no unsolicited auth prompt. |
| Public browsing | Fixed taxonomy and subcategory content reachable; unavailable question counts remain explicit. |
| Prompt cancellation | Maybe Later returns to the initiating Mock Exam overview. |
| Menu authentication | Native SDK registration/sign-in/logout and neutral password-reset acknowledgement work against local emulators. |
| Profile persistence/account switching | Local profile contains only displayName/createdAt/updatedAt; two accounts display their own names after switching back. |
| Retained intent | Start Mock Exam -> authentication -> Mock Exam preflight; no unavailable question session/timer is invented. |
| Auth form cancellation | Reset acknowledgement -> Return to Sign In -> Back returns Menu after the cancellation-race fix. |
| Light/dark/System and large text | Recovery notice readable below status bar; appearance controls reachable at font scale 1.5; System follows OS dark changes. |
| Keyboard | Actual registration fields and submission reachable with keyboard open at normal and 1.5 font scale; sign-in controls also visible at 1.5. |
| Network loss | Wi-Fi/data disabled and emulator host unreachable; public reviewers remain readable, authenticated identity/Sign Out remain available. Connectivity restored. |
| TalkBack | Service bound with spoken feedback; heading focus and dismissal restoration visually verified. Progress and Saved Questions receive restored focus; audible speech is unverified. |

Read-only owner Remote Config was exercised on a separate configured cold launch.
The installed Android SDK's private fetch metadata reports successful status `-1`
(confirmed against installed Firebase Config 23.1.0 constants), fresh fetch time
1791274624672, five-second timeout and one-hour minimum interval. Activated cache
has template version 0 and no remote parameters. Home renders bundled defaults;
this proves native fetch/activation, not validation of owner-supplied nonempty
`app_info`, `data`, or `config` values. Only metadata and parameter names were
inspected; owner configuration/credential contents were not printed or staged.
Metro was returned to emulator mode afterward.

Independent scoped reviews approved architecture boundary fixes (`948acfc`),
themed safe-area recovery notices (`54ac6ec`), required isolated native app options
(`4638525`), and auth-route cancellation (`9b18561`). Android focus restoration
checkpoint `7edce65` failed the native recheck despite passing synthetic tests.
The supported Android host hover-enter event in `07434f6` restores TalkBack focus
after native app-window return: Progress stayed focused after a probe dismissal,
and a noninstrumented cold-launch check restored Saved Questions after Android
Back. Heading and iOS behavior are preserved. Diagnostics were removed; no fixed
time delay was added. Independent scoped source re-review approved the fix with
no new Critical/Important findings.

Final controller checks on the permanent candidate passed: **316/316 unit tests
(19 suites), 102/102 mobile tests (10 suites)**. Both strict TypeScript projects,
bare ESLint, Prettier and whitespace checks also passed in final controller
verification. The earlier
63/63 actual local Auth/Firestore integration and 7/7 reference tests remain
recorded; unchanged rules/content were not redundantly rerun. Publication
eligibility remains zero. Expo dependencies and Doctor 21/21 passed during this
continuation; no dependency changes followed.

A single React startup warning about updating an unmounted component occurred in
an earlier run; later controlled cold launches did not reproduce it. This is not
a claim that every development/native log is warning-free. TalkBack and temporary
settings are restored after device checks. Android TalkBack and iOS VoiceOver
verification are now deferred by the user. iOS native build and Firebase checks
were blocked at that checkpoint; the 2026-10-07 continuation below supersedes
that status. Task 9 and the foundation are not declared complete.

## Controlled iOS continuation, 2026-10-07

The user resumed iOS build and Firebase flow checks after accepting the Xcode
license. Xcode **27.0 (27A266a)** now accepts the installed iOS **18.5** simulator
runtime. Device Hub (`com.apple.dt.Devices`) exposes the simulator controls in this
Xcode version. The previous Xcode 26.5 destination failure is historical.

Both owner Firebase files now live in the ignored worktree root. Their formats,
matching Firebase project IDs, Android package and iOS bundle identifiers were
validated without printing their contents. Configured iOS prebuild and CocoaPods
installation succeeded. `expo run:ios --device FFC1BAA2-881B-4513-B947-39F5374FF480
--no-bundler` exited 0: **Build Succeeded, 0 errors, 3 warnings**, app installed and
opened on iPhone 16 Pro. Warnings concern dependency analysis of native build
scripts; no warning-free build is claimed.

Actual native emulator initialization initially failed with
`app/unknown` / `FirebaseInstallations I-FIS008000`. The synthetic demo API key
was too short and lacked the required leading `A`. The installed iOS pod validator
requires 39 URL-safe characters beginning with `A`. Commit **1532d36** changes only
the demo key to a clearly synthetic value satisfying that format, with a regression
covering the iOS bridge contract and the installed RNFirebase JS registry on both
platforms. The existing demo app ID already satisfies the installed validator.
Named-app isolation, disabled data collection and local emulator endpoints remain.
No owner credentials are used as a fallback. RED: 1 failure / 11 passes; GREEN:
18 focused tests. Independent scoped review approved spec and quality, with no new
Critical/Important findings. The permanent candidate passed actual cold relaunch.

All Auth/Firestore checks below use the isolated `pnpe-emulator` native SDK app,
`demo-pnpe`, Auth `127.0.0.1:9099` and Firestore `127.0.0.1:8080`. No live Auth
account, production profile write, deployment or content publication occurred.

| Controlled iOS check | Observed result |
| --- | --- |
| Guest and authenticated cold launch | Home renders without unsolicited authentication; native session persists after restart. |
| Public browsing | Category and subcategory screens remain reachable, including Constitution; unavailable question counts remain explicit. |
| Registration and profile | Actual form creates a local account; Profile shows `iOS Reviewer`. Read-only local Firestore inspection confirms only displayName/createdAt/updatedAt, with timestamp fields. |
| Sign-in and logout | Actual native forms sign in successfully; Sign Out returns Menu to guest actions. |
| Account switching | A second existing demo account shows `SecondAndroidReviewer`; switching back restores `iOS Reviewer`. |
| Password reset and cancellation | Neutral acknowledgement appears; Return to Sign In then Back returns Menu. No reset credential was changed. |
| Protected intent and cancellation | Maybe Later returns to Mock Exam overview; sign-in from Start Mock Exam resumes preflight with 150 questions/180 minutes and explicit unavailable-session notice. No timer starts. |
| Dark recovery notice | Text remains readable below the status bar and Appearance controls remain reachable. Original System app appearance restored. |

A separate configured cold launch verified **read-only native iOS Remote Config**.
SDK metadata reports `lastFetchStatus: success`, fresh `fetchTimeMillis:
1791338281613`, five-second fetch timeout and one-hour minimum interval. Parameters
`app_info`, `data`, and `config` all report source `default`; there are zero remote
parameter names. This proves a successful native fetch/activation with bundled
fallbacks, not validation of a nonempty owner payload. Only status/source metadata
was recorded. The temporary configured Metro server on 8083 was stopped, and the
app returned to local emulator mode on 8082, guest Home, System appearance.
Android Metro on 8081 and existing local emulators were preserved.

Fresh final source verification: **316/316 unit tests (19 suites)** and **103/103
mobile tests (10 suites)** passed, alongside both strict typechecks, ESLint,
formatting and diff checks. Native build and screenshots/metadata are retained in
ignored `evidence/mobile-foundation/continuation/ios-*` files. No owner files are
staged. Temporary diagnostics lived under `/tmp`, not product source.

The follow-up device session below completes the remaining controlled checks.
VoiceOver and TalkBack remain explicitly deferred, not failed or passed. Branch
integration and dependency release blockers remain separate; this report does
not declare the foundation complete.

## Final review and device follow-up, 2026-10-07

The user authorized reopening closed emulators. Local Firebase services and
Android/iOS Metro were restarted; ephemeral emulator accounts from earlier
sessions were not assumed to survive. No production writes or owner-file changes
occurred. A disposable account was prepared through local Auth REST for the
connection-loss check, then signed in through the actual native iOS form.

On iPhone 16 Pro/iOS 18.5, actual Settings Larger Text was set to 64% of the
accessibility range. Create Account scrolls to Sign In Instead and Back. After
scrolling, the focused Confirm Password field is visible above the software
keyboard; dragging dismisses the keyboard and exposes the lower controls. Earlier
ineffective gestures did not reproduce in this controlled check. The Device Hub
inspector value alone is not proof of native font size. Settings was returned to
50% of the standard range with Larger Accessibility Sizes off. System appearance
followed OS Dark to Light live. Final state: guest, app System, OS Light,
VoiceOver off, Capture Keyboard off.

The local Auth/Firestore service processes were temporarily paused with SIGSTOP
and resumed with SIGCONT. Public reviewers remained reachable, Menu retained the
native authenticated identity and Sign Out, and a cold restart opened Home and
retained that identity on Menu. This is a Firebase service-outage/network-failure
simulation, not a claim that all simulator network interfaces or host internet
were disabled. Services were resumed and the disposable account signed out.
Evidence: `ios-registration-large-keyboard.png`,
`ios-firebase-outage-auth-preserved.png`, and
`ios-firebase-outage-cold-auth.png` under the ignored continuation directory.

The whole-branch review identified four Important and two Minor source findings.
Commit `02bbd96` adds safe auth recovery with Retry/Back, visible public pending
request cancellation, independent config cache operations, correct semver build
and prerelease comparison, maintenance content inside Home's safe scroll area,
Home identity and Menu Guest User/Progress, and precise dependency reachability
wording. Independent scoped re-review approved all six fixes with no introduced
Critical or Important findings. Version comparison reads configured Expo app metadata derived from
package.json, not native binary version fields; this foundation has no OTA
version updates. A 10,000-character maintenance notice has structural/component
scroll coverage; no live owner maintenance payload was published for a native
check. Actual iOS unavailable Progress -> Cancel request stays on Home, and
`pnpe://profile` -> Back to public browsing returns Home. Both devices were returned
to local emulator mode. Android reopened and cold-started public Home; the current
computer-control session does not expose Android touch controls, so no new Android
touch acceptance is claimed.

Post-fix worker gates pass: **318 unit tests (19 suites), 130 mobile tests (11
suites)**, both strict TypeScript projects, ESLint, formatting and whitespace.
Fresh controller integration checks pass **63/63 actual local Firebase tests**
and **7/7 reference tests**, reusing the running demo services. Tests reset only
local disposable Firestore data.

Fresh online Expo validation now fails: `expo install --check` exit 1 and
Doctor **20/21**, solely for four patch-version mismatches. The October 6 SDK 57
patches expect Expo 57.0.27, Constants 57.0.21, Linking 57.0.12 and Router 57.0.25;
installed versions remain 57.0.26/57.0.20/57.0.11/57.0.24. Earlier recorded checks
passed before this updated recommendation. Official SDK-57
[Expo changelog](https://github.com/expo/expo/blob/sdk-57/packages/expo/CHANGELOG.md)
and [Router changelog](https://github.com/expo/expo/blob/sdk-57/packages/expo-router/CHANGELOG.md)
record the releases; Router includes a route-parsing/loader-key fix. Package
metadata for Router 57.0.25 still depends on query-string ^7.1.3, so those patches
alone do not establish decoder advisory remediation. No versions, lockfile or
native projects were changed in this review wave. Dependency maintenance must
restore compatibility gates and separately address the recorded advisory.

Host storage had about **1.3 GiB available** before these checks and fell to
**309 MiB** at the final checkpoint. Further installs/builds are blocked by this
resource constraint. The owner was
asked to make roughly 10 GiB available for dependency updates and native rebuilds;
no files or caches were deleted. Task 9 remains incomplete while required Expo
compatibility checks fail. No merge, push, deployment or scratch cleanup occurred.

## Release gates

Resolve failing Expo compatibility checks, branch integration and
runtime dependency blockers. TalkBack and VoiceOver verification are deferred from the current scope
by the user; revisit them when that scope is resumed. Supply real privacy/terms/support content, account deletion and data
retention processes, legal rights to all redistributed source content, editorial
approval, and reviewed Firebase rules/environment deployment. Account deletion is
not implemented in this slice. Store review, signing, production rules deployment,
question import, upload, and publication remain separate authorized work.

## Chronological implementation rulings

The following records preserve the controller's decisions and cost-if-wrong
before scratch-plan cleanup. They do not authorize additional scope.

Ruling: centralize Task1's initial mock-exam display defaults behind an injectable presentation model, then wire Task2's validated configuration in Task8 — Task1 mandates the invitation before ConfigRepository exists, while the spec forbids screen-owned exam configuration — if wrong, one temporary adapter needs refactoring; no duplicated screen constants or active session engines are introduced.

Ruling: retain profile-write recovery in application/provider-owned state when registration's auth callback navigates away, with profile-only retry accessible after authentication — Task4/6 require account success plus recoverable profile failure, while Task5/8 resume immediately on authenticated state — if wrong, recovery coordination may need simplification; repeat account creation and silently lost profile errors remain prohibited.

Ruling: align bundled app-info minimum version with the actual local application version until owner-supplied release versions exist — the examples are not binding versions and package currently uses 0.1.0 — if wrong, release defaults need revision, without accidental unsupported-version blocking of this development build.

Ruling: preserve the user's Remote Config example integration keys mockExam.passingPercentage and features.examHistory instead of newly coined passingThreshold/history — approved spec names concepts without prescribing replacements, so retaining original configuration vocabulary avoids unnecessary divergence — if wrong, one schema/default/consumer mapping needs migration; internal presentation labels may still use threshold/history terminology.

Ruling: preserve original app_info.minimumSupportedVersion and app_info.termsUrl keys, and default reviewer.shuffleQuestions to true while keeping answer order fixed and including all eligible questions — original user JSON/discovery provide compatible vocabulary and order settings, and approved read-through design permits shuffled question order without scores or caps — if wrong, bundled defaults or the integration schema need a deliberate migration; the real Remote Config schema has not been supplied separately.

Ruling: permit focused PublicBootstrapProvider/appearance adapter/RecoveryAwareKeyValueStore support plus root layout/Home recovery wiring, and a minimal native configuration guard or conditional react-native.config.js only if pinned native setup requires it — brief mandates observable recovery and missing-config public launch but omits composition/support files, while ConfigRepository deliberately catches I/O errors — if wrong, bootstrap boundaries may need consolidation; Task8 must reuse this lifetime/composition rather than initialize twice, and native builds still require actual later verification. Preserve shared storage/appearance validation and public readiness independent of hanging local/native/network work.

Ruling: use the pinned SDK's supported CocoaPods/static-framework opt-out with ios.disableSPM:true and matching Expo build-properties forceStaticLinking for every RNFB native module — installed declarations and primary documentation explicitly support this consistent native linkage path, with existing CocoaPods host and analytics-without-ad-ID requirements — if wrong, native linkage configuration needs rebuilding or switching to supported dynamic SPM; no native SDK version override or claimed build success is permitted.

Ruling: add a per-parameter remote-freshness guard in ConfigRepository with deferred-cache regression — nonblocking startup intentionally overlaps local and remote loading, which otherwise lets an old delayed cache overwrite accepted remote data — if wrong, cache precedence may require adjustment; invalid remote values must still allow validated cache fallback, and refresh may not wait behind hanging storage.

Ruling: add tiny plugins/withFirebaseCocoaPods.cjs in unconfigured mode using pinned withIosDisableSPM helper without full Firebase app plugin — omitting app plugin avoids unconditional native configure but otherwise omits disableSPM while pods autolink, creating an inconsistent static/default-SPM setup; controller inspected helper's tagged Podfile-only transform — if wrong, native plugin integration needs revision; reliance on pinned internal helper must be verified when upgrading, and actual generated transformation/idempotence tests plus later builds remain required.

Ruling: allow narrowly scoped Jest-only dynamic-import transformer/caller settings and precise ESLint package-name boundary patterns plus Node-plugin CommonJS allowance — Expo57 Jest marks Babel caller metro and leaves import() incompatible with Jest29, while broad firebase/* pattern also falsely bans relative central-infrastructure imports — if wrong, test transformation or import-policy coverage needs revision; production Metro, Admin/web SDK bans, raw RNFirebase SDK placement and TypeScript strictness remain unchanged, and no broad source exceptions are permitted.

Ruling: explicitly pin compatible Babel7 dynamic-import/CommonJS transform plugins as dev-only Jest dependencies after the existing caller override reproduced both failures — installed Expo/native presets provide syntax support without lowering and the tests must exercise real adapter branches rather than skip them — if wrong, Jest transform compatibility or dependency pins require revision; production Metro/Babel configuration remains untouched.

Ruling: profile documents use users/{uid}, allowlisted displayName/createdAt/updatedAt, trimmed nonempty names of at most100 characters, preserving createdAt and server-updating updatedAt — original user collection and Task6's name bound align Task4/7 contract, which omits explicit bounds/path — if wrong, profile schema/forms/rules require a coordinated migration; no email authority or additional personal fields are introduced.

Ruling: SafeOrigin uses a closed union home/mockOverview/reviewerOverview(optional taxonomy-validated category/subcategory, subcategory requires category)/menu/appearance/about/privacyPolicy/terms, and coordinator may expose voluntary beginSignIn/beginRegistration, password-reset choice and retry — Task5 omits route enumeration while Task6/8 mandate public routes, both Menu auth entries and resolving retry; preserve origin rather than persist raw routes — if wrong, origin schema/coordinator/router mapping need coordinated revision; no arbitrary URLs or executable callbacks may enter persisted intents.

Ruling: add focused application RegistrationController with provider-owned lifetime, stable snapshot/subscription, register/retryProfile and auth-account/lifetime synchronization — forms must preserve successful registration and pending profile-save recovery across immediate auth navigation; screen-local state cannot meet prior ruling — if wrong, registration application orchestration needs refactoring; passwords never enter snapshots/storage and account switch/logout must prevent stale UID retries. Controller uses existing ProfileRepository.save, not a new duplicate port; provider recovery UI belongsTask8.

Ruling: remote category metadata at categories/{categoryId} uses categoryId/closed availability/subcategory availability array; known counts are nonnegative safe integers with ISO asOf, unknown is explicit, future or older than injected policy's default24h becomes unknown — Task7 requires expiry handling but omits DTO/freshness threshold, and counts are informational never session authorization — if wrong, metadata DTO/freshness policy needs migration; missing/malformed data still preserves bundled categories without fabricated counts, no RC expansion or production metadata write is introduced.

Ruling: export PublicDependencies support type and safeStorage:KeyValueStore pointing to PublicBootstrapProvider's existing recovery-aware instance — Task8 needs coordinator/settings storage while bootstrap alreadyowns wrapper, so sharing avoids duplicate initialization/recovery owners — if wrong, publicdependency surface needs narrowing/refactoring; no new native/config/theme/storage lifetime is created.

Ruling: add typed native View ref forwarding to AppButton and update native-boundary tests to the moved actual Home wrapper/harness while preserving startup assertions — integration found PressableProps does not include ref despite Task6 report assumption; prompt focus restoration needs initiating-control handles and Task8 explicitly removes old index route — if wrong, button typing/test composition needs revision; no visual change or weakened missing-config/hanging-startup coverage is permitted.

Ruling: retain pinned Expo Router dependency and document GHSA-vcc3-ghjq-m6fr as a runtime release blocker instead of overriding decode-uri-component to0.5.0 — upstream query-string7.1.3 requires CJS function/^0.2.2 while patched0.5.0 is ESM-only/outside range, so blind override breaks routing and an adapter/SDK migration exceeds this verification task — if wrong, a compatible smaller patch may have been missed; affected deep-link query parsing remains vulnerable until a reviewed supported remediation, and this branch is not release-ready.


Ruling: use configured Expo app version derived from package.json for minimum-version gating in this foundation, explicitly not binary version fields — no OTA version changes enabled and existing installed APIs expose manifest metadata; if wrong, add native binary-version integration before introducing OTA/version divergence.

Ruling: retain reviewed dependency pins through this final source fix wave and record newly failing online compatibility checks for a separate maintenance slice — the October 6 patches change routing and need independent verification/native rebuilds, while host space of 1.3 GiB constrains builds; if wrong, this delays a small compatible patch update, but no failing gate is hidden or waived.
