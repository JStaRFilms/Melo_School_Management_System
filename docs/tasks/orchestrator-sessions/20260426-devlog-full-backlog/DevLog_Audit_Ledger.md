# DevLog Audit Ledger

**Session:** `20260426-devlog-full-backlog`  
**Audit date:** 2026-05-04  
**Source:** `00_Notes/DevLog.md`  
**Scope:** Audit-only; no source code edits.

## Context read

- `00_Notes/DevLog.md`
- `docs/Project_Requirements.md`
- `docs/Coding_Guidelines.md`
- `packages/convex/_generated/ai/guidelines.md`
- Relevant `docs/features/*.md` files by DevLog theme
- Repository surfaces under `apps/admin`, `apps/teacher`, `apps/portal`, and `packages/convex/functions`

## Classification summary

| Classification | Count | Notes |
| --- | ---: | --- |
| `verified` | 19 | DevLog item is checked or already has matching feature documentation/code surfaces. These still need final verification in Task 11 if touched later. |
| `needs build` | 9 | Open implementation or confirmed refactor/fix stream; assigned to Tasks 02-09. |
| `needs discovery` | 1 | Future standalone study app; assigned to Task 10 only. |
| `deferred` | 1 | Broad UI debloating stream; should be handled opportunistically inside scoped tasks, not as one unbounded build. |
| `regression` | 0 | No runtime regression was proven by this documentation/code-surface audit alone. Suspected regressions are marked `needs build` for targeted confirmation. |

## Item-by-item ledger

| ID | DevLog marker | DevLog item | Classification | Owner | Evidence checked | Comment / risk note | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DL-001 | `[x]` | Create project | verified | Task 11 | `docs/Project_Requirements.md`; monorepo apps/packages present; `pnpm` workspace structure implied by docs | Project exists and has active admin/teacher/portal/Convex surfaces. | Final verification only. |
| DL-002 | `[x]` | Edit teacher names/emails later and reset passwords | verified | Task 11 | `docs/features/TeacherProfileRoleUpdateSafety.md`; `packages/convex/functions/academic/academicSetup.ts`; auth/admin docs | Feature is documented as a completed teacher profile/admin capability. | Verify in final smoke checks if auth/admin files are touched. |
| DL-003 | `[x]` | Edit subjects and subject names | verified | Task 11 | `docs/features/AdminAcademicSetupEnrollment.md`; `docs/features/ArchivedSubjectRecreationSafety.md`; `packages/convex/functions/academic/academicSetup.ts` | Subject edit/archive safety appears represented in feature docs and academic setup functions. | No downstream build unless Task 07/academic audit finds a regression. |
| DL-004 | `[x]` | Edit session details and make a saved session active again | verified | Task 11 | `docs/features/AdminAcademicSetupEnrollment.md`; `packages/convex/functions/academic/academicSetup.ts`; `packages/convex/functions/academic/settings.ts` | Session management is part of academic setup. No open DevLog follow-up remains. | Final verification only. |
| DL-005 | `[x]` | Support display names/nicknames for classes, e.g. Primary 4 called Olive Blossom | verified | Task 11 | `docs/features/Classes_Interface_Refactor.md`; `docs/features/AdminAcademicSetupEnrollment.md`; academic setup functions | Class naming/display refinements are documented. | No separate build. |
| DL-006 | `[x]` | `/academic/students` subject selection should support select all / deselect for class-based enrollment | verified | Task 04 / Task 11 | `docs/features/Subject_Selection_Redesign.md`; `docs/features/EnrollmentMobileSubjectEditor.md`; `docs/features/Refactor_Students_Workbench.md`; `apps/admin/app/academic/students` | Prior UX improvement is marked complete, but Task 04 will re-audit the students page for related loading/editing issues. | Re-check during Task 04; otherwise final verification. |
| DL-007 | `[x]` | Cleanly edit student details, not only subjects | verified | Task 04 / Task 11 | `docs/features/StudentEnrollmentProfileCapture.md`; `docs/features/Student_Enrollment_Refinement.md`; `docs/features/Refactor_Students_Workbench.md`; `packages/convex/functions/academic/studentEnrollment.ts` | Student profile editing is documented, but current open Task 04 expands records/photo/editor work. | Include in Task 04 audit; no standalone build. |
| DL-008 | `[x]` | Shared unified nav bar for admin, students, and teachers | verified | Task 11 | `docs/features/UnifiedWorkspaceNavbar.md`; app workspace routes | Dedicated feature doc exists. | Final navigation smoke check only. |
| DL-009 | `[x]` | Archive-only deletion for subjects, sessions, teachers, classes; editable students | verified | Task 11 | `docs/features/ArchiveOnlyRecordsAndReportCards.md`; `docs/features/StudentArchiveRestore.md`; `packages/convex/functions/academic/archiveGuardrails.ts`; `archiveRecords.ts` | Archive-only pattern is documented and represented in Convex modules. | Final verification only. |
| DL-010 | `[x]` | Dedicated archived records admin view | verified | Task 11 | `docs/features/Archived_Records_Page.md`; `packages/convex/functions/academic/archiveRecords.ts` | Archived records page is documented. | Final verification only. |
| DL-011 | `[x]` | Teachers see only assigned classes | verified | Task 11 | `packages/convex/functions/academic/teacherSelectors.ts`; `academic/auth.ts`; teacher workspace surfaces | Teacher selector/auth modules indicate assigned-class scoping exists. | Final security/access smoke check. |
| DL-012 | `[x]` | Per-student teacher and head-teacher comments for report cards | verified | Task 11 | `docs/features/TeacherReportCardComments.md`; `packages/convex/functions/academic/reportCards.ts`; report-card routes | Feature doc exists and report-card domain is present. | Final report-card smoke check. |
| DL-013 | `[x]` | Manual next-term-begins date picker reflected for every student in term | verified | Task 11 | `docs/features/GroupedReportCardTermSettings.md`; `packages/convex/functions/academic/reportCardTermSettings.ts` | Report-card term settings module/doc cover this area. | Final verification only. |
| DL-014 | `[x]` | Exam finalizing/editing windows controlled by admin | verified | Task 11 | `docs/features/ExamEditingWindowsAndFinalization.md`; `packages/convex/functions/academic/assessmentEditingPolicies.ts`; policy helpers | Dedicated policy feature and Convex modules exist. | Final grading/editing policy smoke check. |
| DL-015 | `[x]` | Configurable report-card add-on bundles and separate student onboarding page | verified | Task 04 / Task 11 | `docs/features/ConfigurableReportCardAddOnsAndStudentOnboarding.md`; `docs/features/Report_Card_Extras_Modernization.md`; `docs/features/Student_Onboarding_Refinement.md`; report-card extras modules | Completed item spans add-ons and onboarding. Task 04 should avoid regressing class-first and standalone onboarding flows. | Re-audit onboarding in Task 04; otherwise final verification. |
| DL-016 | `[x]` | School admins/sub-admins, supreme admin transfer/archive rules, platform super-admin creates school admins | verified | Task 11 | `docs/features/SchoolAdminLeadershipAndDelegation.md`; `docs/features/PlatformSuperAdminSchoolProvisioning.md`; `packages/convex/functions/academic/adminLeadership.ts`; platform functions | Leadership/delegation feature is documented and implemented surfaces exist. | Final security smoke check only. |
| DL-017 | `[x]` | Class-activated subject aggregation / umbrella subjects | verified | Task 11 | `docs/features/ClassActivatedSubjectAggregation.md`; `packages/convex/functions/academic/subjectAggregations.ts`; aggregation helpers | Dedicated aggregation docs and functions exist. | Final verification only. |
| DL-018 | `[-]` | Debloat all pages and work on UI generally | deferred | Tasks 02-09 opportunistically; Task 11 verifies | `docs/features/Admin_UI_Overhaul.md`; `docs/features/Independent_Scroll_Workbench.md`; multiple route surfaces | Too broad for a single safe build task. Should be handled only where scoped downstream tasks already touch UI. | Keep deferred as a cross-cutting guideline; do not start unbounded redesign. |
| DL-019 | `[ ]` | Add photo editor | needs build | Task 04 | `docs/features/StudentEnrollmentProfileCapture.md`; `docs/features/Refactor_Students_Workbench.md`; student records/report-card surfaces | No dedicated completed photo-editor doc found; requires upload/crop/replace/remove and report-card display integration. | Build in Task 04. |
| DL-020 | `[ ]` | Show active school branding/name/logo/metadata for staff and handle parent multi-school context | needs build | Task 03 | `docs/Project_Requirements.md` FR-001/002/009/017; `docs/features/PortalAcademicPortalFoundation.md`; `packages/convex/functions/academic/schoolBranding.ts`; portal/admin/teacher apps | Existing branding module exists, but DevLog asks for authenticated workspace visibility and parent multi-school context. Security-sensitive tenant boundary. | Build in Task 03 with `gpt-5.5` review. |
| DL-021 | `[x]` | Rework report-card printing screen/scaling | verified | Task 02 / Task 11 | `docs/features/UnifiedReportCardPrintSystem.md`; `docs/features/FullClassReportCardPrinting.md`; report-card routes | Single/print scaling work is marked complete. The following open item narrows the remaining problem to batch printing. | Preserve while implementing Task 02. |
| DL-022 | `[ ]` | Multi-student/admin/teacher report-card printing does not work well; create dedicated batch printing flow without breaking single-student print | needs build | Task 02 | `docs/features/UnifiedReportCardPrintSystem.md`; `docs/features/FullClassReportCardPrinting.md`; `docs/features/ClassLevelBatchReportCardPrinting.md`; `apps/admin/app/assessments/report-cards`; `apps/teacher/app/assessments/report-cards` | Open regression-risk build item. Note: task plan says preserve shared print foundation and avoid duplication unless audit proves necessary. | Build/fix in Task 02. |
| DL-023 | `[x]` | UI fixes for billing page, portal, main website, templates | verified | Task 05 / Task 06 / Task 08 / Task 11 | `docs/features/Billing_Redesign.md`; `docs/features/PublicLandingPageRedesign.md`; `docs/features/Template_Studio_Redesign.md`; `docs/features/PortalAcademicPortalFoundation.md` | Broad UI fixes are documented as completed, but related open items remain for billing printing, templates, and portal modularity. | Preserve completed UX while scoped tasks address open defects. |
| DL-024 | `[ ]` | Modularize the student portal page because it is too monolithic | needs build | Task 08 | `docs/features/PortalAcademicPortalFoundation.md`; `apps/portal/app` | Open refactor. Must preserve portal results/report cards/billing/knowledge behavior. | Build in Task 08 after Task 06 context. |
| DL-025 | `[ ]` | Printable invoices/statements with links, QR code, payment dates/times in UI | needs build | Task 05 | `docs/features/BillingAndPaymentsFoundation.md`; `docs/features/Billing_Redesign.md`; `docs/features/BillingReferenceResolutionHardening.md`; `packages/convex/functions/billing*.ts`; `apps/admin/app/billing` | Open finance/printing work. High-risk due to payment links, reconciliation, and financial correctness. | Build in Task 05 with deep review. |
| DL-026 | `[ ]` | Knowledge templates admin UI issues, duplicate entries, cleaning/prevention, catalog navigation should return to prior context | needs build | Task 06 | `docs/features/LessonKnowledgeHub_v1.md`; `docs/features/LessonKnowledgeHub_v2_ContextFirstPlanning.md`; `docs/features/Template_Studio_Redesign.md`; `packages/convex/functions/academic/lessonKnowledgeTemplates.ts`; templates route | Open admin knowledge/template defect stream. Task 06 says prevent future duplicates; do not auto-clean existing duplicates in first pass. | Build in Task 06. |
| DL-027 | `[ ]` | Future standalone study app that can work independently and integrate with Melo schools when available | needs discovery | Task 10 | `docs/Project_Requirements.md` future scope; portal/knowledge feature docs | Product discovery only. No current code should change in this DevLog session. | Create `docs/features/StandaloneStudyAppDiscovery.md` in Task 10. |
| DL-028 | `[ ]` | Confirm whether promotions/class movement are sorted out | needs build | Task 07 | Academic setup/enrollment docs; `packages/convex/functions/academic/studentEnrollment.ts`; academic routes | Open audit-first item. No specific promotion feature doc found in current feature list, so it may be missing or implicit. | Audit in Task 07; implement smallest safe promotion workflow only if missing/broken. |
| DL-029 | `[ ]` | Work on Academic Students loading parents/children/emails/editable fields; admin Knowledge Library; Template Studio; Assessment Profiles; teacher library/subpages/video; portal knowledge system | needs build | Tasks 04, 06, 08 | `docs/features/Refactor_Students_Workbench.md`; `docs/features/LessonKnowledgeHub_v1.md`; `docs/features/LessonKnowledgeHub_v2_ContextFirstPlanning.md`; `docs/features/Template_Studio_Redesign.md`; assessment/knowledge Convex modules; admin/teacher/portal knowledge routes | Compound item must be split: Academic Students to Task 04; admin knowledge/templates/assessment profiles to Task 06; teacher + portal knowledge refactors to Task 08. | Execute as split ownership; avoid one large mixed change. |
| DL-030 | `[ ]` | Upgrade the PDF parser | needs build | Task 09 | `docs/features/ReliableScannedPdfOcrFallback.md`; `docs/features/SmartPdfPageSelectionAndPageAwareIndexing.md`; `packages/convex/functions/academic/lessonKnowledgePdfExtraction.ts`; OCR/ingestion action modules | Open PDF extraction/OCR performance task. Existing docs indicate prior OCR/parser work, but DevLog asks for an upgrade. | Build in Task 09. |

## Downstream task coverage

| Task | Ledger IDs owned | Notes |
| --- | --- | --- |
| Task 02 Report Card Batch Printing v2 | DL-021, DL-022 | Preserve completed print scaling while fixing batch print. |
| Task 03 School Branding and Parent Multi-School Context | DL-020 | Tenant/security-sensitive; active school branding and parent context. |
| Task 04 Student Records and Photo Editor | DL-006, DL-007, DL-015, DL-019, DL-029 partial | Student records audit, onboarding preservation, photo editor. |
| Task 05 Billing Printable Finance Pack | DL-023 partial, DL-025 | Printable invoices/statements and payment timing visibility. |
| Task 06 Knowledge and Template Prevention Fixes | DL-026, DL-029 partial | Admin knowledge/template/assessment profile defects. |
| Task 07 Promotions Audit and Fix | DL-028 | Audit first; build only if missing/broken. |
| Task 08 Portal and Teacher Knowledge Refactors | DL-024, DL-029 partial | Portal modularization and teacher/portal knowledge surfaces. |
| Task 09 PDF Parser Upgrade | DL-030 | PDF/OCR extraction upgrade. |
| Task 10 Study App Discovery Brief | DL-027 | Discovery only; no app code. |
| Task 11 Final Verification, Docs, and Deploy | DL-001 through DL-030 final coverage | Verify docs, tests/typechecks/builds/deploy, and final status. |

## Documentation mismatches / risks

- Task 01 referenced `docs/project_requirements.md`, but the repository file is `docs/Project_Requirements.md`.
- No dedicated promotions feature doc was found in the current feature list; Task 07 should create/update one if a promotion workflow exists or is added.
- No dedicated student photo-editor feature doc was found; Task 04 should update `StudentEnrollmentProfileCapture.md` or create a focused photo-editor doc when implementing.
- Batch report-card printing has multiple related docs (`UnifiedReportCardPrintSystem.md`, `FullClassReportCardPrinting.md`, `ClassLevelBatchReportCardPrinting.md`). Task 02 should reconcile them and avoid diverging print architectures.
- Knowledge duplicate handling is a data-integrity risk. Task 06 should prioritize prevention and document any decision not to auto-clean existing duplicates.
- Billing print/payment links are finance/security-sensitive. Task 05 should preserve provider-agnostic, Paystack-first behavior and avoid exposing cross-school invoice/payment data.

## Acceptance criteria check

- [x] Every DevLog item is represented exactly once: 30 ledger rows, DL-001 through DL-030.
- [x] Ticked items are included and commented on.
- [x] Open implementation items are assigned to Tasks 02-09.
- [x] Future study-app work is assigned to Task 10 as discovery only.
- [x] Mismatches between DevLog and feature docs are called out.
- [x] No source code was edited for this task.
