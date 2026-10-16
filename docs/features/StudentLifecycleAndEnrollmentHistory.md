# Student lifecycle and enrollment history

Status: backend and Admin lifecycle UI implemented. Local registered-function and component checks pass, including the reviewed current-placement narrative regression. Browser acceptance and backend deployment remain deferred.

## Goal
Record student admission, departure and return without losing identity, academic records or bills. Show dated events and separate participation periods, and keep active rosters and Platform Super Admin school counts correct.

## Approved behavior
Status defaults to active on legacy rows. Supported states are active, withdrawn, suspended, graduated and transferred_out.

- Admission opens a period for a new student.
- Withdrawal or suspension closes the current period and removes the student from active participation.
- Re-enrollment after withdrawal or reinstatement after suspension opens a NEW period on the same student/user identity. Both show a gap.
- Graduation closes the period. Keep the existing explicit correction path, but reject stale or wrong-session corrections and record the correction.
- Governed branch-transfer completion closes the source period and opens the destination period under existing canonical identity. A transferred-out source cannot use an ordinary local return to bypass transfer authority.
- Archive and restore are separate visibility/access operations. Restoring an inactive person does not re-enroll them.

Changes take effect immediately at save. The action's date defaults automatically, and the system captures the session, term and recorded timestamp. Administrative dates may be corrected to valid past/current days, but future scheduling is out of scope. Record the actual configured context, not a guessed session or term. Return placement and subjects need confirmation.

## Client components
`/academic/students` defaults to the Active directory and retains the existing class/session subject matrix. The directory also offers suspended, withdrawn, graduated and transferred-out filters. It does not require class/session selection; searches cover loaded pages and Load more follows native cursors, including empty source pages.

The selected profile has independent identity lookup and stays open after filter changes or a departure. `StudentLifecyclePanel` shows legal actions, recorded status, paginated periods/gaps and read-only history. The mobile editor uses `AdminSheet`, including profile/family controls. Inactive placement and immediate-save subject edits are disabled. Contact and family edits remain available except on transferred-out source records, which are read-only.

`StudentLifecycleActionModal` defaults to server UTC today at save, shows actual configured context and permits a valid past/current date correction. Return suggests the previous class only if still available. Subjects start unselected and stay local until the operator confirms class and subject selection. No historical browsing session is submitted as current context. Missing active session blocks return. Quick admission also exposes an optional admission-day correction; blank records the server default. Corrected days are not imported history.

Graduated profiles expose only the existing guarded correction of their matching recorded graduation. Transferred-out source profiles remain openable after transfer acceptance archives their source login. Authorized source-school Admins see local profile/contact details, enrollment periods/history and the governed transfer-workbench link. Profile, photo, family-link, credential and subject write controls are not mounted. The query still rejects archived student rows, ordinary archived accounts, nonstudent accounts and foreign-school accounts. It reads only the source projection and source-scoped contacts, not destination-private data. No account, membership or participation is restored. An authorized open transfer blocks local lifecycle actions. Archive Audit shows enrollment status separately, read-only history and a Restore confirmation that does not imply re-enrollment.

Archive Audit explains that Restore is not Re-enroll. Existing report-card/history entry points remain usable for inactive people. Student/family Portal keeps already released reports and existing bills, but inactive students cannot participate in current learning or assessment entry.

## Server components
`academic/studentEnrollment.ts` exposes `transitionStudentEnrollment`, `listStudentEnrollmentDirectory`, `getStudentEnrollmentReturnContext`, `getStudentEnrollmentHistory` and `getStudentEnrollmentPeriods`. `studentLifecycle.ts` commits the state, event, period and initialized count delta together. Histories and directories use indexed pagination capped at 100 source rows per request. Every directory status uses the existing `students.by_school` index and filters its bounded source page afterward, avoiding a new index/backfill dependency on the populated students table. Active pages include legacy absent statuses. Any status page can contain fewer visible rows or be empty, so clients must follow the cursor until `isDone`.

Admission and accepted-application conversion record a real admission day. Reviewed imports record an unknown historical start rather than inventing an admission date. Graduation and its existing explicit correction, staged promotion/cancellation, reviewed class assignment, archive/restore and governed transfer completion/reversal append evidence. Graduation facts and promotion endpoints survive deletion or changes to their mutable projections.

A versioned promotion uses its recorded participation period and closing event to distinguish an effective promotion from an unfulfilled future placement. Departure in an earlier configured session supersedes that future promotion, even if its target session activates later. Its staged subjects alone cannot establish report history. The promotion row remains intact, exact issued/assessment evidence remains readable, and promotions already effective in the departure context retain their history. Legacy unversioned promotions keep their existing behavior. Inactive profile placement still respects the latest reviewed return opening after its current-period pointer is cleared. Missing or archived targets do not replace the last real placement; return still requires an explicitly confirmed, available class and active session.

Profile edits patch only editable fields. They retain canonical person/auth identity, source application, photo provenance, lifecycle pointers and other protected metadata. Admission-number corrections do not change credential identity or login email. Inactive students cannot change class, select subjects, stage promotions, enter current assessments/attendance/narrative drafts or receive new routine fee invoices. Existing score rows for inactive students remain correctable only in inactive, ended terms belonging to the selected session, even if that session is still active. Admin and Teacher entry sheets retain those exact school/class/session/term/subject rows with their stored scores and draft baselines. Both discovery and correction still require historical class membership. Entry sheets expose editing locks, and writers enforce those locks and expected-row concurrency checks. Inactive pupils without an exact existing row stay off the sheet, including in inactive sessions. New rows and current/future-term scoring remain denied. Class headcounts and active rosters exclude inactive states.

Exact completed-term rows also remain discoverable after reviewed return into a different class in the same active session, without changing current placement or counts. Admin and Teacher entry pages refresh an optional query-cache key every minute while a graded sheet is selected. The key stays stable between ticks and changes the actual Convex query arguments, so term completion and editing locks are reevaluated without database writes. It is not a trusted timestamp. Server time still determines completion and editing authority, including for future or skewed client keys. The timer stops when the sheet is no longer selected or the page unmounts. Older callers may omit the key, but do not receive this clock-driven refresh. Deploy the backward-compatible backend argument before the updated clients.

Authorize from authenticated school membership and existing enrollment capabilities, not actor IDs supplied by clients. Require same-school class/session/entity references, legal state, revision, nonempty bounded departure/return reason, valid chronology and an operation key. Departure accepts active students, with withdrawal also permitted after suspension. Return requires confirmed class/subject placement and an available active session. The configured term is optional and never fabricated. Automatic action/admission days use the server's UTC calendar day; recorded timestamps are milliseconds since epoch.

Identical authorized replay returns the original event result without writes, even after a later return. Clients should refresh the projection instead of treating a replay's old status/revision as current. Conflicting payloads and stale new requests reject. Open governed transfers block local departure/return and graduation; terminal transferred-out records cannot use local return. Transfer reversal checks the recorded enrollment revisions and refuses independent identity/membership restrictions.

## Data flow
1. Admin selects the person and a legal action, reviews automatically recorded context and confirms date/reason/placement where applicable.
2. The mutation authorizes the tenant, checks replay and expected revision/state, validates date/context and transfer conflicts.
3. It appends an immutable event, opens/closes a separate period, patches current state and adjusts any initialized school count in one transaction.
4. Queries refresh active/inactive directories, timelines and the Platform school list. Historical academic and financial data is not deleted or reissued.

## Database changes
Add suspended to the student status validator. Add bounded pointers/revision fields on the student projection and separate studentEnrollmentEvents and studentEnrollmentPeriods tables. Events record school/student, before/after state, type, effective day, timestamp, reason, actor, operation key/fingerprint and available class/session/term context. Graduation facts and promotion endpoint IDs are retained in evidence. Include admission, withdrawal, suspension, return, graduation/correction, promotion and transfer evidence where those operations occur.

Periods record school/student, opening/closing evidence, known effective bounds and entry context. `endDay` is the first inactive day. Both suspension and withdrawal close the period, and each return opens a different period. Archive/restore do not create, close or reopen periods and do not move the latest participation-effective day. Legacy starts remain unknown with explicit provenance. No unbounded event arrays on student rows. Index tenant/entity chronology and operation keys. Update schema/tenant maintenance table inventories without running maintenance.

## Active-school counts
Reuse studentEnrollmentCounts.isCurrentEnrollment and the existing schoolEnrollmentCounts materialized value. Active means nonarchived and active or a legacy absent status. Withdrawn, suspended, graduated and transferred-out pupils do not count. Admission/return and departure must apply eligibility deltas transactionally, with replay zero. Archive/restore count only active people. Transfers update both schools atomically. Uninitialized counts stay null until authorized calculation; do not publish partial counts.

Platform returns aggregate headcounts only, never student identities. Historical archive totals and commercial invoice snapshots are not interchangeable with active headcounts.

## History preservation
Keep original grades, issued graded/narrative reports, attendance, family links, admission-number history, payments and invoices. Use real historical evidence/period context rather than today's class when viewing a previous session. Do not broaden draft/unreleased Portal visibility. Ordinary departure does not archive student or parent identities.

## Verification
B1 registered-function coverage includes legal/invalid states, competing revisions, same-key replay, changed payload, old-operation retry after return, chronology, multiple gaps, tenant/capability denial, current-operation rejection and retained history. Extend registered-mutation Platform count tests across lifecycle/archive/transfer changes and preserve zero/null UI distinction. Include class counts, graduation correction and protected profile metadata.

B3 component tests cover inactive discovery with no setup context, retained selection, mobile profile actions, legal/terminal states, default/corrected dates, local return placement, both gaps and unknown starts, cancel/busy/error/stale/unchanged retry, and recorded-context report links. A nested confirmation owns Escape/Tab while open, so a mobile profile sheet cannot close during its commit. Platform consumer tests retain aggregate zero/null behavior in desktop and mobile rendering.

Browser criteria, including released report/bill access and another active child, remain unverified. Platform needs its own attested origin, account and fixture. QA tooling and runtime acceptance are separate work and are not included in this implementation.

## Not included
Payroll, transcripts, external-school transfer automation, scheduled lifecycle transitions, retrospective count replay and invented legacy history.
