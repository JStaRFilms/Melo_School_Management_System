# U1a — Authoritative workspace access contract

## Objective / scope
Establish safe selected-branch and effective-access contracts before UI integration; preserve legacy default-branch callers. No identity migration, automatic role assignment, deployment or credential repair.

## Context / read first
Read implementation-plan.md, matrix F2/H2 rows, parent decisions H2/F2, D02 and generated Convex guidelines. Real seams: `functions/auth:getViewerContext`; `academic/auth.getActiveMembership`, `resolveActiveMembership`, `getAuthenticatedSchoolMembership`; `rbac.requireCapability/evaluateEffectiveCapabilities/hasViewerCapability`. Admin and Teacher AuthProvider currently project one role/school from default viewer; legacy helpers use one user school. Capability fallback to principal baseline is not full-admin parity proof.

## Ownership / dependencies
G0 prerequisite. Own exact U1a files in plan, relevant identity/auth/RBAC tests; schema/export changes serialized. Do not concurrently alter U1d management sections. Publish contract before U1b or domain owners modify callers.

## Instructions
1. Define typed active-school context with requested school treated as untrusted. Resolve authenticated canonical identity server-side, explicit membership, active school and teacher assignments; retain exact trusted legacy compatibility without email/title inference.
2. Expose a single viewer access summary suitable for nav and route gates (branch, membership, display title, effective capabilities, compatibility state). Add bounded scoped lists only as needed; do not make one capability query per menu item.
3. Enumerate touched public queries/mutations/actions/storage/export endpoints and whether they accept target school, infer from owned record, or retain legacy default. Do not claim branch switching for unsupported callers. Preserve backward-compatible no-argument default reads while adding explicit scoped invocation.
4. Test revoked/suspended/ambiguous identity, forged school ID, teacher assignment and legacy admin parity. Missing reviewed mappings must produce a reconciliation gate, not fabricated membership. Do not globally retire old checks.

## Definition of done / verification
Focused auth/identity, groups and RBAC convex-test suites plus changed-workspace typecheck pass or have exact recorded blockers. Typed server access summary and documented caller contract exist; no changed API trusts caller role/user ID. Regression tests show no unauthorized branch data and no unintended legacy lockout.

## Artifacts / handoff
`results/U1a.md`: exact API signatures, entry-point capability/branch manifest, compatibility limitations, commands/results and self-review. Update relevant matrix rows; no runtime completion claim. U1b reads the contract first. Parent owns reviews/PR operations; proceed autonomously with local work, no provider/production/Convex CLI actions without target authority.
