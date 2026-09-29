# PR #88 and master merge reconciliation

Merge remains in progress. The only reconciliation edit before this pass was the `portal.ts` import conflict. This pass classified the four result publication tables missing from `schemaCoverageRegistry.json`; it did not run a reset, seed, deploy, or Git merge operation.

The registry now records each table's exported validator fingerprint, typed references, `by_school` index and direct-school ownership. `classResultPublicationStudents` is a child of `classResultPublications` and links to `issuedReportCards`. The existing legacy demo ordering removes those children before publications and issued cards; the reviewed reset instead inventories the indexed school rows and checks the recorded snapshot before deletion. Actor users, persons and memberships are references, not independent deletion authority. None of the four tables has a `_storage` path, so the tenant storage inventory remains unchanged. The temporary Vitest fingerprint inspection test was removed after copying its output. No registry regeneration or purge/seed behavior change was needed.

`portal.ts` still imports `resolvePortalStudentContext` for shell selection and keeps `resolvePortalMemberships` for the workspace and billing queries. Its released-results helper still requires one frozen publication inclusion and the matching issued report card before returning a graded report. Billing still calls `isOnlineCheckoutOffered` and uses `invoicePaymentInstructions`. The portal selection, result gate, and billing gate tests pass in the full suite.

Verification completed:

- Focused `schemaCoverage.test.ts`, `demoPreflight.test.ts`, `demoReset.test.ts`, `demoResetSeed.test.ts`, `demoSeed.integration.test.ts`: 49 passed.
- Full `pnpm --filter @school/convex test`: 85 files, 650 tests passed, including portal selection and release gate, billing gate, reset action/deletion/auth/storage, and seed tests.
- `pnpm --filter @school/convex typecheck`, `pnpm --filter @school/convex lint`, `git diff --check`: passed.

No remaining Convex test failures. Existing Convex best-practice warnings about direct function calls appeared during the full suite; they did not fail it. Classification does not authorize any populated-school reset. The four tables have no file paths, but the existing storage and shared-identity blockers described in the schema coverage guide still apply. No commit, push, deployment, or destructive operation was performed.
