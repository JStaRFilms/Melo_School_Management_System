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
- `archive-release`: profile Archive only or atomic archive/current-term exclusion, later-term automatic omission, and stored policy dates after release. These added paths have local backend/component evidence only, not browser acceptance.

## How to get to it (user POV)

Admin Sessions & Terms → Classes → Student Onboarding/Family → Grading Bands/Exam Setup. Teacher Exam Entry. Admin Report Cards certification and Class result release. Parent Report Cards and Result History.

## Driving it with qa

Preconditions: the three owned QA apps, exact isolated backend, original cohort and an unambiguous active period, and no unresolved recovery marker.

Run `pnpm qa:workflow --script scripts/qa/school-workflow.mjs --run-trusted-module --allow-synthetic-writes`. This creates a new fixture per run; do not reuse a released fixture and relabel it as pre-release proof. It drives all writes through UI, caches role sessions only in memory, and validates each session before phase actions. Dependent phases block on failure; ordinary failure cleanup attempts original-calendar restoration.

Review all browser checks and the two independent preservation checks, the 83/63/frozen83 screenshots, actual release counts/stamp, clicked history item, and A4 output. See [verification](../../../../docs/testing/SchoolWorkflowVerification.md).

## Archive and result-release entry points

The existing `scripts/qa/school-workflow.mjs` command above does not exercise these archive paths. No archive module was added in B2. Use the supported exploration contract only after a reviewer has authored and inspected a worktree-contained module, or retain a scoped manual browser report. Do not pass a nonexistent script to the runner or treat the baseline workflow as archive proof.

Browser acceptance for session `orch-20261029-041735` remains pending behind Windows QA blocker148. No doctor, startup, backend maintenance or browser actions ran in B2. The next owner must re-establish the exact isolated target and owned origins before any of the following synthetic writes. Do not repair the runner or switch backends to bypass that blocker.

Use fresh run-marked pupils for Archive only, combined action with subjects, combined action without subjects, and future-term/restore cases. Keep at least one certified included classmate for a release. Record the original active session and term before changing the calendar, restore both afterward, and keep tagged fixtures. Restore cases must use the existing supported archive/restore path in the fixture's default school. Selected-branch archive testing does not authorize fixing the archive browser's pre-existing default-school limitation.

| Entry point | Observable acceptance |
| --- | --- |
| Admin `/academic/students`, select a pupil, profile `Archive Record` | Dialog starts with `Archive only`. Check persisted pupil identity, school, class and offered session/term. Cancel and Escape write nothing, restore trigger focus and reopen with Archive only. At mobile width all controls fit and keyboard focus stays in the dialog. |
| Same profile, `Archive student` | After success/reload the pupil leaves active rosters. Current-term release is not silently excluded. A loading/failed/unavailable calendar check disables only the combined choice. Earlier issued reports and billing links remain. |
| Same profile, choose `Archive and exclude from [term] results` | Reasons of 9 and 501 characters cannot submit; 10 and 500 can. Submit a specific reason. Pending controls cannot resubmit or dismiss. Success/reload shows one manual exclusion with that reason and real approver in the exact reviewed class/term, with the archived pupil removed from active rosters. Repeat using a fresh pupil with no subject selections. |
| Open combined dialog, then change the active term or underlying class/roster in another authorized UI view | Submission cannot silently target the replacement tuple. A stale rejection leaves the dialog open. `Check current term again` loads new context and resets to Archive only; the admin must explicitly choose the combined action again. Ordinary validation errors retain the reason. Already released/excluded and unavailable offers show their reason without disabling Archive only. |
| Profile selection or workspace school changes | Dialog state resets. A late context/archive response from the old pupil/school cannot close the new pupil's dialog or produce a success notice there. Check selected-branch authority and denied non-admin/publish-only access with separately authorized fixtures; no cross-school result is accepted. |
| Admin Report Cards, `Class result release`, or `/assessments/report-cards/release`, select exact session/term/class | Combined exclusion is manual `Excluded` with its original approval. In a later active term starting after archival, an unambiguous archived pupil has `Archived before term`, archive/term-start dates, no approval claim and no exclusion button. Excluded count rises once, eligible/missing-certification counts omit that row, and no repeated manual exclusion is needed. Term participation/conflicting evidence must still need review rather than disappear. |
| Existing restore path before and after a later-term release | Before release, restore removes only computed policy eligibility and invalidates the reviewed roster; missing certification still blocks. After release, restore/re-archive and calendar edits do not change saved policy dates, counts or exclusions. Reload the original released-class entry to inspect the frozen decision. Keep manual exclusions unchanged in both cases. |
| Parent Report Cards and Result History after original-calendar restoration | Unreleased/current-term-excluded/later-policy-excluded reports stay withheld under the existing archive access rules. Once restored, a prior eligible frozen inclusion still opens the same issued history copy. Click the actual history link and compare its issued marks/print output, not a draft or remembered DOM. |

Retain action/end-state screenshots, exact tuple labels, reload assertions and per-criterion blockers with dirty-worktree/revision metadata. Leave browser-only criteria pending until observed. Do not invent server failure injection through production UI or infer atomic rollback from a toast; local backend tests supply that evidence. Follow the normal report review/publication and owned-process teardown steps when browser work is authorized and runnable.

## Gotchas

- Release requires an active session and term. The case temporarily switches only the test school's calendar and restores both.
- The UI's `Finalize Sheet` control currently invokes draft save; certification and release are separate boundaries.
- Local draft recovery after reload is not evidence of server persistence. Cancel/discard and inspect a fresh persisted view when testing rejected input.
- Classes browsing can trigger its existing legacy-name backfill. Known equivalent names are canonicalized for preservation; unrelated renames are rejected.
- Timeout/hard interruption cannot promise UI cleanup. A recovery marker blocks normal runs until the independently recorded period/baseline is restored; use the documented explicit recovery workflow.
- Repeat runs retain tagged records and can increase bounded inspection counts. Do not purge original data to make readiness green.
