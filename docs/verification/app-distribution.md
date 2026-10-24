# Firebase App Distribution: Android internal test

On 2026-10-13, the Android app in Firebase project `pnpe-exam-reviewer` was onboarded to App Distribution. Firebase app ID: `1:426939280805:android:94623f6eb92e769d318c4c`; package: `com.pnpe.exam.reviewer`. The `Internal Testers` group has alias `internal-testers` and currently has no testers.

The first release is [0.1.0 (1)](https://console.firebase.google.com/project/pnpe-exam-reviewer/appdistribution/app/android:com.pnpe.exam.reviewer/releases/39v58u6rogm9o). It was built from `feat/mock-exam` commit `5e2c43a` with the ignored `.env.local` pointing at the production Firebase config files. The APK SHA-256 is `68375bc9c7f584ce49e41b80849d1fd06ece85924caadbc15458743fe7561bca`.

On 2026-10-14, [0.1.0 (2)](https://console.firebase.google.com/project/pnpe-exam-reviewer/appdistribution/app/android:com.pnpe.exam.reviewer/releases/3t8ut8h2nlbfo) replaced the default launcher artwork with the owner-provided `assets/icon.png`. The source asset is a byte-for-byte copy of `ic_pnpe_exam_reviewer.png`. Expo generated the Android launcher icon and an opaque 1024×1024 iOS icon from it. The arm64 APK SHA-256 is `2468238641b48c6ac00686525c2bf5b808cfde1870c9d1ae1f604c74e2ba43d6`; it passed signature verification, installed over build 1 without clearing app data, and launched on the Android API 36 emulator. The iOS icon was generated but no IPA was built.

Build command from this worktree after `npx expo prebuild --platform android --no-install --clean`:

```sh
cd android
ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon --max-workers=2 --console=plain
```

Upload command from the worktree root after authenticating the Firebase CLI:

```sh
node_modules/.bin/firebase appdistribution:distribute android/app/build/outputs/apk/release/app-release.apk \
  --app 1:426939280805:android:94623f6eb92e769d318c4c \
  --project pnpe-exam-reviewer \
  --groups internal-testers \
  --release-notes 'Describe this test build' \
  --non-interactive
```

The APK includes an embedded JavaScript bundle, passed APK signature verification, and launched on the Android API 36 arm64 emulator without Metro. Its release build uses the Expo-generated Android debug signing key. Keep that key consistent and increase `android.versionCode` for subsequent in-place updates; establish a dedicated release signing key before any store release. This is an arm64 APK, not a universal Android build. No iOS IPA was built or distributed.

## 2026-10-17: UI refresh, build 3

Uploaded [0.1.0 (3)](https://console.firebase.google.com/project/pnpe-exam-reviewer/appdistribution/app/android:com.pnpe.exam.reviewer/releases/7kaj0d59c9dl0) to the existing `internal-testers` group. [Tester release](https://appdistribution.firebase.google.com/testerapps/1:426939280805:android:94623f6eb92e769d318c4c/releases/7kaj0d59c9dl0). The group had no members at upload time; no tester invitations were added.

Built from the current `feat/mock-exam` working tree, including its uncommitted UI changes, on base commit `a57bcf7`. This release includes the redesigned five tab pages and icon navigation bar, mock-exam briefing and question layout, fixed exam action bar, conditional submission, and question-state navigator sheet.

- Android version code increased to 3; version name remains 0.1.0.
- Arm64 release APK SHA-256: `cd6489dd4fadcce0e49137a0aca8ebfb5e55c2b879cab38cee3fecd5c1890be4`.
- `assembleRelease` succeeded. APK signature verification passed and its signing certificate matches build 2 (`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`).
- Verified inside the final APK: embedded JavaScript bundle, icon fonts, Firebase mode `configured`, project `pnpe-exam-reviewer`, and version code 3. No local emulator settings are embedded in its Expo configuration.
- Installed and launched the release on the API 36 Pixel 9 emulator in a temporary, isolated Android user profile. Home and all five bottom-navigation icons rendered without Metro. Screenshot: `evidence/app-distribution/build-3-home.png`. This was a launch smoke check, not an authenticated release examination acceptance run.
- Removed the temporary Android profile and restored the development build/preview without clearing the owner's app data.
- Firebase CLI confirmed upload, release notes, and group distribution succeeded. No iOS build or store upload was performed.
