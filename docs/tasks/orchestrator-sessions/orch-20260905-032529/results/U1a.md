# U1a — Authoritative workspace access contract

**Status:** implemented and locally verified; ready for U1b contract review/adoption. This is not a runtime, migration, full-admin parity, or branch-switching completion claim. No commits, deployment, Convex CLI, credentials, provider activation, production access, or database migration performed.

## Delivered contract

Shared type: `WorkspaceAccessSummary` in `@school/shared/workspace-access` (type-only dependency for Convex). States:
- `unauthenticated`;
- `forbidden`, `suspended`, or `reconciliation_required`, with a safe message and **no branch metadata**;
- `ready`: branch ID/name/slug/status; explicit membership ID/person ID/display title or null; cosmetic display title; effective RBAC capability array; compatibility projection; teacher assignment contract.

Compatibility includes `mode: canonical | legacy_default | platform`, nullable legacy user/role/default school, exact legacy admin flag, and `adminParity: review_required | not_applicable`. **No full-admin parity value is asserted.** Teacher projection supplies the selected branch's explicitly linked legacy teacher ID, not email-linked aliases or an all-classes permission. `source: domain_checks_required` means every teacher domain operation still checks its class/subject assignment. No assignment list or branch-list endpoint was added unnecessarily.

### Exact public signatures

```ts
api.functions.auth.getViewerAccess({ schoolId?: Id<"schools"> }): WorkspaceAccessSummary
api.functions.auth.getViewerContext({ schoolId?: Id<"schools"> }): {
  authUserId: string | undefined;
  appUserId: Id<"users">;
  email: string;
  name: string;
  role: "admin" | "teacher" | "student" | "parent";
  isSchoolAdmin: boolean;
  schoolId: Id<"schools">;
} | null
api.functions.academic.auth.getActiveMembership({ schoolId: Id<"schools"> }): ActiveMembershipContext
api.functions.academic.rbac.hasViewerCapability({ schoolId: Id<"schools">, capability: string }): boolean
```

The first query is new; the second accepts an additive optional school argument and keeps its previous return shape. The last two signatures are unchanged. Neither user IDs, roles, nor claimed capabilities authorize any changed API.

Server helpers:
- `resolveActiveMembership(ctx: QueryCtx | MutationCtx, schoolId: Id<"schools">, options?: { allowSuspended?: boolean }): Promise<ActiveMembershipContext>`.
- `ActiveMembershipContext`: optional `personId`, `membershipId`, `userId`; required `schoolId`, `role`, `isPlatformAdmin`. Optional IDs are genuinely absent, never fabricated.
- `getAuthenticatedSchoolMembership(ctx: QueryCtx | MutationCtx, options?: { allowSuspended?: boolean; schoolId?: Id<"schools"> }): Promise<{ userId: Id<"users">; schoolId: Id<"schools">; role: string; isSchoolAdmin: boolean; isSuspended: boolean }>`.
- `getContextCapabilities(ctx, context): Promise<string[]>` is shared by summary and `requireCapability`; `evaluateEffectiveCapabilities(ctx, membershipId)` additionally rejects inactive membership/person/school.
- `resolveLegacyViewer(ctx)` resolves one exact token-linked user, or one exact unlinked historical subject from the configured trusted issuer. It is a server helper, not a public user lookup.

### Default and selected invocation rules

1. All school arguments are untrusted and resolved server-side. Canonical person/token matching is bounded to two matches; duplicate persons/memberships/platform identities fail closed. Canonical suspension, archive, reconciliation state, missing/revoked membership **cannot** fall through to a still-live legacy admin row.
2. A canonical legacy projection must be explicitly supplied by `membership.legacyUserId`, belong to the selected school, not be archived, and not contradict the canonical person/token. Missing projections are not guessed from email, title, or a school-wide user scan.
3. Exact trusted legacy-only callers retain their single legacy default school and old admin/`isSchoolAdmin` checks. They cannot select another school. A legacy row carrying an unresolved person prelink is gated for reviewed reconciliation.
4. `getViewerAccess({})` preserves an unambiguous legacy default. Otherwise it may resolve one explicit canonical default (bounded 101-row overflow detection, maximum 100 candidates), or the sole active membership. Ambiguous defaults require explicit selection/review, never arbitrary first-match selection.
5. `getViewerContext({})` returns a projection only when that school also equals the exact legacy default. A selected canonical projection does not silently make no-argument legacy APIs multi-branch. `{schoolId}` explicitly resolves that branch; missing legacy projection returns null.
6. `getAuthenticatedSchoolMembership(ctx)` remains pinned to the exact legacy default. `{schoolId}` resolves the requested branch and requires its reviewed legacy projection. Its existing `allowSuspended` exception is only passed for default reads; canonical identity and membership checks still apply. No public query accepts the suspension bypass.
7. Admin/Teacher `useAuth()` now exposes `workspaceAccess`. Their single viewer subscription uses `getViewerAccess({})`; session projection occurs only for a compatible legacy default. Configured clients no longer recover a denied/loading role or school from raw Better Auth session fields. Terminal denial is not an endless loading state. No switcher, selected-school persistence, route guard UI or domain caller adoption was added.

## Entry-point capability / branch manifest

| Public entry | Authority | Branch mode / behavior |
|---|---|---|
| `functions/auth.getViewerAccess` (query, new) | Authenticated canonical membership or exact trusted legacy bridge; existing platform support identity | Optional target school; otherwise validated default. Returns one effective summary, not one request per menu item. Denials contain no branch data. |
| `functions/auth.getViewerContext` (query, changed) | Same resolver; additionally requires reviewed legacy projection | Optional target school; omitted argument only projects compatible legacy default. Email fallback and email-bearing warning removed. |
| `academic/auth.getActiveMembership` (query, hardened helper) | Active identity and explicit target membership, existing platform support bypass | Required target school; no role/user argument. |
| `academic/rbac.hasViewerCapability` (query, shared evaluator) | `requireCapability` plus active target membership | Required school and requested capability, boolean denial. |
| RBAC `previewEffectiveCapabilities`, `assignRoleToMembership`, `grantDirectCapability`, `restrictDirectCapability`, `setDelegationCeiling` | Existing manager/proprietor/ceiling/anti-self checks retained; resolver and evaluator now reject inactive context | Existing membership-owned school/explicit-school contracts unchanged. No U1d management body edited or new authority assigned. |
| `functions/auth.getAuthUser`, `getPlatformViewerContext` | Existing Better Auth / platform contracts | Unchanged identity/platform APIs; not staff branch selectors. |
| `functions/auth.rotateKeysForStaticConfig` (action) | Existing action, untouched | No branch contract; **not invoked**. No credential/action remediation in U1a. |
| `academic/curriculumGeneration.requestCurriculumGeneration` and its internal context consumers | Existing legacy admin check | No API/behavior change: only `loadContext` import ID strengthened to `Id<"curriculumImports">` and obsolete `as never` removed because typed auth context exposed that existing type defect. Default school and owned-record school equality remain. |

**No storage, export, HTTP, or public mutation/action entry point was added or given selected-branch support.** Existing downstream storage/export/action handlers retain their per-domain checks and existing school selection. The [conservative helper-consumer inventory](U1a-helper-consumers.md) enumerates public exports in modules referencing the changed helpers, including indirect assignment/capability/default-auth effects. It is explicitly **not** a scoped-route allowlist. U1b and domain owners must inspect complete action→internal query/mutation chains and owned-record checks before enabling a switched route.

## Compatibility and outstanding gates

- Principal baseline capabilities remain exactly the existing baseline, not full legacy admin rights and not newly seeded canonical roles. Existing admin checks are not globally retired. Full-admin migration requires reviewed mappings and per-domain parity evidence; U1b must not replace all legacy route checks with the baseline array.
- `isSchoolAdmin` compatibility remains independent of `role`; the existing RBAC baseline behavior is not broadened for teacher-admin flags.
- Teacher matching by equal email was intentionally removed from touched assignment helpers. Existing exact assignment, class-subject offering, and form-teacher rules remain; class/subject/school boundaries are checked. Historical duplicate teacher rows need reviewed projection/assignment repair rather than email-based access recovery.
- A valid canonical membership without a legacy projection supports capability-aware endpoints, **not** legacy academic record operations. Missing legacy default means default-only shells cannot project a staff role. U1b must display an explicit reconciliation/unsupported-route gate using the summary.
- Existing platform support bypass remains; this packet does not claim an audited break-glass redesign. Existing group list/overview semantics and RBAC manager policy remain U1c/U1d work. Group membership alone is never branch authority in the changed resolver.
- Existing capability vocabulary/alias and preview policy were not redesigned. Domain entitlement and teacher assignment are separate from the capability array.
- No browser/UI runtime or remote target verification was performed. Trusted legacy issuer configuration was not inspected or repaired; local tests use the repository's synthetic trusted issuer.

## Verification

Final local commands and results:

```text
pnpm --filter @school/convex exec vitest run foundationContracts.test.ts functions/academic/__tests__/auth.test.ts functions/academic/__tests__/groups.integration.test.ts functions/academic/__tests__/rbacAudit.integration.test.ts functions/academic/__tests__/identityResolver.integration.test.ts functions/academic/__tests__/identityTenancy.integration.test.ts functions/academic/__tests__/workspaceAccess.integration.test.ts
  PASS: 7 files, 58 tests
pnpm --filter @school/convex typecheck
pnpm --filter @school/admin typecheck
pnpm --filter @school/teacher typecheck
pnpm --filter @school/shared typecheck
  PASS: all four
pnpm --filter @school/convex exec eslint functions/auth.ts functions/academic/auth.ts functions/academic/rbac.ts functions/academic/__tests__/workspaceAccess.integration.test.ts
  PASS
git diff --check
  PASS
```

New regression coverage: no-argument legacy admin access, no membership writes, forged school, revoked/deleted/duplicate membership, suspended/archived/reconciliation-required canonical identity, ambiguous token, cross-school legacy mapping, same-email impostor, school suspension, exact trusted-subject compatibility after canonical linking, explicit teacher branch projection and assignment, and summary/enforcement capability parity. Existing groups, identity, RBAC and foundation suites passed.

Errors resolved during implementation: mock auth tests migrated to real convex-test contexts for the newly typed helper; missing fixture timestamp and module-map normalization corrected; preserved existing denial-message compatibility; fixed the necessary curriculum import-ID type fallout. A first cold summary test exceeded 5 seconds while loading the Better Auth module graph; moved that import to test collection, did not increase timeout. Final suite passes. Existing Vite CJS deprecation and identityResolver test direct-function-call warnings remain nonfatal; no provider was called.

## Files and self-review

Changed: Admin/Teacher AuthProviders; `functions/auth.ts`; `academic/auth.ts`; RBAC resolver/evaluator section; two type-only lines in `academic/curriculumGeneration.ts`; `academic/__tests__/auth.test.ts`; Shared subpath export. Added: shared access type, `workspaceAccess.integration.test.ts`, this result and helper-consumer appendix. Updated F2/H2 matrix notes.

Self-review completed against the diff: removed school-wide identity scans and email inference; no automatic identity/membership/role writes; canonical failures are terminal; summary and enforcement reuse one evaluator; legacy admin checks retained; no U1d management edits, schema/codegen edits, new runtime dependencies, or public storage/export wrappers. The two-line curriculum correction is necessary typed-context fallout, not a feature expansion. Temporary editing scripts removed. U1b must read this contract first and stage branch adoption against actual route callers.
