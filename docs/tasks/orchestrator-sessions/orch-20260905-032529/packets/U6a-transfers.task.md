# U6a — Within-group student transfers

## Objective / scope
Connect audited within-group transfer APIs to source/destination workflows while retaining immutable source history. Independent-school M9 and automated staff-transfer policy are excluded.

## Context / dependencies
U1c/U1d/U1e/U2c/U3a; student-profile edits after U3b. Read F2/F4/H4 and transfers.ts. Available initiateStudentTransfer, authorizeSourceRelease, acceptDestinationTransfer, rejectOrCancelTransfer, getTransfer, listTransfersBySchool/listTransfersByGroup/getStudentTransferHistory. Current transfer authority accepts Platform/legacy admin, proprietor, or enrollment.intakes.manage / academic.classes.manage / enrollment.decisions.record in the branch; destination override checks separate numbering capability. No app route exists.

## Ownership
transfers.ts, proposed `/academic/students/transfers`, existing student list/profile entry/history, relevant tests. Number allocator belongs to U2c; return contract defects there, do not fork it. Schema/nav changes serialized.

## Instructions
1. Provide source student selection and explicit target branch/class/session proposal with minimal shared history, stable operation intent and source/destination confirmation. Verify same group and branch authority server-side; unrelated branch/group data must never populate selectors or detail.
2. Render only valid actions for current state and persona: source release, destination acceptance, rejection/cancellation. Backend rechecks state/authority and reason; replay returns same result, never duplicate enrollment.
3. Destination acceptance uses U2c atomic new-number or governed manual override, correct destination enrollment context and audited mapping. Source students/attendance/scores/invoices retain original schoolId and history. No in-place tenant rewrite.
4. History pane must redact unauthorized branch information and omit financial/health/safeguarding/disciplinary automatic copying. Use U3a guard/draft only for permissible proposal fields, not hidden source dossiers. Keep institution-network/signing/independent transfer controls absent or clearly future-gated.

## Definition of done / verification
transfers.integration.test.ts plus UI cases: source/destination distinct permissions, unrelated group denied, missing class, stale/duplicate case, source release/reject/cancel, destination duplicate retry, override denied/reason, original history unchanged and scoped continuous history. Record local tests/typecheck/lint, no live transfer or data migration.

## Execution status
Local implementation and Portal canonical-identity follow-up delivered. See `../results/U6a.md` and the session coverage matrix: transfer integration is now 17 PASS (including destination login/source history/revocation/retry), the final transfer/identity/learning bundle is 25 PASS, and Convex/Portal typechecks plus focused lint pass. Original 6 Admin UI tests and related regressions remain recorded. Routed source/destination workflow and immutable-source/scoped history are implemented. Runtime deployment/browser/mobile acceptance remains E0 for U7; no live operations performed. Explicit list bounds and guard-only (not persistent) draft protection are documented in the result.

## Artifacts
`results/U6a.md` state/action/permission diagram, API signatures, history/numbering mapping and tests/self-review. Update matrix; request U7 source/destination/denied/mobile confirmation evidence. No production, providers, migrations, deployment, credentials or unapproved CLI/PR operations.
