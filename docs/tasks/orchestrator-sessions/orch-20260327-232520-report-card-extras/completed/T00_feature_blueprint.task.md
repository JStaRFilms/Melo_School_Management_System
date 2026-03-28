# T00 Feature Blueprint

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-genesis`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-genesis`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `avoid-feature-creep`, and `nextjs-standards`.
- Do not use `context7`.
- Treat this task as documentation-only. Do not implement app code.

## Objective

Create or replace the feature spec at `docs/features/ConfigurableReportCardAddOnsAndStudentOnboarding.md`.

## Scope

Included:
- configurable report-card add-on bundles
- reusable rating scales
- class-based bundle assignment
- teacher/admin extras entry flow
- report-card print integration for extras
- student-first onboarding route
- first/last-name support with compatibility display name
- best-effort backfill for existing names
- permissions, regression guardrails, and approval gate notes

Excluded:
- implementation code
- mockup HTML
- formulas or conditional fields
- portal-facing extras display

## Context

Use:
- `docs/Project_Requirements.md`
- `docs/Coding_Guidelines.md`
- `docs/features/AdminAcademicSetupEnrollment.md`
- `docs/features/StudentEnrollmentProfileCapture.md`
- `docs/features/ExamRecording.md`
- `docs/features/FullClassReportCardPrinting.md`

The approved product direction is:
- admins build reusable add-on bundles and reusable scales
- bundle assignment is by class, with easy multi-class selection
- "advanced builder" means richer field types, reusable scales, and reordering only
- teacher edit access is form-teacher-only, with admin override
- the new onboarding flow is student-first, but final save still assigns a class
- first name and last name are stored separately, while the old full-name field remains as a compatibility display name
- no manual broad rewrite of existing names; use best-effort backfill with safe fallback

## Required Sections In The Doc

- Goal
- Components: Client vs Server
- Data Flow
- Database Schema
- Permissions
- UX Flows
- Regression Checks
- Explicit Out Of Scope
- Approval Gate

## Definition Of Done

- `docs/features/ConfigurableReportCardAddOnsAndStudentOnboarding.md` is implementation-ready.
- The doc is specific enough that downstream task briefs do not need to invent product behavior.
- The doc makes the approval gate explicit: implementation starts only after user confirmation.

## Expected Artifacts

- `docs/features/ConfigurableReportCardAddOnsAndStudentOnboarding.md`

## Constraints

- Keep scope bounded to the approved v1.
- Keep tenancy, class targeting, and role boundaries explicit.
- Preserve coexistence with the existing `/academic/students` flow.
- Preserve report-card compatibility for current users while name backfill is incomplete.

## Verification

- Confirm all required sections are present.
- Confirm the doc names the new routes and the new backend responsibilities.
- Confirm out-of-scope items exclude formulas, conditional visibility, and level-precedence rules.
