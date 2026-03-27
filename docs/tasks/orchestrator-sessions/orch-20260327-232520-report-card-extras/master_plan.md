# Master Plan: Configurable Report Card Add-Ons + Student-First Onboarding

**Session ID:** `orch-20260327-232520-report-card-extras`  
**Mode:** `takomi -> mode-orchestrator`  
**Status:** Blueprint complete; external implementation orchestration pending

## Overview

This orchestrator session sets up and controls the delivery of a reusable report-card add-on system plus a separate student-first onboarding flow.

The orchestrator does not implement the feature directly. It creates the task briefs, delegates work to sub-agents, reviews outputs, requests corrections, and only greenlights dependent tasks after review gates pass.

## Source Of Truth

- `docs/Project_Requirements.md`
- `docs/Coding_Guidelines.md`
- `docs/features/AdminAcademicSetupEnrollment.md`
- `docs/features/StudentEnrollmentProfileCapture.md`
- `docs/features/ExamRecording.md`
- `docs/features/FullClassReportCardPrinting.md`
- approved planning notes from the current user thread

## Scope

- configurable report-card add-on bundles
- reusable rating scales
- class-based bundle assignment with easy multi-class attach
- teacher/admin extras entry routes
- report-card print integration for extras
- student-first onboarding route
- first/last-name support with compatibility display name
- best-effort existing-name backfill
- Nursery support where class-level UI currently assumes only Primary/Secondary

## Explicitly Out Of Scope

- conditional field visibility
- computed or formula fields
- level-precedence assignment rules
- portal-facing extras display
- replacing the current `/academic/students` matrix flow
- manual bulk data cleanup for existing names

## Skills Registry

| Skill | Why It Applies |
| --- | --- |
| `takomi` | Primary orchestration and workflow routing |
| `avoid-feature-creep` | Keep v1 bounded while still global |
| `nextjs-standards` | App Router and verification rules |
| `sync-docs` | Keep docs aligned as tasks land |

## Workflows Registry

| Workflow | Purpose In This Session |
| --- | --- |
| `/mode-orchestrator` | Session controller behavior |
| `/vibe-genesis` | Feature blueprint authoring |
| `/vibe-spawnTask` | Self-contained implementation briefs |
| `/vibe-build` | Implementation tasks once approved |
| `/vibe-syncDocs` | Final documentation pass |
| `/review_code` | Final quality gate |

## Dependency Map

`T00` -> approval gate  
approval gate -> `T01`, `T02`, `T03`, `T04`  
`T01`, `T02`, `T03`, `T04` -> `T05`

## Delegated Task Table

| ID | Subtask | Mode | Workflow | Status |
| --- | --- | --- | --- | --- |
| `T00` | Feature blueprint doc | `vibe-architect` | `/vibe-genesis` | Complete |
| `T01` | Foundation domain and schema | `vibe-code` | `/vibe-build` | Pending approval |
| `T02` | Admin bundle configuration UI | `vibe-code` | `/vibe-build` | Pending approval |
| `T03` | Report-card extras entry and print integration | `vibe-code` | `/vibe-build` | Pending approval |
| `T04` | Student-first onboarding UI | `vibe-code` | `/vibe-build` | Pending approval |
| `T05` | Integration, regressions, docs, final summary | `vibe-review` | `/vibe-syncDocs` + `/review_code` | Pending approval |

## File Ownership

- `T00`
  - `docs/features/ConfigurableReportCardAddOnsAndStudentOnboarding.md`
- `T01`
  - `packages/convex/schema.ts`
  - `packages/convex/functions/academic/reportCardBundleConfig.ts`
  - `packages/convex/functions/academic/reportCardExtras.ts`
  - supporting shared type files only if needed by backend contract
- `T02`
  - `apps/admin/app/assessments/setup/report-card-bundles/**`
- `T03`
  - `apps/teacher/app/assessments/report-card-extras/**`
  - `apps/admin/app/assessments/report-card-extras/**`
  - report-card pages/components that surface extras
  - `packages/shared/src/components/ReportCardSheet.tsx` and closely related shared report-card files
- `T04`
  - `apps/admin/app/academic/students/onboarding/**`
  - minimal cross-linking changes in current student enrollment routes
  - class-level UI files that need Nursery support
- `T05`
  - feature doc updates
  - orchestrator summary
  - narrow integration fixups only

## Review Gates

1. Implementer completes task and self-checks deliverables.
2. Spec reviewer checks against the task brief and approved blueprint.
3. Code-quality reviewer checks modularity, regressions, and maintainability.
4. Orchestrator validates write scope, acceptance criteria, and downstream readiness.

No task advances with unresolved blocking findings.

## Progress Checklist

- [x] `T00` Feature blueprint complete and reviewed
- [x] User approved moving to external orchestration of remaining tasks
- [ ] `T01` Foundation domain and schema complete
- [ ] `T02` Admin bundle configuration UI complete
- [ ] `T03` Report-card extras entry and print integration complete
- [ ] `T04` Student-first onboarding UI complete
- [ ] `T05` Integration, docs, and final summary complete

## Orchestrator Notes

- The local approval gate is now satisfied. The next orchestrator should execute only `T01` through `T05`.
- Existing names must be backfilled automatically where possible; ambiguous names must remain safe and editable.
- Keep implementation files modular and split early to stay aligned with the 200-line rule.
