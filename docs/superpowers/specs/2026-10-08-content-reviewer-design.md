# Content loading, Reviewer, bookmarks and resume

Date: 2026-10-08

Status: written specification approved by the owner through “continue” on
2026-10-08 after the specification review request. This authorizes implementation
planning; the written plan still requires review before execution. Production
writes remain outside scope. The approved foundation decisions remain binding.

## 1. Intent and scope

Make the approved question bank usable for authenticated read-through study on
Android and iOS. A learner starts a category or subcategory, reads every eligible
question with its correct answer already visible, bookmarks useful questions,
and resumes after closing the app or losing connectivity.

This slice delivers catalog/revision retrieval, rich-content rendering for the
published bank, durable content caching, Reviewer sessions, bookmarks, viewed
progress, resume and synchronization of these personal records. Mock Exam,
results and exam history follow in a separate specification and plan. The 145
deferred drafts remain excluded. No editorial processing, stamping or reimport
is required by this design.

Confirmed inputs:

- The foundation design specifies guest-first browsing, protected study/personal
  actions, Clean Architecture, strict TypeScript, semantic themes and SQLite for
  durable session state.
- Reviewer has no answer selection, submission, score, accuracy or question cap.
  Choices remain in their original order; question order follows the validated
  Reviewer configuration and is frozen once per session.
- The approved publication has 529 distinct questions. Its recorded category
  counts are 134, 276, 41 and 78. These are an approval checkpoint, not hardcoded
  runtime availability counts.
- The live demo head was read without mutation on 2026-10-08: revision 2,
  generation `7f8f7ded0edcea40cbba7a5180b9713f6c0edec8f76eac7f60558e8a13a0775b`.
- Public Service Conduct and Data Interpretation have no eligible questions.

Design choices proposed here: one active Reviewer session per account per device;
explicit confirmation before replacing it; device-scoped cloud records rather
than live cross-device continuation; availability of fully cached content for new
offline sessions with a visible last-refresh timestamp. These choices make the
foundation's proposed lifecycle concrete.

## 2. Approach and alternatives

Use the existing immutable Firestore catalog/revisions with a local SQLite cache
and transactional personal-state outbox. Read the complete lightweight catalog
before freezing a session manifest, then retrieve questions progressively. This
fits the approved foundation and supports study during network gaps without
requiring a whole-category question download before starting.

Bundling `data/questions.json` would provide immediate offline access but duplicate
publication distribution in every app build and bypass the established live
catalog lifecycle. A network-only reader would be simpler but fail the required
restart/offline behavior. Neither alternative is selected.

Normal startup continues loading public taxonomy/config only. It does not fetch
the bank or initialize study storage synchronously before Home becomes usable.

## 3. Content contracts and retrieval

Introduce mobile-safe catalog DTO schemas and domain ports under
`features/content`. Reuse `QuestionSchema` and taxonomy. Developer tools must not
be imported into mobile code; the current tool catalog schema uses Node APIs.
Keep tool/mobile contract parity under tests using representative stored DTOs.

The deployed head has only `generation` and `revision`; it contains neither shard
names nor per-question content digests. List every shard under the frozen
generation using bounded document-ID pagination. Validate each shard's ID,
nonempty entries (at most 200), taxonomy pair, safe question ID, revision,
validity, kinds and assets. Reject duplicate logical IDs across shards,
conflicting stimulus identities, malformed data and interrupted pagination.
Do not filter on an unindexed field or infer completeness from category counts.
The immutable generation collection is the discovery boundary. Save a catalog
only after all its pages validate, in one local transaction; partial downloads
cannot become a usable catalog.

Read the head from the server when online. Detect a head change after discovery
and retry a bounded number of times before offering retry/cached content. Do not
merge generations. An offline cached generation is usable only if previously
completed and validated; show when it was last checked. Permission/auth failures
must not be misreported as offline cache availability.

Validate each fetched revision against `QuestionSchema` and its manifest entry:
ID/version, taxonomy, status, validity, required kinds, asset and stimulus
references must agree. Validate bounded payload size before durable caching.
Locally fingerprint cached content to detect corruption/conflicting immutable
revisions. Existing remote documents provide no independently anchored revision
digest: do not claim cryptographic approval verification in the client. Editorial
approval remains the trusted importer responsibility.

New-session eligibility requires active content, unexpired dates at the injected
clock, valid current-event safeguards and supported content. Initial rendering
supports text, marked spans and math used by the approved publication. Tables,
images and diagrams remain unsupported until their publication transport/assets
and renderer acceptance exist; never remove a required block and render the rest
as though the question were complete.

Freeze every eligible ID/version in the selected scope, plus entry metadata,
generation, creation time and validated Reviewer configuration. Use a
`RandomSource` port for one-time unbiased shuffle; retain the resulting order.
Progressively fetch the current item and a small bounded look-ahead window.
Missing or invalid revisions block the affected page with retry; they never
shrink or reorder the frozen manifest.

## 4. Durable local state

Add the Expo-compatible SQLite dependency during implementation only after
checking its version against the pinned Expo 57/native environment. Use versioned
migrations and parameterized statements. SQLite, not AsyncStorage or Zustand,
owns durable content/session/bookmark data.

Content tables store complete catalog generations and immutable question
revisions. Personal tables store owner/device/session identity, scope, manifest
items with ordinal, frozen configuration, position, viewed item set, lifecycle
and pending sync operations. Manifest and question payloads are separate rows;
there is no oversized full-category session blob.

Each personal mutation and its outbox operation commit atomically. A failed
transaction leaves the previous state usable and displays an actionable storage
error; the UI must not claim a bookmark or saved position that was not persisted.
Treat migrations/corruption failures as recoverable storage errors without
silently clearing saved work. Cache eviction may remove unreferenced content;
active-session and bookmarked cached revisions are retained. Outbox/personal
records are never evicted as disposable cache.

Owner context derives solely from observed Auth state. Account change,
sign-out or unresolved authentication unmounts personal screens, clears reactive
state and cancels/discards stale asynchronous results. Retained local records
remain keyed by UID and cannot be loaded through another account. Content cached
from authenticated reads is displayed only while a matching protected action
has authenticated access; its presence is not a bypass for guests.

## 5. Reviewer lifecycle and viewed semantics

Starting the same scope offers Resume or Start again. Starting another scope
while a session is active offers Resume existing or Replace; cancellation keeps
the original session. Replacement archives the prior local record only after
the new manifest and initial validated question are durably ready. Session
creation is idempotent against repeated intent callbacks/double taps.

The reading screen shows scope, item position, shared passage where present,
prompt, every choice, a clearly labeled correct answer, explanation when supplied,
bookmark toggle and Previous/Next. Marked grammar targets remain distinguishable
with accessible descriptions. Math retains grouping and displays its provided
accessible text to assistive technology. Never invent an explanation.

Record an item viewed once its required content, prompt and correct answer have
rendered successfully on the focused foreground screen. Deduplicate by session
item; prefetch and background renders do not count. This means rendered, not
proof of comprehension. A failed required explanation/stimulus render leaves the
item unviewed. Position updates and viewed operations are durable and safe under
rapid navigation. Only all manifest items viewed makes a session completed;
completion shows the viewed count and reading actions, never a quiz result.

Leaving a session saves position; restart/resume uses the same manifest/order.
If a page was not cached, offline navigation preserves the intended index and
shows reconnect/retry. Newly expired content is excluded from new sessions;
existing frozen sessions retain it with its historical time context. Config
maintenance/version gates prevent new sessions but preserve saved-work access.

Progress shows viewed count and active-session resume only. It describes viewed
as reading activity, without accuracy, mastery or weakness recommendations.
Feature flags hide new feature entry/mutations while retaining saved records and
access to existing work; disabling progress does not stop session persistence.

## 6. Bookmarks

Bookmarks are owner-specific logical question records containing the pinned
revision, category and timestamps. Bookmark from the current question, list
saved questions, open their validated pinned revision and remove a bookmark.
Do not create a Reviewer session or increment its progress just by opening a
bookmark. A newer catalog revision does not silently replace a saved revision;
show historical/as-of information where relevant.

The local toggle commits first with a queued desired-state operation. Removal
uses a tombstone until acknowledged so retry/download cannot resurrect it.
Uncached bookmarked content shows retry/reconnect; its missing page does not
remove the bookmark. Feature-disabled state retains existing bookmarks.

## 7. Synchronization and Firestore rules

Use bounded owner-only documents under `users/{uid}/bookmarks/{questionId}` and
`users/{uid}/reviewerSessions/{sessionId}` with bounded manifest/item
subcollections. Snapshot identity/config/order become immutable once published;
publish a ready marker only after required manifest chunks are uploaded. Partial
remote manifests are ignored by readers. No question payloads, answer keys or
source evidence are copied into personal cloud documents.

Session IDs include device identity and a unique session identity. Each device
writes only its own session stream; live cross-device handoff is excluded.
Viewed item uploads are idempotent set membership, while position/status use a
monotonic local sequence so late retries cannot regress state. Cloud records
provide durable backup in this slice; device session continuation remains local.

Bookmark synchronization uses a per-question server revision and compare-and-set
transaction. Persist operation ID/base revision locally. Repeated operation IDs
are no-ops. On conflict, retrieve the newer state, preserve and rebase the pending
local desired state, then retry within a bound. The last server-accepted action
wins; tombstones are retained. Never order competing device writes by their
untrusted wall clocks.

Outbox workers bind to a captured UID/auth epoch, serialize operations for a
record, recheck ownership before each network operation and before committing
its acknowledgement. Sign-out pauses retries; permission failures require auth
recovery rather than infinite backoff. Network failures use bounded backoff and
a visible pending-sync indicator without disabling local reading.

Rules explicitly allow only owner access to named personal paths with strict
keys/types, safe IDs, bounded payloads, timestamp constraints and immutable
owner/session identity. Test invalid transitions, cross-owner reads/writes,
malformed manifests and unknown fields. Existing official catalog/revision
client-write denial remains. No recursive owner wildcard is introduced.

## 8. Integration and verification

Extend the composition root with content, SQLite, Reviewer, bookmark and sync
ports. Native Firebase stays in data adapters, initialized through the existing
native services. Thin routes replace Reviewer/bookmarks/progress availability
boundaries; public overviews and the central Auth prompt remain. Preserve safe
return intents, deep-link ownership checks and feature/maintenance gates.

Use meaningful domain/application tests for complete catalog discovery, mixed
generations, malformed revisions, duplicate IDs, eligibility, immutable manifest
order, replacement cancellation, missing offline pages, render/view accounting,
restart persistence, failed transactions and outbox/account-switch races. Use
SQLite adapter tests for migrations, real rollback and restart, and mobile tests
for reading flow, bookmarks, resume, large text and semantic theme accessibility.

Rules/integration tests require a dedicated demo project and dedicated ports,
for example Firestore 8180 and Auth 9199, with explicit configuration and
fail-fast endpoint checks. They must never clear or seed the live demo catalog
on 8080 or reuse its Auth service on 9099. Ordinary unit/mobile tests remain
service independent. Preserve the approved publication and reference evidence.

Acceptance requires strict typechecks, lint/format and relevant existing/new
tests passing; actual native Firebase and SQLite flows in both Android and iOS
development builds; offline cached reading, uncached-page recovery, force-close
resume, bookmark sync retry and account isolation. Report unavailable device
checks explicitly. No push, deployment, production import or store upload follows
automatically from acceptance.

## 9. Next stage

After owner approval, prepare a focused implementation plan with dependency
compatibility checks, contracts, isolated emulator setup, persistence/retrieval,
Reviewer lifecycle, rendering/routes, bookmarks/progress/sync and acceptance.
Use the established subagent implementation and independent review workflow
after the plan is reviewed. Mock Exam/results/history remains the following
slice with 150 unique questions, quotas 35/40/25/50, a 180-minute timestamp-based
deadline and full validated preflight caching.
