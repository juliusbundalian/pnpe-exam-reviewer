# SDK 57 maintenance — 2026-10-07

The online baseline `npx expo install --check` exited 1 and recommended exactly
four updates. The final direct versions are `expo` 57.0.27, `expo-router` 57.0.25,
`expo-constants` ~57.0.21, and `expo-linking` ~57.0.12. Exact/tilde conventions and
all unrelated direct dependencies, including RNFirebase 26.4.0, are preserved.

The lockfile also updates fourteen required Expo transitives: @expo/config
57.0.10, @expo/config-plugins 57.0.10, @expo/image-utils 0.11.6,
@expo/metro-config 57.0.13, @expo/metro-file-map 57.0.4, @expo/prebuild-config
57.0.17, @expo/require-utils 57.0.6, @expo/ui 57.0.22, babel-preset-expo 57.0.14,
expo-asset 57.0.19, expo-modules-autolinking 57.0.14, expo-modules-core 57.0.21,
Expo's nested @expo/cli 57.0.28 and its nested @expo/router-server 57.0.12.
Each prior version fails at least one incoming dependency range in the final
lockfile. Unrelated npm refreshes were restored before verification. No overrides
were added, peer checks bypassed, or audit fixes applied.

Upstream package metadata was fetched using `npm view`; the authoritative
[Expo 57.0.27 metadata](https://registry.npmjs.org/expo/57.0.27) and
[Router 57.0.25 metadata](https://registry.npmjs.org/expo-router/57.0.25)
identify the changed requirements. The online compatibility check passes after
installation; Expo Doctor passes 21/21 checks. Offline validation initially
reported success against the old local map with an explicit reliability warning;
that result was not accepted as current compatibility evidence.

Verification: typecheck (tools/mobile), lint, format:check, test:unit (318 tests,
19 suites), test:mobile (130 tests, 11 suites), test:references (7 tests, 1 suite),
validate:questions (`eligible: 0`), Expo check, Expo Doctor and diff --check all
exit 0. Initial lint detected an ignored evidence `.cjs` script because ESLint
still scans evidence; preserving it as `.cjs.txt` resolved the failure without
changing lint configuration. Initial question validation failed on sandbox IPC
socket permission and passed on its authorized outside-sandbox rerun. Exact
commands, exits and complete logs are preserved in ignored
`evidence/mobile-foundation/sdk57-maintenance/commands.tsv` and sibling logs.
Native rebuilds, device checks and emulator integration belong to the controller
and are not claimed by this dependency-maintenance evidence.

## Decoder advisory remains a release gate

[GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
affects decode-uri-component <=0.4.2 and identifies 0.5.0 as patched. These four
compatibility patches **do not remediate it**. The installed path remains
expo-router 57.0.25 → query-string 7.1.3 → decode-uri-component 0.2.2.

Installed source inspection traces the app linking configuration through
`build/link/linking.js` to the Expo fork of `getStateFromPath`, which delegates
query parsing to `getStateFromPath-forks.js`; that parser obtains a URL's
`searchParams`. Its former queryString.parse block is commented out. The
separate vendored React Navigation parser still calls queryString.parse. Expo's
outbound serializers import query-string and call stringify; query-string
requires the decoder at module load. Thus the decoder lies on a static mobile
bundle import graph even though this does not prove a vulnerable decode call
on an inbound link. This slice did not produce or inspect a fresh native bundle
or establish native execution of the vulnerable function. An isolated benign
Node probe confirms stringify invokes the decoder zero times, whereas parsing
`q=safe%20value` invokes it twice. That probe tests query-string's implementation,
not actual app link reachability; no denial-of-service input was executed.

[query-string 7.1.3 metadata](https://registry.npmjs.org/query-string/7.1.3)
requires ^0.2.2 and its code expects a CommonJS function. The patched
[decoder 0.5.0 metadata](https://registry.npmjs.org/decode-uri-component/0.5.0)
is ESM-only and outside that range. Current
[query-string 9.5.1 metadata](https://registry.npmjs.org/query-string/9.5.1)
uses ^0.5.0 but is a major ESM migration outside Router 57's requirement.
There is no demonstrated supported SDK 57 dependency-only remedy.

npm audit exits 1 with 85 findings (20 moderate, 65 high; no critical) and proposes
Router 58.0.16 as a major decoder remediation. Its
[package metadata](https://registry.npmjs.org/expo-router/58.0.16) removes
query-string, requires SDK 58 peers and is tagged `next`; SDK 57/latest remains
57.0.25. A concrete next step is a separately reviewed SDK 58 migration evaluation
once supported for this app, verifying removal of affected packages, URL/query
semantics, RNFirebase/native compatibility, and both platform builds. Alternatively
request an upstream SDK 57 backport. The pre-release next tag and audit suggestion
are not compatibility approval. Keep the release gate pending that work and
actual app reachability verification.

## Controller native verification and independent review

The independent task review of bc54521..caaa66a approved specification compliance
and quality with no findings. The completed whole-foundation review was not repeated.

Updated-tree Auth/Firestore integration passes 63 tests across two suites against
the actual local demo services. Android configured prebuild, build and install
exit 0: Gradle 1m16s, 566 tasks (285 executed, 267 cached, 14 up to date). iOS
configured prebuild/CocoaPods, build and install exit 0 on Xcode 27.0/iOS 18.5
iPhone 16 Pro: zero errors and three script warnings. Upstream Android Kotlin
and Gradle deprecation warnings remain in the full build log. Generated native
projects and owner configuration files remain ignored.

Both updated binaries load their platform-specific Metro environments (Android
10.0.2.2:8081, iOS 127.0.0.1:8082) and show public Home. Both platforms visibly
open `pnpe://review/generalInformation?source=patch%20check` as the General
Information overview. This benign routing smoke check does not establish
execution of the vulnerable decoder. Android native logs show initialization
of the named pnpe-emulator app. Generated iOS settings retain static frameworks,
all five RNFB force-static entries and the disableSPM Podfile transform. No
native SDK versions or collection settings changed.

The first Android debug startup displayed authentication recovery. Its logs also
show an invalid persisted demo refresh token after the local Auth service was
restarted without the previous in-memory accounts. Those observations do not
prove that the token caused the startup notice. A second controlled cold launch
against the correct Android Metro environment shows Home without that notice.
No account/session data was deleted to obtain this result. Native sign-in and
profile interactions were not repeated in this dependency slice; the earlier
controlled acceptance remains historical evidence, not a fresh auth claim.

Computer Use returned `Computer Use was not approved to use Device Hub`.
Consequently no new touch, keyboard, settings or screen-reader acceptance is
claimed. CLI lifecycle, native screenshots and build logs provide the scoped
launch/routing evidence above. Evidence is preserved under
`evidence/mobile-foundation/sdk57-maintenance/`. Both devices and the local
Auth/Firestore and Metro services remain available; no production writes,
publication, merge, push or scratch cleanup occurred.

The failing compatibility checks and required updated native builds from the
handoff are now resolved. The maintenance slice is verified and independently
reviewed. The decoder/audit release gate remains open; this is not a release-ready
verdict or a claim that Reviewer, Mock Exam or offline/personal engines exist.
