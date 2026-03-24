# T03 Admin UI Design

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-design`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-design`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `frontend-design`, and `ui-ux-pro-max`.
- Do not use `context7`.

## Objective

Design the admin-side exam-recording settings and entry experience.

## Scope

Included:
- assessment settings screen
- grading-band management screen
- admin bulk score-entry screen
- admin exam-recording sitemap additions

Excluded:
- moderation workflow UI
- report-card UI
- analytics dashboards beyond what supports score entry

## Context

Use:
- `docs/features/ExamRecording.md`
- `docs/Project_Requirements.md`
- `docs/design/design-system.md`
- `docs/design/sitemap.md`

## Definition Of Done

- Admin exam-recording routes are represented in `docs/design/sitemap.md`.
- Mockups exist in `docs/mockups/admin/`.
- Admin settings explain the school-wide exam rule in plain language.

## Expected Artifacts

- Updated `docs/design/sitemap.md`
- Admin mockups for settings, grading bands, and score entry

## Constraints

- Keep the UI trustworthy and operational.
- Validation around overlapping or incomplete bands must be visible.
- Treat any existing draft mockup as editable, not final.

## Verification

- Confirm admins can see and change school exam mode.
- Confirm grading-band editing shows min, max, grade, and remark.
- Confirm the admin entry screen reflects school policy clearly.
