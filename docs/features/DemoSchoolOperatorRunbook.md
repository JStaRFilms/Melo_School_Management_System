# Demo-school operator runbook

This guide describes E2E first-run seeding and the separate reviewed reset workflow. It does not authorize a reset without an exact prepared operation and its confirmation phrase. Read the [schema coverage guide](DemoSchoolSchemaCoverage.md) before changing seed or purge behavior.

## Deployment and target proof

`e2e/global-setup.js` requires an explicit `CONVEX_DEPLOYMENT=dev:<deployment-name>` selector. It refuses production and preview selectors. Set `DEMO_SEED_DEPLOYMENT_ENV=development`, `DEMO_SEED_OPERATOR_TOKEN`, `DEMO_SEED_DEPLOYMENT_IDENTITY`, and an HTTPS `DEMO_SEED_EXPECTED_CLOUD_URL` ending in `.convex.cloud`.

The expected cloud URL must agree with the server's `CONVEX_CLOUD_URL`. Root environment files, shell `CONVEX_URL` and `NEXT_PUBLIC_CONVEX_URL`, and each Admin, Teacher, and Portal `NEXT_PUBLIC_CONVEX_URL` must agree too. A missing app cloud URL fails the check. The matching site URL uses the same deployment name and ends in `.convex.site`. Set each app's `NEXT_PUBLIC_CONVEX_SITE_URL` to that sibling. E2E derives it from the attested cloud URL when absent. Explicit root, shell, or app `CONVEX_SITE_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` values must match. A valid URL for another deployment fails before inspection. The operator token and deployment identity must match the server environment; diagnostics do not print their values.

Set the Convex server's `TRUSTED_ORIGINS` to include `http://localhost:3101,http://localhost:3102,http://localhost:3103` for Teacher, Admin, and Portal sign-in. Other origins can remain. The operator-gated read-only preflight reports whether the effective server origins include all three. E2E refuses to seed if any is missing. App-side or shell settings cannot replace the server setting, and preflight does not change it.

E2E calls `functions/academic/demoPreflightAction:inspectDemoSchool` over private HTTPS using `ConvexHttpClient.action`, the attested expected cloud URL, and the operator identity. It verifies the returned server cloud URL. The deployment selector is a local gate; server cloud URL and deployment identity checks provide the server-side target proof.

## Empty first run

An empty first run requires preflight to return a null school, `ready: true`, no blockers, and no table rows. The inspector checks one row per table across all 180 reviewed application tables, including indirect and shared/global tables. It reports nonempty table names, not row contents. It also rejects orphaned demo Better Auth credentials. Registry drift or inspection failure blocks the check.

The seed action repeats the full table check before Better Auth access, so a row added after inspection blocks seeding. Only then does E2E call `functions/academic/seedRunner:seedDemoSchool`, passing the inspected null school ID and exact `demo-school` slug. The server checks again before changing auth credentials or sessions. Success creates canonical demo users, their school memberships, and demo data. The destructive Playwright config refuses to reuse Admin, Teacher, or Portal servers already listening on its ports. Stop those servers before running it. The admissions-smoke config keeps its separate server policy.

A failed first run can leave Better Auth writes, storage cleanup claims, or school data because those writes and Convex seed mutations do not share a transaction. Treat the deployment as contaminated even if a later inspection appears empty. Stop E2E, abandon that disposable dev deployment, and provision a fresh empty development deployment. Reconfigure the CLI selector, server operator gate and expected cloud URL, and all three app URLs before starting another first run. Never reset a shared development deployment or retry blindly on the failed target. This is not an in-place reseed path.

## Populated prepare and typed TTY confirmation

A known populated demo cohort can use the separate reviewed reset only when preflight returns `ready: true`, no blockers, and a complete inventory. E2E requires stdin and stdout TTYs and refuses CI before preparation. An unknown cohort, blocker, missing TTY, or CI never starts preparation.

E2E calls `functions/academic/demoResetAction:prepareDemoReset`. Preparation reserves an exact inventory without deleting rows. E2E prints the original school ID, deployment URL, nonzero per-table counts, operation hash, operation ID, and required full phrase. The operator must type that exact phrase. A cancelled or incorrect answer invokes `cancelDemoReset` and stops without deleting rows.

Preflight and the atomic reservation block every active operation state: `prepared`, `deleting`, `storage_pending`, `auth_pending`, `ready_to_seed`, and `seeding`. This includes the gap between authorization and the first deletion batch. Completed and cancelled history does not block a new reservation.

## Storage retained and deleted

Preparation seals the original succeeded run's ordered logo and 36 portrait IDs against school and student references, reviewed candidates, and the inventory hash. Reservation rechecks the run, references, blob existence, and foreign claims. Preflight, preparation, reservation, execution, and storage ACK refuse more than 50 distinct reviewed storage candidates.

The 37 original files remain retained. Row deletion keeps the operation record. Storage ACK requires retained blobs to exist without a new claim and keeps them intact. Other reviewed candidates use delete followed by missing-file ACK. The final storage transition rechecks all retained and deleted files before the auth phase. The action does not store replacement blobs. Ledger `storageCandidateIds[]` and `storageAcknowledgedIds[]` track inventory and progress only; they are not ownership claims or permission to delete files.

Storage inventory uses separate bounded transactions, so another writer could change ownership after inspection. The reset checks reviewed claims but cannot establish ownership outside those reviewed tables or Better Auth components. A failed or overflowing inventory blocks the operation.

## Execute and finish

After exact typed confirmation, E2E calls `executeDemoReset` with the prepared seal. It requires the operator token, development environment, exact target identity, school ID and slug, operation ID, full inventory hash, and fresh confirmation phrase from preparation. It checks the server cloud URL before mutation and resumes deletion from the recorded cursor. Row and storage cleanup preserve the recorded operation and acknowledge progress.

The auth phase verifies each Better Auth ID by email and reconciles its account. Immediately before any reviewed password or session write, execution and reconciliation require exactly one credential provider link whose account ID and user ID match the recorded ID. A failure leaves the operation at its last acknowledged step.

Execution stops at `ready_to_seed` and returns the operation ID. It does not seed and does not claim reseeding is complete. The separate `functions/academic/demoResetSeedAction:finishDemoReset` Node action accepts the same operator token, exact development target and cloud URL, operation ID, original school ID and slug, inventory hash, and full stored confirmation phrase. Call it only after execution reaches `ready_to_seed`.

An internal START mutation binds the exact `ready_to_seed` operation to one new school and run using its original 37 retained IDs. It requires the server's normalized `CONVEX_SITE_URL`, recorded auth IDs and ordered files, matching development cloud and identity, all retained blobs without claims, an absent old school, and no other school or active reset. START inserts the school and run and records `seeding`, `newSchoolId`, and `newRunId` in one transaction. Matching `seeding` or `complete` calls return the recorded run ID without inserting again.

FINISH checks all three Better Auth IDs by email without changing accounts or sessions, then starts or reuses the operation's new school and run with the ordered retained blobs. It resumes foundation, student, assessment, billing, and knowledge phases from the committed phase and cursors. A thrown population mutation leaves the run `running`; after addressing the error, retry FINISH with the same arguments. It never stores replacement blobs. FINISH marks the operation `complete` only after the bound run succeeds with 36 students, three classes, 36 invoices, and 756 assessment records. Repeating it checks the binding and counts and returns the same IDs and result. A failed run, missing asset, changed credential ID, or changed target is not repaired automatically. Do not call first-run seed as a workaround.

Each indexed table is bounded at 1000 rows. The two unindexed school tables use global 1001-row windows and refuse overflow. The legacy `DEMO_SCHOOL_TABLES` list has 85 entries and is not a complete deletion list. The reviewed reset accounts for the wider registry and bounded special paths. See the [schema coverage guide](DemoSchoolSchemaCoverage.md) for table ownership and known blockers.

## Interruption and resume

If execution or FINISH fails, keep the original operation ID, original school ID, hash, and full phrase. In a TTY, run `node e2e/global-setup.js resume`, enter those four values at its prompts, then type the full phrase again. Resume checks the bound operation status read-only before choosing execution for `prepared` or cleanup phases, or FINISH for `ready_to_seed`, `seeding`, or `complete`. It does not prepare a replacement operation, use preflight to bypass the reservation, or accept an environment variable for automatic confirmation.

Store the phrase privately. Do not put it on a shell command line or share it in logs. If the phrase is lost or the operation is cancelled, stop and review manually rather than starting another reset. Do not use the judge profile or tenant purge to bypass this workflow.

## Verify-only browser mode

After an initial seed, set `E2E_DEMO_VERIFY_SCHOOL=demo-school`. Setup then checks the existing school, app targets, trusted origins, and seeded student, class, invoice, and assessment counts without another reset. Keep it set while Playwright runs. Do not combine it with `E2E_DEMO_VERIFY_OPERATION_ID`.

After a completed reset, set `E2E_DEMO_VERIFY_OPERATION_ID` to the completed operation ID and run `node e2e/global-setup.js`. With this variable set, setup calls only the operator-gated read-only `verifyCompletedDemoReset` action. It rejects any other status, cloud URL, school/run binding, or seeded counts. Keep the same development selector, expected URL, operator token, identity, and matching app URLs. Then run browser checks with the variable still set. Unset it only when deliberately starting a separate first-run or reviewed-reset workflow. Verify-only mode does not reset or seed.

The setup sends the token and confirmation phrase in HTTPS action bodies, never as CLI positional arguments. Do not put either on the shell command line.

## Limits and additional development deployments

No production or shared-development fallback is provided. Use only the explicitly selected disposable development deployment and matching URLs. The setup itself does not authorize deployment creation or selection. To inspect options before any separately authorized deployment work, use installed Convex CLI help, such as `pnpm exec convex --help` followed by the relevant subcommand's `--help`. Do not assume quota or another deployment is available.

Task03c's earlier new-blob ownership gap is avoided only for this exact retained-file path, not for new files: `ActionCtx.storage.store()` returns a new blob ID only after storing it, while `MutationCtx.storage` has no `store()` method. A reviewed candidate ledger is not ownership proof. Preflight reports rows and ownership blockers. The seed action refuses before changing credentials or sessions.

## Maintenance for new tables

For every new table or changed field:

1. Run `pnpm --filter @school/convex exec vitest run schemaCoverage.test.ts`. Review each reported path against exported schema validators. Update `schemaCoverageRegistry.json` deliberately, including ownership, reason, complete typed ID and opaque references, `bySchool`, shape fingerprint, optionality, and every storage disposition. Do not regenerate the registry wholesale.
2. Identify whether a row is school-owned, indirectly owned, shared/global, or a cross-school reference. Review inbound and outbound links. A `schoolId` reference alone does not establish ownership. Keep cleanup blocked for rows in `admissionNumberClaims` and `usageBranchPoolAllocations` until each has a reviewed indexed cleanup path. Their read-only 1001-row global scans are for this disposable single-school preflight only.
3. For direct school-owned rows, add a valid `by_school` index and `TENANT_SCHOOL_TABLES` manifest handling, or implement and review a bounded special path. Review `DEMO_SCHOOL_TABLES` separately. Add child-before-parent cleanup and residual checks for indirect rows. Never delete shared persons, memberships, transfers, shares, or identities solely because they reference this school.
4. For each `_storage` reference, reconcile the schema path with `TENANT_STORAGE_TABLES`, `storageIdsOnRow`, the storage ledger, retained-owner checks, and school-logo handling. Mark unsupported extraction or uncertain ownership as a reset blocker. Add tests for shared claims, missing files, interrupted retries, and the new path.
5. Add E2E coverage for changed behavior: successful empty-school first run and relevant target mismatch, operator-gate, existing-school, or blocker failure paths. E2E must verify blocked paths do not invoke seeding or mutate authentication. Keep app, CLI, and server target agreement checks in setup.
6. Run `pnpm --filter @school/convex test`, `pnpm --filter @school/convex typecheck`, and lint. Review schema, registry, purge, storage, seed, and E2E diffs together. Update the [schema coverage guide](DemoSchoolSchemaCoverage.md) if ownership or reset behavior changes.

## Verified isolated-development run, 2026-09-23

On the separate `content-poodle-172` development deployment, the first seed created Demo Academy and the Admin, Teacher, and Portal Playwright cases passed 3/3. A later operator-confirmed reset replaced that same synthetic school through the reviewed operation. Read-only verification returned `complete`, a new school and run ID, 36 students, three classes, 36 invoices, and 756 assessment records. Running Playwright with `E2E_DEMO_VERIFY_OPERATION_ID` passed all three cases again without another reset. The original shared development deployment and production were not reset or deployed. Injected failure and cross-school isolation cases remain test simulations; this live run was the normal successful path.
