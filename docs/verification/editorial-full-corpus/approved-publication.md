# Approved full-corpus publication

The owner replied exactly “aproved” to the final approval request for all 509 revisions in the [owner-review manifest](owner-review-manifest.json), with the already confirmed reviewer label `Project owner`. The approval was observed/recorded at `2026-10-08T01:48:03Z`; message timestamp metadata was not exposed. This authorization excludes 145 drafts, 13 rejected duplicates and the already approved initial twenty.

The binding canonical manifest digest is `befca02b985a7d07d83dfecd457571308304f07e95b87dd526144f7937b5c7fb`. Before stamping, all 509 source keys exactly matched current needsReview membership. All content, review, overlay, identity/version, lineage and packet digest bindings matched. All twenty stored manifests, overlays, Markdown packets and coverage files matched reconstruction from current authoritative candidates byte for byte. Only status and approval fields were changed for those exact revisions. Content, review metadata, source references, question timestamps, evidence and rationale were preserved; draft/rejected revision bytes and the initial twenty overlay bytes were preserved.

Strict reconstruction at `2026-10-08T01:50:44.600Z` through the existing publication/source/identity/eligibility gates yielded **529 distinct approved eligible questions**: 20 prior plus 509 new. No approved blockers, unavailable approvals or expired approvals were omitted. Actual UTC checks preserved current-event time/verification/expiry gates. Canonical full publication digest: `2aeff30d35bf87bae8ef702156a07d124c3dd30a5d9527a1c9d32ce775b93efb`. `data/questions.json` contains this entire set. The [machine coverage record](approved-publication.json) is the separate approval checkpoint; the [review index](review-index.json), manifest, reconciliation and original packets remain preapproval history.

## Coverage

| Source        | Approved eligible | Draft | Rejected | Occurrences |
| ------------- | ----------------: | ----: | -------: | ----------: |
| short         |                20 |     0 |        0 |          20 |
| comprehensive |               410 |    65 |        2 |         477 |
| notes         |                99 |    80 |       11 |         190 |

| Category              | Distinct eligible | Default quota | Shortage |
| --------------------- | ----------------: | ------------: | -------: |
| generalInformation    |               134 |            35 |        0 |
| communicationSkills   |               276 |            40 |        0 |
| quantitativeReasoning |                41 |            25 |        0 |
| criticalThinking      |                78 |            50 |        0 |

All category minima 35/40/25/50 are satisfied, so the content pools support the default 150-question exam. This is content readiness; Reviewer/bookmarks and Mock Exam/results engines remain unimplemented. Category quotas are unchanged and there are no mandatory per-subcategory quotas.

| Subcategory           | Approved eligible | Schema-valid draft | Rejected |
| --------------------- | ----------------: | -----------------: | -------: |
| constitutionAndLaws   |                90 |                  0 |        5 |
| pnpHistory            |                 3 |                  0 |        0 |
| criminalJusticeSystem |                40 |                  0 |        6 |
| currentEvents         |                 1 |                  0 |        0 |
| publicServiceConduct  |                 0 |                  0 |        0 |
| vocabulary            |                46 |                  1 |        0 |
| readingComprehension  |                90 |                  2 |        0 |
| grammar               |               140 |                  2 |        1 |
| basicConcepts         |                14 |                  0 |        0 |
| problemSolving        |                27 |                  0 |        0 |
| dataInterpretation    |                 0 |                  0 |        0 |
| logicalReasoning      |                26 |                  4 |        1 |
| patternAnalysis       |                18 |                  1 |        0 |
| deduction             |                14 |                  2 |        0 |
| wordAnalogy           |                20 |                  1 |        0 |

Public Service Conduct and Data Interpretation have no eligible questions. Of 145 drafts, 132 are schema-invalid and unmapped in canonical coverage; 13 have a valid taxonomy/schema but unresolved blockers. The historical index records intended taxonomy on partial drafts separately. Missing passages, alternatives/targets, ambiguous wording, corrupt sequences, factual/verification/taxonomy uncertainty and unsupported image/diagram assets remain visible in the original packets. No draft or rejected duplicate enters the publication.

## Local demo dry run

The existing read-only import CLI was run against explicit `demo-pnpe`, bound to `127.0.0.1:8080`. Inspection was recorded at `2026-10-08T01:53:40.180889Z`. It prepared [the ignored exact manifest](../../../evidence/editorial/full-corpus-approved/import-manifest.json), with digest `e1fbe85c5dea1ba3504298de0d551d509ccd075d9e8ff6dc3d36b1539ed4a3b9`: **529 questions, 509 creates, 20 noops and 13 shards**. Input digest matches the full publication above. The existing head is revision 1 / generation `3fb47bd7ebc36303bdb30ac3e58e1ed47de2ca65a455e50466039e1d363a0a3f`; proposed generation `7f8f7ded0edcea40cbba7a5180b9713f6c0edec8f76eac7f60558e8a13a0775b`.

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run import:questions -- --project demo-pnpe --manifest evidence/editorial/full-corpus-approved/import-manifest.json
```

The worker performed no apply or import writes. Controller independent review of the concrete manifest and diff precedes the authorized local demo apply. Existing services were not reset or restarted. Production import, public redistribution/asset hosting, unresolved decoder licensing and native/device acceptance remain separate release gates.

## Verification evidence

The ignored [approval report](../../../.superpowers/sdd/2026-10-07-editorial-full-corpus/approval-report.md) records exact commands and outputs. [Preapproval hashes](../../../evidence/editorial/full-corpus-approved/preapproval-hashes.json), [the archived stamping helper](../../../evidence/editorial/full-corpus-approved/approve.ts.txt), [prior publication bytes](../../../evidence/editorial/full-corpus-approved/prior-publication.json) and command logs are retained alongside the dry run. Reference tests preserve historical packet contracts by removing only the exact authorized approval/status stamp after checking the complete original overlay digest; altered content, review metadata, evidence, rationale or timestamps fail those comparisons.
