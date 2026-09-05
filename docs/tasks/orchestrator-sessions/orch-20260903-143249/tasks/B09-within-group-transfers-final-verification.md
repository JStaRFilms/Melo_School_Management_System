# Task B-09 / M8: Within-Group Transfer Foundation and Final Verification (F4/MX-15)

## Objective
Implement within-group branch-to-branch student transfer workflows with strict two-phase authorization, privacy preservation, and complete repository-wide verification.

## Scope
- **Within-Group Student Transfer State Machine (F4 / MX-15)**:
  - Strict Boundary: Inter-branch transfers are permitted ONLY within the same verified `schoolGroup` (F4 Melo-to-Melo independent network remains gated for Phase 2 / M9).
  - Two-Phase Commit Protocol:
    1. Phase 1: Source Branch Release (Guardian consent verified + Source Branch Principal sign-off).
    2. Phase 2: Destination Branch Acceptance (Destination Principal/Registrar accepts student into target class).
  - Privacy Boundary: Sensitive safeguarding notes, child-protection records, internal disciplinary logs, and parent debt/billing histories are STRICTLY EXCLUDED from the transferred student package.
  - Portable academic record schema: Academic history, transcripts, attendance, and health summaries transferred cleanly into the destination branch without creating orphan records.
  - Schema additions in `packages/convex/schema.ts`: `studentTransfers` (index `by_group_and_status`, `by_source_school`, `by_destination_school`, `by_student`).
- **Convex Transfer Functions (`packages/convex/functions/academic/transfers.ts`)**:
  - `initiateStudentTransfer`: Validates both schools belong to the same active `schoolGroup`, records guardian consent, creates transfer in `status: "initiated"`.
  - `authorizeSourceRelease`: Principal/Registrar of source branch authorizes release; transitions to `status: "source_released"`.
  - `acceptDestinationTransfer`: Principal/Registrar of destination branch accepts student, assigns new class in destination branch, allocates destination admission number, transitions to `status: "completed"`.
  - `rejectOrCancelTransfer`: Cancels transfer and returns student to active status in source branch.
  - Full audit trail emission for every state transition.
- **Integration Tests (`packages/convex/functions/academic/__tests__/transfers.integration.test.ts`)**:
  - Positive: Full two-phase lifecycle (Initiate -> Source Release -> Destination Acceptance) successfully moves student to destination branch class.
  - Negative: Attempting a transfer between schools in DIFFERENT groups is strictly rejected.
  - Negative: Destination acceptance without source release is rejected.
  - Privacy: Transferred package asserts absence of sensitive safeguarding notes and outstanding family debt history.
  - Final full-system verification run across the entire codebase.

## Definition of Done
- Two-phase commit enforced.
- Cross-group transfers blocked.
- Sensitive safeguarding and debt records excluded.
- Independent network (M9) remains gated.
- All integration tests pass.
- Clean working directory and PR-ready commit.

## Dependencies
- B-02 through B-08 complete.
