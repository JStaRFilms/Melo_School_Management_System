# U2b — Actual grade consumers, issued history and print

**Implementation delivered and locally verified; authenticated/browser/print acceptance pending (E0).** U2a's [exact policy, API and historical contract](U2a.md) is implemented, not just a design handoff. No live Convex, codegen, deploy, migration/backfill, credentials, providers, production operations, browser sessions or commits were performed.

## API → calculation → component manifest

All paths are actual inspected consumers; unchanged wrappers preserve the entire typed report payload and do not need redundant mapping edits.

| Actual route / surface | API and calculation path | Rendering/change |
|---|---|---|
| Admin `/assessments/results/entry` desktop | `assessmentRecords.getExamEntrySheet` → effective persisted grading documents → Admin `GradingBandResponse` → `computeDerivedValues` | `AdminRosterGridRow` uses `derived.gradeColor`; removed imported per-letter map. Numeric totals/remarks remain unchanged. |
| Same Admin route, mobile | Same query/helper | `AdminRosterGrid` replaces F-only red rule with the same resolved ink on a restrained white grade indicator. |
| Teacher `/assessments/exams/entry` desktop | Same assignment-checked query → Teacher response/helper | `RosterGridRow` passes `derived.gradeColor` to `ComputedColumns`; removed A/B/C/D/F conditional styling. |
| Same Teacher route, mobile | Same query/helper | `RosterGrid` uses the same policy-derived ink, retaining missing-score placeholders and numeric totals. New DOM regression asserts custom `OUT` grade and identical 80.00 totals in both rendered layouts. |
| Backend score persistence | `assessmentRecords.upsertAssessmentRecordsBulk` | Uses the same effective resolver as entry reads. Existing class/subject assignment and editing-lock checks remain; no new teacher policy-fetch permission. Return validator now permits actual persisted color/point/version fields instead of rejecting them. |
| Teacher `/assessments/report-card-workbench` | `reportCards.getStudentReportCard` → typed full report | `ResultsSummary` resolves from the report's policy, not a letter switch. Incomplete cumulative grades retain their neutral em dash/pending semantics. |
| Admin `/assessments/report-cards` | `getStudentReportCard` / `getClassReportCards` → `ReportCardSheetData` | Existing `ReportCardPreview` and batch wrapper forward policy intact. Shared sheet grade cells resolve configured labels. `ReportCardAdminPanel` mounts new capability-checked `CertifyReportCard` confirmation workflow. |
| Teacher `/assessments/report-cards` | Same report APIs after existing class-access checks | Same shared preview/sheet/batch stack; no broad grading query added. |
| Portal `/`, `/results` mini subject table | Existing `portal.getWorkspaceData` → linked selected student → `buildStudentReportCard` → `selectedReportCard` | `PortalWorkspaceContent` resolves grade ink from the returned report policy. Scores/text remain independent. No Portal billing fields or linked-student authorization changed. |
| Portal `/report-cards` | Same linked-student workspace result | Existing `ReportCardPreview`/toolbar preserve issued policy and shared sheet behavior. |
| Admin `/assessments/report-card-extras` | Existing extras entry API; link built by `buildReportCardHref` | **No independent academic grade render/map** in the extras form. Its report link uses the common report API/sheet, including extras and issued snapshots. |
| Teacher `/assessments/report-card-extras` | Existing legacy redirect → report-card workbench | **No independent grade render.** Actual `ResultsSummary` and linked official report above cover grade-bearing output; extras scale values are not academic grade-band colors. |
| Admin `/assessments/report-cards/manual-adjustments` | `getStudentReportCard` plus existing adjustment API | **Numeric-only adjustment table; no grade-color map.** Its base report now observes issued/no-policy rules. Adjustment permissions and math were not broadened. Official report links use the common renderer. |
| Admin `/assessments/report-cards/backfill` | Existing historical totals workbench | **Numeric historical-total entry, no new grade rendering.** No migration/backfill executed. |
| Shared preview | `ReportCardPreview` → `ReportCardSheet` | Full `reportCard` prop retained, no payload stripping. |
| Single print / browser Save as PDF | Shared sheet + `ReportCardToolbar` / `window.print()` | Same resolved report and policy as preview. There is no separate report-PDF download API in these inspected routes; browser Save as PDF is the existing download path. |
| Batch print | `getClassReportCards` → `ReportCardBatchPrintStackV2`; legacy `ReportCardPrintStack` | Every report remains a whole `ReportCardSheetData`. No current-policy fetch or per-letter substitution in wrappers. Existing A4 scaling/page-stack behavior retained. |

The unused Admin `getGradeColorClass/getGradeBadgeColorClass` switches were deleted after caller removal. Final source searches found no remaining per-letter grade maps in the inventoried active consumers. Shared theme's pre-existing protected palette is not a report policy source and was not rewritten under U3d's ownership; status/billing/theme colors remain separate.

## History, certification and print implementation

- `buildStudentReportCard` checks its existing school/student/session/class/teacher or trusted Portal audience before reading an issued copy. Issued policy + report are immutable; original private media references are re-signed, never replaced by current school/student images.
- New explicit `certifyStudentReportCard({studentId,sessionId,termId,classId,confirmation,reviewedKey})` requires the sensitive final-publish capability as well as ordinary report/branch authority. It snapshots a complete current report with a saved policy version, checks exact reviewed content, and rejects incomplete/stale/historical-without-policy requests. Retry is idempotent. No automatic certification on print, no policy rewrite/backfill and no automatic corrected-report replacement.
- Older inactive/ended records without an issued policy receive `historical_missing` and no current bands. Recorded numeric/letter/remark content remains; unavailable derived historical grades use the existing no-band textual fallback. Future policy edits cannot recolor/regrade certified history.
- Shared sheet prints explicit source/version or historical fallback text. `rc-grade` retains bold text and readable ink on white; row breaks are avoided and table headers repeat. Monochrome-print and forced-color media rules force neutral system/black ink. Color remains supplementary, never the sole carrier of score or grade.
- Existing batch A4 sizing/scaling and page separators are retained, not redesigned. **No browser screenshot, page count, physical grayscale print or PDF fidelity has been claimed.** Unit/source checks are not pagination evidence.

## Final local verification

Executed successfully:

```text
pnpm --filter @school/convex exec vitest run \
  functions/academic/__tests__/gradingPolicy.integration.test.ts \
  functions/academic/__tests__/reportCards.integration.test.ts \
  functions/academic/__tests__/reportCardTermSettings.test.ts foundationContracts.test.ts
  4 files / 11 PASS

pnpm --filter @school/shared exec vitest run src/exam-recording \
  src/__tests__/report-card-sheet.test.ts src/__tests__/report-card-batch-print.test.ts \
  src/__tests__/cumulative-results.test.ts
  7 files / 61 PASS

pnpm --filter @school/admin exec vitest run \
  __tests__/grading-policy-page.test.tsx __tests__/grade-color-editor.test.tsx
  2 files / 5 PASS

pnpm --filter @school/teacher exec vitest run \
  app/assessments/exams/entry/__tests__/ExamEntryFlow.test.tsx \
  app/assessments/exams/entry/__tests__/RosterGrid.test.tsx
  2 files / 26 PASS
```

**103 focused tests passed.** Convex, Shared, Admin, Teacher, Portal and Platform `typecheck` passed. Explicit changed-file ESLint in backend/shared/Admin/Teacher/Portal passed. `git diff --check` passed (Windows line-ending notices only). Existing Vite CJS deprecation notices are nonfatal. No root e2e/seed or build/deletion script was run.

Important regressions exercised: custom label and light hue; adapter persistence/version conflicts and authorization; explicit immutable group default/override; live editor denial/save/discard/failure; shared custom snapshot/no-policy markup; certified output unchanged after policy and score changes; admission confirmation and stale-review rejection; legacy historical recorded label preserved; existing cumulative math/completeness and batch scaling suites. Browser 320px geometry, native keyboard traversal, actual Portal personas, print page breaks and PDF download rendering remain U7 runtime checks, not missing consumer implementation.

## File delta / self-review

Backend: changed `academic/assessmentRecords.ts`, `reportCards.ts`; moved/reexported report validator into new pure `foundation/reportCardContract.ts`; additive `issuedReportCards` table/index/media references in schema (alongside U2a grading group/version fields). `functions/portal.ts` already forwards `buildStudentReportCard` through the shared validator, so no redundant or billing-conflicting edit was needed.

Shared: changed `ReportCardSheet.tsx`, exam-recording types/calculations/index and new grade-policy/review-key helpers; extended report-sheet tests and added grade-policy tests. Preview/print/batch wrappers were inspected, not needlessly rewritten.

Admin: grade editor/types/helpers and two new DOM suites (U2a); `AdminRosterGrid.tsx`, `AdminRosterGridRow.tsx`; new `CertifyReportCard.tsx` and its report-panel mount. Teacher: types/helpers; `RosterGrid.tsx`, `RosterGridRow.tsx`, `ComputedColumns.tsx`, `ResultsSummary.tsx`, focused RosterGrid test. Portal: only the grade cell/import in `PortalWorkspaceContent.tsx`.

Self-review preserved math, status colors, linked-student access, teacher assignments, manual-adjustment authority and default-branch shell boundaries. Removed duplicate preset/writer/maps and actor fabrication. Version allocation now considers deactivated legacy policies; publishing rejects ambiguous old version references. Added no dependency, generated-file hand edit or unrelated cleanup. Temporary editing scripts are removed before handoff.

## U7 evidence / remaining boundaries

Request synthetic/redacted screenshots at 320px and desktop for: grade editor loading/denied/empty/custom-light/dirty/failed-save/discard; explicit group inherit/override and disallowed override; teacher/admin custom-label desktop/mobile entry; workbench incomplete cumulative; Portal selected-child results; current preview, explicit certification, issued snapshot after policy change and old no-policy report. Capture single and multi-student A4 print/Save-as-PDF, long extras pagination, grayscale and numeric-only comprehension, plus keyboard focus.

Schema/index/function rollout is **not performed** and needs an authorized target. U1b's operational selected-branch activation and U3a's full router/account/branch draft guard remain their established program seams; this feature uses the validated current branch and prevents source changes while dirty. No certified correction/reissue lifecycle was invented: later edits do not replace the first issued copy. Native print, private media lifetime and runtime persona behavior require U7 evidence; none is represented as verified by local tests.
