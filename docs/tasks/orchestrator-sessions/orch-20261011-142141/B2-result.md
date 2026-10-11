# B2 frontend handoff

## Status and ownership

B2's frontend implementation is ready for review. This is not a whole-feature or full-browser completion claim. B3 delivery/history and B4 permissions are not implemented here.

Worktree: `C:/CreativeOS/01_Projects/Code/Personal_Stuff/2026-03-14_School_Management_System/tmp/worktrees/identity-onboarding-portal`

Branch: `fix/identity-onboarding-portal`

B2 remained the only application-code writer and Git index owner. No main-checkout changes, nested writer delegation, deployment, push, PR, real provider calls or live-environment testing occurred. Parent-owned `build-execution.json` and `B2-execution.json` were left untouched and unstaged.

## Local implementation commits

- `5245aaa` Unify atomic student admission and persisted portal access UI.
- `e07d63f` Preserve profile identity and confirm household and class changes.
- `881a83d` Preserve person-name parts across forms and govern new student login suffixes.

## Changes

Roster admission and standalone student-first onboarding share `StudentCreationForm`. The duplicate Quick/Family forms are removed. One typed `createStudent` call carries student identity, placement, numbering and contact intent. A retry keeps the reviewed arguments and request key; it does not issue a separate family mutation. Photo upload follows the successful admission and keeps its existing retry behavior.

The contact UI supports none, authorized existing contacts and new contacts. The picker is bounded and paginated. Exact-email matches require choosing the stored identity, which remains read-only during linking. Common and custom relationships, primary-contact consequences and same/different contact addresses are explicit. Old emergency values and onboarding drafts remain recoverable.

Profiles reopen captured structured names, demographics, effective class, photo and legacy emergency details. Ordinary name saves omit class reassignment and unchanged address/emergency/admission intent. Actual class changes need a dialog with reviewed effective class/session expectations. Cancel retains edits; stale assignment errors ask for reload/review. Promoted-session subjects can be cleared/reselected without opening or saving identity.

The family editor separates explicit contact editing, household label/address changes, linking, unlinking and unused-parent deletion. Household-wide changes need confirmation. Unlinking does not imply account deletion; retained-reference blockers remain visible.

Credential panels query `getPortalAccountState`, show persisted IDs and block unsafe pending/reconciliation operations. Merely opening or reopening a panel never provisions or resets. Temporary passwords belong only to the current successful operation and are not draft data.

Teacher, school-admin, Platform bootstrap/assign-admin, Apply guardian/contact and import-review forms support first, optional middle and last names. Exactly two first-name words become first/middle only when the middle is empty. Explicit middles and compound surnames remain intact. Full-name-only legacy records stay editable without guessed splits. Structured saved records do not switch silently to an incompatible full-name update. Import names have an explicit `Save row name` action; the existing row/plan approval gates remain.

Apply saves retain existing demographics and contact addresses during unrelated edits. Contact address inheritance/custom overrides use B1's existing `residential`/`different` contract. Guardian auth signup formats its auth display name from the entered parts; the application contact stores its structured name separately. Declaration signer text and issued snapshots are unchanged.

Admin/Teacher display names load through authorized `getViewerContext` for the validated branch. The Portal header uses the authorized `getWorkspaceData.viewer` name and role. Stale auth-session names are not shown while these reads load. A canonical account with no legacy user projection may have no displayed name rather than an invented identity.

Student-login suffix settings use `getStudentLoginPolicy`/`saveStudentLoginPolicy`, backend edit authority, verified registry choices and an expected version captured for confirmation. The UI explains that only new identities change, existing IDs remain stable, login IDs are not inboxes and sender settings do not change.

## Contract integration

`packages/convex/functions/admissions/refs.ts` had stale frontend reference types for `getDraft` and `saveDraft`. The actual B1 validator/projection already accepts/returns structured contact names and `addressMode`. B2 updated only those reference types. No backend identity logic, schema or generated files changed.

Teacher, school-admin, Platform and Portal touched identity calls use generated typed references. Other unrelated legacy references were not refactored.

## Focused checks

Final focused Vitest runs used `pnpm --filter <app> exec vitest run` and passed 77 tests in 19 files:

- Admin, 59 tests in 14 files: admission retry/entry points, profile identity, family identity, portal credential state, photo upload, numbering, draft adapters, person-name forms, suffix policy, departure guards, teacher reset controls, stored Portal names, workspace selection and migration workbench.
- Teacher, 14 tests in 3 files: workspace selection, workspace shell and home routing.
- Apply, 2 tests in `tests/application-name-roundtrip.test.tsx`.
- Platform, 2 tests in `__tests__/admin-name-forms.test.tsx`.

The final TypeScript checks passed for `apps/admin`, `apps/teacher`, `apps/portal`, `apps/platform`, `apps/apply` and `packages/shared`. Each used `node node_modules/typescript/bin/tsc --noEmit -p <target>/tsconfig.json` from the worktree.

`git diff --check` and the staged diff check passed. A focused review checked scoped changes and removed redundant aliases/casts where the touched API could use generated types.

`node scripts/audit-theme-colors.mjs` ran with B2's touched source paths, including new files. It is informational. Reviewed classifications:

- Emerald/green indicate saved/provisioned/valid outcomes. Amber indicates verification, reset/recovery or duplicate/review warnings. Rose/red indicate error, blocked or destructive states. These are semantic status colors, not tenant branding.
- Existing indigo workflow/action emphasis in admission, credentials, imports and Platform is product styling, not a user-entered tenant color. Platform's recovery amber is also fixed product/recovery styling.
- Slate/white surfaces remain product-neutral. Existing tenant focus classes use the shared brand-token seam. No tenant status/grade substitution or print-surface change was made, and no global color replacement was attempted.

## Browser blockers and evidence limits

`pnpm qa:doctor --apps admin,teacher,portal` exited without output on Windows. The existing CLI entry-point comparison does not run its `main` function with this Windows argv path. B2 did not change the QA runner. Calling its exported function directly with the same doctor arguments failed locally with missing `<worktree>/.env.qa.local`.

No QA servers started, no isolated/backend attestation completed and no browser journey ran. There are no screenshots, traces, published reports, mobile assertions or browser reload evidence to claim. Apply and Platform also remain outside the runner's three attested origins and need their own approved fixtures/origins. Provider-backed credential and guardian verification journeys need approved test-only conditions, not merely credentials.

The verification map now links `.agents/skills/verify-melo/features/identity-admission.md`, which lists the blocked real-user acceptance journeys. Unit/component evidence is not a substitute for those journeys.

## B3 and B4 handoff

B3 should integrate account-notice actions and history into the completed-record credential panels and appropriate family/profile views. Use persisted student/contact IDs and backend eligibility. Keep notice delivery state separate from portal provisioning state. Notice sending must not be inferred from provision/reset success, a typed contact email or the existence of a temporary password. No delivery success UI or automatic send was added by B2.

B4 retains permission/governance ownership. B2's UI calls the existing authorized B1 APIs and displays backend suffix edit authority; it does not broaden parent/shared-contact ownership or endpoint permissions.

The parent can review the local frontend commits and continue B3/B4. Full browser acceptance remains blocked until the isolated profile and permitted test conditions exist.
