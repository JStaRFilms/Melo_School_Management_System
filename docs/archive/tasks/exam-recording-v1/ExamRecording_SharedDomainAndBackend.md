# Task Brief: Exam Recording v1 — Shared Domain and Backend

**Task ID:** T04
**Priority:** High
**Mode:** vibe-code (execute only; no UI work)
**Source FRs:** FR-006 (Assessment and Grading Engine), FR-007 (Results Entry and Moderation)
**Feature Spec:** `docs/features/ExamRecording.md`
**Coding Guidelines:** `docs/Coding_Guidelines.md`
**Backend Decisions:** ADR-004 (Tenancy), ADR-006 (Convex Backend)

---

## 1 Objective

Implement the shared domain layer and Convex backend for Exam Recording v1. The deliverable is a fully functional, school-aware, auditable backend that supports bulk exam score entry, automatic calculation of totals/grades/remarks, school assessment settings management, grading band management, and role-based authorization — with no frontend code.

---

## 2 Scope

### In Scope

| Area | Details |
|------|---------|
| Shared types | TypeScript types and Zod validators for all exam-recording domain objects |
| School assessment settings | CRUD for per-school exam input mode (`raw40` or `raw60_scaled_to_40`) |
| Grading bands | CRUD for school-scoped grading bands with overlap and coverage validation |
| Assessment records | Schema, indexes, and storage for per-student-per-subject score rows |
| Calculation and scaling | CA total, exam scaling (`/60 -> /40`), total, grade derivation, remark derivation |
| Bulk roster fetch | Query to load class roster + existing scores + settings + bands in one call |
| Bulk upsert mutation | Upsert multiple assessment records with audit fields and row-level error reporting |
| Teacher assignment authorization | Verify teacher is assigned to the class-subject before allowing writes |
| Admin override authorization | Verify admin belongs to the school and can edit any sheet |
| School boundary enforcement | Every query and mutation filtered by `schoolId`; no cross-school leakage |
| Unit tests | Calculation logic, validation logic, authorization guards |

### Out of Scope

- Teacher app UI, components, pages
- Admin app UI, components, pages
- Ranking, positions, CGPA, report cards
- Moderation workflow beyond `"draft"` status
- Student-by-student entry views

---

## 3 Context and Assumptions

### 3.1 Tech Stack

- **Backend:** Single Convex deployment (ADR-006)
- **Type Safety:** TypeScript with explicit types; no `any`
- **Validation:** Zod schemas for all function inputs
- **Package Manager:** pnpm workspaces + Turborepo
- **Convex Organization:** Domain-based directories under `convex/functions/academic/`

### 3.2 Tenancy Model (ADR-004)

- Every table includes `schoolId` as a partition key
- Convex functions extract `schoolId` from authenticated user session
- All queries use indexes scoped to `schoolId`
- No function may return data from another school

### 3.3 Data Sources

The following existing tables are assumed to exist (from prior FRs):

| Table | Key Fields |
|-------|------------|
| `users` | `_id`, `schoolId`, `role` |
| `students` | `_id`, `schoolId`, `classId` |
| `classes` | `_id`, `schoolId` |
| `subjects` | `_id`, `schoolId` |
| `teacherAssignments` | `_id`, `schoolId`, `teacherId`, `classId`, `subjectId` |
| `academicSessions` | `_id`, `schoolId` |
| `academicTerms` | `_id`, `schoolId`, `sessionId` |

If any of these tables do not yet exist, create minimal stub schemas so the exam-recording functions compile. Document the stubs.

---

## 4 Data Model Specifications

### 4.1 `schoolAssessmentSettings`

```
Table: schoolAssessmentSettings

Fields:
  schoolId              Id<"schools">          — required, tenant boundary
  examInputMode         "raw40" | "raw60_scaled_to_40"   — required
  ca1Max                number                 — default 20, must equal 20 in v1
  ca2Max                number                 — default 20, must equal 20 in v1
  ca3Max                number                 — default 20, must equal 20 in v1
  examContributionMax   number                 — default 40, must equal 40 in v1
  isActive              boolean                — default true; single active record per school in v1
  createdAt             number                 — ctx.db.normalizeTimestamp(Date.now())
  updatedAt             number                 — updated on every mutation
  updatedBy             Id<"users">            — user who last modified

Indexes:
  by_school     → [schoolId]
  by_school_active → [schoolId, isActive]
```

**Business Rules:**
- Exactly one active settings row per school in v1.
- `ca1Max`, `ca2Max`, `ca3Max` must equal `20`. `examContributionMax` must equal `40`. These are validated on write but not exposed as configurable in v1 — they are stored for forward-compatibility and audit snapshots.
- `examInputMode` determines how `examRawScore` is interpreted.

### 4.2 `gradingBands`

```
Table: gradingBands

Fields:
  schoolId      Id<"schools">       — required, tenant boundary
  minScore      number              — lower inclusive bound (0-100)
  maxScore      number              — upper inclusive bound (0-100)
  gradeLetter   string              — e.g. "A", "B", "C", "D", "E", "F"
  remark        string              — e.g. "Excellent", "Very Good", "Good"
  isActive      boolean             — default true
  createdAt     number              — timestamp
  updatedAt     number              — timestamp
  updatedBy     Id<"users">         — user who last modified

Indexes:
  by_school         → [schoolId]
  by_school_active  → [schoolId, isActive]
```

**Business Rules:**
- Bands are school-scoped.
- Active bands must not overlap: for any two active bands A and B in the same school, the ranges `[A.minScore, A.maxScore]` and `[B.minScore, B.maxScore]` must not intersect.
- Active bands must cover the full range `0` to `100` with no gaps.
- `minScore <= maxScore` must hold.
- Each score `0-100` must map to exactly one active band.
- Validation runs on `saveGradingBands` (bulk replace).

### 4.3 `assessmentRecords`

```
Table: assessmentRecords

Fields:
  schoolId                Id<"schools">         — required, tenant boundary
  sessionId               Id<"academicSessions"> — required
  termId                  Id<"academicTerms">    — required
  classId                 Id<"classes">          — required
  subjectId               Id<"subjects">         — required
  studentId               Id<"students">         — required
  ca1                     number                 — 0-20, raw score
  ca2                     number                 — 0-20, raw score
  ca3                     number                 — 0-20, raw score
  examRawScore            number                 — raw entered value (0-40 or 0-60 depending on mode)
  examScaledScore         number                 — derived: exam contribution out of 40, rounded to 2 decimals
  total                   number                 — derived: ca1+ca2+ca3+examScaledScore, rounded to 2 decimals
  gradeLetter             string                 — derived from grading band lookup
  remark                  string                 — derived from grading band lookup
  examInputModeSnapshot   string                 — snapshot of school mode at save time ("raw40" or "raw60_scaled_to_40")
  examRawMaxSnapshot      number                 — 40 or 60 at save time
  status                  "draft"                — fixed to "draft" in v1; forward-compatible placeholder
  enteredBy               Id<"users">            — user who first created the row
  updatedBy               Id<"users">            — user who last updated the row
  createdAt               number                 — timestamp
  updatedAt               number                 — timestamp

Indexes:
  by_sheet → [schoolId, sessionId, termId, classId, subjectId]
  by_student_sheet → [schoolId, sessionId, termId, classId, subjectId, studentId]
```

**Business Rules:**
- Composite uniqueness: `(schoolId, sessionId, termId, classId, subjectId, studentId)` identifies one record.
- `examScaledScore`, `total`, `gradeLetter`, `remark` are derived at write time and stored. They are NOT recalculated on read.
- `examInputModeSnapshot` and `examRawMaxSnapshot` are captured from the active school settings at the moment of save. This ensures historical records remain correct even if the school later changes its exam mode.
- `enteredBy` is set on first insert and never overwritten.
- `updatedBy` and `updatedAt` are set on every mutation.
- `status` is always `"draft"` in v1. Future moderation states (`submitted`, `approved`, `published`) will be introduced without schema changes.

---

## 5 Calculation Rules (Pure Functions)

All calculation logic must be implemented as pure functions in a shared module (e.g., `convex/functions/academic/calculations.ts`) so they are testable without a database.

### 5.1 CA Total

```
caTotal(ca1, ca2, ca3) => ca1 + ca2 + ca3
```

### 5.2 Exam Scaled Score

```
examScaledScore(examRawScore, examInputMode) => number

If examInputMode === "raw40":
  result = examRawScore

If examInputMode === "raw60_scaled_to_40":
  result = round((examRawScore / 60) * 40, 2)

round(value, decimals) = Math.round(value * 10^decimals) / 10^decimals
```

### 5.3 Total

```
total(ca1, ca2, ca3, examScaledScore) =>
  round(ca1 + ca2 + ca3 + examScaledScore, 2)
```

### 5.4 Grade and Remark Lookup

```
deriveGradeAndRemark(totalScore, activeBands: GradingBand[]) => { gradeLetter, remark }

Find band where band.minScore <= totalScore <= band.maxScore
Return { gradeLetter: band.gradeLetter, remark: band.remark }

If no band matches, throw error — this should never happen if bands cover 0-100.
```

### 5.5 Full Derivation

```
deriveAssessmentFields(
  ca1, ca2, ca3, examRawScore,
  examInputMode,
  activeBands
) => {
  caTotal, examScaledScore, total, gradeLetter, remark
}
```

---

## 6 Validation Rules

### 6.1 Score Validation (on upsert)

| Field | Rule | Error Message |
|-------|------|---------------|
| `ca1` | `0 <= ca1 <= 20` | "CA1 must be between 0 and 20" |
| `ca2` | `0 <= ca2 <= 20` | "CA2 must be between 0 and 20" |
| `ca3` | `0 <= ca3 <= 20` | "CA3 must be between 0 and 20" |
| `examRawScore` (mode=raw40) | `0 <= examRawScore <= 40` | "Exam score must be between 0 and 40" |
| `examRawScore` (mode=raw60_scaled_to_40) | `0 <= examRawScore <= 60` | "Exam score must be between 0 and 60" |

### 6.2 Grading Band Validation (on saveGradingBands)

1. `minScore <= maxScore` for every band.
2. `minScore >= 0` and `maxScore <= 100`.
3. No overlap between active bands: for all pairs (A, B) where A != B, either `A.maxScore < B.minScore` or `B.maxScore < A.minScore`.
4. Full coverage: sorted active bands must start at `minScore = 0`, end at `maxScore = 100`, and each band's `minScore` equals the previous band's `maxScore + 1` (or `0` for the first).
5. At least one band must be provided.

### 6.3 Access Validation (on every function)

| Check | Implementation |
|-------|----------------|
| User is authenticated | `ctx.auth.getUserIdentity()` returns non-null |
| User belongs to school | Lookup membership record; extract `schoolId` |
| Teacher assignment | For teacher role: verify `teacherAssignments` row exists for `(teacherId, classId, subjectId)` |
| Admin scope | For admin role: verify `user.schoolId === targetSchoolId` |
| School boundary | All queries use `.withIndex("by_school", q => q.eq("schoolId", schoolId))` |

---

## 7 Convex Functions

### 7.1 Queries

#### `getSchoolAssessmentSettings`

```
Args: { schoolId: Id<"schools"> }
Returns: SchoolAssessmentSettings | null

Authorization: authenticated user belonging to the school.
Logic: Query schoolAssessmentSettings by (schoolId, isActive=true). Return first match or null.
```

#### `getActiveGradingBands`

```
Args: { schoolId: Id<"schools"> }
Returns: GradingBand[]

Authorization: authenticated user belonging to the school.
Logic: Query gradingBands by (schoolId, isActive=true). Return sorted by minScore ascending.
```

#### `getExamEntrySheet`

```
Args: {
  sessionId: Id<"academicSessions">,
  termId: Id<"academicTerms">,
  classId: Id<"classes">,
  subjectId: Id<"subjects">
}
Returns: {
  roster: Array<{
    studentId: Id<"students">,
    studentName: string,
    assessmentRecord: AssessmentRecord | null
  }>,
  settings: SchoolAssessmentSettings,
  gradingBands: GradingBand[]
}

Authorization:
  - Teacher: must have assignment for (classId, subjectId) in their school.
  - Admin: must belong to the school that owns classId.

Logic:
  1. Extract schoolId from user session.
  2. Fetch school assessment settings (active).
  3. Fetch active grading bands.
  4. Query students by schoolId + classId (roster).
  5. Bulk-fetch existing assessmentRecords by (schoolId, sessionId, termId, classId, subjectId).
  6. Left-join roster with existing records by studentId.
  7. Return combined payload.
```

### 7.2 Mutations

#### `saveSchoolAssessmentSettings`

```
Args: {
  examInputMode: "raw40" | "raw60_scaled_to_40"
}
Returns: Id<"schoolAssessmentSettings">

Authorization: admin role only; user must belong to the target school.

Logic:
  1. Extract schoolId from user session.
  2. Deactivate all existing active settings for this school (set isActive=false, updatedAt=now).
  3. Insert new row with ca1Max=20, ca2Max=20, ca3Max=20, examContributionMax=40, isActive=true.
  4. Set createdAt, updatedAt, updatedBy.
  5. Return new document id.
```

#### `saveGradingBands`

```
Args: {
  bands: Array<{
    minScore: number,
    maxScore: number,
    gradeLetter: string,
    remark: string
  }>
}
Returns: Id<"gradingBands">[]

Authorization: admin role only; user must belong to the target school.

Logic:
  1. Extract schoolId from user session.
  2. Validate input bands (see section 6.2).
  3. If validation fails, throw structured error with field-level messages.
  4. Deactivate all existing active bands for this school.
  5. Insert new bands with isActive=true, timestamps, updatedBy.
  6. Return array of new document ids.
```

#### `upsertAssessmentRecordsBulk`

```
Args: {
  sessionId: Id<"academicSessions">,
  termId: Id<"academicTerms">,
  classId: Id<"classes">,
  subjectId: Id<"subjects">,
  records: Array<{
    studentId: Id<"students">,
    ca1: number,
    ca2: number,
    ca3: number,
    examRawScore: number
  }>
}
Returns: {
  updated: number,
  created: number,
  errors: Array<{
    studentId: Id<"students">,
    field: "ca1" | "ca2" | "ca3" | "examRawScore" | "record",
    message: string
  }>
}

Authorization:
  - Teacher: must have assignment for (classId, subjectId).
  - Admin: must belong to the school.

Logic:
  1. Extract schoolId from user session.
  2. Fetch active school assessment settings (examInputMode).
  3. Fetch active grading bands.
  4. For each record in `records`:
     a. Validate score ranges (section 6.1). Collect errors per student; do not abort early.
     b. If the row has validation errors, skip persistence for that row and continue processing the rest.
     c. Compute derived fields via `deriveAssessmentFields()` for valid rows only.
     d. Look up existing record by (schoolId, sessionId, termId, classId, subjectId, studentId).
     e. If exists: patch (ca1, ca2, ca3, examRawScore, examScaledScore, total, gradeLetter, remark, updatedBy, updatedAt). Preserve enteredBy and createdAt.
     f. If not exists: insert with enteredBy=currentUser, createdAt=updatedAt=now, status="draft", examInputModeSnapshot, examRawMaxSnapshot.
  5. Return counts of updated and created records plus the collected row-level errors.
```

---

## 8 Authorization Helpers

Create a shared authorization module at `convex/functions/academic/auth.ts`:

```typescript
// getAuthenticatedSchoolMembership(ctx) => { userId, schoolId, role }
//   - Throws "Unauthorized" if not authenticated.
//   - Throws "School membership not found" if user has no school.

// assertTeacherAssignment(ctx, teacherId, classId, subjectId) => void
//   - Throws "Not assigned to this class-subject" if no matching teacherAssignments row.

// assertAdminForSchool(ctx, schoolId) => void
//   - Throws "Admin access required" if user role is not admin.
//   - Throws "Cross-school access denied" if user.schoolId !== schoolId.

// assertSchoolBoundary(ctx, schoolId) => void
//   - Throws "Cross-school access denied" if user.schoolId !== schoolId.
```

Every public Convex function must call the appropriate auth helper before any database operation.

---

## 9 File Structure

```
convex/
  schema.ts                              ← add new tables here (or in a separate schema file if convention exists)
  functions/
    academic/
      schema.ts                          ← (optional) exam-specific schema definitions if split
      calculations.ts                    ← pure functions: deriveAssessmentFields, examScaledScore, etc.
      validation.ts                      ← validateScoreRanges, validateGradingBands, etc.
      auth.ts                            ← authorization helpers
      settings.ts                        ← getSchoolAssessmentSettings, saveSchoolAssessmentSettings
      gradingBands.ts                    ← getActiveGradingBands, saveGradingBands
      assessmentRecords.ts               ← getExamEntrySheet, upsertAssessmentRecordsBulk
      __tests__/
        calculations.test.ts             ← unit tests for pure calculation functions
        validation.test.ts               ← unit tests for validation logic
        auth.test.ts                     ← unit tests for authorization helpers (mocked ctx)
```

---

## 10 Implementation Phases

### Phase 1: Schema and Types

- [ ] Add `schoolAssessmentSettings` table to Convex schema with fields and indexes as specified in section 4.1.
- [ ] Add `gradingBands` table to Convex schema with fields and indexes as specified in section 4.2.
- [ ] Add `assessmentRecords` table to Convex schema with fields and indexes as specified in section 4.3.
- [ ] Define Zod validators for all function inputs (settings, grading bands, upsert records).
- [ ] Define TypeScript types for all domain objects.
- [ ] If prerequisite tables (students, classes, subjects, teacherAssignments, academicSessions, academicTerms) do not exist, create minimal stub schemas and document them.

### Phase 2: Calculation and Validation Logic

- [ ] Implement `convex/functions/academic/calculations.ts` with pure functions: `caTotal`, `examScaledScore`, `total`, `deriveGradeAndRemark`, `deriveAssessmentFields`.
- [ ] Implement `convex/functions/academic/validation.ts` with functions: `validateScoreRanges`, `validateGradingBands` (overlap, coverage, ordering).
- [ ] Write unit tests in `__tests__/calculations.test.ts` covering:
  - raw40 mode: exam scaled score equals raw score.
  - raw60_scaled_to_40 mode: 30 -> 20.00, 45 -> 30.00, 0 -> 0.00, 60 -> 40.00.
  - Rounding to 2 decimals: 33.333 -> 33.33, 33.335 -> 33.34.
  - Total computation with known inputs.
  - Grade derivation with sample bands.
  - Edge: total exactly on band boundary.
- [ ] Write unit tests in `__tests__/validation.test.ts` covering:
  - Valid score ranges pass.
  - Out-of-range scores fail with correct messages.
  - Overlapping bands rejected.
  - Gaps in bands rejected.
  - Valid full-coverage bands accepted.

### Phase 3: Authorization

- [ ] Implement `convex/functions/academic/auth.ts` with helpers: `getAuthenticatedSchoolMembership`, `assertTeacherAssignment`, `assertAdminForSchool`, `assertSchoolBoundary`.
- [ ] Write unit tests in `__tests__/auth.test.ts` with mocked `ctx.auth` and `ctx.db`.

### Phase 4: Queries

- [ ] Implement `getSchoolAssessmentSettings` query in `settings.ts`.
- [ ] Implement `getActiveGradingBands` query in `gradingBands.ts`.
- [ ] Implement `getExamEntrySheet` query in `assessmentRecords.ts` with roster join.

### Phase 5: Mutations

- [ ] Implement `saveSchoolAssessmentSettings` mutation in `settings.ts`.
- [ ] Implement `saveGradingBands` mutation in `gradingBands.ts` with bulk validation and deactivation of prior bands.
- [ ] Implement `upsertAssessmentRecordsBulk` mutation in `assessmentRecords.ts` with per-row validation, derivation, and audit field management.

### Phase 6: Integration Verification

- [ ] Run `pnpm typecheck` and ensure zero errors.
- [ ] Run unit tests and ensure all pass.
- [ ] Manually verify (or write integration test) that:
  - A teacher assigned to class-subject can fetch the exam entry sheet.
  - A teacher NOT assigned receives an authorization error.
  - An admin in the same school can fetch any sheet.
  - An admin in a different school receives a cross-school error.
  - Upserting records in raw40 mode stores examScaledScore = examRawScore.
  - Upserting records in raw60_scaled_to_40 mode stores correct scaled score.
  - Grade and remark are correctly derived from active bands.
  - Audit fields (enteredBy, updatedBy, timestamps, snapshots) are set correctly.
  - Re-upserting the same student preserves enteredBy but updates updatedBy.

---

## 11 Acceptance Criteria

### Schema and Types

- [ ] All three tables (schoolAssessmentSettings, gradingBands, assessmentRecords) exist in the Convex schema with correct fields and indexes.
- [ ] Zod validators exist for every public function's arguments.
- [ ] TypeScript types are explicit; no `any` types introduced.

### Calculation Logic

- [ ] `examScaledScore` correctly handles both `raw40` and `raw60_scaled_to_40` modes.
- [ ] All derived values are rounded to 2 decimal places.
- [ ] `deriveGradeAndRemark` returns correct band match for any total in 0-100.
- [ ] Pure calculation functions have >90% test coverage.

### Validation Logic

- [ ] Score range validation rejects out-of-bounds values with clear per-field error messages.
- [ ] Grading band validation rejects overlapping bands.
- [ ] Grading band validation rejects incomplete coverage (gaps or range outside 0-100).
- [ ] Validation functions have >90% test coverage.

### Queries

- [ ] `getSchoolAssessmentSettings` returns the active settings or null.
- [ ] `getActiveGradingBands` returns active bands sorted by minScore.
- [ ] `getExamEntrySheet` returns roster with left-joined assessment records, settings, and bands in one call.

### Mutations

- [ ] `saveSchoolAssessmentSettings` deactivates old settings and inserts new active one.
- [ ] `saveGradingBands` validates, deactivates old bands, inserts new active bands atomically.
- [ ] `upsertAssessmentRecordsBulk` validates each row, computes derived fields, saves valid rows, skips invalid rows, and reports per-row errors.
- [ ] `enteredBy` is set only on first insert and never overwritten.
- [ ] `updatedBy` and `updatedAt` are set on every mutation.
- [ ] `examInputModeSnapshot` and `examRawMaxSnapshot` are captured from active settings at save time.
- [ ] `status` is always `"draft"`.

### Authorization

- [ ] Unauthenticated users receive an error on every function.
- [ ] Teachers can only access sheets for their assigned class-subject pairs.
- [ ] Admins can access any sheet within their school.
- [ ] No function returns data from a different school.
- [ ] Admin-only functions (saveSettings, saveBands) reject teacher callers.

### Audit and Auditability

- [ ] Every record stores who entered it and who last updated it.
- [ ] Every record stores timestamps for creation and last update.
- [ ] Exam mode snapshot is preserved so historical records remain interpretable.

---

## 12 Test Scenarios

### Scenario 1: raw40 Mode — Happy Path

```
Given: School has examInputMode = "raw40", active bands covering 0-100
When:  Teacher upserts { ca1: 15, ca2: 18, ca3: 12, examRawScore: 35 } for student S1
Then:  examScaledScore = 35, total = 80, gradeLetter and remark from band containing 80
       enteredBy = teacher, status = "draft", examInputModeSnapshot = "raw40", examRawMaxSnapshot = 40
```

### Scenario 2: raw60_scaled_to_40 Mode — Scaling

```
Given: School has examInputMode = "raw60_scaled_to_40"
When:  Teacher upserts { ca1: 20, ca2: 20, ca3: 20, examRawScore: 60 } for student S2
Then:  examScaledScore = 40.00, total = 100.00
       examInputModeSnapshot = "raw60_scaled_to_40", examRawMaxSnapshot = 60
```

### Scenario 3: raw60_scaled_to_40 — Rounding

```
Given: School has examInputMode = "raw60_scaled_to_40"
When:  Teacher upserts { ca1: 10, ca2: 10, ca3: 10, examRawScore: 37 } for student S3
Then:  examScaledScore = round((37/60)*40, 2) = 24.67, total = 54.67
```

### Scenario 4: Score Validation Failure

```
Given: School has examInputMode = "raw40"
When:  Teacher upserts { ca1: 25, ca2: 10, ca3: 10, examRawScore: 30 } for student S4
Then:  Error: "CA1 must be between 0 and 20"
```

### Scenario 5: Grading Band Overlap Rejection

```
Given: Admin tries to save bands: [{0-50, "C"}, {45-100, "A"}]
When:  saveGradingBands is called
Then:  Error: "Bands overlap: range 45-50 is covered by multiple bands"
```

### Scenario 6: Cross-School Access Denied

```
Given: Admin A belongs to School X
When:  Admin A calls getExamEntrySheet with classId from School Y
Then:  Error: "Cross-school access denied"
```

### Scenario 7: Teacher Not Assigned

```
Given: Teacher T is assigned to (Class 1, Math) but not (Class 1, English)
When:  T calls upsertAssessmentRecordsBulk for (Class 1, English)
Then:  Error: "Not assigned to this class-subject"
```

### Scenario 8: Re-Upsert Preserves Audit

```
Given: Student S1 already has an assessment record entered by Teacher A
When:  Teacher B upserts new scores for S1
Then:  enteredBy remains Teacher A; updatedBy becomes Teacher B; updatedAt changes
```

### Scenario 9: Bulk Partial Failure

```
Given: 3 students in upsert payload; student 2 has ca1 = 25 (invalid)
When:  upsertAssessmentRecordsBulk is called
Then:  Response reports student 2's failure; students 1 and 3 are still saved successfully
```

**Design Decision — Partial Failure:** Use per-row skip with error report. Records with valid scores are saved; invalid rows are reported. This matches the bulk-entry UX where a teacher may have 30 students and one typo should not block 29 saves. Document this decision.

### Scenario 10: Empty Settings Returns Null

```
Given: School has no assessment settings row
When:  getSchoolAssessmentSettings is called
Then:  Returns null; frontend should prompt admin to configure settings
```

---

## 13 Dependencies and Blockers

### Depends On

- `users` table (with `schoolId`, `role`)
- `students` table (with `schoolId`, `classId`)
- `classes` table (with `schoolId`)
- `subjects` table (with `schoolId`)
- `teacherAssignments` table (with `schoolId`, `teacherId`, `classId`, `subjectId`)
- `academicSessions` table (with `schoolId`)
- `academicTerms` table (with `schoolId`, `sessionId`)
- `schools` table

If any of these do not exist, create minimal stubs and document them in the task output.

### Used By

- Teacher App bulk entry page (FR-006, FR-007)
- Admin App bulk entry page (FR-006, FR-007)
- Admin App assessment settings page
- Admin App grading band management page

---

## 14 Verification Checklist

Before marking this task complete, confirm:

- [ ] `pnpm typecheck` passes with zero errors.
- [ ] All unit tests pass.
- [ ] The `/40` rule: when mode is `raw40`, `examScaledScore === examRawScore`.
- [ ] The `/60 -> /40` rule: when mode is `raw60_scaled_to_40`, `examScaledScore = round((examRawScore / 60) * 40, 2)`.
- [ ] Audit fields (`enteredBy`, `updatedBy`, `createdAt`, `updatedAt`) are set correctly on insert and update for all successfully saved rows.
- [ ] Snapshot fields (`examInputModeSnapshot`, `examRawMaxSnapshot`) are captured at write time.
- [ ] Derived values (`examScaledScore`, `total`, `gradeLetter`, `remark`) are stored at write time, not recomputed on read.
- [ ] Every public function enforces school boundary.
- [ ] No `any` types in the codebase.
- [ ] Documentation in `docs/features/ExamRecording.md` remains accurate or is updated.

---

## 15 Open Questions

None. This brief is self-contained. If the builder encounters ambiguity, default to the feature spec (`docs/features/ExamRecording.md`) and coding guidelines (`docs/Coding_Guidelines.md`).

---

## 16 Summary

This task delivers the complete backend and domain layer for Exam Recording v1. A build agent following this brief should be able to:

1. Create the three Convex tables with correct schema and indexes.
2. Implement pure calculation and validation functions with full test coverage.
3. Implement authorization helpers enforcing school boundaries and role-based access.
4. Implement three queries and three mutations covering the full exam recording workflow.
5. Verify correctness via type checking and unit tests.

The output is a production-ready, auditable, school-aware backend with no UI dependencies.

---

*Generated by vibe-spawnTask / vibe-architect workflow*
