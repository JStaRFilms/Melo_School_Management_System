# Task B06 / M5: Shared Theme Tokens, Draft Recovery, and Mobile Progress Foundation (F6/H6/H7) - Execution Record

**Status**: COMPLETED  
**Date**: 2026-09-03  
**Parent Session**: `orch-20260903-143249`  
**Milestone**: M5 / PR-F  
**Authors**: Frontend Systems Engineer & UI Architect  

---

### 1. Architectural Summary & Scope

Task B-06 establishes the cross-application visual and UX primitives across all school-facing apps:
1. **Convex Schema Expansion (`packages/convex/schema.ts`)**:
   - Added table `formDrafts`:
     - Fields: `schoolId`, `userId`, `formKey`, `entityId`, `payload`, `status` (`active` | `committed` | `discarded`), `revision`, `lastSavedAt`, `createdAt`, `updatedAt`.
     - Indexes: `by_user_and_form` on `["userId", "formKey"]`, `by_school_and_form` on `["schoolId", "formKey"]`.

2. **Draft Persistence Backend (`packages/convex/functions/academic/drafts.ts`)**:
   - `saveFormDraft` (alias `saveDraft`): Authenticates user and branch membership, performs upsert for `(userId, formKey, entityId)` active drafts, advances `revision`, refreshes `lastSavedAt`, and catches concurrency revision conflicts.
   - `getFormDraft` (alias `getDraft`): Retrieves active draft scoped strictly to caller's identity and school branch.
   - `discardFormDraft` (alias `discardDraft`): Marks draft as discarded by ID or formKey/entityId.
   - `commitFormDraft` (alias `commitDraft`): Marks draft as committed upon final successful submission.

3. **Shared Theme Token Derivation (`packages/shared/src/theme/`)**:
   - Strict 2-input theme model: `primaryColor` and `accentColor`.
   - Algorithm in `themeDerivation.ts` deriving 8 contrast-safe CSS custom properties:
     `--school-primary`, `--school-primary-hover`, `--school-primary-surface`, `--school-primary-border`, `--school-primary-contrast`, `--school-accent`, `--school-accent-surface`, `--school-accent-contrast`, `--school-focus-ring`.
   - Mathematical relative luminance and contrast calculator per ITU-R BT.709 and WCAG 2.2 AA ($4.5:1$ for normal/body text, $3:1$ for large text).
   - **Semantic Sovereignty Invariant**: `assertThemeDoesNotOverwriteSemanticTokens` and `PROTECTED_SEMANTIC_TOKENS` guarantee school brand colors NEVER overwrite operational status tokens (emerald, amber, rose, sky) or H1 grade-band colors.
   - `SchoolThemeProvider.tsx`: Injects CSS custom properties dynamically via inline style on a wrapper or container and exposes theme context via `useSchoolTheme()`.

4. **Draft Recovery Modal & Truthful Connectivity (`packages/shared/src/drafts/`)**:
   - `DraftRecoveryModal.tsx`:
     - Invariant: A draft NEVER silently overwrites a fresh blank form upon user return.
     - Displays form title, draft subject, formatted last modified timestamp, author, and completion summary.
     - Offers three distinct actions: "Resume Editing Draft", "Preview Draft", and "Discard Draft & Start Fresh".
   - `DraftStatusIndicator.tsx`:
     - Truthful labeling for `saving`, `saved`, `connection_lost`, `save_failed`, and `conflict`.
     - **Zero False Offline Claims Invariant**: Disconnected state displays `Connection lost • Recovery pending` with explicit notice that edits are held in browser memory and synchronization will resume once connectivity is restored.
   - `useFormDraft.ts`:
     - React hook with 1.5s debounced autosave, navigator online/offline event synchronization, and draft recovery trigger.

5. **Compact Mobile Progress Indicator (`packages/shared/src/components/MobileProgressIndicator.tsx`)**:
   - Compact sticky sub-header bar docked beneath navbar on mobile viewports ($<768\text{px}$, height $\le 32\text{px}$).
   - **Strict Progress Semantics Invariant**:
     - Mode A (Scroll Progress): Viewport scroll depth for reading documents (`Page X%`).
     - Mode B (Validated Section Completion): Multi-step wizard completion (`Step X of Y: Title`). Steps mark complete ONLY when validation rules pass (`isValid === true`), never when scrolled or clicked past.
   - Integrates compact persistence status pill.

6. **Exports & Packaging**:
   - Exported theme, draft, and progress primitives from `packages/shared/src/index.ts`.
   - Added subpath exports `./theme` and `./drafts` to `packages/shared/package.json`.

---

### 2. Verification & Test Results

1. **Shared Package Typecheck**:
   - Command: `pnpm --filter @school/shared typecheck`
   - Result: `tsc --noEmit` exited 0 (Clean, 0 errors).

2. **Convex Backend Typecheck**:
   - Command: `pnpm --filter @school/convex typecheck`
   - Result: `tsc --noEmit -p tsconfig.json` exited 0 (Clean, 0 errors).

3. **Shared Vitest Suite**:
   - Command: `pnpm --filter @school/shared test`
   - Result: 20 test files passed, 142 tests passed in 2.15s.
     - `themeDerivation.test.ts` (10 tests passed): Hex conversion, relative luminance math, WCAG 2.2 AA contrast ratios, automatic high-contrast text selection (light/dark), and protected semantic token sovereignty.
     - `MobileProgressIndicator.test.tsx` (8 tests passed): Viewport scroll clamping, validated section completion logic, and truthful status pills.
     - `DraftRecoveryModal.test.tsx` (5 tests passed): Returning user modal rendering, preview toggle, 3 action buttons, and zero false offline claim labels.

4. **Convex Drafts Integration Test Suite (`packages/convex/functions/academic/__tests__/drafts.integration.test.ts`)**:
   - Command: `pnpm --filter @school/convex test drafts.integration.test.ts`
   - Result: 7 tests passed in 116ms:
     1. Saves a new form draft and retrieves it successfully.
     2. Upserts existing active draft, bumping revision and timestamps without duplicate rows.
     3. Detects revision conflict when `expectedRevision` does not match.
     4. Supports entity-scoped drafts alongside un-scoped drafts.
     5. Discards draft so it is no longer retrieved.
     6. Commits draft upon final submission.
     7. Enforces strict user isolation so User B cannot access User A's drafts.

---

### 3. Merged Artifact Inventory

- `packages/convex/schema.ts` (added `formDrafts` table and indexes)
- `packages/convex/functions/academic/drafts.ts` (`saveFormDraft`, `getFormDraft`, `discardFormDraft`, `commitFormDraft`)
- `packages/convex/functions/academic/__tests__/drafts.integration.test.ts` (7 integration tests)
- `packages/shared/src/theme/themeDerivation.ts` (mathematical luminance, WCAG 2.2 contrast, token derivation)
- `packages/shared/src/theme/SchoolThemeProvider.tsx` (React provider and context)
- `packages/shared/src/theme/index.ts` (theme barrel export)
- `packages/shared/src/theme/__tests__/themeDerivation.test.ts` (theme unit tests)
- `packages/shared/src/drafts/types.ts` (draft status types and configs)
- `packages/shared/src/drafts/DraftStatusIndicator.tsx` (truthful connectivity status pill)
- `packages/shared/src/drafts/DraftRecoveryModal.tsx` (returning user modal)
- `packages/shared/src/drafts/useFormDraft.ts` (autosave debounce hook)
- `packages/shared/src/drafts/index.ts` (drafts barrel export)
- `packages/shared/src/drafts/__tests__/DraftRecoveryModal.test.tsx` (drafts unit tests)
- `packages/shared/src/components/MobileProgressIndicator.tsx` (compact mobile progress bar)
- `packages/shared/src/components/__tests__/MobileProgressIndicator.test.tsx` (mobile progress unit tests)
- `packages/shared/src/index.ts` (re-exports for all components and utilities)
- `packages/shared/package.json` (subpath exports for `./theme` and `./drafts`)
- `packages/shared/vitest.config.ts` (enabled `.tsx` test file discovery)
