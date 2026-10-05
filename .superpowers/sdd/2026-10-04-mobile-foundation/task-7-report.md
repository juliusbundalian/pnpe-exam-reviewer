# Task 7 report

Status: DONE. Public metadata reads and least-privilege owner-profile rules implemented. No production deployment or data writes were performed.

## Implementation and files

- `src/features/content/domain/CategoryRepository.ts`: required Availability, CategoryOverview, CategoryRepository contracts. Counts/timestamps are explicitly informational and do not authorize eligibility.
- `src/features/content/data/FirebaseCategoryRepository.ts`: injected Node-pure public metadata reads; validates safe nonnegative integer counts, canonical UTC ISO timestamps, freshness, taxonomy pairs, duplicate category/subcategory IDs. Missing/malformed/unavailable/expired/future metadata becomes unknown. Always retains bundled category order and all subcategories.
- `src/features/content/data/nativeCategoryFacade.ts`: narrowly scoped native factory consuming existing Firestore service, with no app initialization, official question read, or web SDK import.
- `src/features/auth/data/profileSchema.ts`, `FirebaseProfileRepository.ts`: existing display-name normalization/validation extracted into shared schema, reusing domain max length 100. Existing transactional server timestamps and immutable creation behavior preserved; domain reads/writes project to displayName only.
- `firebase/firestore.rules`: guest category reads; authenticated immutable versions and current catalog/shard reads; owner-only profiles with exact fields, string/name bounds, timestamp types, server create/update timestamps, immutable createdAt. Deletes and all client content writes denied. Default deny covers unimplemented subcollections and paths.
- `firebase/firestore.indexes.json`: category metadata field indexing disabled; unfiltered category reads need no field index.
- `tests/application/categories.test.ts`, `tests/firebase/rules.integration.test.ts`: category fallback/schema and actual emulator security behavior.
- `package.json`, `package-lock.json`, `jest.integration.config.cjs`: exact dev pins Firebase JS 12.19.0 and rules-unit-testing 5.0.2; Auth alongside Firestore; both integration globs. Dev integration-only app/compat singleton resolution fixes split web/native-transitive app modules without changing mobile imports.

The authoritative bundled taxonomy contains 4 categories and 15 subcategories (5+3+3+4). Parent confirmed the initial 4/14 dispatch text was a count typo; taxonomy was not edited.

## RED/GREEN evidence

Initial category test load identified the missing module; this was not counted as runnable RED. A deliberately empty typed repository stub then produced actual assertion failures:

`npm run test:unit -- --runTestsByPath tests/application/categories.test.ts`

RED: 1 failed suite, 14 failed tests; bundled result expected four IDs but received `[]`. After implementation, GREEN: 14/14. Injected facade empty stub subsequently produced 1 failed / 14 passed (expected categories-only read path, received no path). Final focused GREEN after facade implementation and additional valid-document coverage: 16/16.

Actual emulator commands used only local demo project and process-local Java/no-ADC configuration:

```sh
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' GOOGLE_APPLICATION_CREDENTIALS='/nonexistent/pnpe-emulator-no-adc.json' npx firebase emulators:exec --only auth,firestore --project demo-pnpe 'npx jest --config jest.integration.config.cjs --runInBand'
```

First two attempts exposed split app/compat singletons before assertions; these are not counted as security RED. Root cause traced to pinned web Firebase 12.19.0 and RN transitive web Firebase 12.17.1 resolving distinct app modules. The integration-only singleton mapper corrected registration. With deny-all still intact, actual RED: 5 failed / 7 passed, expected allowed guest/category, authenticated official, and valid owner profile operations failed `PERMISSION_DENIED` against rule L4. Existing importer tests passed 6/6. Only after this RED were rules relaxed.

Final actual emulator command:

```sh
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' GOOGLE_APPLICATION_CREDENTIALS='/nonexistent/pnpe-emulator-no-adc.json' npm run test:emulator
```

GREEN: 2 suites / 12 tests passed (6 rules, 6 existing content import); exit 0. Auth and Firestore started; CLI confirmed `demo-pnpe`; emulators shut down. Rule fixtures were seeded with security disabled, cleared between tests and after final test, and environment cleaned up. No owner project/configuration/test users were accessed.

Self-review additionally caught rules rejecting an internal newline in a display name, which the existing shared trim validator permits. The new actual emulator regression produced 1 failed / 11 passed; enabling RE2 dot-all on the nonblank-name guard aligns that case without broadening field/timestamp rules. Final emulator rerun after this correction again passed 12/12.

Full unit run: `npm run test:unit` -> 18 suites, 292 tests passed, exit 0. A final additional facade test was then run in the focused suite above (16/16). No Node/mobile implementation changes followed the full unit run; the later rules-only newline correction was verified through the final actual emulator run.

Final `npm run typecheck && npm run lint && npm run format:check`: tools strict and mobile strict TypeScript exited 0; ESLint exited 0; Prettier reported all matched files use code style. `git diff --check` exited 0. No unrelated native builds were run.

## Self-review and concerns

Verified exact official paths against existing importer: `questions/{id}/versions/{version}`, `questionCatalogs/current`, `questionCatalogs/{generation}/shards/{id}`. Parent documents and arbitrary descendants remain denied. Emulator coverage includes guest/signed-in reads and queries, cross-user profile access, arbitrary admin/email fields, type/length bounds, client timestamps, changed createdAt, deletion denial, and unimplemented paths. Existing auth repository tests continue to cover transactional creation/update and domain projection.

No unresolved task blockers. Native factory compiles against the installed SDK; native device acceptance remains Task 9. Installing the required dev dependencies reported 81 existing/transitive audit findings (15 moderate, 66 high); no broad audit fixes or unrelated upgrades performed. Lockfile version differences are Firebase packages needed by the specified 12.19.0 dev SDK. No UI/theme changes, startup question fetches, session engine behavior, production metadata seeding, or excluded features were added.

## Task 8 API / metadata DTO

Public collection: `categories`; document ID must equal `categoryId`.

```ts
{
  categoryId: CategoryId,
  availability: {status:'known',eligibleCount:number,asOf:string} | {status:'unknown'},
  subcategories: readonly {
    subcategoryId: SubcategoryId,
    availability: {status:'known',eligibleCount:number,asOf:string} | {status:'unknown'}
  }[]
}
```

`eligibleCount` is a nonnegative safe integer. Known availability accepts UTC ISO timestamps with seconds and optional three-digit milliseconds; a valid zero stays known. Missing children remain bundled with unknown availability. Cross-category IDs or repeated children invalidate that category's remote metadata. Duplicate category records invalidate that category. Unknown remote category IDs are ignored.

`new FirebaseCategoryRepository(categorySdk, policy?)`; `CategorySdk.listCategories(): Promise<readonly unknown[]>`. `createCategorySdk(modularReadFacade)` performs exactly a categories collection read and rejects document/data ID mismatch. `CategoryMetadataPolicy` accepts `clock?: () => number` (epoch milliseconds), `metadataMaxAgeMs?: number`; default max age centrally exported as `DEFAULT_METADATA_MAX_AGE_MS = 24h`. Future or strictly older timestamps are unknown; exactly max-age remains known. This is display metadata policy, never session eligibility authority.

Mobile: `await createNativeCategoryRepository(nativeServices.firestore, policy?)` from `nativeCategoryFacade.ts`; then `repository.list()`. It consumes the already initialized service. No implicit auth/navigation or official question fetch occurs.
