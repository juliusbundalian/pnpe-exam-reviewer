# PNPE Exam Reviewer

This checkpoint provides a developer content toolchain: source evidence,
conservative candidates, stable identities, editorial approval validation, and
guarded Firestore import. It accounts for 687 source occurrences across three
references. The owner has approved 529 distinct questions: the initial twenty
plus the exact 509-revision full-corpus manifest. All 529 pass strict publication
validation; 145 drafts and 13 rejected duplicates remain excluded. Category pools
meet the default 150-question exam quotas. See the
[approved publication and coverage](docs/verification/editorial-full-corpus/approved-publication.md)
for exact authorization, counts and the verified local demo catalog: 529 questions
at head revision 2. Source counts are not counts of unique or publishable questions.

The mobile foundation adds a public Home, four categories and fifteen
subcategories, appearance settings, and an authentication shell. Native/device
acceptance and release blockers are tracked in the
[mobile verification record](docs/verification/mobile-foundation.md); the foundation
must not be called complete while mandatory checks remain blocked. The content
Reviewer, viewed progress, bookmarks, SQLite persistence and owner-only sync are
implemented on the feature branch. Recorded automated checks pass, and the
Android development build has partial device acceptance. Remaining Android
checks, iOS acceptance and native gate/performance observations keep this slice
partially verified. See the
[content Reviewer verification record](docs/verification/content-reviewer.md)
for evidence and outstanding checks. Mock Exam, results and history are the next
separately approved slice. No service has been deployed.

Use Node 24 and `npm ci`. Unit tests require Python 3; extraction requires
the pinned Python environment described in [the content workflow](docs/content-workflow.md).
Firebase Admin 14.5.0 and Firebase Tools 15.32.1 are developer dependencies only.
No production project or credentials are needed for local acceptance.

```sh
npm run test:unit
npm run test:mobile
npm run typecheck
npm run lint
npm run format:check
npm run test:emulator # Java 21 required
npx expo install --check
npx expo-doctor
```

With all original PDFs and extraction evidence supplied, run
`npm run process:references`, `npm run validate:questions`, and
`npm run test:references`. Missing reference prerequisites fail explicitly.
See [the workflow](docs/content-workflow.md) for extraction, approval lifecycle,
dry-run/apply safeguards, credentials separation, and no-delete recovery.
Measured acceptance results are in [the verification record](docs/verification/content-toolchain.md).

The software license does not establish rights to redistribute the PDFs or their
content. Originals, generated evidence, credentials, and import manifests remain
untracked. No deployment command is included in scripts or CI.

## Mobile development

Use the installed Expo 57 / React Native 0.86 native development client, not Expo
Go. See `.env.example` and the verification record for native build prerequisites,
the three Remote Config JSON schemas, emulator separation, actual acceptance
results, and remaining release gates.

For a public-only build, leave both `GOOGLE_SERVICES_ANDROID` and
`GOOGLE_SERVICES_IOS` unset. For configured builds, set them to absolute paths to
the owner's ignored `google-services.json` and `GoogleService-Info.plist`; both
must exist. Their registered identity is `com.pnpe.exam.reviewer`. Set
`EXPO_PUBLIC_FIREBASE_MODE=configured` and `EXPO_PUBLIC_FIREBASE_PROJECT_ID` to
the matching project ID. Native configuration files are not Admin credentials.
Never put a service-account key or Admin ADC in any Expo variable.

```sh
# Re-run prebuild when switching native configuration; generated projects ignored.
npx expo prebuild
npx expo run:ios
npx expo run:android
```

For isolated Reviewer acceptance set mode to `emulator`, project to `demo-pnpe`,
and emulator host to `127.0.0.1` (iOS simulator) or `10.0.2.2` (Android emulator).
Explicitly set `EXPO_PUBLIC_FIREBASE_AUTH_PORT=9199` and
`EXPO_PUBLIC_FIREBASE_FIRESTORE_PORT=8180`; omitted overrides retain the original
live demo defaults and are unsuitable for isolated acceptance. This creates a
named Firebase app; Remote Config uses bundled defaults in this mode.

Run the guarded `npm run test:emulator` to completion before starting a separate
acceptance lifetime with
`npx firebase emulators:start --only auth,firestore --config firebase.study-tests.json --project demo-pnpe`.
The test runner resets isolated data, so never run it during device scenarios.
Preserve existing services on Firestore 8080, Auth 9099 and Metro 8081/8082.
Use a separately checked free Metro port and rebuild/restart Metro with the same
explicit environment. Only isolated emulator accounts and an authorized copy of
the approved bank may be written for acceptance. The
[verification record](docs/verification/content-reviewer.md) lists the remaining
native checks. A live Remote Config fetch remains a separate read-only check.

`eas.json` contains profiles only. No remote builds, store registration, uploads,
production writes, or deployment are authorized by these setup commands.
