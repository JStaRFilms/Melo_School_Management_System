# Task Brief: Exam Recording v1 — Admin App Build

**Task ID:** T06
**Priority:** High
**Mode:** vibe-architect (build only; no backend logic changes)
**Source FRs:** FR-006 (Assessment and Grading Engine), FR-007 (Results Entry and Moderation)
**Feature Spec:** `docs/features/ExamRecording.md`
**Coding Guidelines:** `docs/Coding_Guidelines.md`
**Mockups:** `docs/mockups/admin/`
**Depends On:** T04 (Shared Domain and Backend), T05 (Teacher App Build)

---

## 1 Objective

Implement the admin-facing Exam Recording screens in the admin app: school assessment settings, grading-band management, and bulk score-entry. The admin app reuses the same backend queries and mutations as the teacher app but exposes additional configuration and oversight controls restricted to school-admin users.

---

## 2 Scope

### In Scope

| Area | Details |
|------|---------|
| Assessment settings screen | Configure school-wide exam input mode (`raw40` or `raw60_scaled_to_40`) |
| Grading-band management screen | CRUD for school-scoped grading bands with overlap and coverage validation |
| Admin bulk score-entry screen | Same roster grid as teacher app, with broader admin access to any class-subject sheet |
| School exam mode controls | Radio selector for input mode with plain-language descriptions |
| Grading-band validation UX | Explicit inline errors for overlaps, gaps, and ordering violations |
| Save/update behavior | Mutation calls, success/error feedback, unsaved-changes guard |
| Tests | Unit, component, and integration tests for all three screens |

### Out of Scope

- Teacher app code (already built in T05)
- Backend domain design (consumes shared logic from T04)
- Ranking, positions, CGPA, report cards
- Moderation workflow beyond `"draft"` status

---

## 3 Context and Assumptions

### 3.1 Tech Stack

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS v4
- **Backend:** Convex (queries and mutations from T04)
- **Package Manager:** pnpm workspaces + Turborepo
- **Shared Packages:** `packages/ui`, `packages/domain`, `packages/auth`

### 3.2 Existing Backend (from T04)

The following Convex functions are available and must NOT be recreated:

| Function | Type | Purpose |
|----------|------|---------|
| `getSchoolAssessmentSettings` | Query | Returns active settings for the school |
| `getActiveGradingBands` | Query | Returns active grading bands sorted by minScore |
| `getExamEntrySheet` | Query | Returns roster with joined assessment records, settings, and grading bands |
| `saveSchoolAssessmentSettings` | Mutation | Updates exam input mode |
| `saveGradingBands` | Mutation | Validates and replaces grading bands |
| `upsertAssessmentRecordsBulk` | Mutation | Bulk upserts assessment records with audit fields |

### 3.3 Shared Domain Functions (from T04/T05)

These pure functions in `packages/domain` are available for reuse:

- `computeExamScaledScore(examRawScore, examInputMode)`
- `computeTotal(ca1, ca2, ca3, examScaledScore)`
- `deriveGradeAndRemark(total, gradingBands)`
- `validateScoreRanges(ca1, ca2, ca3, examRawScore, examInputMode)`
- `validateGradingBands(bands)`

### 3.4 Mockup References

| Screen | Mockup File |
|--------|-------------|
| Assessment Settings | `docs/mockups/admin/admin-exam-recording-settings.html` |
| Grading Bands | `docs/mockups/admin/admin-grading-bands.html` |
| Bulk Score Entry | `docs/mockups/admin/admin-bulk-score-entry.html` |

---

## 4 Route Structure

### 4.1 Route Map

```
apps/admin/app/
  assessments/
    setup/
      exam-recording/
      page.tsx                          # Redirect to settings or overview
        components/
          ExamModeSelector.tsx          # Radio group for raw40 / raw60_scaled_to_40
          WeightDistribution.tsx        # Read-only display of CA1/2/3/Exam percentages
          AuditPolicyCard.tsx           # Dark card showing enforcement policy
          SettingsActionBar.tsx         # Save/discard bar
      grading-bands/
        page.tsx                        # Grading-band management screen (server component shell)
        components/
          BandTable.tsx                 # Editable table of grading bands
          BandRow.tsx                   # Single band row with inputs
          BandValidationBanner.tsx      # Red banner for overlap/gap errors
          AddBandButton.tsx             # Append new tier button
          BandsActionBar.tsx            # Save/discard bar
    results/
      entry/
        page.tsx                        # Admin bulk score-entry page (server component shell)
        components/
          AdminSelectionBar.tsx         # Session/Term/Class/Subject selector (admin-scoped)
          AdminRosterGrid.tsx           # Bulk score grid (reuses teacher grid logic)
          AdminSaveActionBar.tsx        # Save bar with admin-specific labels
```

### 4.2 Route Rules

- All three screens are **server components** that render their interactive children as **client components**.
- Admin auth guard: redirect non-admin users to their appropriate workspace.
- `schoolId` is derived from the authenticated admin session, never from the URL.
- Query string params drive the entry screen selectors (same pattern as teacher app).

---

## 5 Screen 1: Assessment Settings

### 5.1 Page: `/admin/assessments/setup/exam-recording`

**Mockup:** `docs/mockups/admin/admin-exam-recording-settings.html`

**Data Loading:**

- Call `getSchoolAssessmentSettings` to fetch the active settings.
- If no settings exist, show default state with `raw40` pre-selected.

### 5.2 Component: `ExamModeSelector`

**Props:**

```typescript
interface ExamModeSelectorProps {
  currentMode: "raw40" | "raw60_scaled_to_40" | null;
  onModeChange: (mode: "raw40" | "raw60_scaled_to_40") => void;
}
```

**Behavior:**

- Render two radio-card options matching the mockup:
  - **Direct /40 Entry** (`raw40`): "Teachers enter exam scores directly out of 40."
  - **Scaled /60 Entry** (`raw60_scaled_to_40`): "Teachers enter scores out of 60. System scales it to 40 for final total."
- The selected card shows a blue check icon and blue border.
- The unselected card shows a hollow circle and gray border.
- Use plain language — no technical field names in user-facing copy.
- Section heading: "1. Input Mode"

### 5.3 Component: `WeightDistribution`

**Behavior:**

- Read-only display showing four tiles: CA1 20%, CA2 20%, CA3 20%, Exam 40%.
- Exam tile has a blue tint background.
- Section heading: "2. Total Distribution"
- Snapshot label at bottom: "Snapshot: Session YYYY/YYYY Policy"
- These values are fixed in v1 and not editable.

### 5.4 Component: `AuditPolicyCard`

**Behavior:**

- Dark slate card (`bg-slate-900`) with emerald shield icon.
- Explains: "Changes are logged per administrator. Mode updates apply to Incomplete recordings only. Published results are never affected by mode changes."
- Shows two stat boxes: Pass Mark (40.0) and Precision (2 DP).

### 5.5 Component: `SettingsActionBar`

**Behavior:**

- Mobile: fixed bottom bar with "Discard" (text button) and "Commit Settings" (dark button with upload icon).
- Desktop: same bar, right-aligned.
- "Commit Settings" calls `saveSchoolAssessmentSettings({ examInputMode })`.
- Disabled when no changes have been made.
- On success: show toast "Settings updated" and refresh the page data.
- On failure: show error toast with the server error message.

### 5.6 Save Behavior

1. Track `draftMode` state initialized from fetched settings.
2. On mode change, update `draftMode` and set `hasUnsavedChanges = true`.
3. On save:
   - Call `saveSchoolAssessmentSettings({ examInputMode: draftMode })`.
   - On success: reset `hasUnsavedChanges`, show success feedback.
   - On failure: show error, keep draft state.
4. On discard: revert `draftMode` to fetched value, reset `hasUnsavedChanges`.
5. Guard against navigation with unsaved changes via `beforeunload`.

---

## 6 Screen 2: Grading-Band Management

### 6.1 Page: `/admin/assessments/setup/grading-bands`

**Mockup:** `docs/mockups/admin/admin-grading-bands.html`

**Data Loading:**

- Call `getActiveGradingBands` to fetch current bands.
- If no bands exist, show an empty table with a single "Add Tier" prompt.

### 6.2 Component: `BandTable`

**Props:**

```typescript
interface BandTableProps {
  bands: GradingBand[];
  onBandsChange: (bands: GradingBandDraft[]) => void;
  validationErrors: BandValidationError[];
}

interface GradingBandDraft {
  minScore: number | null;
  maxScore: number | null;
  gradeLetter: string;
  remark: string;
}

interface BandValidationError {
  type: "overlap" | "gap" | "ordering" | "out_of_range" | "empty";
  message: string;
  bandIndices?: number[];
}
```

**Behavior:**

- Render an editable table with columns: Grade, Range (min - max inputs), Remark, Actions.
- Each row has:
  - Colored badge for the grade letter (A=emerald, B=blue, C=amber, D=slate, F=red).
  - Two number inputs for min/max scores (70px wide, monospace font, centered).
  - A text input for the remark label.
  - A vertical-more menu button (delete action in v1).
- Rows are sorted by minScore ascending.
- Section heading: "Grading Bands" with subtitle "Define result derivation tiers for the session."

### 6.3 Component: `BandRow`

**Props:**

```typescript
interface BandRowProps {
  band: GradingBandDraft;
  index: number;
  hasError: boolean;
  onChange: (index: number, field: keyof GradingBandDraft, value: string | number) => void;
  onDelete: (index: number) => void;
}
```

**Behavior:**

- Render the grade badge, min/max inputs, remark input, and delete button.
- Inputs with validation errors get `error-border` class (red border, red background).
- On input change, call `onChange` with parsed values.
- Min/max inputs: `type="number"`, `step="1"`, no decimals.

### 6.4 Component: `AddBandButton`

**Behavior:**

- Renders "Add Tier" button (top-right, dark) and "Append Pass Tier" link (bottom of table).
- On click: append a new empty band row with `minScore: null, maxScore: null, gradeLetter: "", remark: ""`.
- The new row appears at the bottom and is immediately editable.

### 6.5 Component: `BandValidationBanner`

**Props:**

```typescript
interface BandValidationBannerProps {
  errors: BandValidationError[];
  onDismiss: () => void;
}
```

**Behavior:**

- Rendered when `errors.length > 0`.
- Red banner (`bg-red-50 border-red-200`) with alert-circle icon.
- Shows heading "Policy Error" and the first error message.
- Dismiss button (X icon) hides the banner until the next validation run.
- Error types:
  - **Overlap**: "Bands overlap for Grade X and Y. Resolve thresholds to unblock results."
  - **Gap**: "Gap detected between Grade X and Y. All scores from 0 to 100 must be covered."
  - **Ordering**: "Min score must be less than or equal to max score for Grade X."
  - **Out of range**: "Score values must be between 0 and 100."
  - **Empty**: "At least one grading band is required."

### 6.6 Validation Rules (Client-Side)

| Rule | Check | Error Type |
|------|-------|------------|
| Ordering | `minScore <= maxScore` for every band | `ordering` |
| Range | `minScore >= 0` and `maxScore <= 100` | `out_of_range` |
| Overlap | No two active bands have intersecting ranges | `overlap` |
| Coverage | Sorted bands cover 0-100 with no gaps | `gap` |
| Non-empty | At least one band exists | `empty` |

- Validate on every input change (debounced 300ms).
- Also validate on save attempt.
- Validation runs on the client for immediate feedback; the server mutation also validates and will reject invalid data.

### 6.7 Save Behavior

1. Track `draftBands` state initialized from fetched bands.
2. On any row change, update `draftBands` and set `hasUnsavedChanges = true`.
3. Run client-side validation on every change.
4. On save:
   - Run full validation. If errors: show `BandValidationBanner`, scroll to it, do NOT call mutation.
   - If clean: call `saveGradingBands({ bands: draftBands })`.
   - On success: show toast "Grading bands updated", refresh data.
   - On failure (server rejection): show error toast with server message.
5. On discard: revert to fetched bands, reset state.
6. Guard against navigation with unsaved changes via `beforeunload`.
7. Mobile: "Commit Global Policy" button at bottom of screen (full-width).

---

## 7 Screen 3: Admin Bulk Score Entry

### 7.1 Page: `/admin/assessments/results/entry`

**Mockup:** `docs/mockups/admin/admin-bulk-score-entry.html`

**Data Loading:**

- Same `getExamEntrySheet` call as teacher app.
- Admin can select ANY class-subject in the school (not filtered by teacher assignment).
- The response should be consumed using the shared backend contract from T04:
  - `roster`: array of `{ studentId, studentName, assessmentRecord }`
  - `settings`
  - `gradingBands`

If the UI wants a `studentId -> assessmentRecord` map, derive it client-side from `roster`.

### 7.2 Component: `AdminSelectionBar`

**Behavior:**

- Same four-dropdown selector pattern as teacher app.
- Difference: class and subject options are NOT filtered by teacher assignment.
- Use `getClasses` (all school classes) and `getSubjectsByClass` (all subjects for class) instead of teacher-scoped queries.
- Mobile: "Jump to Student" dropdown below selectors showing completion progress (e.g., "21 / 28 Complete").

### 7.3 Component: `AdminRosterGrid`

**Behavior:**

- Reuses the same grid logic as the teacher app `RosterGrid`.
- Import shared grid components from `packages/ui` or a shared feature module.
- Key differences from teacher grid:
  - Header label: "Global Score Overwrite" (breadcrumb) and "Mathematics \u2022 Primary 4A" (title).
  - Shows "Standard Entry" or "Admin Override" label in the Protocol column per row.
  - Save button label: "Commit Batch" instead of "Save Changes".
  - Mobile card shows "Admin Security active" subtitle.
- Desktop: sticky student column, full table with CA1-3, Exam, Total, Grade, Remark columns.
- Mobile: swipeable card layout with score inputs, computed preview, and pagination pills.

### 7.4 Exam Mode Rendering

- Same behavior as teacher app:
  - `raw40`: Exam column header shows `/40`, max input 40, no Scaled column.
  - `raw60_scaled_to_40`: Exam column header shows `/60`, max input 60, Scaled /40 read-only column.
- Mode badge near grid header.

### 7.5 Inline Validation

- Same rules as teacher app (section 5 of teacher build).
- Admin-specific: admin can override teacher-entered scores without restriction (no "not assigned" check).

### 7.6 Computed Columns

- Reuse `computeExamScaledScore`, `computeTotal`, `deriveGradeAndRemark` from `packages/domain`.
- Live recalculation on every keystroke.

### 7.7 Save Behavior

1. Track `draftScores` as `Map<studentId, Partial<AssessmentRecord>>`.
2. On save: call `upsertAssessmentRecordsBulk` with dirty rows only.
3. Partial failure handling: valid rows save, invalid rows reported and remain dirty.
4. Success feedback: "Changes Synced Successfully — All N valid student records have been updated."
5. Partial success: warning banner listing skipped rows.
6. Full failure: error banner with retry.
7. Mobile: fixed bottom bar with "Commit Batch" button.
8. Desktop: floating action bar.
9. Guard against navigation with unsaved changes via `beforeunload`.

---

## 8 Shared Module Reuse

### 8.1 Required Shared Modules

| Package | Module | Usage |
|---------|--------|-------|
| `packages/ui` | `Button`, `Select`, `Input`, `Badge`, `Toast`, `Skeleton` | Base UI primitives |
| `packages/ui` | `DataTable`, `StickyColumn` | Grid layout helpers |
| `packages/domain` | `examCalculations.ts` | Score computation functions |
| `packages/domain` | `validation.ts` | Score range and band validators |
| `packages/domain` | `types.ts` | `AssessmentRecord`, `GradingBand`, `SchoolSettings`, `StudentRosterEntry` |
| `packages/auth` | `useSession`, `useSchoolId` | Auth context and school scoping |

### 8.2 Import Rules

- NEVER import from `apps/teacher` directly.
- All shared logic lives in `packages/*`.
- Feature-specific logic lives in `apps/admin/app/assessments/`.
- If teacher app has grid components that can be shared, extract them to `packages/ui` or a shared feature module BEFORE building admin screens.

---

## 9 Mobile-First Behavior

### 9.1 Breakpoints

- Default (< 768px): card layouts, stacked selectors, bottom action bars.
- Tablet/Desktop (>= 768px): table grids, horizontal selectors, floating action bars.

### 9.2 Touch Targets

- All inputs: minimum 44px touch target height.
- Score inputs: full-width on mobile card layout.
- Action buttons: full-width on mobile.

### 9.3 Specific Mobile Patterns

| Screen | Mobile Pattern |
|--------|----------------|
| Settings | Stacked radio cards, full-width save bar at bottom |
| Grading Bands | Full-width table scroll, full-width save bar at bottom |
| Score Entry | Swipeable student cards with pagination pills, "Jump to Student" dropdown |

---

## 10 File Structure

```
apps/admin/app/assessments/
  setup/
    exam-recording/
      page.tsx
      components/
        ExamModeSelector.tsx
        WeightDistribution.tsx
        AuditPolicyCard.tsx
        SettingsActionBar.tsx
    grading-bands/
      page.tsx
      components/
        BandTable.tsx
        BandRow.tsx
        BandValidationBanner.tsx
        AddBandButton.tsx
        BandsActionBar.tsx
  results/
    entry/
      page.tsx
      components/
        AdminSelectionBar.tsx
        AdminRosterGrid.tsx
        AdminRosterGridRow.tsx
        AdminSaveActionBar.tsx
  __tests__/
    ExamModeSelector.test.tsx
    BandTable.test.tsx
    BandValidation.test.ts
    AdminRosterGrid.test.tsx
    AdminSaveFlow.test.tsx
```

---

## 11 Implementation Phases

### Phase 1: Assessment Settings Screen

- [ ] Create route `/admin/assessments/setup/exam-recording` as a server component page under `apps/admin/app/assessments/setup/exam-recording/page.tsx`.
- [ ] Implement `ExamModeSelector` with radio-card UI matching mockup.
- [ ] Implement `WeightDistribution` read-only display.
- [ ] Implement `AuditPolicyCard` dark info card.
- [ ] Implement `SettingsActionBar` with save/discard behavior.
- [ ] Wire up `getSchoolAssessmentSettings` query for data loading.
- [ ] Wire up `saveSchoolAssessmentSettings` mutation on save.
- [ ] Add unsaved-changes guard (`beforeunload`).
- [ ] Ensure mobile layout matches mockup (stacked cards, bottom bar).

### Phase 2: Grading-Band Management Screen

- [ ] Create route `/admin/assessments/setup/grading-bands` as a server component page under `apps/admin/app/assessments/setup/grading-bands/page.tsx`.
- [ ] Implement `BandTable` with editable rows.
- [ ] Implement `BandRow` with grade badge, min/max inputs, remark input, delete button.
- [ ] Implement `AddBandButton` (top "Add Tier" and bottom "Append Pass Tier").
- [ ] Implement `BandValidationBanner` with error display.
- [ ] Implement client-side grading-band validation logic (overlap, gap, ordering, range, empty).
- [ ] Wire up `getActiveGradingBands` query for data loading.
- [ ] Wire up `saveGradingBands` mutation on save with pre-save validation gate.
- [ ] Add unsaved-changes guard.
- [ ] Ensure mobile layout matches mockup (scrollable table, full-width save bar).

### Phase 3: Admin Bulk Score-Entry Screen

- [ ] Create route `/admin/assessments/results/entry` as a server component page under `apps/admin/app/assessments/results/entry/page.tsx`.
- [ ] Implement `AdminSelectionBar` with school-wide class/subject options (not teacher-filtered).
- [ ] Extract or reuse roster grid components from teacher app (move shared pieces to `packages/ui` or shared module).
- [ ] Implement `AdminRosterGrid` reusing shared grid with admin-specific labels.
- [ ] Implement exam mode rendering (raw40 vs raw60 with Scaled column).
- [ ] Implement inline validation (same rules as teacher app).
- [ ] Implement computed columns using shared pure functions.
- [ ] Implement `AdminSaveActionBar` with "Commit Batch" label.
- [ ] Wire up `getExamEntrySheet` query and `upsertAssessmentRecordsBulk` mutation.
- [ ] Implement partial failure handling (valid rows save, invalid rows reported).
- [ ] Add unsaved-changes guard.
- [ ] Ensure mobile layout matches mockup (swipeable cards, pagination pills, Jump to Student).

### Phase 4: Testing

- [ ] Write unit tests for grading-band validation logic.
- [ ] Write component tests for `ExamModeSelector` (mode selection, save trigger).
- [ ] Write component tests for `BandTable` (row add, delete, validation errors).
- [ ] Write component tests for `AdminRosterGrid` (score entry, computed columns, validation).
- [ ] Write integration tests for full save flows on each screen.
- [ ] Run `pnpm typecheck` and ensure zero errors.
- [ ] Run all tests and ensure all pass.

---

## 12 Acceptance Criteria

### Assessment Settings Screen

- [ ] Admin can see current exam input mode (or default if none set).
- [ ] Admin can select between `raw40` and `raw60_scaled_to_40` using plain-language radio cards.
- [ ] Weight distribution (CA1/2/3 = 20%, Exam = 40%) is displayed as read-only.
- [ ] Audit policy card explains that changes affect incomplete recordings only.
- [ ] "Commit Settings" saves the mode via `saveSchoolAssessmentSettings`.
- [ ] Save button is disabled when no changes have been made.
- [ ] Success and error feedback is shown via toast/banner.
- [ ] Unsaved changes trigger a navigation warning.
- [ ] Mobile layout matches mockup.

### Grading-Band Management Screen

- [ ] Admin can see existing grading bands in an editable table.
- [ ] Admin can add new bands via "Add Tier" or "Append Pass Tier".
- [ ] Admin can edit min score, max score, grade letter, and remark for each band.
- [ ] Admin can delete bands.
- [ ] Overlapping bands are detected and blocked with a clear error banner.
- [ ] Gaps in band coverage (0-100) are detected and blocked.
- [ ] Ordering violations (min > max) are detected and blocked.
- [ ] Out-of-range values (< 0 or > 100) are detected and blocked.
- [ ] "Commit Global Policy" is disabled when validation errors exist.
- [ ] Save calls `saveGradingBands` with the draft bands.
- [ ] Server-side validation errors are displayed if the mutation rejects the data.
- [ ] Unsaved changes trigger a navigation warning.
- [ ] Mobile layout matches mockup.

### Admin Bulk Score-Entry Screen

- [ ] Admin can select any Session, Term, Class, and Subject in the school (not filtered by teacher assignment).
- [ ] Grid loads with all students in the selected class.
- [ ] Existing scores are pre-filled.
- [ ] Admin can enter CA1, CA2, CA3, and Exam scores.
- [ ] Inline validation blocks out-of-range values with clear error messages.
- [ ] In `raw40` mode, Exam column shows `/40` with no Scaled column.
- [ ] In `raw60_scaled_to_40` mode, Exam column shows `/60` and Scaled column shows computed `/40`.
- [ ] Total, Grade, and Remark update live as scores are entered.
- [ ] "Commit Batch" calls `upsertAssessmentRecordsBulk`.
- [ ] Partial failure: valid rows save, invalid rows are reported and remain editable.
- [ ] Full success shows confirmation with row count.
- [ ] Unsaved changes trigger a navigation warning.
- [ ] Mobile layout uses swipeable student cards with navigation pills.
- [ ] Desktop layout uses sticky-column table grid.

### General

- [ ] All screens enforce admin-only access (non-admins are redirected).
- [ ] `schoolId` is derived from the admin session, never from the URL.
- [ ] No direct imports between `apps/admin` and `apps/teacher`.
- [ ] `pnpm typecheck` passes with zero errors.
- [ ] All unit and component tests pass.
- [ ] No `any` types introduced.

---

## 13 Test Scenarios

### Scenario 1: Change Exam Mode

```
Given: School currently has raw40 mode
When:  Admin selects "Scaled /60 Entry" and clicks "Commit Settings"
Then:  saveSchoolAssessmentSettings is called with raw60_scaled_to_40
       Success toast appears
       Page reloads with new mode selected
```

### Scenario 2: Save Overlapping Grading Bands

```
Given: Admin edits bands to overlap: A: 80-100, B: 75-85
When:  Validation runs
Then:  Red banner appears: "Bands overlap for Grade A and B"
       "Commit Global Policy" button is disabled
```

### Scenario 3: Save Valid Grading Bands

```
Given: Admin has bands: A(80-100), B(65-79), C(50-64), D(40-49), F(0-39)
When:  Admin clicks "Commit Global Policy"
Then:  saveGradingBands is called with all 5 bands
       Success toast appears
```

### Scenario 4: Admin Overrides Teacher Score

```
Given: Teacher entered ca1=15 for student S1
When:  Admin opens the same sheet and changes ca1 to 18
Then:  updatedBy becomes admin; enteredBy remains teacher
       Total, Grade, Remark recalculate live
```

### Scenario 5: Partial Bulk Save Failure

```
Given: 30 students in grid; student 7 has ca1=25 (invalid)
When:  Admin clicks "Commit Batch"
Then:  29 records save successfully
       Warning banner shows: "1 row skipped: CA1 must be between 0 and 20"
       Student 7 row remains dirty with error border
```

### Scenario 6: Unsaved Changes Warning

```
Given: Admin changes exam mode but does not save
When:  Admin tries to navigate away
Then:  Browser shows "You have unsaved changes" confirmation
```

### Scenario 7: Empty Grading Bands

```
Given: School has no grading bands configured
When:  Admin opens grading-bands screen
Then:  Empty table shown with "Add Tier" prompt
       Save is blocked with error: "At least one grading band is required"
```

### Scenario 8: Mobile Score Entry

```
Given: Admin opens bulk entry on mobile (< 768px)
When:  Grid loads
Then:  Swipeable card layout appears with one student at a time
       "Jump to Student" dropdown at top
       Pagination pills show progress
       "Commit Batch" button at bottom
```

---

## 14 Dependencies and Blockers

### Depends On

- **T04** (Shared Domain and Backend): Convex queries/mutations, shared calculation and validation functions, TypeScript types.
- **T05** (Teacher App Build): Shared grid components that may be extracted to `packages/ui` for reuse.
- `packages/ui`: Base UI primitives (Button, Select, Input, Badge, Toast, Skeleton).
- `packages/auth`: `useSession`, `useSchoolId` hooks.

### Used By

- No downstream tasks in v1.

### Blockers

- If T04 or T05 are incomplete, admin app cannot be fully wired. Build screen shells and mock data first, then integrate when backend is ready.

---

## 15 Verification Checklist

Before marking this task complete, confirm:

- [ ] All three screens render without errors at their routes.
- [ ] Assessment settings screen loads current mode and saves changes.
- [ ] Grading-band screen loads bands, validates on edit, and saves valid configurations.
- [ ] Admin bulk entry screen loads any class-subject sheet and saves scores.
- [ ] Overlapping or incomplete grading bands are blocked on both client and server.
- [ ] Exam mode changes are persisted and reflected in the entry screen.
- [ ] Partial save failures are handled gracefully (valid rows saved, invalid rows reported).
- [ ] Unsaved changes warnings work on all three screens.
- [ ] Mobile layouts match mockups for all three screens.
- [ ] `pnpm typecheck` passes.
- [ ] All tests pass.
- [ ] No `any` types in the codebase.
- [ ] No direct cross-app imports (admin does not import from teacher).

---

## 16 Open Questions

None. This brief is self-contained. If the builder encounters ambiguity, default to:

- Feature spec: `docs/features/ExamRecording.md`
- Coding guidelines: `docs/Coding_Guidelines.md`
- Mockups: `docs/mockups/admin/`
- Teacher app patterns: `docs/tasks/ExamRecording_TeacherAppBuild.md`

---

## 17 Summary

This task delivers the three admin-facing Exam Recording screens: assessment settings, grading-band management, and bulk score-entry. A build agent following this brief should be able to:

1. Create three page routes with server-component shells and client-component interactivity.
2. Implement the assessment settings screen with mode selection, weight display, and save behavior.
3. Implement the grading-band management screen with inline editing, validation, and save behavior.
4. Implement the admin bulk score-entry screen reusing teacher app grid patterns with admin-specific access and labels.
5. Verify correctness via type checking and tests.

The output is a production-ready, mobile-first, school-aware admin interface that consumes the shared backend from T04 and reuses shared UI patterns from T05.

---

*Generated by vibe-spawnTask / vibe-architect workflow*
