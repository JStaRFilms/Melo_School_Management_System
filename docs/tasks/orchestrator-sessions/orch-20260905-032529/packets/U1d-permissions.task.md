# U1d — Permissions and ownership management

**Execution:** safe local editor/backend slice implemented and verified after U1c; P/G, E0 for browser, legacy parity and recovery evidence. See [results/U1d.md](../results/U1d.md). No role migration or ownership recovery performed.

## Objective / scope
Expose composable templates, independent titles, grants/restrictions and management ceilings through a real categorized permission editor. Preserve ownership and legacy access safety.

## Context / dependencies
U1a/U1b/U1c. Read H2/F1 and D02 plus RBAC code (actual file `packages/convex/functions/academic/rbac.ts`). Existing functions: previewEffectiveCapabilities, assignRoleToMembership, grantDirectCapability, restrictDirectCapability, setDelegationCeiling; factory definitions/catalog and aliases are in this module. Read evaluator and mutations completely before edits: available APIs do not prove a complete candidate preview/removal/template CRUD UI contract.

## Ownership
RBAC management sections after U1a finishes; proposed Admin `/admin/permissions`, `/admin` entry, adminLeadership title/ownership seam only if needed; RBAC tests. Catalog/schema/export changes serialized.

## Instructions
1. Add bounded authorized membership/template lookup; display seven approved templates, combinations and independent title. Use actual capability vocabulary, not the stale D02 count. Candidate preview must run identical evaluator logic without writes.
2. Provide reversible assignment/grant/restriction removal, template configuration and effective-access summary; do not infer role from title. Guard all relevant query/mutation/action endpoints, not just buttons.
3. Enforce anti-self-edit, proprietor/platform/superior protection, explicit delegation ceiling and possession-not-delegation. Only proprietor controls permission-manager authority by default. Confirm reason/target before sensitive saves; append masked audit and leadership alerts.
4. Keep Platform proprietor recovery a separately authorized/audited UI flow with explicit intended canonical owner and support evidence; if evidence unavailable show gated state. Never seed roles or run recovery/migration to make a demo pass.

## Definition of done / verification
Extend `rbacAudit.integration.test.ts` for preview parity, unions/restrictions, removal, ceiling/self/superior denial and ownership. Test editor loading/empty/conflict/denied, keyboard checklist and 320px controls. Local typecheck/lint and focused tests recorded; no lockout or broad privilege fallback.

## Artifacts
`results/U1d.md` includes exact catalog/endpoint capability manifest, authority decisions, tests/self-review and U7 cases. Update matrix. No provider, deployment, migration, production, credential or PR operations by this owner unless separately delegated by parent.
