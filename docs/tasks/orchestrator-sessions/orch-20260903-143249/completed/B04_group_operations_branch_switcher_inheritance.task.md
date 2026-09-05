# Task B04 / M3: School Group Operations, Branch Switcher, and Inheritance Boundaries (F2/H2) - Execution Record

**Status**: COMPLETED  
**Date**: 2026-09-03  
**Parent Session**: `orch-20260903-143249`  
**Milestone**: M3 / PR-D  
**Authors**: Fullstack Product Engineer & UI Architect  

---

### 1. Architectural Summary & Scope

Task B-04 delivers the complete backend and frontend foundations for School Group Operations, Active Branch Switching, Dirty-Form Interception, and Authoritative Access Denial:
1. **Zero-Trust Multi-Branch Backend Module (`packages/convex/functions/academic/groups.ts`)**:
   - `listUserBranches`: Queries all active branch memberships for the authenticated user, resolving school name, slug, status, group association, and headquarters metadata without cross-branch leakage.
   - `getGroupOverview`: Queries school group overview and member branch directories for authorized proprietors, platform super admins, and branch leaders.
   - `listGroupBranches`: Ergonomic query returning group branch summaries for umbrella navigation.
   - `createSchoolGroup`: Mutation creating a `schoolGroups` record, designating initial headquarters in `schoolGroupBranches`, and appending a statutory audit event.
   - `linkBranchToGroup`: Mutation linking additional branches to a school group while verifying tenant ownership and appending an audit event.
2. **Frontend UI Components (`packages/shared/src/components/`)**:
   - `AuthoritativeForbiddenView.tsx`: Authoritative 403 Forbidden denial view conforming to D-04 §2.2, with diagnostic capability badges, active identity context, and action buttons.
   - `BranchSwitcher.tsx`: Navbar header dropdown conforming to D-04 §3.1, displaying current branch, search filtering, `[HQ]` badges, active checkmarks, and membership role subtitles.
   - `UnsavedBranchSwitchModal.tsx`: Dirty-form guard modal conforming to D-04 §3.2, intercepting branch switches when local forms contain unsaved edits, offering stay, discard & switch, or draft save & switch.
3. **Workspace Navbar Integration (`packages/shared/src/components/WorkspaceNavbar.tsx`)**:
   - Added optional `branchSwitcher?: ReactNode;` to `WorkspaceNavbarProps`.
   - Rendered `branchSwitcher` directly beside the school branding / workspace title area in the header.
4. **Integration Test Suite (`packages/convex/functions/academic/__tests__/groups.integration.test.ts`)**:
   - Verified multi-branch user queries, zero-trust branch isolation, group creation, branch linking, audit log emission, and unauthorized access rejection.

---

### 2. Backend Implementation Details (`packages/convex/functions/academic/groups.ts`)

- **Server-Side Identity Derivation**:
  `ctx.auth.getUserIdentity()` resolves the authenticated caller. The canonical person is identified through `persons.authTokenIdentifier` (or `email`), querying `branchMemberships` with index `by_person_and_status`.
- **Role Title Resolution**:
  Prioritizes `branchMemberships.displayTitle`, then checks `isMembershipProprietor`, followed by role template names in `membershipRoleAssignments`, and finally legacy user roles.
- **Strict Tenant Boundary Invariant**:
  Linking Branch A and Branch B into a shared `schoolGroup` does **not** grant Branch A users implicit access to Branch B operational data. Every branch operation requires explicit active membership in that specific branch.
- **Append-Only Redacted Audit Integration**:
  `createSchoolGroup` and `linkBranchToGroup` mutations call `recordAuditEventHelper` with module `"groups"`, actions `"group.create"` and `"group.branch_link"`, persisting permanent statutory audit entries.

---

### 3. Frontend Component Contracts (`packages/shared/`)

#### 3.1 `AuthoritativeForbiddenView`
- **Path**: `packages/shared/src/components/AuthoritativeForbiddenView.tsx`
- **Props**: `AuthoritativeForbiddenViewProps` (`moduleTitle`, `missingCapability`, `userName`, `userTitle`, `branchName`, `branchId`, `onReturnToDashboard`, `onSwitchBranch`, `canSwitchBranch`).
- **Features**: Accessible `role="alert"`, amber security shield icon, diagnostic metadata box displaying required capability and active context, actionable remediation guidance, and responsive recovery action buttons.

#### 3.2 `BranchSwitcher`
- **Path**: `packages/shared/src/components/BranchSwitcher.tsx`
- **Props**: `BranchSwitcherProps` (`currentBranch`, `availableBranches`, `onSelectBranch`, `disabled`, `className`).
- **Features**:
  - Top trigger showing current branch name, `[HQ]` badge, and chevron.
  - Accessible `role="listbox"` popover with search filter input and clear action.
  - Active checkmark indicator, role/status subtitle, and keyboard navigation (Esc to close).
  - Outside-click detection and responsive overflow handling.

#### 3.3 `UnsavedBranchSwitchModal`
- **Path**: `packages/shared/src/components/UnsavedBranchSwitchModal.tsx`
- **Props**: `UnsavedBranchSwitchModalProps` (`isOpen`, `formName`, `targetBranchName`, `lastSavedText`, `supportsDraftSave`, `onStay`, `onDiscardAndSwitch`, `onSaveDraftAndSwitch`).
- **Features**:
  - Accessible `role="dialog"` backdrop and modal card.
  - Three distinct decision paths: "Stay on Current Branch", "Discard Changes & Switch", and "Save Draft & Switch Branch" with loading spinner and error feedback.

---

### 4. Verification & Test Results

1. **Shared Package Typecheck**:
   - Command: `pnpm --filter @school/shared typecheck`
   - Result: `tsc --noEmit` exited 0 (Clean).
2. **Shared Package Unit Tests**:
   - Command: `pnpm --filter @school/shared test`
   - Result: 17 test files passed, 119 tests passed.
3. **Convex Backend Typecheck**:
   - Command: `pnpm --filter @school/convex typecheck`
   - Result: `tsc --noEmit -p tsconfig.json` exited 0 (Clean).
4. **Groups Integration Tests**:
   - Command: `pnpm --filter @school/convex test groups.integration.test.ts`
   - Result: 4 passed in 104ms.
     - `1. Multi-branch user querying listUserBranches receives all active branch memberships with accurate group and HQ metadata` (PASSED)
     - `2. Cross-branch isolation: Linking Branch A and Branch B into a school group does NOT allow Branch A queries to access Branch B data` (PASSED)
     - `3. Group creation and branch linking accurately records schoolGroups, schoolGroupBranches, and emits audit events` (PASSED)
     - `4. Unauthorized users cannot create groups or link branches` (PASSED)
5. **Full Convex Test Suite**:
   - Command: `pnpm --filter @school/convex test`
   - Result: 25 test files passed, 133 tests passed (Clean).
