# D1 — Admissions guardian and staff experience design

**Stage:** Design | **Role:** Designer | **Depends on:** G1 | **Worktree:** documentation/design only

## Objective
Translate the approved admissions architecture into tested, accessible journeys for (a) a guardian buying, resuming, submitting, and tracking one child application, and (b) staff triaging, reviewing, deciding, and converting it.

## Scope
- Journey maps and annotated wireframes for school selection/link entry, sign-up/verification, fee disclosure, checkout hand-off/return, slot dashboard, child form, document upload, declaration, submission confirmation, status/messages, and support/recovery.
- Staff list/filter/assignment, application detail, document review, request-changes, assessment/interview capture, decision, conversion confirmation, and audit visibility.
- Field grouping, conditional fields, save/resume rules, error states, low-bandwidth/mobile behavior, and WCAG 2.2 AA requirements.
- Explicitly design a truthful payment state: pending/confirmed/failed/retry; never show a place as secured merely because payment started.

## Constraints
- One slot = one child application; guardian may buy siblings’ slots.
- Do not expose sensitive documents in list views or URLs.
- Do not turn staff review into an automatic acceptance decision.
- Use only G1-approved terminology and state transitions.

## Deliverables
- `docs/features/AdmissionsExperienceDesign.md`
- `docs/mockups/admissions/guardian-journeys.html` (or Figma/export reference)
- `docs/mockups/admissions/staff-review-journeys.html` (or Figma/export reference)
- A component inventory and validation/error copy matrix.

## Done when
- Every G1 state has a visible user/staff state and recovery action.
- Required vs optional/sensitive fields and document rules are understandable before submission.
- The design gives B2 and B3 route/component/API expectations without inventing backend behavior.
