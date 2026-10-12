# Mock Exam verification

Date: 2026-10-12. Branch: `feat/mock-exam` in `.worktrees/mock-exam`.
Status: implementation and automated verification complete; Android acceptance
partial. This record does not authorize merge, production import, deployment or
release. The [approved design](../superpowers/specs/2026-10-11-mock-exam-design.md)
and [implementation plan](../superpowers/plans/2026-10-12-mock-exam.md) define
the target behavior.

## Automated checks

On the feature branch, `npm run test:unit` passed 43 suites/643 tests;
`npm run test:mobile` passed 22 suites/262 tests; and
`npm run test:exam-emulator` passed 5 suites/81 tests with Java 21 on the
separate Firestore 8280/Auth 9299 test profile. Typecheck, lint, format check,
`npx expo install --check` and `git diff --check` passed. The complete unit and
mobile suites were rerun after the independent review corrections. The original
8180/9199 Reviewer runner was not restarted or reset. The approved
`data/questions.json` Git blob remained
`4be1bf329d21201382536ef230f2fb9be82f5244`, and the approval manifest
blob remained `28025a8b27df3dcb5a57d327fa392b14c977bf71`, matching the
pre-feature base `f868fd6`. These are code and emulator tests, not substitute
evidence for device behavior.

## Android acceptance environment

The Android API 36 ARM64 `Medium_Phone_API_36` emulator ran the existing
compatible debug development client, package `com.pnpe.exam.reviewer`, version
0.1.0 (code 1), APK SHA-256
`94ae7f7e6cc1bae9bcc02dee194bb2321ee681e9592842caaf430a9139806ca6`.
Native dependencies did not change in this slice. The feature Metro bundle ran
on port 8084 with explicit emulator mode, project `demo-pnpe`, host `10.0.2.2`,
Auth 9299 and Firestore 8280. The guarded emulator tests finished before this
persistent acceptance lifetime. An authorized copy of the approved 529-question
bank was imported into the fresh exam profile. The observed head generation was
`7f8f7ded0edcea40cbba7a5180b9713f6c0edec8f76eac7f60558e8a13a0775b`,
revision 1. The separate Reviewer 8180/9199 lifetime and original demo catalog
were not reset.

Synthetic account A (`mockexam-a@example.test`) started one 150-question,
180-minute attempt. The public overview and authenticated preflight displayed
the exact 35/40/25/50 quotas and practice-threshold disclaimer. Start showed
preparation before the timer began. The runner displayed question 1 of 150;
selecting a choice and flagging it showed a saved state. Compact and expanded
navigators marked the current answered/flagged question, and navigation reached
question 2. After a force-stop and cold relaunch, **Resume Exam** restored
question 2 and the remaining countdown rather than starting a new attempt.

With Android Wi-Fi and data disabled, manual submission warned about exactly
149 unanswered questions. **Submit Anyway** immediately produced a local
terminal result: 0 correct, 1 incorrect, 149 unanswered, 0.00%, manual
completion, and cloud sync pending. Submitted review used frozen question text
and exposed the selected answer, correct answer and explanation. After network
reconnection, history showed that attempt once as synced. An Admin read of the
isolated Firestore emulator found one `ready` root with `itemCount: 150` and
exactly 150 child item documents for the attempt. During an authenticated
session with networking disabled, History showed the saved attempt with an
explicit cloud-unavailable notice. A later cold launch with networking still
disabled also restored A's authenticated Menu, local History and local Result.
After signing out and registering synthetic
account B (`mockexam-b@example.test`), History showed no completed exams; A's
result was not visible under B.

A read-only copy of the stopped app's SQLite files passed `PRAGMA quick_check`:
one completed attempt, 150 saved exam questions, one manual terminal result,
zero active attempts and zero pending exam outbox rows after sync. The raw copy
remains ignored local evidence and is not committed.

History and Result were also opened in the light appearance setting and at
Android `font_scale=1.5`; the longer result remained scrollable and both
**Review submitted answers** and **Exam History** controls were reachable.
The emulator font scale was restored to 1.0 afterward. This checks those
completed screens, not the active runner at enlarged text.

For background expiry, synthetic account B started a separate isolated
150-question attempt with a temporary **one-minute** validated duration
fixture. The runner showed 0:00:51 before backgrounding. On foreground it
showed 0:00:26, then automatically reached **Exam complete** at the deadline.
The saved result reported 0 correct, 0 incorrect, 150 unanswered, **Completed by
time limit**, 1 minute used, and cloud sync `synced`. The fixture changed only
the bundled duration, retained the approved bank and quotas, and was restored
to the 180-minute default immediately after this observation; a cold relaunch
displayed 180 minutes again. It was not a second live 180-minute attempt.

Screenshots and isolated logs are retained locally under ignored
`evidence/mock-exam/`; they contain practice content and emulator identity and
are not published. The debug-client timings here are not release-device latency
measurements.

## Open acceptance and release work

- **Offline notice layout:** An initial cold offline launch displayed a stale
  authentication notice over authenticated content; a coordinator fix clears
  that notice after a valid auth observation. A repeat cold offline launch
  opened local History and Result. The existing Reviewer study-sync offline
  notice still overlaps the status bar on History and needs a separate layout
  check. It does not block local exam records.
- **Android scenarios still unverified natively:** live configuration gate
  recovery, active-runner enlarged font and theme transitions, and
  accessibility navigator announcements. Deterministic tests cover gates but
  do not close these device checks.
- **Other platforms and services:** iOS and screen-reader acceptance, live
  Remote Config transition, release-build performance and production/release
  behavior remain pending. The original Reviewer and foundation acceptance
  records have their own outstanding checks.

The 75% threshold, 150 questions, 180 minutes and quotas are application
practice settings, not verified official examination claims. Deferred drafts,
unsupported required assets and production data were not used for this test.
