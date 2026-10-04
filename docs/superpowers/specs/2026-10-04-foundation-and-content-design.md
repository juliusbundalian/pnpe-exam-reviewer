# PNPE Exam Reviewer — foundation and content design

Date: 2026-10-04

Status: written specification approved by the user on 2026-10-04. Implementation plans are prepared separately for user review and execution-method selection. This specification does not authorize production provisioning or publication.

## 1. Purpose and delivery boundary

Build a maintainable Android/iOS PNPE study application with public discovery, authentication only for personal actions, trustworthy reviewed content, and durable study/examination state. The application is an independent preparation tool, not an official examination service.

This is the first delivery slice: a working guest-first shell, authentication, semantic themes, configuration infrastructure, validated content contracts, and a safe reference-processing/import toolchain. Later slices implement read-through reviewer sessions/bookmarks, then Mock Exam/results, then progress/history and release hardening. Each has its own specification and implementation plan. This decomposition does not remove any requested feature.

The discovery evidence is recorded in [the repository and questionnaire audit](../../discovery/2026-10-03-repository-and-questionnaire-audit.md). This specification takes precedence over superseded proposals in that audit. User revisions on 2026-10-04 take precedence over the original answering-based reviewer requirements.

### Binding product decisions for all slices

- Normal launch opens Home for guests and authenticated users; never automatically open Login.
- Category and subcategory overviews are public. Starting a reviewer/exam and accessing personal records use one central authentication prompt.
- Reviewer means reading every eligible published question in the chosen category/subcategory, without a 20-question or other count cap. Correct answer and available explanation appear immediately. There is no answer selection, Submit Answer, reviewer correctness score, or reviewer accuracy. Previous/Next, bookmarks, and resume support the reading experience. Track questions viewed, not answered.
- Mock Exam remains a scored mode with 150 questions and a default 180-minute deadline. Allocation: General Information 35, Verbal Reasoning 40, Quantitative Reasoning 25, Logical Reasoning 50. These are product settings, not a claim of verified official weighting.
- Map exam Verbal Reasoning to `communicationSkills` and Logical Reasoning to `criticalThinking`; retain the original four reviewer categories and fifteen subcategories rather than duplicating them.
- Home follows the selected A / Guided reading direction. The exam navigator offers Compact grid and Expanded list. The list has one-line question previews with tail ellipses. Answered is green, unanswered gray, flagged amber, current has a blue outline. Retain symbols and labels; flagged fill overrides answered fill without hiding answered status. Green never reveals correctness.
- Exclude Custom Practice, Diagnostic Exam, Weak Topics/recommendations, separate Mistake Review, Question Mastery, Search, and Study Goals.

### Deliverables and deliberate boundaries

Implement real Home, category/subcategory overview, Menu, appearance, About, legal-information routes, login, registration, password reset, and basic authenticated profile display. Provide real Remote Config loading and Firebase adapter wiring, not simulated authentication.

Do not claim a working reviewer or exam engine in this slice. Future entry routes may show a clearly labeled development availability message after the appropriate guard; they must not create fake sessions, timers, scores, history, or progress. Such messages are integration boundaries in an unreleased build, not publishable completed features. Tests exercise return intents using explicit test handlers. Later slices replace those availability boundaries before release.

No Firebase project creation, rules deployment, production import, app-store submission, or automatic editorial approval is part of executing this slice. Emulator runs and local dry runs are in scope. A real project configuration is supplied by the owner; missing configuration produces a clear setup/unavailable state, never mock success.

## 2. Architecture and stack

Use Expo development builds with Expo Router and React Native Firebase for native Auth, Firestore, and Remote Config. Expo Go is not the acceptance runtime for native Firebase integration. Use strict TypeScript, Zustand, React Hook Form, Zod, AsyncStorage, Jest, React Native Testing Library, ESLint, and Prettier. Add Expo SQLite for durable local repositories when session persistence is implemented; do not build an unused session database in the foundation slice.

Choose and lock a mutually compatible stable dependency set during implementation planning, checking current primary documentation and the host toolchain. Do not install unbounded latest dependencies without a compatibility check. Firebase Admin and PDF tooling belong to developer-only tooling, not mobile imports.

Suggested structure, creating directories only when they contain actual responsibilities:

```text
src/
  app/                         thin Expo Router routes
  bootstrap/                   startup and dependency composition
  core/                        design tokens, components, errors, shared ports
  features/
    content/                   taxonomy, question contracts, repositories
    auth/                      domain/application/data/presentation
    home/                      Home and public overview composition
    settings/                  appearance and application information
    menu/                      reactive account/menu presentation
tools/questions/               extraction, normalization, validation, import
data/                          source registry, candidates, publication artifacts
firebase/                      rules, indexes, emulator configuration
docs/                          setup, editorial workflow, design and plans
```

Domain modules import neither React nor Firebase. Application use cases depend on ports. Data adapters validate external DTOs and map errors/timestamps. Presentation renders application state and sends typed actions. A composition root creates dependencies once; do not instantiate Firebase in screens. Avoid `any`; narrow `unknown` at external boundaries with validated schemas. Enforce import boundaries with linting and tests.

Use narrow Zustand stores for reactive UI/application state; repositories own persisted data. Forms use React Hook Form and Zod. Introduce typed Clock, RandomSource, and AnalyticsService ports where used. The initial analytics adapter is explicitly no-op and must not log credentials, email addresses, or question-answer content.

## 3. Public shell, themes, and accessibility

Primary navigation: Home, Review, Mock Exam, Progress, Menu. Public routes include Home/Menu, reviewer category/subcategory overviews, mock-exam overview, appearance, About, app information, Privacy Policy, Terms, and auth forms. Personal progress, bookmarks, history, profile, session starts, and personal attempt results are protected even when entered by deep link.

Home uses a concise preparation introduction, primary Explore Reviewers action, restrained quick links, spacious coverage rows, and a secondary Mock Exam invitation. Guest Home shows no fabricated statistics. Authenticated greeting uses available profile data with a safe fallback. Display content availability honestly: unknown counts are not zero counts, and staged drafts are not available questions.

Guest Menu shows Guest User, Sign In, Create Account, and public destinations. Authenticated Menu reacts to auth changes and includes identity, Profile, Progress, Saved Questions, Exam History, Appearance, About/legal information, and Logout. Incomplete slice destinations are labeled as unavailable rather than faking data.

Central semantic tokens cover primary/onPrimary, containers, background, surfaces, border, primary/secondary text, success, warning, error, spacing, type scale, radii, and touch targets. Persist System/Light/Dark; System reacts to OS changes. Components consume tokens rather than hard-coded screen colors. Build focused AppScreen, AppText, AppButton, AppInput, AppHeader, AppModal, separators, loading/error/empty states, and coverage rows; avoid a universal oversized component.

Use accessible labels, focus handling for modal open/dismissal, keyboard-safe forms, sufficient contrast, at least 44-point interactive targets, and scalable text. Never encode state only in color. Long content must scroll without hiding primary controls. Device verification covers both themes, OS appearance changes, large text, and screen readers; browser mockups and Jest alone do not prove native accessibility.

About includes the user's independence/no-guarantee disclaimer. Legal routes display validated configured HTTPS URLs when present, with browser-opening errors handled. If legal content is not configured, say it is unavailable; do not invent a published privacy policy. Approved legal content and appropriate account-deletion arrangements are release gates, not claimed completed by the initial shell.

## 4. Authentication and retained intent

The AuthenticationRepository exposes auth-state observation, register, signIn, requestPasswordReset, and signOut. Map SDK failures to friendly application errors. Do not expose raw Firebase messages or stack traces. Password-reset acknowledgement does not disclose whether an email is registered.

AuthenticationCoordinator owns `resolving`, `guest`, `authenticated`, and `recoveryRequired` states, the shared AuthRequiredModal, and one pending typed intent. Screens call the coordinator instead of duplicating authentication checks. Protected use cases and the route boundary share access policy; Firestore rules remain the remote authorization boundary.

The intent union includes startReviewer, startMockExam, openProgress, openBookmarks, openHistory, openProfile, openAttempt, and setBookmark. Validate all IDs, action parameters, safe origin, timestamps, and optional required owner UID. Derive routes from these types, never arbitrary redirect URLs. Include intent/operation IDs for idempotent future side effects. Bookmark intent specifies desired saved state, not a toggle.

Persist sanitized intent metadata for 30 minutes using a schema-versioned cache. No password, Firebase token, function, or executable callback may be stored there. Only one flow owns a pending intent; repeated taps cannot create overlapping flows. Expired or malformed intent cannot execute and falls back to its safe public origin.

Prompt actions are Sign In, Create Account, and Maybe Later. Maybe Later dismisses and clears the intent while preserving the original public screen. Switching forms, opening password reset, and recoverable validation failures preserve it; explicitly exiting auth cancels it.

Successful authentication revalidates identity/intent and resumes the intended destination. Mock Exam returns to preflight with an explicit Start action, never starts its clock during login. Voluntary Menu login returns to Menu. Remove completed auth forms from the back stack. A newly authenticated different UID cannot resume another account's session.

While auth resolves, public Home remains usable and protected actions show a cancellable wait/retry state; do not flash guest Login. Temporary network loss alone is not sign-out. Confirmed invalid credentials lock personal interaction and request recovery. Later exam expiry remains a local operation even while reauthentication is required.

Profile persistence is independent of account creation: if Auth registration succeeds but Firestore profile write fails, show a recoverable profile error rather than offering to create the account again. Profile display never requires exposing other users' records.

Logout clears visible owner state, intent metadata, and owner listeners. Future session/outbox repositories participate in a save-before-logout contract; no silent deletion of unsynced work. Account-switch tests verify both application caches and native Firebase persistence. App-private storage is not advertised as encrypted storage.

## 5. Initialization and configuration

Load local appearance/defaults, initialize configured Firebase centrally, read validated cached configuration, and start auth/config resolution. Once local bootstrap renders, open Home without waiting for network success. Use a five-second remote-fetch budget for initial application loading; failures use cached/default values. Late valid results may update non-session state. A local storage error produces a recoverable public shell rather than an indefinitely visible splash.

Expose typed AppInfoRepository, RemoteDataRepository, and AppConfigRepository over one RemoteConfigService. Validate each JSON parameter independently; invalid JSON/schema falls back as a whole to its last-known-good value, then bundled defaults. Do not merge inconsistent exam fields across versions. Cache successful validated values with schema version and validation timestamp. Ignore unknown additive fields; reject unsupported enum values and invalid required fields.

| Parameter | Required contract |
| --- | --- |
| `app_info` | App name; latest/minimum semantic versions; maintenance flag/message; support email; privacy/terms HTTPS URLs or empty unconfigured values |
| `data` | Typed bounded arrays for announcements, study tips, FAQ, reviewer instructions, and exam information; no arbitrary objects or executable HTML |
| `config` | Mock-exam duration/count/threshold/shuffle/distribution; reviewer question-order setting; bookmarks/progress/history feature flags |

Local config: exam duration 180 minutes, count 150, distribution `{generalInformation:35, communicationSkills:40, quantitativeReasoning:25, criticalThinking:50}`, practice threshold 75%, question/answer shuffle enabled with per-question fixed-order override. The 75% threshold is an application default submitted for approval in this specification, not an assertion about official passing standards. Reviewer includes all eligible questions, may shuffle question order, retains original choice order, and always shows correct answer plus available explanation. No reviewer question-count cap or hide-answer switch remains.

For `data`, use `{id, title, body}` entries for announcements, study tips, reviewer instructions, and exam information; FAQ uses `{id, question, answer}`. Optional announcement dates are validated ISO timestamps with expiry after publication. IDs are unique within each array. Defaults are empty arrays. Limit each array to 100 entries, titles/questions to 300 characters, and body/answer fields to 10,000 characters; display plain text, not untrusted markup.

Validate positive finite integer duration/counts and all four category quotas, sum equal to total, and threshold in 0–100. Apply bounded schema sizes before parsing/retrieval: reject oversized parameter strings over 256 KiB, counts over 1,000, or durations over 1,440 minutes. These are defensive application bounds, not exam facts. Unknown/missing category keys cannot silently change distribution.

Maintenance or unsupported-version notices prevent new study/exam sessions but preserve access to Home, information, and saved work. Later active sessions can finish locally; feature toggles cannot delete or strand their records. Remote Config is client-readable configuration, not authorization or secret storage. Freeze the validated session configuration in later session implementations.

## 6. Taxonomy and published content

Use stable category IDs and the exact requested subcategories:

| Category ID / display | Subcategories |
| --- | --- |
| `generalInformation` / General Information | Philippine Constitution and Relevant Laws; PNP History; Criminal Justice System; Current Events; Norms of Conduct in Public Service |
| `communicationSkills` / Communication Skills | Vocabulary; Reading Comprehension; Grammar |
| `quantitativeReasoning` / Quantitative Reasoning | Basic Concepts; Problem Solving; Data Interpretation |
| `criticalThinking` / Critical Thinking | Logical Reasoning; Pattern Analysis; Deduction; Word Analogy |

Separate immutable extracted SourceRecord, incomplete EditorialCandidate, and validated PublishedQuestion. Candidates can retain missing information and blocking issues without pretending to satisfy the published schema. Their states are draft, needsReview, approved, rejected. Publication status is a separate active/inactive/archived value.

PublishedQuestion requires stable ID, positive immutable version, valid category/subcategory pair, nonempty prompt blocks, at least two uniquely identified nonempty choices, exactly one correctChoiceId, choice-order policy, source lineage, timestamps, and publication status. Optional explanation/difficulty must be explicit rather than guessed. Reject duplicate rendered alternatives and unresolved answer ambiguity. Source A/B labels are provenance; choices have stable opaque IDs independent of display position.

Rich-content blocks form a discriminated union for text/marked spans, math, image with dimensions and accessible description, table, and diagram. Required shared stimuli have their own versioned identities. Retain math grouping and marked grammar targets. Client capability checks exclude unsupported required kinds rather than dropping them. Rendering text/marked text/math/reviewed images belongs to the reviewer slice; foundation provides contracts and representative fixtures, not fake render support.

Current-event revisions require reviewed time context, publication/as-of date, expiry after publication, and verification provenance. Unknown dates remain unknown in staging. Eligibility requires active approved content, supported formats, valid taxonomy, available assets, and unexpired dates. Historical snapshots retain original answers/content despite later corrections or expiry.

An editorial approval binds a reviewer identity and timestamp to the exact content digest, including prompt, stimulus, choices/key, explanation, taxonomy, and validity dates. Content changes invalidate approval. Structural validation is not editorial approval. Legal/current-event corrections require appropriate current primary-source verification. Software MIT licensing does not establish rights to redistribute the reference content; confirm publication rights before a public release.

## 7. Reference processing and guarded import

Preserve the three PDFs byte-for-byte. The audit records 178 pages and 687 source occurrences: short PDF 20 MCQs, large PDF 477 mixed-format occurrences, notes PDF 190 answer-only entries. These are not publishable or unique-question counts.

The pipeline has reproducible source-specific extraction adapters, a stable identity registry, deterministic normalization, separate editorial overlays, validation, and an import planner. Preserve file checksum, section, original number, page span, original choice labels/answer, raw extracted material, source links, image locations, and correction provenance. Unknown source checksums require deliberate registry review instead of quietly applying old offsets to a changed document.

Use a pinned developer-only PDF extraction tool through a documented environment; Node/TypeScript orchestrates normalization and validation. Extracted layout/image evidence must remain available for manual review. No runtime calls to an AI service or silent dependency on the current assistant session are required to rerun extraction. Authored MCQ conversions are editorial data stored separately, not regenerated on every import.

Account for every expected source occurrence either as a candidate or an explicitly blocked source record. Reconcile the audit counts and report differences as failures requiring inspection. Image-only records may remain blocked until manually transcribed and visually reviewed; do not silently omit them. Preserve all 190 answer-only entries and support authored distractors/corrections, but human approval of each exact conversion remains necessary before publication. Foundation completion does not mean every editorial issue has been resolved.

Required parser/quality fixtures include shared paragraph stimuli, inline grammar segments, duplicated labels, missing stems, missing passages, duplicate alternatives, contradictory keys, malformed math, stale current events, image-only answers, and prompts repeated across different passages. Use the audit's identified defects as regression cases. Detect exact duplicates by normalized prompt/choices/context; near-duplicate clusters are review suggestions, not automatic destructive merges.

Stable source identity is separate from content fingerprints. Corrections preserve logical question IDs and increment versions. Merging confirmed duplicates retains all provenance locators. General Philippine history is not automatically PNP History; unmapped content stays staged. Generate coverage counts and shortage reports without inventing missing Data Interpretation content.

Commands and artifacts:

- `npm run process:references`: extract and normalize into source/candidate artifacts and a machine-readable plus human-readable issue report; preserve editorial overlays.
- `npm run validate:questions`: validate candidate/published boundaries, stable identities, review digests, references/assets, taxonomy, duplicates, and publication invariants; exit nonzero for invalid publication input.
- `npm run import:questions`: dry-run by default, emitting explicit project ID, input digest, expected remote versions, creates/updates/no-ops, and blocked records. Never deploy rules implicitly.
- `data/questions.json`: only validated editorially approved revisions eligible for the publication set. An empty approved set is allowed and must be reported honestly, not filled with test fixtures.

Applying an import requires explicit apply mode, target project, and an approved manifest matching the exact input and expected remote versions. Use server-side preconditions/transactions for version conflicts; identical reruns are no-ops. Never overwrite an immutable revision or implicitly delete content. Catalog publication must switch a generation pointer only after every referenced revision and shard is uploaded and validated. Interrupted writes leave the previous generation readable and permit a resumable retry.

No source answer-key imagery is published as a learner-facing prompt asset. Asset hosting is outside this slice: asset-bearing candidates remain blocked from publication unless an explicitly supported, reviewed asset is available. Do not add Cloud Storage or external hosting silently. Admin credentials never enter client imports or fixtures. Ignore secret/service-account files and provide safe environment examples.

## 8. Firestore contracts and security

| Path | Access / role |
| --- | --- |
| `categories/{id}` | Public safe overview metadata; trusted import writes only |
| `questions/{id}` | Current revision metadata; authenticated reads; no client writes |
| `questions/{id}/versions/{version}` | Immutable published question revisions; authenticated reads; no client writes |
| `questionCatalogs/{id}` and `/shards/{id}` | Generation metadata and bounded category/subcategory eligibility entries; authenticated reads; no client writes |
| `users/{uid}` | Owner-only profile; allowlisted display name and timestamps; Auth remains authoritative for email |

Later owner subcollections are bookmarks, reviewerSessions, and examAttempts, with bounded item/manifest documents for snapshots rather than one oversized question array. Deny these unimplemented paths by default in this slice; later specs add rules alongside their repositories/tests, not an unsafe recursive wildcard.

Catalog entries contain ID/revision, taxonomy, validity, capability and stimulus/asset references, not complete prompts. Bound shards and paginate metadata; normal startup loads taxonomy/config, not the bank. Validate remote DTOs and Firestore document sizes before writes. A category with no approved items has a genuine unavailable state.

Rules tests cover unauthenticated category reads, authenticated question/catalog reads, denial of every client official-content write, owner profile allowlists, cross-user denial, and default denial for unknown paths. Admin bypasses rules and therefore requires independent target/manifest safeguards. This personal practice application does not claim tamper-proof official scoring.

## 9. Later-session contracts preserved by this foundation

Reviewer sessions freeze a complete lightweight ID/revision manifest and progressively load content; no whole-category payload download is required to begin reading. Offline missing pages preserve position and show reconnect/retry instead of silently shrinking the category. Proposed viewed-progress semantics: count a question only after its prompt and correct answer render successfully, deduplicate within a session, and mark completed after all manifest items have been viewed. “Viewed” is not mastery. Persist current position and allow resume.

Mock Exam must cache and validate all 150 selected snapshots/assets before activation. Deadline is timestamp-based, never reset after backgrounding/restart. Manual/expiry finalization converges on one durable outcome; OS suspension means expiry may finalize on next execution as of the saved deadline. Results distinguish incorrect and unanswered, preserve content/config snapshots, and remain available while upload is pending.

SQLite commits local state and pending sync operations atomically; AsyncStorage is not authoritative exam storage. Stable IDs and owner-bound retry queues prevent duplicate attempts and cross-account uploads. One active reviewer and one active exam per account per device are the proposed concurrency limits; live cross-device handoff is excluded. These later lifecycle implementations require their own focused tests and plans.

The navigator uses the approved grid/list designs. List preview text comes from the frozen prompt, never its answer/explanation, collapses whitespace, and uses accessible descriptions for non-text prompts. A virtualized list uses one-line tail ellipsis with unshrunk number/status controls; screen readers receive full preview text. Changing layout cannot change answers, flags, current question, or deadline.

## 10. Verification and acceptance

Follow Superpowers TDD for behavior: focused failing tests, minimal implementation, then refactoring. Inject clocks/randomness and repository fakes. Do not use production credentials for tests or publish fixtures into the question bank.

Foundation acceptance requires:

1. Strict TypeScript, lint, formatting checks, and relevant Jest/RNTL tests pass.
2. All seven mandatory guest/auth scenarios pass at the shell/intent boundary, including public browsing, shared prompts, Menu entry, intended return, and authenticated Home relaunch. Explicitly do not claim exam/reviewer execution before those slices exist.
3. Additional auth tests cover cancellation, expiry, malformed intent, repeated callbacks, password-reset round trips, profile-write failure, auth-resolution failure, and account switching.
4. Config tests cover all three parameters, malformed/oversized JSON, schema errors, default/cache fallback, mismatched quotas, and removal of the obsolete reviewer cap/answer-reveal configuration.
5. Content/import tests cover all three source structures, expected occurrence reconciliation, defective source fixtures, stable IDs, context-aware deduplication, changed-digest approval invalidation, empty approved sets, dry-run safety, immutable versions, stale manifests, and interrupted catalog publication.
6. Firebase Emulator tests prove rules/access and safe import behavior. Normal tests require no paid production service.
7. Android and iOS development-build checks verify public startup, actual auth integration when configured, theme switching, readable large text, keyboard behavior, and modal accessibility. Report unavailable device/service checks explicitly; do not mark them passed by inference.
8. Reference hashes match the audit before and after tooling runs. No secrets are staged, committed, or included in client bundles.
9. README documents scope/status, installation, environment variables, development builds, Firebase/emulator setup, Remote Config JSON, architecture, auth routing, themes, test commands, extraction/editorial workflow, validation, dry-run/apply safeguards, and later release gates.

Implementation review must distinguish completed foundation features from later scope. No deployment/publication occurs merely because local tests pass.

## 11. Review handoff

The user approved this written specification on 2026-10-04. Implementation planning proceeds in separate content-toolchain and mobile-foundation plans. Both plans require user review and an execution-method selection before scaffolding or product implementation begins. Later delivery-slice plans must preserve the decisions here, including the 75% practice threshold and viewed-progress semantics, unless the user requests a revision.
