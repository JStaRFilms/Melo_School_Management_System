# Task B7: Implement Legal-Name Compatibility

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Takomi Build (`vibe-build`).

### Prime Agent Context
- `packages/convex/_generated/ai/guidelines.md`
- `docs/tasks/orchestrator-sessions/orch-20260722-114501/future/Admissions_Application_Future_UX_and_Data_Safety_Work.md`
- Current form schema, public application profile save, snapshots, Admin detail, and conversion code.

## Objective
Introduce required student legal middle names for new applications while keeping legacy records, drafts, and immutable submitted snapshots valid.

## Scope
- Determine the existing form-version/publication boundary.
- Enforce first/middle/last legal student names only for new form versions after the rollout boundary.
- Preserve legacy first/last-only records and snapshots.
- Keep guardian first/last naming separate and backward-compatible.
- Update Admin, conversion, exports, and tests to display available name components consistently.

## Definition Of Done
- New published student forms require legal first, middle, and last names.
- Legacy records continue to load, review, and convert without fabricated names.
- Snapshot immutability is preserved.
- Focused tests/typechecks pass.

## Expected Artifacts
- Minimal schema/form validation changes.
- Regression tests.
- Updated implementation notes.

## Constraints
- Do not infer or split existing names.
- Do not block existing drafts retroactively.
- Do not touch production data.
- Keep the change isolated from document-management work.

## Verification
Run focused Apply/Convex/Admin tests and affected typechecks/ESLint.

## Result
Completed on the integration branch with form-bound legal-name policy version 2 and legacy policy version 1 compatibility. Student middle name and guardian first/last names are authoritative only for new policy-version-2 forms. Combined verification is recorded in `follow-up/FU4_B7_B8_B9_remaining_admissions_result.md`.
