# Firebase App Distribution: Android internal test

On 2026-10-13, the Android app in Firebase project `pnpe-exam-reviewer` was onboarded to App Distribution. Firebase app ID: `1:426939280805:android:94623f6eb92e769d318c4c`; package: `com.pnpe.exam.reviewer`. The `Internal Testers` group has alias `internal-testers` and currently has no testers.

The first release is [0.1.0 (1)](https://console.firebase.google.com/project/pnpe-exam-reviewer/appdistribution/app/android:com.pnpe.exam.reviewer/releases/39v58u6rogm9o). It was built from `feat/mock-exam` commit `5e2c43a` with the ignored `.env.local` pointing at the production Firebase config files. The APK SHA-256 is `68375bc9c7f584ce49e41b80849d1fd06ece85924caadbc15458743fe7561bca`.

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
