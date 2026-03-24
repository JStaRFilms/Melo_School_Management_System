# Exam Recording - Teacher App Build

**Priority:** P1  
**Status:** Ready for Build  
**Dependencies:** Shared packages (`packages/ui`, `packages/domain`), Convex schema, backend queries/mutations  
**Estimated Scope:** 3-5 days

---

## 1. Objective

Implement the teacher-facing bulk exam-entry workflow at `/teacher/assessments/exams/entry` so teachers can select an assigned class-subject sheet, enter CA and exam scores in a roster grid, and see computed totals, grades, and remarks update in real time.

---

## 2. Route Structure

### 2.1 Route Map

```
apps/teacher/app/
  assessments/
    exams/
      page.tsx                 # Redirect to /assessments/exams/entry or show selector summary
      entry/
      page.tsx                 # Main entry page (server component shell)
      components/
        SelectionBar.tsx       # Session/Term/Class/Subject selector
        RosterGrid.tsx         # Bulk score-entry grid
        RosterGridRow.tsx      # Single student row
        ScoreInput.tsx         # Controlled number input with validation
        ComputedColumns.tsx    # Exam Contribution, Total, Grade, Remark display
        SaveActionBar.tsx      # Mobile bottom bar + desktop floating action
        LoadingSkeleton.tsx    # Shimmer skeleton for loading state
        EmptyRoster.tsx        # Empty state when no sheet selected
        ValidationErrorBanner.tsx  # Inline validation error display
      layout.tsx               # Exam section layout with compact nav
```

### 2.2 Route Rules

- The entry page is a **server component** that renders the `SelectionBar` and conditionally the `RosterGrid`.
- The `RosterGrid` and all interactive children are **client components** (`'use client'`).
- Route params: `sessionId`, `termId`, `classId`, `subjectId` via query string (not path segments) so the selector can update without full page navigation.
- If any selector value is missing, render `EmptyRoster` state.

---

## 3. Selection Flow

### 3.1 Component: `SelectionBar`

**Location:** `apps/teacher/app/assessments/exams/entry/components/SelectionBar.tsx`

**Behavior:**

1. Render four dropdown selectors: Session, Term, Class, Subject.
2. Each dropdown fetches its options from teacher-scoped queries:
   - `getSessions` (filtered by `schoolId`)
   - `getTermsBySession` (filtered by `sessionId`)
   - `getTeacherAssignableClasses` (filtered by teacher + `schoolId`)
   - `getTeacherAssignableSubjectsByClass` (filtered by teacher + `classId`)
3. On change, update the URL query string via `router.replace()`.
4. Disable downstream selectors until upstream is selected (Term disabled until Session chosen, etc.).
5. On mobile, selectors stack vertically. On desktop, they sit in a single row.

**State Management:**

```typescript
interface SelectionState {
  sessionId: Id<"academicSessions"> | null;
  termId: Id<"academicTerms"> | null;
  classId: Id<"classes"> | null;
  subjectId: Id<"subjects"> | null;
}
```

- Initialize from `useSearchParams()`.
- Derive `isSheetReady` when all four values are non-null.

### 3.2 Auth Gate

- Before rendering selectors, constrain class and subject options to the teacher's assignments.
- If the teacher is not assigned, show an access-denied state (not an error -- just "You are not assigned to this class-subject").
- The `schoolId` is derived from the authenticated user session, not from the URL.

---

## 4. Roster Grid UI

### 4.1 Component: `RosterGrid`

**Location:** `apps/teacher/app/assessments/exams/entry/components/RosterGrid.tsx`

**Data Loading:**

- Call `getExamEntrySheet` with `{ sessionId, termId, classId, subjectId }`.
- The query returns:
  - `roster`: array of `{ studentId, studentName, assessmentRecord }`
  - `settings`: `{ examInputMode, ca1Max, ca2Max, ca3Max, examContributionMax }`
  - `gradingBands`: array of active grading bands

If the UI prefers a `studentId -> assessmentRecord` map, derive it client-side from `roster`.

**Layout:**

- Desktop: full `<table>` with sticky student column (first column pinned on horizontal scroll).
- Mobile: card-based layout (one card per student, scrollable vertically).
- Match mockup styling: `roster-grid-wrapper`, `sticky-column`, `score-input` classes.

### 4.2 Component: `RosterGridRow`

**Location:** `apps/teacher/app/assessments/exams/entry/components/RosterGridRow.tsx`

**Props:**

```typescript
interface RosterGridRowProps {
  student: StudentRosterEntry;
  existingScore: AssessmentRecord | null;
  examInputMode: "raw40" | "raw60_scaled_to_40";
  gradingBands: GradingBand[];
  onScoreChange: (studentId: Id<"students">, field: ScoreField, value: number | null) => void;
}
```

**Renders:**

- Student avatar (initials), name, registration number.
- Four `ScoreInput` components: CA1, CA2, CA3, Exam.
- `ComputedColumns` for derived values.

### 4.3 Component: `ScoreInput`

**Location:** `apps/teacher/app/assessments/exams/entry/components/ScoreInput.tsx`

**Props:**

```typescript
interface ScoreInputProps {
  field: "ca1" | "ca2" | "ca3" | "examRawScore";
  value: number | null;
  max: number;
  onChange: (value: number | null) => void;
  isExamField?: boolean;
  validationError?: string | null;
}
```

**Behavior:**

- Render `<input type="number">` with `min={0}`, `max={max}`, `step="1"`.
- On `onChange`, parse to number. If `NaN` or empty, set to `null` (allows incomplete rows).
- Show visual error state (red border) when `validationError` is present.
- Exam field gets amber-tinted background (`bg-amber-50/20 border-amber-200`).
- All other CA fields use default styling.

---

## 5. Inline Validation

### 5.1 Validation Rules (Client-Side)

| Field | Rule | Error Message |
| :--- | :--- | :--- |
| `ca1` | `0 <= value <= 20` | "CA1 must be between 0 and 20" |
| `ca2` | `0 <= value <= 20` | "CA2 must be between 0 and 20" |
| `ca3` | `0 <= value <= 20` | "CA3 must be between 0 and 20" |
| `examRawScore` (raw40) | `0 <= value <= 40` | "Exam must be between 0 and 40" |
| `examRawScore` (raw60) | `0 <= value <= 60` | "Exam must be between 0 and 60" |

### 5.2 Validation Implementation

- Create a `useValidation` hook or inline validator function.
- Validate on blur AND on save.
- Track `validationErrors` as a `Map<studentId, Partial<Record<ScoreField, string>>>`.
- Invalid inputs get a red border and a tooltip/error message below the input.
- The save button is disabled when any validation errors exist.
- Show `ValidationErrorBanner` summarizing all errors at the top of the grid.

### 5.3 Empty Row Handling

- Rows where all four scores are `null` are considered "incomplete" but not invalid.
- Incomplete rows are skipped during save (no record created).
- The grid shows a subtle indicator for incomplete rows (e.g., muted text in the student name).

---

## 6. Exam Mode Rendering

### 6.1 Mode Detection

- Read `examInputMode` from `settings` returned by `getExamEntrySheet`.
- Store in a `useExamMode` context or pass as prop through the grid.

### 6.2 `raw40` Mode

- Exam column header: `Exam /40`
- Exam input max: `40`
- No "Scaled" column displayed.
- `examScaledScore = examRawScore` (identity).

### 6.3 `raw60_scaled_to_40` Mode

- Exam column header: `Exam /60`
- Exam input max: `60`
- Additional read-only column: `Scaled /40`
- Formula: `examScaledScore = round((examRawScore / 60) * 40, 2)`
- The scaled value updates live as the teacher types in the exam field.

### 6.4 Mode Indicator Badge

- Display a badge near the grid header:
  - raw40: `Active Rule: ExamRawMode=raw40` (indigo badge)
  - raw60: `Active Rule: ExamRawMode=raw60_scaled_to_40` (amber badge)

---

## 7. Computed Columns

### 7.1 Component: `ComputedColumns`

**Location:** `apps/teacher/app/assessments/exams/entry/components/ComputedColumns.tsx`

**Props:**

```typescript
interface ComputedColumnsProps {
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  examScaledScore: number | null;
  total: number | null;
  gradeLetter: string | null;
  remark: string | null;
  examInputMode: "raw40" | "raw60_scaled_to_40";
  showScaledColumn: boolean;
}
```

### 7.2 Computation Logic

Reuse the shared pure calculation module produced by the shared/backend slice. Prefer `packages/domain/examCalculations.ts`; if the backend task initially places pure logic in Convex-only files, extract the pure functions into `packages/domain` and have both the teacher app and backend import the same implementation:

```typescript
export function computeExamScaledScore(
  examRawScore: number,
  examInputMode: "raw40" | "raw60_scaled_to_40"
): number {
  if (examInputMode === "raw40") return examRawScore;
  return round((examRawScore / 60) * 40, 2);
}

export function computeTotal(
  ca1: number,
  ca2: number,
  ca3: number,
  examScaledScore: number
): number {
  return round(ca1 + ca2 + ca3 + examScaledScore, 2);
}

export function deriveGradeAndRemark(
  total: number,
  gradingBands: GradingBand[]
): { gradeLetter: string; remark: string } | null {
  const band = gradingBands.find(
    (b) => total >= b.minScore && total <= b.maxScore
  );
  if (!band) return null;
  return { gradeLetter: band.gradeLetter, remark: band.remark };
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
```

### 7.3 Display

| Column | Type | Style |
| :--- | :--- | :--- |
| Scaled /40 | Read-only | `bg-indigo-50/20`, small font, shown only in raw60 mode |
| Total /100 | Read-only | Large bold font, `text-obsidian-950` |
| Grade | Read-only | Bold, color-coded (A=emerald, B=blue, etc.) |
| Remark | Read-only | Small uppercase editorial text, `text-obsidian-400` |

### 7.4 Live Recalculation

- All computed values recalculate on every keystroke (no debounce needed -- pure functions are fast).
- Keep the computation logic pure and cheap; only memoize at row level if the repo pattern already uses it or profiling shows rerender issues.

---

## 8. Save/Update Behavior

### 8.1 Local State Management

- Maintain `draftScores` as a `Map<studentId, Partial<AssessmentRecord>>`.
- On input change, update `draftScores` and mark the row as "dirty".
- Track `hasUnsavedChanges` boolean.

### 8.2 Save Action

**Component:** `SaveActionBar`

- Mobile: fixed bottom bar with "Save Changes" / "Sync All" button.
- Desktop: floating action bar (bottom-right) with "Cancel" and "Finalize Sheet" buttons.
- Button is disabled when:
  - No unsaved changes.
  - Any validation errors exist.
- On click:
  1. Final validation pass.
  2. If errors: show `ValidationErrorBanner`, scroll to first error.
  3. If clean: call `upsertAssessmentRecordsBulk` mutation.

### 8.3 Mutation Call

```typescript
await upsertAssessmentRecordsBulk({
  sessionId,
  termId,
  classId,
  subjectId,
  records: Array.from(draftScores.entries())
    .filter(([, scores]) =>
      scores.ca1 != null &&
      scores.ca2 != null &&
      scores.ca3 != null &&
      scores.examRawScore != null
    )
    .map(([studentId, scores]) => ({
      studentId,
      ca1: scores.ca1!,
      ca2: scores.ca2!,
      ca3: scores.ca3!,
      examRawScore: scores.examRawScore!,
    })),
});
```

### 8.4 Save Feedback

- On full success: show success toast/banner matching State 03 mockup.
  - "Changes Synced Successfully"
  - "All N valid student records have been updated."
- On partial success: show warning/error banner summarizing skipped rows returned by the mutation and keep those rows dirty for correction.
- On full failure: show error banner with retry option.
- Do not mark every row as saved optimistically; reconcile row state from the mutation response so skipped invalid rows remain editable.

### 8.5 Unsaved Changes Warning

- Use `beforeunload` event to warn on page close with unsaved changes.
- On selector change (new sheet loaded), prompt to discard unsaved changes.

---

## 9. Loading and Empty States

### 9.1 Loading State

**Component:** `LoadingSkeleton`

- Rendered while `getExamEntrySheet` is loading.
- Matches State 01 mockup: shimmer skeleton rows with:
  - Circle placeholder for avatar
  - Rectangular placeholders for name and scores
  - Animated gradient shimmer effect

### 9.2 Empty Roster State

**Component:** `EmptyRoster`

- Rendered when:
  - No sheet selected (all selectors not yet chosen).
  - Sheet selected but roster is empty (no students in class).
- Matches State 02 mockup:
  - Icon: `users-round`
  - Heading: "No Students Selected"
  - Subtext: "Please choose a Session, Term, Class, and Subject above to load the student roster and begin recording scores."
  - Retry button if load failed.

### 9.3 Access Denied State

- Rendered when teacher is not assigned to the selected class-subject.
- Simple message: "You are not assigned to this class-subject."
- No retry button -- teacher must select a different class-subject.

### 9.4 Error State

- Rendered on query failure.
- Generic error message with retry button.

---

## 10. Shared Package Reuse

### 10.1 Required Shared Modules

| Package | Module | Usage |
| :--- | :--- | :--- |
| `packages/ui` | `Button`, `Select`, `Input`, `Badge`, `Toast`, `Skeleton` | Base UI primitives |
| `packages/ui` | `DataTable`, `StickyColumn` | Grid layout helpers |
| `packages/domain` | `examCalculations.ts` | Shared score computation functions reused by app and backend |
| `packages/domain` | `validation.ts` | Shared score range validators reused by app and backend |
| `packages/domain` | `types.ts` | `AssessmentRecord`, `GradingBand`, `SchoolSettings`, `StudentRosterEntry` |
| `packages/auth` | `useSession`, `useSchoolId` | Auth context and school scoping |

### 10.2 Import Rules

- NEVER import from `apps/admin` directly.
- All shared logic lives in `packages/*`.
- Feature-specific logic lives in `apps/teacher/app/assessments/exams/entry/`.

---

## 11. Mobile-First Behavior

### 11.1 Breakpoints

- Default (< 768px): card-based student list, stacked selectors, bottom action bar.
- Tablet/Desktop (>= 768px): full table grid, horizontal selectors, floating action bar.

### 11.2 Touch Targets

- All inputs have minimum 44px touch target height.
- Score inputs are full-width on mobile card layout.
- Action buttons are full-width on mobile.

### 11.3 Sticky Column

- On desktop, the student name column is sticky (pinned left) during horizontal scroll.
- On mobile, sticky column is not needed (card layout).

### 11.4 Scroll Behavior

- On validation error, scroll to the first invalid input.
- On save success, scroll to top and show success banner.

---

## 12. Tests

### 12.1 Unit Tests

**File:** `packages/domain/__tests__/examCalculations.test.ts`

| Test Case | Input | Expected |
| :--- | :--- | :--- |
| raw40 mode: scaled equals raw | `examRaw=34, mode=raw40` | `scaled=34` |
| raw60 mode: scaled is rounded | `examRaw=54, mode=raw60_scaled_to_40` | `scaled=36.00` |
| raw60 mode: max input | `examRaw=60, mode=raw60_scaled_to_40` | `scaled=40.00` |
| raw60 mode: zero input | `examRaw=0, mode=raw60_scaled_to_40` | `scaled=0.00` |
| total computation | `ca1=18, ca2=15, ca3=19, examScaled=34` | `total=86.00` |
| grade derivation: A band | `total=86, bands=[{min:80,max:100,grade:"A"}]` | `{grade:"A",remark:"Excellent"}` |
| grade derivation: boundary | `total=80, bands=[{min:80,max:100,grade:"A"}]` | `{grade:"A",remark:"Excellent"}` |
| grade derivation: no band | `total=80, bands=[{min:90,max:100,grade:"A"}]` | `null` |

**File:** `packages/domain/__tests__/validation.test.ts`

| Test Case | Input | Expected |
| :--- | :--- | :--- |
| valid ca1 | `ca1=18` | `null` (no error) |
| ca1 below range | `ca1=-1` | `"CA1 must be between 0 and 20"` |
| ca1 above range | `ca1=21` | `"CA1 must be between 0 and 20"` |
| valid exam raw40 | `exam=34, mode=raw40` | `null` |
| exam raw40 above range | `exam=41, mode=raw40` | `"Exam must be between 0 and 40"` |
| valid exam raw60 | `exam=54, mode=raw60` | `null` |
| exam raw60 above range | `exam=61, mode=raw60` | `"Exam must be between 0 and 60"` |
| null value (incomplete) | `ca1=null` | `null` (not invalid, just incomplete) |

### 12.2 Component Tests

**File:** `apps/teacher/app/assessments/exams/entry/__tests__/RosterGrid.test.tsx`

| Test Case | Description |
| :--- | :--- |
| renders correct number of rows | Grid shows one row per student in roster |
| displays existing scores | Pre-filled scores from `roster[].assessmentRecord` appear in inputs |
| raw40 mode: no scaled column | Only 7 columns visible (Student, CA1-3, Exam, Total, Grade, Remark) |
| raw60 mode: scaled column visible | 8 columns visible (adds Scaled /40) |
| score change updates computed values | Changing CA1 updates Total, Grade, Remark |
| validation error shows on invalid input | Entering 25 in CA1 shows error border and message |
| save button disabled when no changes | Initially, save button is disabled |
| save button enabled when changes exist | After editing, save button becomes enabled |

### 12.3 Integration Tests

**File:** `apps/teacher/app/assessments/exams/entry/__tests__/ExamEntryFlow.test.tsx`

| Test Case | Description |
| :--- | :--- |
| full selection to save flow | Select all 4 selectors -> grid loads -> enter scores -> save succeeds |
| selector change discards draft | With unsaved changes, changing selector prompts confirmation |
| access denied for unassigned class | Selecting a class-subject the teacher is not assigned to shows access denied |

---

## 13. Acceptance Criteria Checklist

Build is complete when ALL of the following are true:

- [ ] Teacher can select Session, Term, Class, Subject in sequence.
- [ ] Grid loads with all students in the selected class for the selected subject.
- [ ] Existing scores are pre-filled in the grid.
- [ ] Teacher can enter CA1, CA2, CA3, and Exam scores.
- [ ] Inline validation blocks out-of-range values with clear error messages.
- [ ] In `raw40` mode, Exam column shows `/40` and no Scaled column.
- [ ] In `raw60_scaled_to_40` mode, Exam column shows `/60` and Scaled column shows computed `/40` value.
- [ ] Total, Grade, and Remark update live as scores are entered.
- [ ] Save button is disabled when no changes or when validation errors exist.
- [ ] Save calls `upsertAssessmentRecordsBulk` and shows success feedback.
- [ ] Loading state shows shimmer skeleton while data loads.
- [ ] Empty state shows when no sheet is selected.
- [ ] Mobile layout uses card-based student list.
- [ ] Desktop layout uses sticky-column table grid.
- [ ] All unit tests pass.
- [ ] All component tests pass.
- [ ] `pnpm typecheck` passes with no errors.

---

## 14. Verification Commands

```bash
# Type check
pnpm typecheck

# Unit tests
pnpm test -- --grep "examCalculations"
pnpm test -- --grep "validation"

# Component tests
pnpm test -- --grep "RosterGrid"
pnpm test -- --grep "ExamEntryFlow"

# Full test suite
pnpm test

# E2E (before marking release ready)
pnpm test:e2e
```

---

## 15. Notes

- The `/60` scaled contribution display is a READ-ONLY computed column, not an editable field.
- Score-entry states (empty, partial, complete, invalid) must all be visually distinct.
- The teacher app does NOT manage grading bands or assessment settings -- those are admin-only.
- Audit fields (`enteredBy`, `updatedBy`, `createdAt`, `updatedAt`) are set server-side by the mutation, not by the client.
- The `status` field is hardcoded to `"draft"` in v1 -- no moderation UI needed.
