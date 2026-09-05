# U3c — Fee, academic and planning form adoption

## Objective / scope
Apply U3a shared drafts/dirty guard/mobile progress to the remaining initial high-value workflows without duplicating existing domain saves or steppers.

## Context / dependencies
U3a; finish U2d billing and U2a configuration edits first. Read H6/H7. Actual fee-plan creation is `FeePlanForm` modal under `/billing`; academic sessions/term setup is `/academic/sessions`; exam recording and report add-ons have actual setup routes. Teacher planning is `/planning` and `/planning/lesson-plans`, not curriculum/planner. Import workbench adoption belongs to U4b.

## Ownership
Files listed for U3c in plan and their form-specific hooks/tests. Keep unrelated planning library/AI behavior unchanged; coordinate later U5b heavy-action work. No shared framework rewrite beyond returning a defect to U3a.

## Instructions
1. Inventory existing form state, submit boundaries and domain draft behavior. Register typed sensitivity/version/retention adapters only for genuinely long/high-value forms. Small settings receive dirty warnings without needless persistent drafts.
2. Integrate fee-plan and academic/report configuration recovery, explicit save and submission tombstone. Validation (amounts, required sections, session dates, exam totals) controls completion, not scroll/click.
3. For Teacher planning, preserve existing saved lesson/domain drafts and identities; recovery must not overwrite a newer plan or reuse another class/session/branch draft. Exclude raw documents, credentials and provider payloads.
4. Cover link/sidebar/back/modal-close/branch/account departure through common guard. In-memory disconnect/reauth state remains honest. Do not add global progress to short pages or duplicate a clear existing stepper.

## Definition of done / verification
Focused tests for fee modal close, invalid academic totals/dates, report configuration submit, planning multi-tab conflict/reauth and branch change. Verify scroll vs completion accessibility, saving distinct from progress, no stale autosave resurrection. Record local tests/typechecks/lint and specific short-form exclusions.

## Artifacts
`results/U3c.md`: per-form route, adapter, field/sensitivity classification, progress mode and exclusions; tests/self-review; U7 mobile/recovery/error requests. Matrix updated. No paid AI/provider run, production, migration, deployment, credential or unapproved Convex/PR operations.
