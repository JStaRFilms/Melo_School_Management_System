# U1e — Audit explorer, leadership alerts and safe exports

**Status: safe local vertical slice implemented; P/G, E0.** Executed after U1c and U1d focused verification/self-review. No server/browser authentication, provider delivery, production, live Convex CLI, codegen, deployment, migrations, cleanup job, credential reads or commits. The additive schema/index is authored only and must be rolled out under separately verified development authorization before runtime acceptance.

## Real routes and workflows
- Admin `/admin/audit`: current-branch audit context, recorded-owned-group selection, group branch filter, search/date/module/action/actor-ID/affected-record filters, true cursor continuation including empty matching pages, safe context/before-after inspection, separate CSV/printable-PDF controls, recent addressed leadership alerts and proprietor-only delegated module-scope editor with reason/confirmation/conflict handling.
- Platform `/audit`: all-school or selected-school **Platform-authored actions only**. No blanket tenant operational/support history is exposed merely because the user is a Platform admin. `/schools` and `/groups` discover it.
- Shared `AuditExplorerView` uses labelled native controls, wrapping layouts and details disclosure. Both apps call generated typed API references; no mock data or backend-only route placeholder.
- Admin shell mounts a compact addressed-alert link through U1b navbar's additive `leadershipAlerts` slot only after default-school admission and audit capability. Recent count is explicitly not a complete unread total. Acknowledgement on the audit page is shared leadership status, not per-recipient inbox state and not deletion of the event.
- Query failures have a retry/access-unavailable route boundary rather than a false 404. Unknown legacy actor identity is labelled by recorded actor kind, not inferred from private email. New Platform events carry a server-derived platformAdmin ID.

## Authority / API manifest
All APIs below are `api.functions.academic.audit`; internal writer remains internal.

`scope` is a discriminated union:
- `{kind:'branch',schoolId}`: active U1a branch authority + `audit.branch.view`. Nonowners additionally need explicit `branchMemberships.auditModules`; **undefined/empty grants no module visibility**. No module entitlement is inferred from another operational capability.
- `{kind:'group',groupId}`: active recorded canonical group proprietor via U1c metadata contract, or Platform operator subject to Platform-only restriction. Ordinary group-branch membership or delegated `audit.group.view` alone does not unlock the full group. This conservative owner-only group rollout is explicit; broader delegated group scopes are not implemented.
- `{kind:'platform'}`: one active token-linked Platform operator; only `actorKind=platform_admin` events. Wider verified support access is gated, not manufactured.

| Endpoint | Authority and contract |
|---|---|
| `getAuditAccess({scope})` query | Same authority; returns configured module vocabulary, scope-configured flag, separate CSV/PDF flags, proprietor scope-editor flag and Platform-only indicator. No raw event/identity payload. |
| `queryAuditPage({scope,paginationOpts,search?,module?,action?,actor?,target?,startDate?,endDate?,branchId?,exportFormat?})` query | Same authority on **every page**, explicit denial for foreign module/branch filter; optional export format additionally requires that export capability. <=100 source rows/page. Date bounds use indexes; secondary filtering follows source pagination and preserves continuation even when page is empty. No recent-window search truncation. Safe DTO only. |
| `listAuditEvents({schoolId,module?,action?,startDate?,endDate?,limit?})` legacy query | Now applies same module/branch/Platform visibility and read-time sanitization. Still explicitly a <=100-row recent compatibility read, **not** the complete explorer API. Sensitive raw email/IP fields are no longer returned. Safe `_id`, safeSummary and before/after summary compatibility fields retained; new explorer does not call it. |
| `listAuditAlerts({schoolId,isDismissed?,limit?})` query | Same branch/module/event visibility **and** addressed recipient check; untargeted critical alerts are owner-only, not all audit readers. Platform sees only visible Platform events. <=50 source rows; default recent 20, explicit UI disclosure. |
| `dismissAuditAlert({schoolId,alertDocId})` mutation | Rechecks recipient and event/branch scope, idempotent acknowledgement, appends permanent `leadership_alert_acknowledged`; modifies only alert acknowledgement metadata. |
| `recordAuditExport({scope,format,stage,correlationId,rowCount?,journalSchoolId?})` mutation | Stages `attempt`, `client_prepared`, `client_failed`; rechecks scope/export capability. An authenticated visible-scope reader lacking export capability gets a recorded denied attempt and `permitted:false`. Row count bounded <=5000, correlation ID validated. Records only safe format/stage/scope/count, never filters/search text, row payloads or document content. Platform-wide exports require an explicit journal school context selected in UI or represented in loaded authorized results because existing journal schema requires schoolId; never silently selects an unrelated school. Client outcome is labelled client-reported, not proof of download/PDF save. |
| `getAuditScopeConfiguration({schoolId})` query | Active branch proprietor only; <=100 safe canonical member names/IDs/current explicit module scopes/revisions; overflow gated. |
| `setAuditModuleScope({schoolId,targetMembershipId,modules,expectedRevision,reason})` mutation | Proprietor only; active same-school target, protects self/ownership/Platform identity, validates known modules and 8–240 char reason, optimistic conflict. Changes module visibility only, **not** audit-view capability, title, roles or identity. Appends permanent tier1 RBAC event. |
| `recordAuditEventInternal(...)` internal mutation / `recordAuditEventHelper` helper | Existing append-only producer entry preserved. Adds read/write sanitization improvements, server-derived optional Platform actor ID, explicit permanent-class floor for known security/finance/ownership modules/actions and in-app tier2 notices as well as tier1 alerts. No event update/delete API added. |

Group source pages use the timestamp index plus school-link allowlist, not only stored groupId. This deliberately includes old producer rows lacking a group snapshot without relabelling them. Original `groupId` remains null/“Not recorded” in details. Large group/platform searches may scan many nonmatching source pages; limits are explicit and never presented as complete results prematurely.

## Same-scope export mechanism
`shared/audit-export.ts` consumes `queryAuditPage` repeatedly with the **applied filters**, frozen upper timestamp and export format. Each fetch authorizes independently. No file/print body is populated until the matching stream is complete. Maximum 5,000 matching events and 200 source pages; exceeding either fails with a narrow-filters message, not partial output. Export authority is checked again immediately before preparation.

CSV always quotes fields, doubles quotes and prefixes leading formula/control/whitespace + `= + - @` with apostrophe. UTF-8 file is created locally and the object URL revoked. Printable PDF opens a same-origin blank window, fills **textContent** (never untrusted HTML), renders the same columns as CSV, and offers a real browser **Print / Save as PDF** button. This is browser print-to-PDF, **not server PDF generation or proof that a PDF was saved**. Popup failure closes the window and reports retry guidance. A failed follow-up journal write after revocation cannot be guaranteed; original export failure remains visible.

Both formats include identical event/time/branch/group-snapshot/actor/module/action/target/outcome/safe-summary/before/after/correlation/retention columns. Private email snapshots, IP hashes, prompts and documents are excluded. Read-time re-sanitization covers older persisted summaries. Regex sanitation is defense-in-depth, not permission to send raw sensitive content into a producer.

## Producer and retention contract / checklist
- All domain producers must pass schoolId, optional truthful group snapshot, authenticated actor IDs/kind, module/action, target metadata, outcome and **allowlisted safe summaries**. Do not serialize request bodies, documents, prompts, student health/safeguarding notes, passwords, credential fields or full bank numbers. Corrections append a new linked event.
- Known finance/billing, commercial, RBAC, groups, asset-security and auth modules, plus recognized password/security/permission/ownership/certified/final-publication actions receive `permanent_statutory` even if a producer requests ordinary retention. Other events default to `operational_7yr`; an explicit permanent request is preserved.
- `operational_7yr` means retain at least seven years; permanent history must not be purged absent reviewed legal policy. **No retention cleanup/scheduler was added or executed**, and a class flag is not proof of all downstream producer coverage.
- Tier1 critical and tier2 warning produce only in-app addressed leadership alerts; export attempts produce one tier2 notice, preparation/failure stages do not multiply notifications. No email/SMS/provider dispatch exists.

| Producer / follow-on owner | Local contract status / remaining review |
|---|---|
| U1c groups | Create/link are permanent tier1, target group/branch/owner IDs recorded; no operational rekeying. New Platform actor ID derived in writer. |
| U1d RBAC | Configuration changes include safe before/after assignments/overrides; template creation, role assignment, direct override and ceiling expose safe changes. Permanent tier1; identity/title not authority. |
| Bank/finance/billing — U2d | Known helper events get permanent floor; domain owner must verify all actual legacy billing/bank producers, masking and alert coverage. No finance domain adapter changed here. |
| Certified history — U2a/U2b | Explicit permanent flag/recognized final-publication action supported; actual result/report producers need owner verification. |
| Commercial — U5a | Helper recognizes commercial permanent history; no commercial provider/contract workflow enabled here. |
| Assets/security — U5c/U5d | Private metadata-only contract; asset_security permanent floor. Domain owner must classify sensitive downloads/purge/retention holds and verify all paths. |
| Enrollment/import/email/transfers — U2c/U4/U6 | Preserve safe IDs and explicit class/tier; no raw imported/document/mail content. Actual application-wide production coverage remains unverified. |

## Schema and serialized seams
Additive only in `schema.ts`: optional `branchMemberships.auditModules`, optional `auditEvents.actorPlatformAdminId`, `auditEvents.by_timestamp` index. No migration/backfill or generated file hand-authoring. New functions are in an already-generated API module and type inference passes locally. Shared index exports only the pure view/export utility; **no Convex dependency was added to Shared**. Navbar slot and Admin default-shell hookup are narrow U1b integration changes, not branch-switch activation.

## Verification and ordinary errors
Final combined local commands, executed (no live backend):
- Convex `vitest run ...groups.integration.test.ts ...rbacAudit.integration.test.ts ...auditExplorer.integration.test.ts ...workspaceAccess.integration.test.ts`: **4 files / 24 PASS**.
- Convex `vitest run foundationContracts.test.ts ...auth.test.ts ...identityResolver.integration.test.ts ...identityTenancy.integration.test.ts`: **4 files / 37 PASS** after fixing the discovered U1c compatibility issue below.
- Admin `vitest run __tests__/group-governance.test.tsx __tests__/permission-editor.test.tsx __tests__/audit-explorer.test.tsx __tests__/workspace-shell.test.tsx`: **4 files / 14 PASS**.
- Shared navigation/route-access suites: **2 files / 9 PASS**.
- Convex, Admin, Platform, Shared, Teacher and Portal `typecheck`: **all six PASS**.
- Explicit changed-file eslint over U1c/U1d/U1e backend/new UI/tests/shared/navbar/StaffWorkspace: **PASS**. Admin landing's earlier two pre-existing unused-import warnings remain; no new lint error. `git diff --check`: PASS (existing Windows CRLF notices only).

New audit tests cover >150 recent nonmatches with preserved cursor, cross-branch and module denial, group proprietor/ordinary-member separation, CSV-query projection equality and redaction, Platform action restriction, recipient/dismissal denial, export grant revocation, explicit scope changes/conflict, quoted secret/multiword/sensitive-summary redaction. DOM/export tests cover filtered-page-vs-empty truth, labels/focus/filter apply, safe detail text, export error, CSV formula prevention and printable text/column parity. Browser layout and real downloads are not proved by jsdom.

Ordinary errors resolved: cursor-loop test inference required an explicit FunctionReturnType annotation; broader identity-tenancy regression expected discovery to return [] for an unrelated/untrusted legacy issuer. U1c discovery now maps **only that specific resolver denial** to no candidates, preserving the valid compatibility test; canonical/duplicate/mismatched-identity denials remain terminal, and no fallback grants access. Original test expectation was not weakened. Existing Vite CJS and identityResolver direct-registered-function test warnings remain nonfatal. Temporary edit scripts/files were removed by exact path.

## Self-review / independent PR boundary
Reviewed full changed module/route paths, source scope before filtering, same redacted DTO for screen/export, recipient checks at both read/acknowledge, schema-only deployment gate, Platform actor derivation, legacy endpoint narrowing, group history without groupId, formula injection, text-only printable rendering and accurate client-reported export outcome. Removed the initial arbitrary-school export journal fallback and unused filter field; no raw export payload journaled. Added safe before/after data at U1d producers as a serialized follow-through rather than claiming an empty detail panel is complete.

U1e files: `academic/audit.ts`, `academic/__tests__/auditExplorer.integration.test.ts`, small U1e fixture changes in `rbacAudit.integration.test.ts`, schema additions; Admin `app/admin/audit/{page,error,LeadershipAlerts,AuditScopeEditor}.tsx`; Platform `app/audit/{page,error}.tsx`; Shared `audit-export.ts`, `components/AuditExplorerView.tsx`, three exports, navbar alert slot; Admin `lib/StaffWorkspace.tsx` slot hookup and `__tests__/audit-explorer.test.tsx`; result/matrix. U1d safe producer before/after additions remain in rbac.ts; U1c final compatibility fix remains in groups.ts. Domain PR manifests in each result identify those ownership seams. No U1f/U1g or U2+ implementation.

## Genuine gates / U7 requests
- Authorized schema/function rollout and synthetic accounts are unverified; no live endpoint existence claim. No browser/screenshots captured (**E0**).
- Capture Admin branch/group/module-denied/missing-scope/filter-empty/older-page/detail/alert-acknowledgement/export-error, Platform restricted-school history, desktop and **320px**, keyboard disclosure/filter use, and printable grayscale/page breaks. Verify popup-block/retry, real CSV opening, complete filtered export and PDF Save as PDF with synthetic/redacted data.
- Platform operational support/recovery needs verified support evidence; ordinary delegated group audit is not implemented. Active owned-group metadata path only; archived-group audit requires separately reviewed historical-access policy.
- App shells remain U1b default-compatible; no switched branch/capability-only shell or full legacy parity claim. U3a dirty-form guard not installed for the scope editor.
- Producer-by-producer statutory retention/alert classification remains each domain owner's work; no claim of application-wide producer completeness, provider notification delivery, immutable database enforcement against privileged internal code, or executed retention cleanup.
