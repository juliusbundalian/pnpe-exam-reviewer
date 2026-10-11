# Mock Exam, results and history design

Date: 2026-10-11

Status: draft for owner review. This specification does not authorize production
writes, deployment or release. It carries forward the approved
[foundation design](2026-10-04-foundation-and-content-design.md) and the session
decisions in the [discovery record](../../discovery/2026-10-03-repository-and-questionnaire-audit.md).

## 1. Intent and boundary

An authenticated learner can take a realistic timed practice exam from the
approved bank, resume it after closing the app, submit or expire it once, and
inspect durable results and completed history. The app is an independent
preparation tool. The count, distribution and threshold are application practice
settings, not verified official PNPE standards.

This slice replaces the current Mock Exam preflight placeholder and Exam History
availability screen. It adds exam-specific progress totals where the existing
Progress screen presents them; it does not change Reviewer scoring or introduce
weak-topic predictions, Custom Practice, diagnostic modes or editorial content
approval. The 145 deferred drafts and unsupported required image, diagram or
table questions remain ineligible. The 529 approved questions already satisfy
the default category quotas.

## 2. User flow and configuration

Public Mock Exam overview displays the validated configured count, duration,
exact category quotas, and app practice passing threshold. Start requires the
existing central authentication flow; login returns to preflight and never
starts the clock. An authenticated learner explicitly presses **Start Exam**.
Maintenance or unsupported-version configuration blocks new starts while
leaving a saved attempt, results, Home and information accessible. Existing
feature flags for history and progress affect their entry points and never
delete records.

Defaults remain 150 distinct questions, 180 minutes, a 75% app practice
threshold, and quotas of General Information 35, Verbal Reasoning 40,
Quantitative Reasoning 25 and Logical Reasoning 50. The latter two display
labels map to the existing `communicationSkills` and `criticalThinking`
category IDs. The entire validated `config.mockExam` is frozen per attempt.
Invalid remote configuration falls back atomically to the last known good
configuration or bundled defaults through the existing configuration repository.
No quota shrinks or draft substitution occurs when a pool is short.

Preflight reads a complete validated lightweight catalog, filters eligible
supported questions at the injected clock, selects exact quotas without
replacement, and retrieves every selected immutable question/stimulus/required
asset. It validates and durably persists all 150 snapshots and frozen question
and choice order before creating the active attempt and its deadline. A failed
fetch, validation or storage write leaves no running clock and offers Retry.
No whole-bank content download is needed merely to display the overview.

Within a category, use capacity-aware round-robin selection across nonempty
subcategories so one large pool does not monopolize the exam. Randomize the
selection/order with an injectable unbiased source when configured. Honor
fixed-order choice policy and shared-stimulus dependencies. Repeated Start taps
resolve to the same active attempt; one active exam and one active Reviewer may
coexist per account per device. Another device has a distinct attempt and
cannot take over a live attempt.

## 3. Active attempt

Persist an opaque attempt ID, owner UID/device ID, catalog generation, selected
question IDs/revisions, full validated content snapshots, frozen configuration,
question/choice order, cursor, answers, independent flags, start timestamp,
deadline timestamp and last effective observed time in versioned SQLite tables.
Use the existing owner guard and lazy protected-storage composition; public
Home must not open SQLite or download exam content.

The active screen shows one question and its choices, remaining time, position,
Previous/Next, flag and navigator. No correct answer, correctness state or
explanation appears before finalization. A selection can be changed or cleared
before the deadline. Each answer, flag and cursor change is serialized and
durably saved before the UI claims it is saved; failures show Retry without
pretending the mutation succeeded. The navigator offers Compact grid and
Expanded list with one-line truncated previews. Current, answered, unanswered
and flagged states have text/symbol labels as well as color. Flagging never
changes an answer.

The timer derives remaining time from the persisted deadline and an injected
clock; a UI interval only refreshes the display. Backgrounding, logout,
navigation and force-close never pause or reset it. Recheck expiry before every
answer write, navigation, foreground return, resume and submission. While the
process lives, a monotonic elapsed-time reference complements wall time.
Persist the last effective observed time so the displayed remaining duration
never grows after restoration. This limits ordinary clock changes but does not
claim tamper resistance across offline restarts.

Leaving warns that time continues and offers Stay or Leave and Resume Later.
Relaunch still opens Home, with an explicit Resume entry. If the deadline passed
while the process was suspended, finalize on the next execution opportunity
before allowing edits and offer Results. Auth recovery cannot restart the clock
or expose another account's attempt.

## 4. Finalization and results

Manual submission asks for confirmation. If questions remain unanswered, show
their exact count and **Continue Exam** / **Submit Anyway**. If the deadline
passes while the confirmation is open, expiry takes precedence. One serialized
SQLite transaction keyed by attempt ID rejects further edits, freezes the
answers, computes the result from the saved content/configuration snapshots,
stores a terminal attempt/result and enqueues one sync operation. Manual taps,
deadline and restore retries converge on that same result. Effective end time
for expiry is capped at the original deadline. A storage failure locks edits
and offers Retry against the durable state; a network failure never reopens a
completed attempt.

Correct means the selected choice ID equals the frozen correct choice ID.
Incorrect means a selected choice exists and differs. Unanswered is separate.
Overall percentage is `100 × correct / total`, including unanswered in the
denominator. Compare the unrounded score with the frozen practice threshold;
round only for display. Category/subcategory breakdowns show sample counts,
correct/incorrect/unanswered and percentages; empty groups say **No questions**.
Time used is clamped between zero and frozen duration. Results show the
finalization reason (`manual` or `timeExpired`) and a separate sync state.

Submitted-exam review uses the saved wording and choice order and now reveals
the learner's answer, correct answer, explanation when present and correctness.
History lists each locally available completed attempt once, with start time,
score, duration used, completion reason and sync state. An active attempt is a
Resume entry, not completed history. Average/highest exam scores use percentages
across unique completed attempts. No completed exams means unavailable, not a
fabricated zero. Reviewer viewed counts remain separately labeled.

## 5. Synchronization and trust boundary

Local SQLite is the immediate source of truth for an attempt and result. Reuse
the existing authenticated owner/device guard, durable outbox pattern and
bounded retry/error classification, but give exam attempts separate tables,
domain ports, service and cloud document paths/rules. Store immutable completed
snapshots and an idempotent attempt ID so retries cannot duplicate history or
progress. Completed history can synchronize across the same account's devices;
active cross-device handoff is outside this slice. A second device may create
its own distinct attempt.

Firestore rules authorize owner-only reads/writes and validate bounded metadata,
immutable fields and allowed state transitions. As with Reviewer, client-held
content and device identity are not a server security proof; do not claim an
official proctored or tamper-proof score. Do not upload a full 150-question
payload in one document. Retain frozen local snapshots for offline review;
remote history/result records use bounded chunks or summary metadata with
validated association to the attempt. Upload failures remain visible as
pending/failed without losing the local result. Logout and account switch
invalidate visible owner state and never show another UID's records.

## 6. Failure and acceptance boundaries

The implementation plan must cover domain selection, timer/finalization, SQLite
migration and repositories, cloud rules/sync, UI/routes, and native acceptance in
independently testable stages. It must preserve current Reviewer behavior and
the immutable approved bank.

Required checks include: exact 35/40/25/50 selection of 150 unique eligible
items; shortage and invalid-configuration rejection; fixed choice order and
shared-context preservation; complete preflight rollback on missing content or
storage failure; repeated Start idempotence; answer/flag/cursor durability after
force-close; deadline persistence and late-write rejection; expiry racing a
manual confirmation; exactly-once local finalization and cloud retry;
unanswered scoring and unrounded threshold comparison; source/config changes
not changing a saved result; account isolation; offline result/history access;
and device checks for long text, themes, large font, accessible navigator state
and active/background/expired transitions. Screen-reader and iOS acceptance
remain explicit separate checks if still deferred when this slice is built.

No production import, deployment, merge, push, store upload or release follows
from this design. The active Reviewer worktree and its evidence remain preserved
until its own acceptance/finishing decision.
