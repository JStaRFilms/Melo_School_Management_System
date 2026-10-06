# Complete school workflow QA

## Goal and scope

Verify a real Admin → Teacher → Admin → Parent scoring/certification/publication path on the isolated backend, including reload, withheld privacy, frozen issued values after correction, history, mobile, and print. All business writes use the UI. Initial accounts are the existing synthetic Admin, Teacher, and Parent. Production and normal development are out of write scope.

Use one tagged session with one standalone term, one tagged class, one new synthetic student, an existing subject, the seeded Teacher, and an explicitly reviewed link to the existing Parent. Preserve original students/classes/scores/issued reports. Record the original active session/term, temporarily activate the fixture for the active-only release contract, and restore both through the UI in cleanup even if a phase fails.

## Prerequisites

- A separate read-only, exact-target QA inspector must support legitimate run-tagged additions. The destructive demo reset preflight remains unchanged and must still block unsupported admission claims.
- Capture original-cohort fingerprints and active-period metadata before any write. Additional test records must be school-owned and marked; labels alone are not authorization.
- Existing grading bands must be versioned for certification. If a versioned save is needed, preserve their thresholds, letters, remarks, and colours and report that maintenance explicitly.
- Use a new session for configurable scoring so regrade never touches the original 756 assessments.
- Teacher must be assigned to the exact offered class/subject. Parent linking uses the Family panel's existing-account review path; do not provision another credential or send email.

## Acceptance phases

1. Admin setup: create fixture inactive, offer one subject, assign the Teacher, enroll the student, review/link Parent, ensure subject selection, activate fixture period, apply a valid scoring policy and wait for completion.
2. Parent before issue: the exact student's exact period is withheld, with no draft marks, grade, average, or print/report controls.
3. Teacher entry: reject out-of-range input, save valid values, reload and assert inputs, independently calculated total and grade.
4. Admin certification: inspect the same values; certify with reviewed admission number. Parent remains withheld because certification is not release.
5. Admin release: reviewed roster is exactly one eligible, one certified, zero excluded. Confirm release through the real dialog, then verify its timestamp/frozen roster.
6. Parent published: view exactly the issued copy and history item, and verify print/mobile use the same values.
7. Teacher correction: change a draft score through UI, reload and confirm the new live total. Parent/Admin issued copy remains the original value; no amendment is implied.
8. Cleanup/history: restore original active session and term through UI, confirm cohort fingerprints unchanged, and verify the released fixture remains accessible as history. Retain tagged records/evidence; no reset or generic purge.

Cross-role phases require separate browser contexts and unique criterion/evidence names. Failed prerequisites block dependent phases; cleanup always runs. A partial run is not complete feature verification.

## Shipping and next surfaces

Inspect both repository and provider-side build hooks before a branch push or draft PR. A Preview label alone does not prove that its build cannot deploy Convex to production. If safety cannot be established, retain a local PR packet and report the exact blocker.

After this workflow, establish fixtures/origins for Platform, Apply, WWW, and Sites. Published Sites configuration remains a public, explicit seam; an Admin save does not synchronize it. Email/payment/AI flows require test-only recipient/sandbox/budget conditions before live provider actions.
