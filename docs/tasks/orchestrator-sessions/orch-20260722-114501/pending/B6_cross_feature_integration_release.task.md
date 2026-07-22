# B6 — Cross-feature integration, security, E2E, and release handoff

**Stage:** Build | **Role:** Reviewer | **Depends on:** B2, B3, B5 | **Worktree:** integration owner branch

## Objective
Integrate the admissions and sites worktrees, resolve only real shared conflicts, and prove a secure end-to-end release candidate.

## Scope
- Rebase/merge in prescribed order; reconcile generated Convex API/types and shared manifests/schema only as needed.
- Verify managed-site and external-site application entry points; canonical redirects; payment webhook replay; guardian slot lifecycle; draft/submit; private documents; staff review; accepted conversion; photo fallback/preferred-photo behavior; and portal onboarding.
- Run tenant-isolation, authorization, a11y, SEO, responsive, and regression suites. Record deployment/configuration prerequisites, secrets/webhook setup, DNS verification, monitoring, retention operations, rollback, and support runbook.
- Review all OBHIS factual/asset approvals before public production enablement.

## Must not do
Do not waive a security/privacy failure, silently change conversion records to resolve a test issue, or deploy unverified school facts/assets.

## Deliverables
- `docs/features/OBHISAdmissionsIntegrationReleaseChecklist.md`
- E2E test additions/results and a merge/release report containing conflicts, migrations, known limitations, rollback procedure, and production approvals required.

## Done when
The full critical path passes from two website contexts, no cross-tenant/private-document breach is reproducible, conversion is replay-safe, and remaining launch blockers are explicitly signed off or release-blocking.
