# PNPE Exam Reviewer: discovery and architecture proposals

Date: 2026-10-03

Status: repository/reference inspection complete; brainstorming in progress. This is a discovery report and a set of proposals, not an approved implementation specification or an implementation plan. No application has been scaffolded and no question has been published.

Update 2026-10-04: the first-slice [written design specification](../superpowers/specs/2026-10-04-foundation-and-content-design.md) is drafted and self-reviewed for user approval. It supersedes outdated proposals here, particularly the answering-based or capped reviewer. This audit retains historical discussion and source evidence; it is not the execution contract.

## 1. Agreed requirements and workflow

Build a maintainable Android/iOS PNPE preparation app with guest-first Home and category browsing, authentication before personal actions, category/subcategory reviewers, bookmarks, resumable timed mock exams, results, progress, history, accessible light/dark/system themes, Firebase repositories, and a validated question-import pipeline.

Do not implement Custom Practice, Diagnostic Exam, Weak Topics, Weak Topic Recommendations, Mistake Review, Question Mastery, Search, or Study Goals. Submitted-exam review is part of results, not a separate mistake-review feature. No official exam count or pass mark has been established by this audit.

Superpowers architectural workflow checkpoints:

- [x] Inspect repository, configuration, history, and every reference PDF.
- [x] Reflect the supplied intent and identify material content constraints.
- [x] Resolve editorial policy: draft conversions/corrections, with editorial review before publication.
- [x] Approve foundation: Expo development builds + Expo Router + React Native Firebase.
- [x] Approve content contracts and editorial publication rules in section 11.
- [x] Approve guest-first authentication and navigation in section 12.
- [x] Review foundation architecture approaches and design sections with the user.
- [x] Write and self-review the first-slice specification; commit at the written-spec handoff.
- [ ] Obtain written-spec approval.
- [ ] Use writing-plans to produce small, testable implementation tasks.
- [ ] Review the implementation plan and select its execution method.

The user has requested this process explicitly. Implementation, product dependency installation, and external Firebase provisioning have not begun.

## 2. Repository state

- Current branch: `main`.
- HEAD: `9a29112 Initial commit`.
- Only tracked file: `LICENSE`, an MIT software license.
- Existing untracked directory: `references/`, containing exactly the three supplied PDFs.
- No application source, `package.json`, lockfile, Expo/native project, TypeScript configuration, tests, CI, Firebase configuration, environment examples, README, or project-level `AGENTS.md` was found.
- Available host tools checked: Node `v24.3.0`, npm `11.4.2`, Python, uv. These are observations, not an approved compatibility matrix for the future app.
- Poppler was not available. A temporary PyMuPDF environment was used for read-only extraction and PNG rendering. Its dependency was not added to this repository.
- Original PDFs were not modified. Their hashes are recorded below so the future import pipeline can verify its exact inputs.

## 3. Source inventory

Counts below are source question occurrences, including defective items and duplicates. They are **not** counts of publishable or unique questions.

| File | Pages | Question occurrences | Structure |
| --- | ---: | ---: | --- |
| `PNPE Reviewer.pdf` | 6 | 20 | Four-choice MCQs, explicit answers, 20 explanations |
| `PNPE Reviewer (1).pdf` | 153 | 477 | Fifteen sections; MCQs, shared passages, paragraph ordering, numbered grammar segments, math, and image questions |
| `PNPE Reviewer (2).pdf` | 19 | 190 | Five sections of answer-only notes; no supplied choice lists; includes true/false statements and incomplete “except” prompts |
| Total | 178 | 687 | Requires deduplication, editorial validation, and format-specific adapters |

Method: read extracted text from every page, inspect numbered section boundaries and answer markers, inspect PDF hyperlinks and metadata, and visually examine representative text/layout pages plus every image-bearing page (149–153 of the large PDF). The large document has 469 textual answer markers plus eight image-only answers, reconciling to 477. All ten abstract-reasoning items were visually located. Some source errors remain unresolved; this is not certification of every answer's factual correctness.

SHA-256:

```text
PNPE Reviewer.pdf
ca25ecda36ab8db4036f6fb9a051d97a207178399fc850f1abe50a378bd4263d

PNPE Reviewer (1).pdf
cbd490cc60e4700912c1fc4e634a1e92f4231e1aa85687434837f7eb591ab169

PNPE Reviewer (2).pdf
bd6e9a06be5bc48922fe784580d0bdd987a207881e3c317896488e995a04a70b
```

All three PDFs have title `PNPE Reviewer`, producer `Skia/PDF m156 Google Docs Renderer`, and empty author/creation/modification date metadata. Do not infer publication dates from file modification times or the “2026” title.

### 3.1 Short MCQ reference

Source headings: Verbal Reasoning (Q1–5), Quantitative Reasoning (Q6–10), Logical Reasoning (Q11–16), General Information (Q17–20).

The title links to [Super Tutor's PNPE readiness test](https://supertutor.ph/resources/tools/napolcom-pnpe-readiness-test/). This is provenance found in the PDF, not independent verification of its answers.

All twenty questions have four labeled choices, an explicit answer, and an explanation. Q20 uses the former `PO1` terminology and states an appointment-age answer that needs current official verification. Q19's stem and explanation use different descriptions of departmental versus commission control; review wording against the governing source before publishing. A conversational offer to reformat the reviewer appears after Q20 and must not enter the question bank.

### 3.2 Large mixed-format reference

| Section | Pages containing section | Occurrences | Proposed mapping |
| --- | --- | ---: | --- |
| I General Information | 1–31 | 75 | General Information; individual classification required |
| II Verbal Reasoning | 31–43 | 40 | Communication Skills / Vocabulary |
| III Connecting Ideas | 43–51 | 30 | Communication Skills / Grammar |
| IV Completing Sentences | 52–60 | 30 | Communication Skills / Grammar, with vocabulary-dependent items reviewed individually |
| V Reading Comprehension | 60–65 | 12 | Communication Skills / Reading Comprehension |
| VI Paragraph Organization | 65–81 | 80 | Communication Skills / Reading Comprehension; 16 shared sentence groups |
| VII Correct Usage | 81–90 | 50 | Communication Skills / Grammar |
| VIII Correct Usage 2 | 90–104 | 35 | Communication Skills / Grammar |
| IX Quantitative Reasoning | 104–115 | 22 | Quantitative Reasoning / Basic Concepts or Problem Solving |
| X Number Series | 115–121 | 15 | Critical Thinking / Pattern Analysis |
| XI Word Problem | 121–128 | 15 | Quantitative Reasoning / Basic Concepts or Problem Solving |
| XII Word Analogy | 128–133 | 20 | Critical Thinking / Word Analogy |
| XIII Logical Reasoning | 133–140 | 15 | Critical Thinking / Logical Reasoning or Deduction; passage questions reviewed individually |
| XIV Word Sequence | 141–149 | 28 | Critical Thinking / Logical Reasoning, with alphabetical items reviewed for Vocabulary |
| XV Abstract Reasoning | 149–153 | 10 | Critical Thinking / Pattern Analysis; algebraic classification reviewed individually |

The opening source link points to a Studocu reviewer. Other embedded links include the Philippine Commission on Women, Supreme Court, PhilAtlas, Inquirer, Wikipedia, a legal commentary site, and Facebook. Capture these as source references associated with the relevant page/item; an embedded link is not proof that an explanation is correct. Unresolved citation markers such as `[1, 2]` also appear.

Source formats require more than a generic numbered-list parser:

- Numbering restarts per section; repeated headers are not new sections.
- A–D, A–E, and one A–F set occur. There are duplicate labels and duplicate choice texts.
- Answer syntax includes `Correct Answer: C.`, `A.)`, inline `Answer: Letter A`, and `Answer: phrase (2)`.
- Paragraph organization shares A–E sentence choices across five positional questions. The prompt alone is not a unique fingerprint.
- Correct Usage has inline numbered segments 1–5 instead of conventional choice lists. Preserve the segment mapping and “No error” option.
- Vocabulary instructions refer to underlined targets; on inspected page 31, the question is bold but the target is not visibly underlined. Do not select a target word solely by guessing from the explanation.
- Q11–12 in Reading Comprehension refer to a Dragon plant/fruit passage that is absent from that section.
- Abstract Reasoning Q1–5 and Q7–9 have their answer keys embedded as bold/underlined image text. Page 150 has no extractable text despite containing two questions.
- There are nine embedded image placements across pages 149–153. Images sometimes contain both the question and an exposed answer key; future published question assets must exclude the answer key while retaining original provenance.
- Explanations/solutions are supplied for many items; Correct Usage Q36–50 and eight image-only items do not have separate explanation blocks. An answer correction phrase is not automatically a full explanation.

### 3.3 Answer-only reference

| Source section | Pages | Entries | Mapping implications |
| --- | --- | ---: | --- |
| Philippine Constitution | 1–3 | 26 | Mainly Constitution and Relevant Laws; some civil-service ethics items |
| Philippine History | 3–8 | 50 | Much of this does not fit the requested PNP History subcategory |
| PNP Law and History | 8–11 | 30 | Split PNP History from Constitution and Relevant Laws as appropriate |
| Criminal Justice System | 11–17 | 49 | Criminal Justice System; some legal items need legal review |
| Current Events | 17–19 | 35 | Current Events staging; dated largely to 2016–2018 |

All 190 entries have an `Answer:` marker, but none supplies conventional distractor lists. Two entries are explicitly answered `True`; others contain “which of the following” or “except” without the referenced alternatives. One solution and several correction/caution notes appear; there are no `Explanation:` blocks or embedded source hyperlinks.

These cannot all be converted into valid MCQs by formatting alone. The user selected: **draft multiple-choice conversions and corrected content, with editorial review before publication**. Preserve original answers and wording separately from authored prompts, distractors, corrected keys, and explanations. Mark every authored conversion as an unapproved candidate until editorial review and validation pass. Missing context must be researched or the item explicitly rewritten; it must not be fabricated and attributed to the PDF.

## 4. Observed defects and review queue seeds

This is a concrete initial issue register, not an exhaustive count of all questionable facts. Source correction notes are themselves unverified claims; never treat the last note on a page as authoritative automatically.

| Location | Observation | Required disposition |
| --- | --- | --- |
| Large I Q5, p3 | Entire question stem is underscores; choices and an asserted answer remain | Block publication: missing stem |
| Large I Q12, p5–6 | Stem appends the apparent answer after “renamed” | Review answer leakage |
| Large I Q43, p19 | B and D both say `President`; six choices | Block until single-answer ambiguity resolved |
| Large I Q46, p20 | Stem says 25 medals; explanation says 28 | Resolve internal conflict, verify time context |
| Large I Q54, p23 | Stem says Marcos Jr.; explanation says Sr.; ratification premise also disputed by wording | Block and verify/rewrite with source |
| Large I Q69, p28–29 | Explanation qualifies the stem's definition of martial law | Block pending subject review |
| Large II Q10, p34 | Keyed synonym repeats `Negligent` from stem | Review pedagogical validity and original target |
| Large II Q25, p39 | `Excellent` and `First-class` are both plausible synonyms | Review unique-answer quality |
| Large III Q10, p46 | Several relative-clause/purpose choices appear plausible | Grammar review |
| Large III Q23, p49–50 | Explanation claims being ideal explains being underrated | Review answer and explanation coherence |
| Large III Q27, p50–51 | Explanation reverses the stated causal direction; multiple causal conjunctions supplied | Review/rewrite |
| Large III Q29, p51 | Note alleges missing “if” although the stem already contains “if” | Do not trust correction notes blindly |
| Large IV Q1, p52 | Singular key justified for `quality and texture` despite plural alternative | Grammar review |
| Large IV Q2, p52 | A and E identical; E keyed | Block duplicate correct choice |
| Large IV Q27, p59 | Key yields `his belief have`; explanation silently changes `have` to `has` | Block until stem/key reconciled |
| Large IV Q30, p60 | `Adapted` keyed where `Adopted a new method` is an available alternative | Grammar/meaning review |
| Large V Q2, p60–61 | Source admits root-ball alternative does not precisely fit bare-root question | Review/rewrite |
| Large V Q11–12, p64–65 | Required Dragon fruit passage missing; Q11 repeats `Fragrant` | Block missing context; duplicate choices |
| Large VII Q24, p86 | `give us glimpse` labeled no error | Grammar review |
| Large VIII Q7, p93 | Keyed sentence still contains `exceptionally large bird` without article/plural | Review malformed alternatives |
| Large VIII Q33 and Q34, p103–104 | Same five sentence alternatives and same key | Confirmed duplicate pair; retain both source locations |
| Large VIII Q18/Q24/Q32 | Keyed alternatives contain `gloodgates`, `hte`, `posses` | Preserve raw spelling; assess whether repair changes grammar task |
| Large IX Q6/Q12, p106/p108–109 | Powers and fraction grouping flattened in visible source | Mathematical transcription review |
| Large IX Q18, p112 | 144-inch stem but solution mentions 48 inches | Repair explanation only after review |
| Large X Q1, p115 | C =118 keyed; working gives 228 and note says D | Block conflicting key |
| Large X Q2, p115 | Malformed series and incompatible working/answer | Block until reconstructed and verified |
| Large X Q7, p117–118 | B =218 keyed; working gives 228 and note says C | Block conflicting key |
| Large X Q8, p118 | Working claims `380 + 120 = 520`; sum is 500, choice C | Block incorrect arithmetic/key |
| Large X Q13, p120 | Worked pattern gives 840; no 840 option; key says 850 | Block missing correct alternative |
| Large XI Q12/Q14, p126–127 | `₱1,5000`, `3&`, and inconsistent intermediate subtraction | Review transcription and solutions |
| Large XII Q15, p132 | Two choices labeled `b`; answer is `b.) theater` | Preserve source labels; resolve stable identity before publication |
| Large XIII Q2, p134 | Explanation treats lack of evidence for retinopathy as proof of absence | Logical inference review |
| Large XIV Q3/Q5/Q12, p141–144 | Ordered answer strings conflict with plausible or explained sequence | Block and reconcile individually |
| Large XIV Q10, p143 | Duplicate choice strings; explanation places death before sickness | Block ambiguous/invalid sequence |
| Large XIV Q17/Q18/Q21/Q22, p145–147 | Inconsistent sequences or insufficient ordering criteria | Subject review, no automatic correction |
| Large XIV Q20/Q26, p146/p148 | Same clerical hierarchy with relabeled source terms | Semantic duplicate candidate |
| Large XIV Q23, p147 | Ordering multiples of X lacks positivity assumption | Review missing constraint |
| Large XIV Q25, p148 | Note says `CBDEA` absent, but it is option A | Key and options agree; note is wrong |
| Large XIV Q28, p149 | B/D identical; stated filmmaking order maps to C, not keyed B | Block duplicate alternatives and incorrect mapping |
| Large XV Q5, p151 image | Keyed 72 conflicts with the visible preceding multiplication pattern | Visual/math review; no inferred repair |
| Large XV Q6, p151–152 | Literal `\\frac` and duplicated expression text printed in PDF | Reconstruct math in reviewed rich content |
| Large XV Q7, p152 image | Diagram and choice transcription show differing coefficients | Inspect original asset and reconcile |
| Notes Constitution Q4, p1 | Original COMELEC answer and correction disagree | Preserve both, verify official source |
| Notes Constitution Q19, p2–3 | PDF itself warns drug-law penalty may be outdated | Exclude until current legal verification |
| Notes History Q6/Q7/Q11/Q34, p4–7 | PDF contains substantive historical correction notes | Verify both original and note before rewriting |
| Notes PNP Q2/Q22, p9/p11 | Rank/title and establishing-law corrections | Verify current terminology and precise question |
| Notes Justice Q7/Q11/Q21/Q34, p12–16 | PDF qualifies or disputes legal answers | Legal editorial review, not automatic activation |
| Notes Current Events Q2/Q3, p17 | Rainfall range/date corrected in annotations | Preserve raw version and verify revision |
| Notes Current Events Q7/Q20/Q22/Q33 | “Current” officeholders tied to old context | Require dated context and expiry policy |
| Notes History Q15 / Current Events Q10 | Same 2016 election fact with near-identical wording | Semantic duplicate candidate |
| Notes History Q38 / Current Events Q28 | Same arbitration date | Semantic duplicate candidate |
| Notes History Q20/Q24 | Same observance/date asked in reverse | Related-content duplicate review |
| Cross-file Senate-size, appointment-age, PNP governance items | Repeated facts with different prompts/formats | Candidate clustering; do not merge solely on common answer |

Cross-cutting cleanup: zero-width spaces, soft line wrapping, missing spaces, typos, curly punctuation, peso symbols, mathematical exponents, page splits, repeated headings, conversational editing text, and duplicated equations. Preserve meaningful negation, numeric values, choices, and passage context during deduplication. Typography normalization must not silently rewrite grammar questions.

## 5. Taxonomy and coverage gaps

Use the user's four category IDs and exactly the requested fifteen subcategories. Classify by the skill tested, not merely the source heading: numeric sequences belong under Pattern Analysis; a grammar sentence about police still belongs under Grammar.

| Category | Subcategories and observed supply |
| --- | --- |
| General Information | Constitution and Relevant Laws: substantial but needs verification. PNP History: dedicated answer-only section plus a few MCQs. Criminal Justice System: dedicated answer-only section. Current Events: old items need dates/review. Norms of Conduct in Public Service: isolated possible items, no dedicated source section. |
| Communication Skills | Vocabulary, Reading Comprehension, Grammar: substantial material, with shared context and answer ambiguities. |
| Quantitative Reasoning | Basic Concepts and Problem Solving: present. Data Interpretation: no dedicated chart/table-based question set identified; an averages item alone does not establish coverage. |
| Critical Thinking | Logical Reasoning, Pattern Analysis, Deduction, Word Analogy: present, but some proposed mappings need item-level review. |

General Philippine history, geography, culture, and science do not automatically fit PNP History or Current Events. Keep unmapped candidates in staging; do not invent a sixteenth subcategory or silently relabel historical trivia as current events. A publishable count per subcategory can be computed only after editorial decisions and validation.

## 6. Foundation approaches for design review

Decision recorded on 2026-10-03: the user approved option 1. The alternatives below are retained as decision context. Approval covers the foundation; the remaining detailed design sections are still under review.

1. **Recommended: Expo development builds + Expo Router + React Native Firebase.** Native Auth, Firestore, and Remote Config behind adapters; Expo config plugins and development clients for Android/iOS. This fits the mobile requirements and native offline behavior. It requires a native development build rather than Expo Go. [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/)
2. **Expo Go + Firebase JavaScript SDK.** Easier initial preview, but service/platform support and offline behavior need additional design; it does not provide the proposed native Firebase integration. This is not the preferred foundation for these requirements. [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/)
3. **Bare React Native + React Navigation + React Native Firebase.** Can meet the requirements, with more direct native-project maintenance. No inspected requirement currently calls for that extra ownership.

No package versions are selected yet. At implementation planning, choose a mutually compatible stable Expo/React Native/React/TypeScript/Firebase set and lock it. Use the native modules' current modular APIs and verify the selected versions together.

Recommended state/form tools: Zustand for narrow application/UI stores, React Hook Form + Zod for forms, Zod at all external-data boundaries. Domain state machines and scoring remain plain TypeScript. Repository instances are composed centrally; screens do not import Firebase SDKs.

## 7. Proposed architecture boundaries

`src/app/` contains thin Expo Router routes; `src/bootstrap/` composes dependencies and bounded startup; `src/core/` contains design-system primitives, errors, clock/random/analytics interfaces, and infrastructure shared by multiple features. Feature folders contain `domain`, `application`, `data`, and `presentation` only where they have real responsibilities.

Features: auth, home, reviewer, mockExam, results, progress, bookmarks, examHistory, settings, and menu. Shared question/taxonomy contracts belong to a focused content module, not duplicated across reviewer and mockExam. Avoid empty boilerplate layers for purely presentational screens.

Domain depends on neither React nor Firebase. Application use cases depend on repository/clock/random/storage contracts. Data adapters validate DTOs and translate Firebase timestamps/errors. Presentation observes application state and sends typed actions. Tests can replace every external dependency.

### Authentication and navigation

Public tabs: Home, Review, Mock Exam landing/instructions, Progress entry, Menu. Progress content itself is protected. Public stacks include category/subcategory overviews, About/app information, Privacy, Terms, appearance, sign-in, registration, and password reset. Protected destinations include session runners, personal progress, bookmarks, history/results belonging to a user, and profile.

One coordinator owns `requireAuthentication(intent)`, the shared `AuthRequiredModal`, and validated pending intent. Intents form a closed union of actions/routes with validated IDs; no arbitrary redirect URLs or persisted callbacks. Store the origin and expiry with a single-use intent. Maybe Later clears it and preserves the origin. Switching between sign-in and registration preserves it; unsuccessful authentication retains it. Successful authentication consumes it once and continues the intended flow. Voluntary Menu authentication has no forced destination.

Route-entry boundaries protect deep links, and application use cases recheck user identity before protected operations. These checks share the same policy. If a guest directly opens a protected deep link, show the common prompt over a safe public context; never silently redirect app launch to Login. Auth-resolution failure is not proof of sign-out: Home remains visible while protected operations wait/retry.

Startup loads local settings/defaults and begins Firebase/auth/config initialization. Remote fetches are bounded and nonblocking once local bootstrap is ready. Both resolved guest and authenticated sessions open Home. Menu/profile information reacts to auth changes. A failed profile-document write after successful registration has a retry path and must not masquerade as failed account creation.

### Question and import contracts

Separate incomplete `QuestionCandidate` from validated `PublishedQuestion`. A candidate can carry missing choices/answer, raw text, source answer, corrections, proposed mapping, quality issues, and review status. It never enters scored selection. A published single-choice question requires:

- Stable question ID, positive revision, active/inactive/archived publication status, category/subcategory IDs validated as a pair.
- Prompt content blocks and optional shared stimulus with a stable stimulus/group ID.
- At least two uniquely identified, nonempty choices and exactly one `correctChoiceId` referencing an existing choice.
- Optional explanation, difficulty, and citations. Missing difficulty is unknown, not guessed.
- Explicit answer-shuffle policy; disable for position-dependent or “above”/letter-reference content unless safely rewritten and reviewed.
- Source references: file ID/hash, section, original number, page span, original labels, and transformation provenance.
- ISO timestamps in normalized JSON, translated to/from infrastructure timestamp types at boundaries.
- Current-event metadata: `isCurrentEvent`, verified publication/as-of time, expiry, and verification provenance. Unknown dates stay unknown in staging; do not invent them from filesystem dates.

Rich content should be a discriminated union (text with marked spans, math expression, image with alt text/dimensions, table with headers/cells, diagram asset). Rendering support can be added by kind. Unsupported required content blocks prevent session eligibility rather than disappearing. Shared passages are included in snapshots and must travel with their questions.

Stable identity is separate from fingerprinting: assign a source lineage key from file/section/original occurrence through a checked-in mapping registry; text corrections increment version without changing ID. Exact/near duplicate fingerprints include prompt, stimulus, and choices. Do not hash only “Which should be the first sentence?” or regenerate IDs whenever punctuation changes. Keep all source references on merged records.

### Firebase and Firestore

Central initialization exposes Auth, Question, Session, Exam, Bookmark, Progress, AppInfo, AppConfig, and RemoteData repositories/services. An AnalyticsService initially has a deliberate no-op adapter; event names are typed and avoid email/answer content.

Proposed collections/access patterns:

| Path | Role and access |
| --- | --- |
| `categories/{categoryId}` | Public labels/subcategories and published availability metadata; admin writes only |
| `questions/{questionId}` | Current published revision metadata; authenticated reads, admin writes |
| `questions/{questionId}/versions/{version}` | Immutable published content revisions retained for history; authenticated reads, admin writes |
| `questionCatalogs/{catalogId}/shards/{shardId}` | Versioned, bounded metadata shards for eligible-ID selection; authenticated reads, admin writes |
| `users/{uid}` | Owner-readable/writable allowlisted profile fields |
| `users/{uid}/bookmarks/{questionId}` | Owner bookmark with stable key, timestamp, referenced revision |
| `users/{uid}/reviewerSessions/{sessionId}` | Session manifest/summary; owner only |
| `users/{uid}/reviewerSessions/{sessionId}/items/{itemId}` | Immutable submitted question/answer snapshots; owner only |
| `users/{uid}/examAttempts/{attemptId}` | Attempt manifest/status, config snapshot, timestamps, totals; owner only |
| `users/{uid}/examAttempts/{attemptId}/items/{itemId}` | Per-question snapshots, presented order, answers, flags; owner only |

Avoid putting hundreds of full questions into one Firestore document: the document size limit is 1 MiB. Validate document sizes and chunk writes before publication. [Firestore limits](https://firebase.google.com/docs/firestore/quotas)

Question retrieval uses category/subcategory catalogs and bounded reads of selected revisions, not a full bank download at launch. Catalog metadata includes validity windows/group dependencies and per-shard counts. Selection must preserve exact configured quotas, remove duplicate IDs, attach stimuli, and fail clearly if an eligible pool is too small. Never silently repeat questions or change the configured examination count. Catalog corruption/staleness triggers bounded refresh/retry. Catalog sampling details require tests for bias and eligibility before acceptance.

Rules deny cross-user reads/writes and all normal-client writes to questions/categories/catalogs. Allowlist fields, enforce owner IDs/types and valid state transitions, prevent editing finalized records, and test query/rule compatibility. Owner-only access alone is insufficient validation. Remote Config values are client-readable configuration and must never contain secrets.

This is a personal practice app: offline/client-derived scores are not tamper-proof official results. If authoritative scoring is later required, that needs a trusted server validation design. No leaderboard or official certification is proposed.

### Remote Config

Fetch `app_info`, `data`, and `config` through one adapter. Parse each parameter with independent Zod schemas; validate distribution sums, numeric ranges, supported category keys, booleans, URLs, versions, and bounded payloads. A malformed parameter falls back as a whole to its last validated cached value, otherwise local defaults. Avoid partial merging of mutually inconsistent exam fields.

Default duration is 180 minutes. Question count/distribution/pass threshold are explicit product settings, not facts about official PNPE structure. Their production defaults must be chosen after eligible-content counts are known. Snapshot validated configuration when a session starts; later remote changes cannot alter its deadline, scoring, or passing threshold.

Native Remote Config supports local defaults and fetch/activate; app-level validation and last-known-good handling are additional safeguards. [React Native Firebase Remote Config](https://rnfirebase.io/remote-config/usage)

### Offline sessions, timing, synchronization

Use AsyncStorage for small versioned appearance/settings/config values. Recommend Expo SQLite for session snapshots, answers, cached question content, and an outbox: session mutation plus pending operation can commit atomically. This dependency has a concrete durability purpose. [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

Native Firestore caching is useful but does not replace the application session store. [React Native Firebase Firestore](https://rnfirebase.io/firestore/usage)

Before starting a mock exam, validate and persist the entire selected question/stimulus/asset set and frozen config, then establish `startedAt` and `deadlineAt`. A first-time offline guest may browse bundled taxonomy; online authentication is still necessary. Existing signed-in users may resume cached sessions. Starting a new offline session requires a complete eligible local pool and assets.

Persist attempt ID, owner UID, ordered snapshots, stable choice presentation order, selected answers, flags, cursor, timestamps, state version, and submission status. Rehydrate through validation/migrations. Do not discard an invalid cache silently or reset its timer; provide a recoverable error and diagnostic record.

Remaining time is calculated from the deadline, with an injected clock and protection against increasing time during the current run. A display interval only refreshes the display. Check expiry before answer writes, on foreground, on restoration, and on submission. A suspended/killed app cannot promise to execute at the exact deadline: on the next execution it finalizes as of that deadline, accepts no late answer, and synchronizes when possible. Manual/expiry races converge on one immutable finalization.

Save final state and an outbox entry atomically. Retries use deterministic attempt/item/operation IDs. Upload snapshot items before marking the remote attempt complete; incomplete uploads are resumable and are excluded from completed totals. App-level progress is derived from unique finalized records/events rather than blind repeated counter increments. Define read models/cursors for larger histories during detailed design.

Active attempts are device-owned; transparent simultaneous editing across devices is not promised. History may sync across devices. Bind every pending operation/cache to UID, pause writes on credential loss, and never replay one user's outbox under another account. Logout must handle unsynced work explicitly; app caches and native Firestore persistence require a tested privacy lifecycle, not just clearing a Zustand store.

### Reviewer, results, and bookmarks

User revision: reviewers cover all eligible published questions in the selected category/subcategory, without a batch cap. They are read-through study sessions: show correct answers and available explanations immediately, with Previous/Next navigation and bookmarks. No answer selection, submission, or reviewer accuracy scoring. No custom practice.

Bookmarks use question ID as an idempotent key and display saved content/reference information; no bookmark-to-exam generator. Mock Exam results separate incorrect from unanswered; overall exam percentage uses all selected questions as the denominator. Category/subcategory results show sample counts, and empty groups show “No questions,” not 0% performance. Reviewer progress tracks questions viewed, not answered or correct. Historical exam results always use the attempt's captured question/config versions.

### Theme and accessible UI

Semantic light/dark palettes cover surfaces, text, borders, primary/secondary, success, warning, and error, plus spacing/type/radius/touch-target tokens. Persist system/light/dark preference and react to OS appearance changes. Build reusable screens, typography, buttons, inputs, state views, question/answer controls, progress indicators, and the shared auth modal.

Home uses clear hierarchy, coverage rows, quick actions, and an exam call-to-action. Guest Home shows no invented stats. Session UI prioritizes readable content and primary action placement. Navigator cells combine current borders, answer/flag icons, and accessibility labels. Handle large fonts, long passages, safe areas, keyboard overlap, screen-reader focus in dialogs, and both themes. UI visual direction is still subject to design review.

## 8. Proposed import workflow

Preserve originals -> extract page text/layout/images -> create candidates with provenance -> attach context/choices/answers -> normalize conservatively -> map taxonomy -> detect duplicate candidates -> apply reviewed corrections -> validate publishable schema -> emit normalized JSON, assets, and issue report -> dry-run Firestore diff -> explicit target-bound import.

Source-specific adapters are necessary. Missing distractors, missing stems/passages, contradictory keys, invalid choice labels, uncertain dates, and unsupported assets are blocking publication issues. The user has authorized drafting distractors and corrected content. This belongs in an explicit editorial transformation stage, separate from deterministic extraction: record original content, proposed change, rationale, verification source where needed, and approval status. Drafts cannot be imported into the active question catalog merely because they pass structural validation.

Planned commands: `process:references`, `validate:questions`, `import:questions` (dry-run by default). No command exists yet. Separate Firebase Admin dependencies/credentials from the mobile bundle. Prefer developer credentials outside the repo; ignore service-account files and environment secrets. Validate project ID/environment and a reviewed change manifest before applying writes. Use version-aware upserts with preconditions, explicit creates/updates, bounded batches, restart checkpoints, and no implicit deletes. Re-running identical input must be a no-op.

Emit per-subcategory eligible counts and explain pool shortages. Historical questions remain versioned. Reference pages and original hashes stay available for every correction. Asset publication/storage ownership is part of detailed content design; do not introduce an unreviewed storage backend silently.

## 9. Verification strategy and delivery decomposition

Follow Superpowers TDD for business behavior: a focused failing test, minimal implementation, then refactor. Use deterministic Clock and RandomSource dependencies rather than flaky time/random tests.

| Test level | Required meaningful coverage |
| --- | --- |
| Domain/Jest | Stable answer mapping after shuffle; selection without duplicates; exact quotas and shortage errors; expiry; scoring and unanswered denominators; grouped context; immutable snapshots; progress deduplication |
| Configuration/import | All three JSON parameters invalid/missing/valid cases; distribution coherence; candidate vs published schema; source-format fixtures; duplicate labels/text; missing context; malformed math; stable IDs on rerun; correction provenance |
| Application/storage | Guest action guards; single-use return intent; cancellation/auth failure; corrupt cache and migrations; crash/restore; manual/expiry race; offline finalize/retry; UID isolation; bookmark retries |
| React Native Testing Library | All seven mandatory auth scenarios; menu updates; reviewer answer feedback; navigator state labels; unanswered confirmation; loading/error/empty/retry views; theme behavior |
| Firebase Emulator | Allowed owner operations; all cross-user denial; official content write denial; allowlisted fields and terminal-state rules; pagination/query compatibility; resumable upload and retry behavior |
| Device verification | Android/iOS development builds, background/foreground/force-close expiry, offline recovery, deep links, screen readers, large text, light/dark/system appearance, release configuration |

Do not claim device-tested accessibility/dark mode from Jest alone. Completion requires typecheck, appropriate tests, lint, relevant device/visual checks, reviewed repository boundaries, and no exposed secrets.

Recommended sequence of design/plan/implementation cycles:

1. Content contracts/import validation and app foundation: taxonomy, schemas, guest shell, theme, Firebase/config boundaries, auth coordinator, test harness.
2. Reviewer lifecycle and bookmarks, with durable local state and safe synchronization.
3. Mock exam engine, configuration/distribution, durable timer/finalization, results and submitted-exam review.
4. Progress/history, full security-rule integration, offline/device verification, and release documentation.

These are delivery slices, not reductions in the requested scope. Each slice needs its approved spec and small verifiable implementation plan. The first slice must establish shared contracts needed by later slices without pretending those later features are complete.

## 10. Decisions still needed during brainstorming

Resolved editorial decision: draft MCQ conversions and corrected content for the answer-only entries, with editorial review before publication. This authorizes the editorial work within the planned content pipeline; it does not certify any proposed answer or approve an unwritten architecture/specification.

Resolved foundation decision: Expo development builds + Expo Router + React Native Firebase.

Resolved content decision: section 11's content contracts and editorial publication rules are approved. This is approval of the workflow, not approval of individual question drafts.

Resolved authentication decision: section 12's guest-first navigation, central protected-action coordinator, and return-intent behavior are approved.

Resolved mock allocation decision: 150 items, distributed General Information 35, Verbal Reasoning 40, Quantitative Reasoning 25, Logical Reasoning 50. The user approved this allocation on 2026-10-03. This approval does not certify official examination weighting or approve unrelated pending session rules.

Resolved infrastructure decision: section 14's repository boundaries, local durability, owner-scoped synchronization, Firestore access, and configuration fallback design are approved.

Further design decisions will be raised one at a time: remaining reviewer/mock-exam session rules and configurable practice defaults, and visual design. Unmapped source material stays in editorial staging under the approved publication policy. None of these decisions expands the excluded feature list.

No tests, builds, lint, Firebase writes, or imports have run: there is no application yet. The next checkpoint is review of the proposed approach, followed by the written-spec and implementation-plan stages prescribed by Superpowers.

## 11. Approved design section: content contracts and editorial publication

Status: approved by the user on 2026-10-03. This section defines the accepted content design; it does not create application code or publish content.

### 11.1 Separate extraction, editorial work, and published content

Use three representations with explicit boundaries:

| Representation | Purpose | May enter a scored session? |
| --- | --- | --- |
| Source record | Exact extracted question material, source labels/answers, page locations, file checksum, and linked images/context | No |
| Editorial candidate | Proposed prompt, choices, correct answer, explanation, mapping, verification evidence, and unresolved issues | No |
| Published question revision | Validated, editor-approved content with stable identity and publication metadata | Yes, when active, eligible, and supported by the client |

Raw extraction is reproducible from the unchanged reference PDFs. Editorial changes are stored separately and are never overwritten by re-extraction. The review queue is repository data and reports used by the import tooling; no additional mobile admin feature is proposed.

Every conversion of an answer-only item records which prompt/choices/explanation were authored. Factual corrections record evidence and reasoning; correcting legal/current-event information requires appropriate current primary sources. The PDF's own correction notes are evidence to investigate, not automatic approval.

Candidate review states are `draft`, `needsReview`, `approved`, and `rejected`. An approval applies to an exact content digest, including choices, answer, context, explanation, taxonomy, and validity dates. Changing any of those invalidates the prior approval. Structural validity alone never activates an editorial draft.

### 11.2 Published question contract

| Field | Proposed invariant |
| --- | --- |
| `id` | Stable logical identity independent of wording, order, and revision |
| `version` | Positive integer; published revisions are immutable |
| `categoryId`, `subcategoryId` | One valid pair from the requested taxonomy |
| `prompt` | Nonempty validated content blocks |
| `stimulus` | Optional versioned shared passage/sentence set/diagram; required dependencies must be present |
| `choices` | Two or more nonempty choices with unique stable IDs; duplicate rendered alternatives are blocking issues |
| `correctChoiceId` | Exactly one existing choice ID |
| `explanation` | Optional validated content blocks; omission is allowed, fabrication is not |
| `choiceOrderPolicy` | `shuffleAllowed` or `fixed`; fixed takes precedence over global answer randomization |
| `difficulty` | Optional explicitly reviewed value; absent means unspecified |
| `sources` | One or more source locators and transformation references |
| `status` | `active`, `inactive`, or `archived`; independent of editorial candidate status |
| `isCurrentEvent`, `publishedAt`, `expiresAt` | Current-event items require verified time context and a valid expiry window before activation |
| `createdAt`, `updatedAt` | Normalized timestamps for question records; not substituted for source publication dates |

Use opaque choice IDs such as `choice-01` and retain original source labels separately. A displayed A/B/C/D label is generated from the saved presentation order; it is never used to score. This resolves the duplicated `b.)` labels in the source without guessing which occurrence is correct.

Question and stimulus versions are frozen into the active session and submitted result. Source edits, retirement, reclassification, or later answer corrections do not rewrite old results. New sessions select the current eligible revision.

### 11.3 Preserve meaning across content formats

Text blocks support explicitly marked target words/segments, so vocabulary and error-identification questions do not rely on lost PDF underline formatting. Math has a validated representation distinct from plain prose. Image/diagram blocks include asset identity, dimensions, and a reviewed accessible description; table blocks include headers and rows.

The initial published content renderer should support text, marked text, math, and reviewed images because the inspected sources already require them. Table/diagram-specific extensions stay in the model; unsupported required kinds cannot be selected until rendering support exists.

Shared passages and sentence sets are first-class stimuli, not loose text attached to the preceding question. Each question can render its complete context even after question shuffling. The deduplication fingerprint includes that context, preventing all eighty positional paragraph questions from collapsing into five generic prompts.

Disable answer shuffling for inline numbered grammar segments, letter-dependent sequences, and position-dependent choices until reviewed wording makes shuffling safe. “All of the above” cannot simply be moved into the middle of a choice list. The question's policy overrides the global Remote Config toggle.

For image questions, extract or reconstruct only the question/choices needed by the learner. Preserve the original PDF image as provenance, but do not display its bold/underlined answer key before submission. Candidate assets require visual and editorial checks before publishing. Asset hosting remains a later infrastructure decision.

### 11.4 Eligibility and shortages

A new session may select a question only if its exact revision is approved and active, the taxonomy pair is valid, required content/assets are available, the client supports its content kinds, and its validity window includes the session start time. Failures produce a content issue or a clear insufficient-content state, not guessed answers or duplicate filler questions.

Questions outside the requested taxonomy remain unmapped candidates pending a content decision. In particular, general Philippine history is not automatically PNP History. Category browsing remains public and may show an honest unavailable-content state when a subcategory lacks eligible questions.

An expiry occurring during an already-started session does not remove its question or change its score. The session represents the eligible question/configuration set selected at its start.

### 11.5 First contract acceptance examples

- Large reviewer I Q5 cannot publish while its stem is missing.
- Large reviewer IV Q2 cannot publish while two rendered alternatives are identical.
- Large reviewer X Q8's corrected arithmetic/key remain a reviewed revision proposal until approved.
- Notes entries gain authored distractors in candidates, with no automatic promotion into the active bank.
- A re-extraction preserves authored corrections and returns the same source identities.
- Two “Which should be the first sentence?” questions with different sentence sets remain distinct.
- Shuffling choices preserves the keyed choice ID and the stored display order on restart.
- Editing approved content invalidates its prior editorial approval.
- Archiving or changing a question leaves submitted exam snapshots unchanged.
- A client cannot start a session containing unavailable required images or expired current-event content.

These boundaries and publication rules are approved inputs to the eventual written specification and implementation plan.

## 12. Approved design section: guest-first authentication and navigation

Status: approved by the user on 2026-10-03. Defines the seven mandatory authentication scenarios as architecture and acceptance criteria; no application code has been written.

### 12.1 Public shell and protected entry points

The primary tabs are Home, Review, Mock Exam, Progress, and Menu. Home is the normal cold-launch destination for both guests and authenticated users. An active exam is offered through a Resume action on Home instead of forcing the user away from the required landing screen. A valid explicit deep link is a separate navigation intent, subject to the same access policy.

| Destination/action | Guest behavior | Authenticated behavior |
| --- | --- | --- |
| Home, Menu | Open immediately | Open immediately; show real user information when available |
| Reviewer category/subcategory overview | Browse descriptions and availability | Same public content plus permitted Start actions |
| Mock Exam tab | Open instructions/configured exam overview | Same overview with Start/Resume actions |
| Progress tab | Show shared auth prompt, leaving previous tab selected | Open personal progress |
| Start Reviewer, Start Mock Exam | Show shared auth prompt; create no session | Validate content/config and enter session preparation |
| Bookmarks, history, profile | Show shared auth prompt | Open owner-scoped data |
| About, app information, appearance, Privacy, Terms | Open immediately | Open immediately |
| Sign-in, registration, password reset | Open when requested | Auth entry routes avoid redundant login forms |

Thin route files render feature screens. The root layout owns providers, initialization, and navigation containers; it does not redirect guests to Login. A centralized route policy handles protected deep links as well as in-app links. Directly opening another user's attempt ID does not grant access: identity and ownership are checked by the application/repository and Firestore rules.

### 12.2 Authentication coordinator and return intent

One `AuthenticationCoordinator` exposes a protected-action entry point, observes the AuthenticationRepository, and owns the reusable auth prompt. UI components send typed intent objects; they do not inspect Firebase users or duplicate modal implementations.

An intent describes a supported action such as `startReviewer`, `startMockExam`, `openProgress`, `openBookmarks`, `openHistory`, `openProfile`, `openAttempt`, or `setBookmark`. It contains validated action parameters, a safe return destination, an intent ID, creation/expiry timestamps, and an optional required owner UID for resuming existing user data. Routes are derived from this closed union rather than trusted arbitrary redirect strings.

Bookmark intents express the desired final state (`saved: true/false`), not a replayable toggle. Session starts use a stable operation ID and deduplicated local creation, so repeated auth callbacks cannot create multiple sessions. Route navigation can be replayed safely if interrupted; side effects need idempotency rather than a claim of exactly-once callback delivery.

Only one auth flow owns a pending intent at a time. Prevent repeated taps while its prompt/auth transition is active. Persist only the validated intent metadata, with a proposed centrally defined 30-minute lifetime, so process recreation during sign-in can recover the destination. Never persist passwords, Firebase tokens, executable callbacks, or raw external URLs in this mechanism. On expiration, successful authentication returns to the safe originating overview and tells the user to start again.

Prompt actions:

- **Sign In:** open the sign-in screen while retaining the intent.
- **Create Account:** open registration while retaining the same intent.
- **Maybe Later:** dismiss, clear the intent, and retain the originating public screen.

Switching between sign-in/registration or opening password reset preserves the intent. Login/registration validation errors preserve it too. Explicitly leaving the authentication flow cancels it. Failed or canceled authentication never starts a reviewer or an exam.

After successful authentication, revalidate the intent, current user, question availability, and configuration. Resume the selected reviewer flow; for Mock Exam, return to its preflight screen with duration/count and a deliberate Start action. The exam clock begins only after that action successfully prepares and persists the exam, never while the person is entering credentials. An existing-session intent can resume only under its original UID.

Voluntary authentication from Menu has no protected-action intent: return to the Menu origin and update the profile header automatically. Back navigation must not redisplay completed sign-in/registration forms.

### 12.3 Authentication and initialization states

Use explicit `resolving`, `guest`, `authenticated`, and `recoveryRequired` application states. Firebase authentication details remain in the data adapter. Home and public browsing are available in every state once local bootstrap is ready.

While auth is resolving, protected actions display a short loading state with cancellation/retry if necessary; do not assume a guest or flash Login. Remote Config timeout uses validated cache/defaults and cannot hold the splash indefinitely. Distinguish a real signed-out result from an initialization/network failure.

When Firebase retains a signed-in identity during a network interruption, an already-prepared session continues locally. A failed network refresh alone does not trigger logout. If the adapter confirms invalid credentials, revoked access, or a disabled account, lock protected interaction and request authentication recovery. Preserve the session's existing answers and deadline; an exam timer never pauses for reauthentication. Finalization on expiry remains a local domain operation even if remote synchronization must wait.

No previous user's pending writes are ever sent as a newly signed-in user. If recovery authenticates a different UID, show that account's Home and keep the prior session inaccessible. Profile loading/sync failure is distinct from authentication failure; an account successfully created in Auth should not prompt the person to register again because its profile write failed.

### 12.4 Menu, errors, logout, and boundaries

Guest Menu shows Guest User, Sign In, Create Account, and public destinations. Authenticated Menu shows name/email and Profile, Progress, Saved Questions, Exam History, Appearance, About/legal information, and Logout. The menu observes the coordinator's state without owning an independent auth subscription.

Email/password forms use React Hook Form and Zod. AuthenticationRepository operations cover register, signIn, requestPasswordReset, signOut, and auth-state observation. Map infrastructure failures to stable application error codes and friendly messages; never render raw Firebase errors. Password-reset completion uses neutral wording that does not depend on whether an address is registered.

Before logout, explain any active exam/unsynced-work consequence and persist pending changes. Logout does not pause an active exam's deadline or discard saved answers silently. Stop owner-scoped listeners, clear visible personal state and pending auth intents, and preserve only the owner-bound recovery/session/outbox data needed for a later same-account recovery. Native Firestore cache handling must be verified with account-switch tests; app-private storage is not a claim of encryption. Session persistence failure must offer retry/cancel before a destructive local cleanup.

The authentication prompt is a presentation component with accessible focus/labels and three actions. The coordinator is application logic, AuthRepository is a domain/application port, and FirebaseAuthenticationRepository is infrastructure. A shared protected-route boundary and protected use cases enforce the same policy; hiding a menu item is never the authorization mechanism.

### 12.5 Acceptance tests for this section

All seven user-specified scenarios are required. Additional cases:

- Guest cold launch never presents Login; auth/config failure still permits public Home.
- Guest Progress tap preserves the originating tab when Maybe Later is selected.
- Protected deep links show the common prompt and never expose personal content first.
- Sign-in/registration switching, validation failures, and password-reset navigation preserve the intended destination.
- Canceling auth clears the intent; voluntary Menu sign-in returns to Menu.
- Expired, malformed, or unknown intents cannot navigate or execute an action.
- Repeated auth callbacks/repeated taps do not create duplicate sessions or reverse bookmark state.
- Mock Exam authentication returns to preflight, with no running timer until Start succeeds.
- Offline continuation does not imply logout; confirmed credential loss locks access without resetting the exam deadline.
- Account switching never exposes or synchronizes the previous account's data.
- A persisted valid signed-in session opens Home on normal relaunch, with Resume offered where relevant.

This guest/auth/navigation design is approved input to the eventual written specification and implementation plan.

## 13. Next design section: reviewer and mock-exam session behavior

Status: proposed for user review. The numbers below are proposed application practice settings. They are not claims about official PNPE question counts, category weighting, or passing standards. No normalized/approved production bank exists yet.

### 13.1 Central defaults and session preflight

| Setting | Proposed local default | Configuration behavior |
| --- | --- | --- |
| Reviewer coverage | All eligible published questions in selected category/subcategory | No question-count cap; retrieve content in batches without limiting session coverage |
| Mock Exam duration | 180 minutes | `config.mockExam.durationMinutes`, as required |
| Mock Exam count | 150 questions (user requirement) | `config.mockExam.questionCount` |
| Mock Exam distribution | Approved: General Information 35, Verbal Reasoning 40, Quantitative Reasoning 25, Logical Reasoning 50 | Integer counts in `config.mockExam.distribution`; sum must equal question count |
| Mock Exam practice passing threshold | 75% | `config.mockExam.passingPercentage`; label as app practice threshold |
| Question randomization | Enabled | Separate reviewer and mock-exam configuration |
| Answer randomization | Mock Exam only, where question policy permits | Reviewer retains source choice order; fixed-order questions override exam shuffle |
| Reviewer answer/explanation | Immediately visible | Required read-through behavior; obsolete `showExplanationAfterAnswer` does not apply |

The user replaced the previous 100-question proposal with 150 items and supplied these approximate allocation ranges: General Information 30–40, Verbal Reasoning 40–45, Quantitative Reasoning 20–25, Logical Reasoning 45–55. The user approved the fixed allocation 35/40/25/50, which totals exactly 150 and stays within all four ranges. Use exact remotely configured quotas rather than independently randomizing counts within ranges, which could produce the wrong total. Question selection remains randomized where configured.

For this allocation, propose mapping Verbal Reasoning to the existing `communicationSkills` category and Logical Reasoning to `criticalThinking`; do not introduce duplicate categories or change the approved subcategories. Mock-exam preflight/results can display the supplied exam labels with the reviewer category name for clarity. This naming bridge is proposed, not a global taxonomy rename.

The official [NAPOLCOM Region I examination coverage page](https://www.napolcom.gov.ph/r1/index-services.php), checked on 2026-10-03, lists General Information, Verbal Reasoning, Quantitative Reasoning, and Logical Reasoning. The checked official sources did not establish the 150-item total or these numerical ranges. Treat 150 as the user's product requirement and the proposed allocation as an application practice setting; do not advertise the exact breakdown as officially verified.

The configuration is subject to real eligible-pool validation: a Logical Reasoning quota of 50 cannot start against 49 valid questions. Never fill shortages with drafts, repeated questions, expired items, or silently changed category quotas. The startup default exists even before content publication; Start displays a clear unavailable-content state until the bank can satisfy it.

Category/subcategory overview shows the full eligible reviewer count with no cap; mock exams require the entire configured count/distribution. Neither mode downloads the whole bank merely to display its overview.

Mock Exam preflight resolves the user, validated configuration, eligibility metadata, and selected content. Fully validate and persist all required question/stimulus/asset snapshots before the exam becomes active. Storage or retrieval failure leaves no running exam and offers Retry. Freeze configuration, question revision, choice order, and question order at activation. Reviewer content can load progressively as described below.

### 13.2 Reviewer selection and lifecycle

User-directed revision on 2026-10-04 supersedes the original answering-based reviewer requirements and the proposed 20-question cap. A category reviewer includes every eligible published question in that category; a subcategory reviewer includes every eligible published question in that subcategory. No sampling cap or custom-practice controls.

Show the question, reference choices where present, clearly labeled Correct answer, and available explanation immediately. Choices are not selectable; do not show Submit Answer, correctness feedback about the user, or hide answers behind a reveal action. If an explanation is missing, say “No explanation available”; do not fabricate one. Keep bookmarks, category/subcategory labels, question position, Previous, and Next.

Freeze a complete lightweight ordered ID/revision manifest from a published catalog generation at session start. Fetch immutable question content and required assets in bounded batches, validating and caching them as loaded. Preserve the full count; offline missing pages offer reconnect/retry without silently dropping items or marking them viewed. A new offline session needs a complete cached manifest, but may browse its cached content with clear availability messaging. New publications appear in a new session rather than reshuffling an active reviewer.

Reviewer sessions are untimed and resumable. Persist owner, manifest/order, current question, and distinct viewed-question IDs. Mark viewed only when the question and correct answer have successfully rendered; navigation past unloaded content does not count. Proposed completion rule: all questions have been viewed, not answered. Repeated visits do not increment the session's viewed count. “Viewed” describes display history, not demonstrated comprehension or mastery.

Leaving saves the position for Resume. Explicit End Session preserves viewed progress without inventing correctness statistics. Starting another reviewer must not silently overwrite an active one. The summary shows viewed/total and completion status only; reviewer correct/incorrect/accuracy and passing thresholds no longer apply. Authentication remains required to start and save these personal sessions; category browsing remains public.

### 13.3 Mock-exam selection and answering

The preflight screen displays the configured count, exact category distribution, 180-minute default duration, practice passing threshold, and the rule that leaving/backgrounding does not pause time. The authenticated user presses Start Exam. Activate only after complete snapshot persistence; record a stable attempt ID, owner UID, owning device ID, start timestamp, deadline timestamp, and configuration snapshot.

Select without replacement within each category and across the attempt. Honor shared-stimulus dependencies even when question order is shuffled. Category quotas are exact counts; use capacity-aware round-robin allocation across nonempty subcategories, randomizing allocation order when shuffling is enabled, to prevent a large Grammar pool from monopolizing Communication Skills. This balancing is an app practice policy, not an asserted official exam weighting.

There is no correctness feedback or explanation before exam submission. Answer selection is saved and may be changed or cleared while the attempt is active and before its deadline. Flags are independent of answers: a question can be both answered and flagged. Persist every answer, flag, and navigation change; do not falsely report a failed storage write as saved.

The navigator identifies current, answered, unanswered, and flagged states using accessible labels and non-color cues. It allows jumping to any question. Previous/Next operate on the frozen question order. A bookmark control during the exam saves the question reference without exposing its answer/explanation.

One active mock exam and one active reviewer may exist per user per device. Repeated Start taps resolve to the existing active attempt. Another device can create its own distinct attempt, but cannot silently take over or merge a live attempt. Completed history synchronizes across devices; live cross-device handoff is not part of this design.

### 13.4 Deadline and durable finalization

The domain calculates remaining duration from the persisted deadline and an injected clock; a UI interval is only a display refresh. Re-check expiry on every answer mutation, navigation into the exam, foreground event, restored session, and submission. The deadline does not reset or pause after navigation, backgrounding, authentication recovery, or app restart.

While the process runs, use a monotonic elapsed-time reference alongside wall time. Persist the last effective observed time and never allow remaining duration to increase on restoration. This guards ordinary clock changes but is not a tamper-proof clock across offline device restarts; no official-exam security guarantee is claimed.

Leaving an active exam shows that its clock continues and offers Stay or Leave and Resume Later. Normal relaunch opens Home with Resume; if the attempt has expired, bootstrap finalizes it locally before allowing any answer change and offers View Results. If the operating system suspends/kills the app at the deadline, finalization executes on the next opportunity, with effective end time capped at the original deadline.

Manual submission always asks for confirmation. If unanswered questions remain, include the exact count and Continue Exam / Submit Anyway actions. If every question is answered, use a concise Submit Exam confirmation. A confirmation dialog cannot pause the clock; if time expires while it is open, automatic submission takes precedence.

Use one serialized finalization operation keyed by attempt ID. It atomically freezes answers, calculates results from snapshots, writes a terminal local result, and records pending synchronization. Manual taps, expiry events, and restore retries converge on the same result. Answer writes recheck status/deadline inside the same serialized storage boundary; actions processed at or after expiry are rejected.

Finalization reason is `manual` or `timeExpired`. Domain status becomes `completed` locally whether online or offline. Synchronization separately reports `pending`, `syncing`, `synced`, or `failed`; a network failure must not reopen a completed exam. Persisted attempts awaiting sync remain visible with their actual sync state.

If local finalization fails, lock further answer edits, preserve the last durable active state, and show a recoverable save error. Retry computes the same frozen cutoff from durable data; it never resets the deadline. A process crash before an answer is durably saved cannot guarantee recovery of that answer, so the UI must distinguish saving from saved rather than claiming impossible durability.

### 13.5 Results, history, and progress definitions

| Metric | Definition |
| --- | --- |
| Exam correct | Selected choice ID equals the snapshotted correct choice ID |
| Exam incorrect | An answer exists but is not correct |
| Exam unanswered | No selected choice at finalization |
| Exam percentage | `100 * correct / total`; includes unanswered in the denominator |
| Practice pass | Compare unrounded score against snapshotted percentage threshold; round only display values |
| Category/subcategory percentage | Correct divided by all questions assigned to that group; show counts alongside percentage |
| Time used | Effective end minus start, clamped to zero through configured duration |
| Time remaining | Configured duration minus time used; zero for time-expired submissions |
| Reviewer questions viewed | Distinct question IDs viewed per session; repeat visits in the same session count once; no accuracy metric |
| Reviewer sessions completed | Proposed: sessions in which every manifest question has been viewed |
| Mock exams completed | Unique finalized attempts, including automatic expiry and attempts with unanswered questions |
| Average/highest mock score | Average/highest percentage across completed attempts, not raw marks when exam counts differ |

Reviewer viewed counts and mock-exam category performance remain separately labeled. Never infer reviewer accuracy from visible answers or questions viewed. Progress shows real data and no weak-topic predictions or mastery labels. If there are no completed exams, average/highest are unavailable rather than invented zeros.

Results show overall score/percentage, correct/incorrect/unanswered counts, practice threshold/pass result, time used/remaining, category and subcategory breakdowns, and submission reason. Empty categories in other summaries show No questions rather than an artificial 0%.

Submitted-exam review exposes all questions with the user's answer, correct answer, explanation when present, and correctness state, using the original saved wording and choice order. This is part of results. History lists start date, score/percentage, time consumed, and completed/time-expired status with a separate sync indicator. An in-progress attempt is presented separately as Resume, not included in completed averages.

Progress calculations deduplicate the same submitted event/attempt across local records and cloud synchronization. Retrying an upload never adds another completed exam or answer. Distinct attempts on different devices have distinct IDs and legitimately contribute separately.

### 13.6 Acceptance tests for session behavior

- Reviewer with 137 eligible questions includes all 137, loaded in batches; empty pools produce an actionable empty state.
- Reviewer immediately displays the correct answer and available explanation, with no answer input or submission button; long sessions resume at the same question.
- Failed/unavailable content is not counted as viewed; repeat visits count once per session; reviewer progress never creates correctness or accuracy values.
- Mock Exam with one category below quota cannot start and does not change the configured count.
- The proposed default selects exactly 150 distinct questions with category counts 35/40/25/50; reject configuration whose quotas do not sum to the configured total. Exam labels resolve to the existing category IDs without duplicate pools.
- Category and subcategory selection preserve exact intended counts, unique IDs, valid context, and fixed-order exceptions.
- Previous/Next, restart, and shuffling do not change answer-to-choice mapping or submit an answer twice.
- Ending early preserves viewed reviewer totals without adding a completed reviewer session.
- Offline persistence and restoration retain the same attempt, deadline, selections, flags, and cursor.
- A manual confirmation open at expiry finalizes once as time-expired.
- Late answer writes are rejected, including after foreground or restoration.
- Local finalization/network failure does not reopen the attempt; retries do not duplicate progress.
- A changed Remote Config threshold/duration or edited source question cannot change an existing attempt/result.
- Unanswered questions lower the exam percentage but are not counted as incorrect selections.
- Score display rounding cannot turn a below-threshold result into a pass.
- Mixed exam sizes use percentages for averages; local/cloud copies count once.
- Returning to Home leaves the exam deadline running; an expired attempt offers results rather than Resume.

The 150-item allocation and section 14 infrastructure/offline design are approved. Remaining session rules/defaults remain proposed for the consolidated design review; allocation approval alone does not approve them. Visual design remains to be finalized before producing the agreed written specification.

## 14. Approved infrastructure and offline design

Status: approved by the user on 2026-10-03. This approves the design, not implementation before the written-spec and implementation-plan gates. No application code, Firebase resources, or production data has been changed.

### Boundaries and storage responsibilities

Initialize Firebase once in the app composition layer. Authentication, Question, Exam, ReviewerSession, Bookmark, and configuration repositories expose typed contracts; native SDK calls stay in infrastructure adapters. Application use cases enforce eligibility, ownership, scoring, and lifecycle rules independently of screens.

Use Expo SQLite for durable session snapshots, answer mutations, and the pending-sync outbox. Commit each local mutation and its queued operation in one transaction. AsyncStorage holds only small versioned preferences and validated configuration caches, not authoritative exam state. Zustand supplies reactive presentation state, not a second persistence authority. SQLite persistence/transaction APIs are documented by [Expo](https://docs.expo.dev/versions/latest/sdk/sqlite/).

### Firestore and retrieval

Public categories contain safe overview metadata. Authenticated content reads use immutable question revisions and a versioned, partitioned eligibility catalog. Fetch only relevant catalog metadata and selected question content; do not download the full question bank on launch. Recheck selected revisions, expiry, assets, and category quotas before activation. Offline starts require enough fully cached eligible content; missing content produces an explicit unavailable state.

Store personal records beneath `users/{uid}`: bookmarks, reviewer sessions, and exam attempts. Keep question snapshots in item subcollections rather than a single large attempt document. Separate compact result summaries from full review payloads so history can paginate without reading every question. Public browsing does not require question-answer access.

### Synchronization and privacy

Local finalization succeeds independently of network availability. Upload immutable snapshot items with stable IDs before publishing the remote completion manifest. Retry incomplete uploads without duplicating attempts; validate completeness when reading cloud results. Owner-scoped outbox processing pauses on authentication loss and never replays under another UID. Retry temporary failures with bounded exponential backoff; permission/validation failures remain visible for recovery rather than retrying indefinitely.

Active sessions and unsynced records are pinned against cache eviction. Corrupt or unsupported local records are preserved for recovery, not silently replaced by a fresh exam. Paginate remote history and incrementally reconcile compact summaries into the local progress read model; do not repeatedly scan all question snapshots. Cross-device live editing remains excluded.

Firestore rules deny cross-user access and client changes to official content; validate allowed fields and final-state immutability. Import tooling uses separate Admin credentials, explicit project targeting, a reviewed dry-run manifest, and no implicit deletes. Rules are not a tamper-proof scoring server; results remain personal practice records. See [Firebase rule conditions](https://firebase.google.com/docs/firestore/security/rules-conditions).

### Configuration and startup

Validate `app_info`, `data`, and `config` independently with Zod. Each invalid parameter falls back as a whole to its last-known-good value, then bundled defaults. Never merge incompatible count/distribution fields. Freeze session configuration at activation. Remote Config fetch runs with a finite timeout and does not hold Home behind network success; public Home remains available while authentication resolves. Native defaults/fetch behavior is documented by [React Native Firebase](https://rnfirebase.io/remote-config/usage).

Proposed maintenance/minimum-version behavior: show clear notices and prevent new sessions when required, but preserve existing sessions and permit local completion/results. Remote feature toggles must not erase records or strand an active exam. Configuration is not a security boundary and contains no secrets.

### Verification

Test transaction rollback, interrupted uploads, retry deduplication, account switching, corrupt-cache recovery, configuration fallback, exact 150-item selection, and Firestore owner/immutability rules. Device tests must cover force-close restoration, offline expiry, and reconnection. UI design and the consolidated session-rule approval remain before the written-spec stage.

## 15. Visual design review

Status: visual direction approved on 2026-10-04, including the requested expanded navigator and prior color treatment. Remaining session-policy defaults in section 13 require their own confirmation before the written specification is drafted.

The user selected Home option A (Guided reading): one clear reviewer action, spacious coverage rows, restrained cards, quick links, and a secondary Mock Exam invitation. Preserve the approved guest-first navigation and no invented guest statistics. This selection approves the Home direction, not implementation or unreviewed session screens.

The reviewed screens apply the same visual direction to reviewer, active Mock Exam, and the 150-item navigator: semantic light/dark surfaces, blue primary actions, readable question text, and a separate exam navigator with current/answered/unanswered/flagged indicators. The original reviewer-feedback mockup is superseded by the user's read-through requirement: show the correct answer and available explanation immediately, with Previous/Next and no Submit Answer or “Your answer” treatment. Mock Exam correctness stays hidden until finalization. Show save status separately from network synchronization. Browser previews are illustrative, not device/accessibility verification or product code.

The user approved color coding for the question navigator: green answered cells, neutral gray unanswered cells, amber flagged cells, and a blue outline for the current question, with semantic equivalents in dark mode. Flagged fill takes precedence over answer-state fill; retain ✓ or — alongside ⚑ so flagged-and-answered and flagged-and-unanswered remain distinct. Current outline is independent of both states. Keep a visible legend and explicit screen-reader labels. Green indicates an answer exists, never that it is correct.

The user additionally requested an expanded navigator: vertically stacked rows displaying a single-line question preview, truncated with a trailing ellipsis when needed. Keep both Compact grid and Expanded list modes via a shared toggle. Each expanded row retains its number, status colors/symbols, and independent current marker. Preview text comes from the frozen question prompt, never its answer or explanation; collapse whitespace and use accessible content descriptions for non-text prompts. Screen readers receive the full preview text rather than a manually truncated string. Selecting a row navigates to the full question; no inline answers or new study mode. Implement a virtualized list with flexible text width, a single-line tail ellipsis, and unshrunk number/status controls; switching layouts preserves the selected question and exam state. The new preview opens in expanded mode solely to demonstrate the requested layout; the production default remains compact unless subsequently changed. Verify long text, large fonts, light/dark states, combined flags, and mode switching during implementation.
