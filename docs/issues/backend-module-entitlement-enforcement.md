# Follow-up: enforce optional modules in backend operations

**Status:** Open. Separate from the EduClearance integration and safety fixes.

## Confirmed gap

The platform switch updates `schools.features`, and workspace navigation and routes use the shared module registry. Admissions has backend checks through `requireAdmissionsModuleEnabled` in `packages/convex/functions/admissions/shared.ts`. Other optional modules do not consistently reject direct calls when disabled. For example, the entry points in `packages/convex/functions/billing.ts` do not check `schools.features.billing`.

A hidden link or blocked page is not an authorization check for a public Convex function. See `docs/features/ProductWideModuleEntitlements.md` for the module defaults and staged schema rollout rules.

## Scope for follow-up

- Inventory the public queries, mutations, actions, and HTTP paths owned by each optional module. Distinguish customer-facing operations from platform operations, settlement/webhook callbacks, and essential read-only information needed to show a disabled state.
- Resolve the school from authenticated membership or trusted server context, enforce its effective entitlement on relevant backend entry points, and retain separate staff permission checks. Respect documented legacy defaults and fail closed for newly disabled modules.
- Test direct function invocation with a disabled module, enabled module plus denied staff permission, legacy school with omitted feature state, and allowed platform/provider operations. Do not make module disabling destroy existing records or interrupt payment reconciliation.

Do not bundle this review with EduClearance's paid-request retry/matching fixes. Its own backend gate must be complete before Melo exposes the integration.
