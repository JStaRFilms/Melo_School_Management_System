# R1 — U1–U6 milestone review findings

Reviewed the U1–U6 working-tree changes since `f6fc7c4817eb287daeebf78a4d143ef1a988844f` against the plans, coverage matrix, implementation reports, product decisions, repository instructions, and Convex guidance. This was non-live: no backend, seed, migration, deployment, provider, credential, production operation, or browser authentication was used.

## Verdict

**NEEDS CHANGES**

> **Storage stabilization update:** Critical 4 is locally contained by server-side fail-closed upload issuance/finalization for assets, logos, student photos, staff/Portal knowledge uploads, and PDF candidates. The generic Convex URL is not treated as provenance or quota evidence. Existing authorized historical reads remain compatibility-only. See `results/S0-storage.md`. Upload functionality remains unavailable/incomplete pending authoritative transport, reservation, and cleanup support; the overall verdict remains unchanged for findings outside this storage-only task.

The local slices contain useful tenant checks, immutable invoice-instruction snapshots, audit redaction, draft revision handling, quota accounting, asset quarantine, and transfer history. All executed checks passed. However, four release-blocking security/data-integrity issues remain, several lifecycle defects are concrete, and substantial packet requirements remain safe repository work rather than external gates.

## Blocking findings

### CRITICAL 1 — Import commit silently binds collisions and bypasses reviewed numbering/audit contracts

**Location:** `packages/convex/functions/academic/migrationMerge.ts:17-24`, `:82-161`, `:258-320`; `packages/convex/functions/academic/migrationAutosave.ts:191-249`

`commitImportWorkspace` is public. In its normal create path, an admission-number collision silently sets `studentId` to the existing student (`migrationMerge.ts:267-276`) even when the reviewer did not choose `merge_existing`, then marks the row committed. The path also auto-creates classes/subjects from text, manufactures non-login `.local` users, and allocates missing numbers from workspace-local sequence state. `bulkResolveAdmissionNumbers` writes up to 1,000 proposals without checking live students/claims or using H4 allocation. No commit audit/reconciliation receipt is emitted.

This violates explicit human duplicate/relationship resolution, deterministic validation, reviewed official-counter changes, and audited/reconcilable batch requirements. A collision can be reported as successful while no student was created, and independently generated numbers can race live enrollment.

**Required fix:** Until complete, make commit unreachable from public clients or hard-fail it. Implement an immutable reviewed plan with per-row create/merge/ignore, class/subject/family decisions, supplied-number preservation, authoritative H4 proposals and expected versions. Commit only that plan; reject rather than infer collisions; use claim/allocation helpers transactionally; emit batch audit/reconciliation receipts and deterministic retry state. Do not create fake auth identities as provisioning.

**Regressions:** unresolved/accidental collisions cannot commit; only explicit same-tenant `merge_existing` can merge; >1,000 rows plus concurrent enrollment cannot duplicate/desynchronize counters; implicit class/subject/family creation is rejected; replay preserves exact outcomes and receipts.

### CRITICAL 2 — Configured RBAC restrictions do not govern the shell or major legacy mutations

**Location:** `packages/shared/src/workspace-route-access.ts:15-33`; `packages/shared/src/workspace-navigation.ts:212-221`; `apps/admin/lib/StaffWorkspace.tsx:20-69`; example backend paths `packages/convex/functions/academic/studentEnrollment.ts:410-448`, `:634-659`, `:982-1020`

The access summary contains `effectiveCapabilities`, but shell admission checks only legacy role/default-school compatibility. Navigation filters three feature flags, not capabilities. Student create/update/archive/delete still use broad `assertAdminForSchool` rather than the applicable capability. A direct restriction can therefore appear in the permission editor while the legacy admin still sees and invokes the restricted operation. The product contract makes backend functions authoritative and subtracts restrictions from effective access.

**Required fix:** Review a route/API capability matrix. Convert each adopted U1–U6 route and all its query/mutation/action/storage endpoints as a vertical slice, then derive navigation and direct-route denial from the same contract. Preserve full access only for explicitly unmigrated compatibility accounts; once managed/restricted, legacy role checks must not override effective restrictions. Enable branch switching only where every caller is explicitly scoped.

**Regressions:** a legacy admin restricted from `enrollment.intakes.manage` is denied in navigation, direct URL, create/update/archive/delete, and upload URL generation while an unrestricted migrated admin retains parity. Repeat for bank, audit export, permissions, destructive assets, and report publication.

### CRITICAL 3 — Platform authentication becomes every tenant capability, including unmasked bank access

**Location:** `packages/convex/functions/academic/rbac.ts:441-469`; exposure `packages/convex/functions/academic/bankAccounts.ts:137-147`; bypass `packages/convex/functions/academic/transfers.ts:22-33`

`getContextCapabilities` returns the whole catalog for every Platform admin. Any such identity can supply a school ID and pass every `requireCapability`, including `finance.bank_details.manage`; `getBankAccount` returns the complete account document and number. Transfers independently admit Platform admins. This exceeds the approved model: Platform performs strongly audited proprietor recovery/authorized support, not standing school ownership or universal operations.

**Required fix:** Remove the all-catalog shortcut. Separate platform governance from tenant operations. Support work must require a purpose-bound, time-limited, school-scoped grant/break-glass intent, minimize returned fields, and audit attempt/success/failure for the proprietor. Ordinary platform access must not expose bank details, child data, drafts, or routine tenant mutations.

**Regressions:** a normal Platform admin is denied bank, enrollment, assets, permissions, transfers, and private drafts. A separately authorized fixture performs only its named operation and leaves proprietor-visible audit; wrong school, expiry, replay, and revocation deny.

### CRITICAL 4 — Upload URLs allow unreserved/unmetered storage before entitlement, size, or quota checks (**locally contained: server-disabled; see `results/S0-storage.md`**)

**Location:** `packages/convex/functions/academic/assets.ts:225-242`, `:249-307`

`createAssetUploadIntent` checks only `assets.upload` and returns a generic storage URL. Plan policy, object size, and quota are checked during finalization, after storage already exists. For abandoned, oversized, invalid-type/marker, wrong-owner, revoked, expired, or insufficient-quota attempts, the storage ID is not durably attached to cleanup state. The blob incurs provider storage without metering or a reachable deletion path. Repeated pending intents bypass the commercial/resource boundary.

**Required fix:** Issue transport only after active plan-owned entitlement and bounded reservation. Cap outstanding intents, enforce maximum size at transport/provider boundary, and obtain trusted ownership/callback evidence so every upload can be deleted if finalization never happens. Settle on success; release/delete on every terminal/expiry/lost-client path. If current storage cannot guarantee this, keep uploads server-disabled.

**Regressions:** abandoned, oversized, bad-type, wrong-owner, insufficient-quota, revoked, and expired uploads delete storage and release reservation; replay/concurrency cannot double-charge; no URL is issued without versioned purchased entitlement.

## Additional required findings

### WARNING 5 — Accepted transfers create a destination identity Portal cannot resolve

**Location:** `packages/convex/functions/academic/transfers.ts:641-681`; `packages/convex/functions/portal.ts:206-226`

Acceptance creates the destination `users` row with a synthetic `authId` and only copies `authTokenIdentifier`/`personId`. Portal queries exclusively `users.by_auth` where `authId === identity.subject`, then chooses the first student row. The user therefore resolves only the source row, now `transferred_out`, and cannot reach the destination enrollment. Copying the old `authId` alone would still leave “first student only” ambiguous.

**Required fix:** Resolve Portal through canonical person/token identity and active branch memberships, with explicit branch selection. Link destination enrollment to that identity rather than inventing a credential. Preserve source history but exclude it from active destination views.

**Regression:** after acceptance, the same login reaches destination Portal data, source history remains scoped, unrelated branches are absent, and retry creates no duplicate identity/enrollment.

### WARNING 6 — Draft retention is not operational

**Location:** `packages/convex/functions/academic/drafts.ts:92-103`

The expiry mutation clears payloads when manually invoked, but its own comment confirms no cron/scheduler invokes it. Tests call it directly, so admissions, family, staff, and planning draft PII can remain indefinitely despite 30/90-day policy.

**Required fix:** Install bounded recurring or per-draft scheduling, continue until `mayHaveMore` is false, and make failure/retry observable and idempotent.

**Regression:** advance fake time without directly invoking cleanup; due payloads clear, newer drafts remain, >100 due rows drain, and audit contains no payload.

### WARNING 7 — A live draft can disappear behind 100 tombstones and be duplicated

**Location:** `packages/convex/functions/academic/drafts.ts:43-53`, `:73-79`; `packages/convex/schema.ts:3278-3298`

Begin and recovery read the newest 100 rows by `(userId, formKey)`, then filter school/status/version/expiry in memory. With 100 newer committed/discarded records, an older active draft is hidden: recovery returns null and begin creates a second active row.

**Required fix:** Index the authoritative school/user/form/status scope and query active state directly. Enforce one active instance with a deterministic scope claim inside the mutation.

**Regression:** with >100 newer tombstones, the active draft remains recoverable; begin returns `RECOVERY_REQUIRED`; concurrent begins leave exactly one active row.

### WARNING 8 — Retention-held assets can starve cleanup behind the first batch

**Location:** `packages/convex/functions/academic/assets.ts:1083-1149`

Cleanup takes the first due rows and skips held rows, but reschedules only when `cleaned > 0`. If the first batch is all held/skipped, every later unheld trash or rollback row is unreachable; later scheduled calls repeat the same prefix. The source comment acknowledges the missing cursor sweep.

**Required fix:** Advance cursor scans over skipped rows (or index due-and-unheld state), and continue based on source exhaustion rather than deletion count. Handle trash, rollback, and candidates independently with provider-failure retry/backoff.

**Regression:** more than `limit` oldest held rows do not prevent later due rows from cleanup; held storage/accounting stays intact; injected deletion failure retries without receipt/accounting drift.

### WARNING 9 — Group audit scans global history and can fail due to unrelated tenant volume

**Location:** `packages/convex/functions/academic/audit.ts:285-331`, `:436-504`; `packages/shared/src/audit-export.ts:45-80`

A group query without branch filter pages global `by_timestamp`, then filters to group school IDs. Export stops after 200 source pages. One old group event behind >20,000 newer unrelated events fails export even if matches are tiny; interactive pages can be repeatedly empty. This does not provide complete proprietor group history and makes cost/latency depend on other tenants.

**Required fix:** Query tenant/group-addressable indexes. Record/backfill `groupId` where historically valid and define a legacy strategy such as merged per-branch cursors, rather than scanning global history. Apply visibility before pagination and preserve identical CSV/PDF scope.

**Regression:** an old group event behind >200 pages of unrelated events remains available/exportable without leaking unrelated rows; explicitly test group relinking/history policy.

### SUGGESTION 10 — Migration tests retain unsupported direct function references

**Location:** `packages/convex/functions/academic/__tests__/migrationLifecycle.test.ts:27-32`, `:508`, `:538`, `:777`, `:924-926`

The test suite casts module-exported Convex function objects to `FunctionReference` with `as unknown`. The runner repeatedly warns that direct Convex-function calls are unsupported. Although all assertions pass, warned invocation paths are weaker evidence of deployed API behavior.

**Suggested fix/check:** Use generated `api`/`internal` references for endpoint integration tests and extract plain helpers for direct unit tests. Rerun the suite with no direct-call warnings.

## Finite safe in-repository remediation scope

These are not satisfied by screenshots, credentials, deployment, or provider approval and remain implementation work:

1. **U1b:** selected-branch activation/persistence/reset and explicit scoped APIs with H6 departure protection; keep switching disabled elsewhere.
2. **U1d/H2:** capability parity across adopted Admin/Teacher routes and backend/storage/export operations, including legacy migration semantics (Critical 2).
3. **U1e:** complete/scalable group audit pagination and intended delegated/group visibility (Warning 9).
4. **U1f:** effective group-default/branch-override resolvers and consumers for grading, admission numbering, report cards, billing defaults, calendars, notifications, and email conventions. Branding alone is partial.
5. **U1g:** authoritative enrollment, attendance, finance, staffing, and academic aggregates with tenant-safe drill-down, replacing metadata/placeholders.
6. **U2c:** named default/branch-level counters, approved group-wide and branch-plus-level scopes, inherited numbering defaults, import integration, and optimistic policy/counter checks.
7. **U3b/U3c:** persistent adapters, timestamped Preview/Resume/Discard, atomic finish-on-domain-submit, and adoption across student, family, staff, fee-plan, academic setup, report-card, import-review, and Teacher planning. Current guard/in-memory slices are partial.
8. **U3a lifecycle:** operational expiry and correct active-instance indexing (Warnings 6–7).
9. **U4b:** finish or disable public import commit; reviewed mappings/confidence/duplicate/relationship decisions, H4 numbering, audit, reconciliation, retry, and privacy-safe outcomes (Critical 1).
10. **U5a/U5b:** versioned plan entitlements/editor; allowance cycle/top-up/exception/grace/group pools; model/task profiles; authoritative heavy-action estimate/confirm/cancel and reserve-dispatch-settle/reconcile. Dashboards and a generic ledger are not a provider gate.
11. **U5c/U5d:** purchased-entitlement upload binding, abandoned/raw temporary-object accounting/cleanup, non-starving retention sweeps, and provider-failure recovery (Critical 4, Warning 8). Private download, AV, and PDF promotion stay hard-disabled pending genuine external approvals.
12. **U6a:** canonical transfer/Portal identity continuity and destination-login regressions (Warning 5). The explicitly excluded future inter-school network and automated staff-transfer policy are not added to this milestone.

## Genuine external/runtime gates after remediation

- Authorized development schema/function rollout and reviewed migration/backfill.
- Synthetic authenticated desktop/320 px, keyboard/focus, Back/reload/sidebar/account/branch, print/grayscale, reconnect/revoke, and error/retry evidence. Reports remain E0; screenshots cannot replace code.
- Legal/privacy/counsel decisions for child data, cross-school processing, naming, retention, notices, and vendor/controller duties.
- Provider-specific DNS/mail authorization and reconciliation; payment merchant/webhook evidence; AV/private transport/residency; AI model/cost/timeout/replay evidence; PDF fidelity approval.
- Production credentials, providers, deployments, migrations, destructive storage operations, and production verification remain unauthorized here.

## Checks actually run

- Tracked diff: **119 files, +7,349/-6,090** versus the base. Many U1–U6 files are untracked, so relevant untracked files/results were also reviewed.
- Convex, Shared, Admin, Teacher, Portal, Platform, and Sites package typechecks: passed.
- Admin focused tests: **13 files / 61 tests passed**.
- Shared focused tests: **9 files / 72 tests passed**.
- Reviewer rerun: `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/migrationLifecycle.test.ts functions/academic/__tests__/drafts.integration.test.ts functions/academic/__tests__/transfers.integration.test.ts functions/academic/__tests__/assetWorkspace.integration.test.ts functions/academic/__tests__/rbacAudit.integration.test.ts` — **5 files / 49 tests passed**.
- `git diff --check`: no whitespace errors; LF/CRLF conversion warnings were emitted.
- Migration tests repeatedly emitted Convex direct-call warnings; see Suggestion 10.
- `node scripts/audit-theme-colors.mjs`: completed as informational; it listed many direct colors that still require tenant/status/grade/product-neutral/print classification, not global replacement.

No full production build, runtime, accessibility geometry, provider, deployment, or production-data claim is inferred from local passes.
