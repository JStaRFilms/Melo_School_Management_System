# U1e — Audit explorer, alerts and safe exports

**Execution:** safe local routes/export/alert slice implemented and verified after U1d; P/G, E0 for schema rollout, browser and producer coverage. See [results/U1e.md](../results/U1e.md). No deployment, retention cleanup or provider delivery performed.

## Objective / scope
Build scoped Admin and Platform audit experiences with truthful filters, redacted details, leadership alerts and equivalent CSV/printable-PDF exports.

## Context / dependencies
U1a/U1b/U1d. Read F1/H2, audit.ts and RBAC tests (actual `rbacAudit.integration.test.ts`). Existing listAuditEvents reads recent bounded window then filters; not complete pagination. listAuditAlerts/dismissAuditAlert use branch audit capability. recordAuditEventHelper inserts immutable events and tier1 alerts; exports/group scopes/complete producer retention are missing.

## Ownership
`academic/audit.ts`, proposed Admin `/admin/audit`, Platform `/audit`; navbar alerts via U1b seam; focused audit tests. Producer domain fixes belong to respective owners, using the contract established here.

## Instructions
1. Add bounded paginated branch/group/platform-authorized queries with search, date, module/action, actor, target and branch filters. Department scope must constrain backend results, not merely UI filter options. Do not silently truncate a search to recent rows.
2. Render safe before/after detail, context, timestamps, empty/filtered/denied/error states. No edit/delete of audit events; corrections append.
3. Export authorized CSV and printable PDF from the same scoped/redacted query contract; prevent CSV formula injection. Record export attempts/outcomes safely; no raw sensitive payload or prompt/document content.
4. Scope alert recipients/dismissal; integrate in-app leadership alerts without claiming provider email/SMS delivery. Establish producer contract for permanent finance/security/permission/ownership/certified history retention and seven-year ordinary events. Domain owners must verify producers; no retention cleanup execution.

## Definition of done / verification
Tests cover cross-branch and module-scope denial, filtered pagination beyond initial window, redaction/export parity, alert visibility/dismissal and append-only API surface. Browser-ready accessible filter/detail/export UI; no false 404. Record local tests/typecheck/lint, then request U7 desktop/mobile/denied/print evidence.

## Artifacts
`results/U1e.md` with API/producer checklist, export mechanism, exact test results/self-review and residual gates. Update matrix. No credential reads, provider sends, production, migrations, deployments or unapproved Convex commands; parent owns PR/review.
