# Product-Wide Module Registry and School Entitlements

**Status:** Proposed architecture follow-up  
**Scope:** Optional Melo features that are implemented once product-wide and enabled for selected schools or all schools.

## Purpose

Melo should not maintain school-specific forks or one-off feature implementations. A feature is built, tested, and deployed as part of the shared product. Platform operators then control whether each school is entitled to use that feature.

This document separates two decisions that must not be conflated:

- **Module entitlement:** Is this product module enabled for this school?
- **User permission:** May this authenticated user perform this operation within an enabled module?

A user must pass both checks. Enabling a module does not grant user permissions, and granting a capability does not override a disabled school module.

## Current Problem

Module information is currently repeated across the Convex school schema, platform queries and mutations, branding projections, platform UI types/defaults, workspace navigation, and route guards. The displayed module route catalog is also not fully aligned with the routes that are actually gated:

- Curriculum advertises teacher planning and admin templates, while the current module route guard covers only two admin curriculum routes.
- Knowledge Library advertises `/planning/drafts`, which is not the current teacher route structure.
- Billing advertises `/portal/fees`, while the portal route is `/billing`.
- Admissions is displayed as configurable before its listed application and pipeline routes are consistently available and gated.
- Client navigation and layout guards do not by themselves prevent direct calls to Convex functions belonging to a disabled module.

These inconsistencies make adding another optional product module a scattered, error-prone change.

## Decision Direction

### 1. One non-React module registry

Create one pure TypeScript registry containing module identity, defaults, availability, descriptions, and controlled route prefixes. It must not import React components or UI icons.

Illustrative shape:

```ts
export const PRODUCT_MODULES = {
  billing: {
    defaultEnabled: true,
    availability: "available",
    title: "Finance & Fee Billing",
    description: "Invoicing, fee schedules, payments, and ledgers.",
    routes: {
      admin: ["/billing"],
      portal: ["/billing"],
    },
  },
} as const;

export type ProductModuleKey = keyof typeof PRODUCT_MODULES;
```

The registry should drive, rather than merely describe:

1. Platform feature-management controls.
2. Module names, badges, descriptions, and route-impact summaries.
3. Sidebar and workspace navigation visibility.
4. Direct-route blocking before protected page children mount.
5. Default entitlements for newly provisioned schools and legacy fallback behavior.

UI-only icon selection may map the registry key to a component inside the platform app.

### 2. School entitlements remain configuration

Each school stores its enabled/disabled module state. This configuration selects from product modules deployed in the shared codebase; it does not select school-specific code.

The initial implementation may retain the existing `schools.features` object for compatibility. The registry should centralize its defaults and key type so consumers do not independently repeat fallback values. If module count or module-specific configuration grows substantially, a later migration may introduce a dedicated school-entitlement table without changing the registry contract.

### 3. Route enforcement uses registry metadata

A shared route decision should accept a workspace, pathname, and resolved school entitlements. It should use the registry's route prefixes for Admin, Teacher, and Portal surfaces.

Both sidebar filtering and direct-route blocking must call the same decision function. Components such as `WorkspaceNavbar` must not maintain a second list of module-specific path conditions.

Public surfaces require an equivalent server-resolved availability decision. Hiding a public link is not sufficient if its route remains callable.

### 4. Backend enforcement is authoritative

Add a Convex helper with an interface similar to:

```ts
await assertSchoolModuleEnabled(ctx, schoolId, "billing");
```

Sensitive queries, mutations, and actions belonging to an optional module must call this helper after deriving the authoritative `schoolId` from authenticated membership or trusted server context. They must not accept a caller-supplied school identity for authorization.

The helper should:

- Load the school entitlement using the canonical registry default when a legacy school has no explicit value.
- Fail closed for known optional modules that are disabled or unavailable.
- Return a stable, non-sensitive error suitable for workspace handling.
- Remain separate from capability/RBAC checks.

Public admissions and site entry points should use their existing public availability contracts in addition to module entitlement where applicable; module enablement must not bypass publication, intake, domain, payment, or privacy checks.

### 5. Availability is distinct from entitlement

A planned or incomplete module must not be presented as operational merely because its entitlement boolean exists. The registry should distinguish states such as:

- `available`: implemented and eligible for enablement.
- `preview`: intentionally exposed only through an explicit preview policy.
- `unavailable`: not selectable and not advertised as controlling live routes.

Admissions should remain unavailable in the switchboard until its real Admin/Public routes and backend boundaries are integrated.

## Initial Alignment Work

The first narrow implementation should:

1. Correct Billing's portal route to `/billing`.
2. Replace the Knowledge Library placeholder route with actual teacher routes, or omit teacher routes until ownership is decided.
3. Define the intended Curriculum ownership of admin templates and teacher planning, then gate those routes consistently.
4. Mark Admissions unavailable until its actual routes are delivered and protected.
5. Use one shared registry decision for navigation and direct routes across Admin, Teacher, and Portal.
6. Add authoritative backend entitlement checks at each optional module's meaningful entry points.
7. Add tests proving that disabled modules are absent from navigation, blocked by direct URL, and rejected by backend operations even when the user otherwise has permission.

## Acceptance Criteria

- A product module key, defaults, metadata, and controlled routes are declared once.
- Adding a module does not require parallel hard-coded route conditions in workspace components.
- Platform route-impact text matches routes that actually exist and are gated.
- Disabled modules cannot be reached through sidebar navigation, direct URLs, or direct Convex calls.
- Entitlement tests and permission tests are separate and cover the case where one passes while the other fails.
- Existing schools retain documented default behavior during rollout.
- No school-specific source fork, component copy, or backend implementation is introduced.

## Non-Goals

- Runtime loading of arbitrary third-party plugins.
- Custom source-code branches for individual schools.
- Treating feature entitlements as a replacement for RBAC or capability checks.
- Allowing platform module enablement to override tenant isolation, publication approval, payment verification, or privacy controls.

## Related Documents

- [Tenant Branding, Platform Module Switchboard Governance, and Workspace Suspension](./TenantBrandingModuleSwitchboardAndSuspensionGovernance.md)
- [ADR-004: Multi-Tenant School-Aware Architecture](../decisions/ADR-004-tenancy-model.md)
- [Admissions and Site Foundation Contract](./AdmissionsAndSiteFoundationContract.md)
