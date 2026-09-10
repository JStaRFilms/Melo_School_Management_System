# U3b — People forms draft and progress adoption

## Objective / scope
Integrate shared recovery/guard/progress into student enrollment, family onboarding and teacher/staff onboarding without persisting credentials or raw photo documents.

## Context / dependencies
U3a/U2c and U1d staff authority contract. Read H6/H7 and actual form/types. Routes: `/academic/students/onboarding` owns state and calls studentEnrollment.createStudent, family link and separate credential actions; StudentFirstOnboardingForm renders it. FamilyOnboardingForm is under students/components. Teacher creation is on `/academic/teachers` via academicSetup.createTeacher action, not a staff/onboarding route.

## Ownership
U3b exact files in plan plus tests; numbering control contract belongs to completed U2c. No auth-provider or credential backend redesign. Finish before U4a adds email links and U6 modifies student profile integration.

## Instructions
1. Explicitly classify each form field. Draft only permitted person/enrollment/contact fields in authenticated server storage; exclude passwords, credential summaries, tokens and raw files. Show excluded-file reselect instructions on recovery.
2. Register U3a adapters with branch/form/version/entity keys. Wire explicit save, autosave, Preview/Resume/Discard, revision resolution and submit lifecycle to actual successful mutation boundaries, not early optimistic clearing.
3. Use validated section completion for multistep enrollment and sufficiently long staff/family flows; retain existing steppers where already sufficient. Failure in later family/credential actions must not silently duplicate already-created student on retry.
4. Test navbar/sidebar, browser reload/back, modal close, branch/account switching, save failure and reauthentication. Sensitive submission notices must not leak into screenshots or draft audit.

## Definition of done / verification
Focused UI/integration cases demonstrate no silent blank-form overwrite, no credential/file persistence, no duplicate student on partial failure/retry, correct invalid/optional section progress, creator/branch isolation and stay/discard/save departure. App/shared typecheck and tests recorded. 320px form/modal/keyboard/focus behavior checked locally where tools permit; U7 captures authenticated proof.

## Artifacts
`results/U3b.md`: field-classification table, adapter/form route inventory, excluded fields, submit/retry contract, commands/self-review and screenshot requests. Update matrix. No provider calls, credential reads, production, migration/deploy or unapproved Convex CLI; parent owns PR/review.
