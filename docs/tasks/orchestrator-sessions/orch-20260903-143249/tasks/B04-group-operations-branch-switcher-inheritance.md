# Task B-04 / M3: School Group Operations, Branch Switcher, and Inheritance Boundaries (F2/H2)

## Objective
Enable multi-branch group management and a branch switcher UI with dirty-state interception while preserving zero-trust branch isolation.

## Scope
- **Backend Group Operations & Branch Directory** (`packages/convex/functions/academic/groups.ts`):
  - `listUserBranches`: Query returning all branches for the authenticated user with active memberships, plus group metadata if the branch is linked.
  - `listGroupBranches`: Query returning all branches in a group for authorized group proprietors/directors.
  - `createSchoolGroup`: Mutation to create a school group and designate a headquarters branch.
  - `linkBranchToGroup`: Mutation linking a branch to a group.
  - Audit context propagation linking group and branch context.
- **Frontend Branch Switcher & Dirty-Form Interception** (`apps/admin` / `@school/ui` / `WorkspaceNavbar`):
  - Active branch switcher dropdown in workspace navbar showing current branch and available branches.
  - Dirty-form guard seam: If unsaved changes are detected (`isDirty`), intercept branch switch with a `<DirtySwitchModal />`:
    - "Stay on Current Branch"
    - "Discard Changes & Switch"
  - Authoritative 403 Forbidden denial view `<AuthoritativeForbiddenView />` for unauthorized branch URL attempts.
- **Integration & Unit Tests**:
  - Tests ensuring group linking never grants implicit branch access.
  - Tests for dirty form interception logic and clean branch switching.

## Definition of Done
- Users switch branches cleanly without re-authentication.
- Dirty forms intercept branch switching until user confirms.
- Group link never merges branch operational data.
- Direct URL access to an unauthorized branch renders the 403 Forbidden screen.

## Dependencies
- B-02 (Identity & Tenancy) complete.
- B-03 (RBAC & Audit) complete.
- D-04 visual contract frozen.
