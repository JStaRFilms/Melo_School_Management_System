# Task 03: School Branding and Parent Multi-School Context

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read `docs/project_requirements.md`.
- Read `docs/features/PortalAcademicPortalFoundation.md`.
- Read tenant/domain/public-site docs if branding touches public surfaces.
- Read `packages/convex/_generated/ai/guidelines.md` before Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build`.

Use these skills where available:
- `takomi`
- `convex`
- `convex-security-check`
- `nextjs-standards`
- `frontend-design`
- `webapp-testing`
- `sync-docs`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Architect / Coder.
- Initial model: `gpt-5.5`.
- Review model: `gpt-5.5`.
- Escalation: move to `gpt-5.5` immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- `gpt-5.4-mini` is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Security-sensitive tenant context and parent multi-school access.

## Objective

Make each authenticated workspace clearly show the active school, and add the first parent multi-school context flow.

## Scope

- Show school name/logo/theme in admin, teacher, and portal navigation/dashboard context.
- Add dynamic browser metadata where feasible for active school context.
- Portal parents with children in multiple schools can see and choose the active child/school context.
- Student login remains direct to the student’s own school/student context.
- Preserve all school data boundaries and role restrictions.

## Acceptance Criteria

- Staff can tell which school they are using from dashboard/nav/browser title.
- Parent portal can represent children from multiple schools without leaking data across schools.
- Active context changes update visible school identity.
- Fallback branding remains usable when a school has no logo/theme.
- Relevant portal/branding docs are created or updated.
- Tenant-scope tests or explicit verification notes are included.


## Completion Notes

Completed on 2026-05-06.

### Implementation

- Added authenticated school branding query: `functions/academic/schoolBranding:getCurrentSchoolBranding`.
- Extended `WorkspaceNavbar` with optional `schoolBranding` support, logo/fallback initials, school name, theme accents, and browser-title updates.
- Wired admin, teacher, and portal workspace layouts to pass active school branding.
- Updated portal workspace data to resolve parent-accessible students across multiple parent memberships linked to the same auth identity.
- Student portal users remain direct-context users.
- Portal child selectors now display school context.
- Portal billing and payment context now validate through accessible student records across portal memberships.
- Added `docs/features/SchoolBrandingAndParentMultiSchoolContext.md` and updated `PortalAcademicPortalFoundation.md`.

### Verification

Passed:

- `corepack pnpm -C packages/shared exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/portal exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/admin lint`
- `corepack pnpm -C apps/teacher lint`
- `corepack pnpm -C apps/portal lint`
- `corepack pnpm -C apps/admin build`
- `corepack pnpm -C apps/teacher build`
- `corepack pnpm -C apps/portal build`

### Manual verification still recommended

- Confirm active school name/logo appears in admin and teacher nav.
- Confirm portal child switching updates the selected child's school context.
- Confirm parent cannot access an unrelated student/invoice by URL.
