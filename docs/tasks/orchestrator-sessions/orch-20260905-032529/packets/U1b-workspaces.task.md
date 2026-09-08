# U1b — Workspace switching, navigation and denied routes

## Objective / scope
Wire shared branch/access primitives into actual Admin/Teacher shells and preserve Portal family authority. Provide reliable navigation projection and direct-URL denial, not cosmetic hiding.

## Context / dependencies
Read plan/matrix and U1a result. Use `groups.listUserBranches`, U1a viewer summary, shared `BranchSwitcher`, `WorkspaceNavbar`, `AuthoritativeForbiddenView`, `workspace-navigation.ts`. Current nav is static and shells gate legacy roles. Actual Admin shells are admin/academic/assessments/billing; `/students/import` also needs coverage. Teacher shells are assessments/enrollment/planning. Portal `(portal)/layout.tsx` uses `portal.canAccessPortal`, not staff authority.

## Ownership
U1b files in plan; related navigation/component tests. Coordinate shared navbar with U3a guard and U3d themes. Domain route links are added through this established seam, serialized rather than concurrent nav rewrites.

## Instructions
1. Render only authorized branches and accessible sections, removing inaccessible controls from DOM. Separate module-disabled, unauthenticated, suspended and forbidden states.
2. Persist only nonsecret selected branch context scoped to account; verify it against server results every session. Clear prior branch/entity selections and queries before rendering target data. Do not mutate users.schoolId or reauthenticate to switch.
3. Adopt explicit school arguments for current route calls per U1a manifest. If a route still uses default-school endpoints, block switching there with honest explanation until its domain adapter lands; never display a target header above old-branch data.
4. Preserve Portal selected-child/family semantics. Do not add general staff branch switching to Portal as an authorization shortcut.
5. Install departure seam for links, router actions, workspace/account/sign-out and browser navigation. U3a supplies awaited save/discard/stay; final acceptance waits for integration. Suspend destructive switching until guard can complete.

## Definition of done / verification
Test single/multi/zero branches, suspended/revoked target, denied deep link, no data flash, keyboard selection and 320px layout. Verify hidden nav and backend denial agree; test dirty stay/discard/save failure after U3a. Navigation unit tests and relevant app typechecks/lint recorded. No invented mockup URLs in nav.

## Artifacts
`results/U1b.md` with shell/route/caller adoption manifest, exclusions, tests/self-review and U7 screenshot requests. Update matrix; completion remains partial for unsupported branch routes. No production/provider/migration/deployment or ungated browser authentication. Parent owns independent review and PRs.
