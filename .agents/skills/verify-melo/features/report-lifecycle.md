# Scoring and issued result lifecycle

A Teacher saves a draft; Admin certification creates an immutable copy; explicit class release grants Parent access. Later draft corrections must not change that issued copy.

## Sub-features

- `fixture`: a fresh marked session, standalone term, class, pupil, Teacher assignment, and reviewed existing-Parent link.
- `policy`: session-specific weights and unchanged semantic grading bands.
- `entry`: invalid values rejected; valid inputs/total/grade persist after reload.
- `withheld`: draft and certified-but-unreleased marks/print controls stay hidden from Parent.
- `release`: exact reviewed roster, confirmation, release counts and timestamp survive reload.
- `freeze`: Teacher draft changes from 83/A to 63/B; Parent/Admin issued copy stays 83/A.
- `history-print`: open the actual history row/link after calendar restoration; mobile fits its container and A4 output is one readable white page.

## How to get to it (user POV)

Admin Sessions & Terms → Classes → Student Onboarding/Family → Grading Bands/Exam Setup. Teacher Exam Entry. Admin Report Cards certification and Class result release. Parent Report Cards and Result History.

## Driving it with qa

Preconditions: the three owned QA apps, exact isolated backend, original cohort and an unambiguous active period, and no unresolved recovery marker.

Run `pnpm qa:workflow --script scripts/qa/school-workflow.mjs --run-trusted-module --allow-synthetic-writes`. This creates a new fixture per run; do not reuse a released fixture and relabel it as pre-release proof. It drives all writes through UI, caches role sessions only in memory, and validates each session before phase actions. Dependent phases block on failure; ordinary failure cleanup attempts original-calendar restoration.

Review all browser checks and the two independent preservation checks, the 83/63/frozen83 screenshots, actual release counts/stamp, clicked history item, and A4 output. See [verification](../../../../docs/testing/SchoolWorkflowVerification.md).

## Gotchas

- Release requires an active session and term. The case temporarily switches only the test school's calendar and restores both.
- The UI's `Finalize Sheet` control currently invokes draft save; certification and release are separate boundaries.
- Local draft recovery after reload is not evidence of server persistence. Cancel/discard and inspect a fresh persisted view when testing rejected input.
- Classes browsing can trigger its existing legacy-name backfill. Known equivalent names are canonicalized for preservation; unrelated renames are rejected.
- Timeout/hard interruption cannot promise UI cleanup. A recovery marker blocks normal runs until the independently recorded period/baseline is restored; use the documented explicit recovery workflow.
- Repeat runs retain tagged records and can increase bounded inspection counts. Do not purge original data to make readiness green.
