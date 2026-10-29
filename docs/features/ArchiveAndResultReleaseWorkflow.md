# Archive and result release workflow

Status: Implemented locally. Final parent verification passed 123 backend/schema tests and 66 frontend/component tests, plus backend, Admin and Portal typechecks. Independent review found one stale-offer recovery defect, which was corrected and covered by permanent regression tests. Affected lint has no errors and two pre-existing profile-editor warnings. Theme and diff checks passed. Real-browser acceptance remains blocked by [issue #148](https://github.com/JStaRFilms/Melo_School_Management_System/issues/148). Not deployed.

Session `orch-20261029-041735`, Genesis G1. Source inspected on `feature/archive-result-release` at master base `e479b9fa86f98289ddc06eee0512d4ad63a58d56` in `_w/archive-result-release`.

## Goal and boundary

An admin can archive a student alone or archive and explicitly exclude them from the current active term's unreleased class results in one transaction. While the student remains archived, terms starting strictly after the archive timestamp omit them automatically when enrollment evidence is unambiguous. Schools must not repeat the same manual exclusion every term.

Earlier terms, billing records, academic records, issued reports and frozen release decisions remain unchanged. This work does not publish results, revoke results, create assessments, import Preview lifecycle branches, add a multi-term manager or repair the QA runner.

This contract implements parent FR-A1 through FR-A5. It supports project requirements FR-001, FR-002, FR-005, FR-007, FR-009 and FR-017. Existing archive and batch-report rules remain in `StudentArchiveRestore.md`, `ArchiveOnlyRecordsAndReportCards.md` and `ReportCardArchivedStudentRosterAudit.md`. Their statement that archive alone never excludes a student remains true for a term that already started. The new future-term policy is the narrow exception defined here.

## Baseline behavior before this feature

- `studentEnrollment.ts:archiveStudentRecord` archives `students` and linked `users` with the same server timestamp and actor. It decrements an initialized enrollment count only for a current enrollment. `deleteStudent` is a legacy archive alias.
- `restoreStudent` checks admission-number and account-login conflicts, clears both archive flags and increments the count only for active enrollment status. It retains old archive timestamps. Those timestamps alone therefore do not prove current archival.
- The profile-read, archive and restore APIs currently infer the default school. `StudentProfileEditor` has selected-school context but does not pass it to profile-read or archive. The archive browser also reads the default school.
- `resultPublication.ts:buildReadiness` discovers candidates from current class, promotions, subject selections, assessment records, issued cards and explicit exclusions. It does not silently filter archived students. It requires the active session and term and rejects archived tuples.
- Issue145 permits explicit exclusion of a current-class archived student without subjects or marks. It does not bypass tenant/class conflicts, duplicate cards or duplicate exclusions.
- Readiness supports `certified`, `blocked` and `excluded`. Counts exclude excluded rows from the denominator. Release requires at least one certified student, a matching review digest and explicit family-visibility confirmation.
- Release pins inclusions in `classResultPublicationStudents`. Frozen readiness reads inclusion rows and `classResultExclusions`, checks stored counts and never rebuilds eligibility.
- Every exclusion currently requires `approvedBy` and `approvedAt`. Inventing an approving admin for an automatic rule would corrupt that contract.
- `portal.ts:hasReleasedTupleWithoutEligibleRecord` also reads exclusions and compares `approvedAt` with the release timestamp. It must understand policy exclusions after restore. The graded reader requires an exact frozen inclusion and issued card and currently denies archived students. Preserve this access rule rather than treating retained reports as permission to bypass archive restrictions.

## Client and server components

Client paths are relative to the worktree:

- `apps/admin/app/academic/students/components/StudentProfileEditor.tsx`: selected-school profile read, existing archive entry point and editor pending state.
- `apps/admin/app/academic/students/components/ArchiveStudentConfirmation.tsx`: existing `ConfirmationModal` with archive choices, one caught context snapshot, explicit stale-context refresh, reason validation and one atomic archive mutation. The keyed instance ignores late responses after student/school changes.
- `apps/admin/lib/components/ui/ConfirmationModal.tsx`: already supports children, disabled confirmation, pending dismissal protection and keyboard focus. Use these hooks without redesigning the shared modal.
- `apps/admin/app/assessments/report-cards/release/ClassReleasePanel.tsx`: existing roster, explicit exclusion dialog and frozen release confirmation.

Server paths:

- `packages/convex/functions/academic/studentEnrollment.ts`: archive query/mutation, existing archive helper and restore.
- `packages/convex/functions/academic/studentEnrollmentCounts.ts`: unchanged count rules, reused in the same transaction.
- `packages/convex/functions/academic/resultPublication.ts`: shared tuple/exclusion validation, eligibility, review digest, release freeze and frozen reader.
- `packages/convex/functions/portal.ts`: source-aware frozen exclusion availability check, with no new report access.
- `packages/convex/schema.ts`: minimal exclusion provenance change described below.

Keep shared backend logic typed with `QueryCtx` or `MutationCtx`. Export narrowly needed plain helpers instead of chaining public mutations or creating an action. No new service layer is needed.

## Atomic archive contract and data flow

Extend `archiveStudent` with optional `schoolId` and optional `resultExclusion` containing `sessionId`, `termId`, `classId`, `reason` and `reviewedKey`. Omitting `resultExclusion` means Archive only and preserves the legacy return value `null`. Keep old callers valid. New Admin callers always pass the selected school. Preserve `deleteStudent` as an archive-only alias, using the same archive helper.

Add a bounded, admin-authorized `getStudentArchiveContext` query in `studentEnrollment.ts`, accepting selected `schoolId` and `studentId`. It returns school/student/class display context and either one exact active unreleased term offer or a specific unavailable reason. It returns no scores or raw evidence. Resolve the active session and term server-side through existing indexes and detect duplicates rather than choosing the first row. An inactive, archived, missing or ambiguous period offers no combined action. Do not turn the modal into a term picker.

For an available offer return the exact tuple, display names, `canArchiveAndExclude`, its reason if false, and a review token bound to the current roster evidence and linked account state. A no-subject student can become excludable after archive, so current `row.canExclude` alone is not an adequate preview. Reuse the existing archived-current-class validation against the proposed archive state. Do not fabricate subjects or reports to preview the action.

The combined mutation must:

1. Resolve the authenticated selected-school membership. Require existing enrollment management authority and school-admin authority. Publishing permission alone does not permit a manual exclusion.
2. Validate student and linked account ownership and active archive state. Verify the requested class is the student's stored current class, not an unsaved profile edit.
3. Resolve and compare the exact active session and term. Reject archived tuples, an existing publication, ambiguous context or a stale review token. The profile uses `activeStudentAssignment`, which can resolve a promotion-based class different from stored `student.classId`. Do not silently substitute either class. If they disagree, offer Archive only and require class review before combining actions. Expanding issue145's current-class proof is outside this contract. Never silently switch terms while the confirmation is open.
4. Trim and require a specific exclusion reason of 10 to 500 characters. Use the existing rule and error semantics.
5. Apply the existing archive operation and the same issue145 exclusion guards against the archived student. Insert one manual exclusion with the authenticated admin and server approval timestamp. An existing exclusion is not overwritten or duplicated. Offer Archive only when a prior manual exclusion already covers the student.
6. Record archive and manual-exclusion audit events in this transaction. Store the full reason on the exclusion, not in a broad audit summary. Include the selected tuple in safe audit metadata or summary.
7. Return success only after both decisions commit. Any validation, audit, counter or write failure rolls back archive flags, timestamps, counter delta and exclusion together. Do not catch an exclusion failure and retain the archive.

Load bounded evidence once where practical and classify the target's proposed archived state from that evidence. Do not double a whole class scan merely to preview one student. If the existing transaction budgets are exceeded, reject the combined action with no writes. Archive only must remain available without loading an entire release roster or requiring a valid academic calendar.

Include linked account archive/provenance fields in review evidence, which master currently omits. A class reassignment, account-state change, calendar change, exclusion or report change invalidates the combined offer. Existing class-release digests must likewise change when policy eligibility changes. Read-only queries must not use `Date.now()`; the actual archive timestamp is assigned only inside the mutation.

## Deterministic future eligibility

Evaluate policy only while building an unfrozen roster for the selected active, non-archived tuple. Never scan or mutate all terms at archive time.

The comparison is `term.startDate > student.archivedAt`, using stored finite epoch-millisecond values. Do not compare formatted dates, truncate to days, use the browser clock or infer a timezone. Equality does not qualify. A term starting one millisecond later qualifies; a term starting one millisecond earlier does not. Validate a sensible term range and archive timestamp relative to student creation. Malformed dates need review, not a guessed exclusion.

An automatic row requires all of the following:

- Both student and linked student account exist in the selected school and are currently archived. Their stored archive timestamp and archive actor agree and are present. Missing, non-finite or inconsistent archive metadata is not repaired by this flow.
- The student still belongs to the selected current class, existed by term end and has no conflicting tenant or class evidence. Check the linked account's role and ownership too. Same-session subject selections and same-class promotions can corroborate identity, but do not prove term participation by themselves.
- All bounded evidence has been inspected before applying policy. A sole different-class reference is a conflict too, not only a set containing multiple classes. Preserve existing foreign/missing candidate and duplicate safeguards.
- There are no assessment records or issued reports for this student in the selected term. Even one such row is participation evidence that the rule must not silently discard. Leave the row needing review, with the existing manual exclusion route available only when its guards permit it. Earlier-term marks and reports do not defeat the new term's rule.
- No explicit exclusion already governs this student and tuple. A valid manual exclusion takes precedence and retains its exact reason and approver. Conflicting exclusions remain blocked.

Represent a qualifying live row as `status: excluded`, `reasonCode: archived_before_term`, `exclusionSource: archived_before_term`, `approvedByName: null`, and `canExclude: false`. Show it in the reviewed roster rather than deleting it. Count it once in `excludedCount`, not in `eligibleCount` or missing certification. No new summary count is necessary.

A missing archive date is deliberately not replaced with `updatedAt`, `_creationTime`, today's date or the term boundary. Existing archived rows with complete matching metadata can qualify. Legacy rows without it retain review/manual behavior. No bulk backfill or live reconciliation belongs in this feature.

## Persistence, frozen provenance and compatibility

Use `classResultExclusions`, not a new lifecycle table. Change its validator to two source-aware variants sharing the existing tuple, student and reason fields:

| Variant | Stored provenance |
| --- | --- |
| Manual, including legacy rows | Optional `source: manual`, existing required `approvedBy` and `approvedAt`. Absence of `source` means manual. |
| Policy | Required `source: archived_before_term`, `policyVersion: 1`, `publicationId`, `frozenAt`, `archivedAt`, `archivedBy`, linked `archivedUserId`, and `termStartDate`. No `approvedBy` or `approvedAt`. |

Policy `archivedBy` identifies the actor who archived the student, not an admin approving this exclusion. `publicationId` and `frozenAt` identify the release that materialized the rule. The archived timestamp/user/actor and term-start snapshot explain the decision even after restore, re-archive or calendar edits. A stable stored reason can read "Archived before this term began." Do not expose account IDs as ordinary UI copy.

Compute policy rows during readiness without writes. In `releaseClassResults`, recompute and compare the review key as today, insert the publication, persist one policy exclusion per qualifying row and pin certified inclusions, all in that transaction. Existing manual rows remain untouched. Policy rows must never be created ahead of release or inserted by `excludeStudent`.

Frozen `getClassReadiness` must branch by source and read stored policy provenance, not current student/archive dates. Verify policy publication ID, tuple and freeze timestamp match the release, validate no inclusion/exclusion overlap or duplicates, and preserve count reconciliation. A policy row attached to an unfrozen or different publication is a conflict, not an editable manual exclusion. Do not rewrite existing releases or turn previously included students into exclusions.

Update `portal.ts` only where it interprets exclusion provenance. Manual rows retain the existing approval-time check. Policy rows require exact publication identity and frozen timestamp instead of `approvedAt`. Restore must not make a policy-excluded student receive a frozen release. The exact-inclusion graded reader remains the only report-granting path.

This schema change is necessary because today's required approver fields cannot truthfully describe an automatic rule. A nullable approver on an otherwise undifferentiated row would leave readers guessing. The union keeps old documents valid, existing indexes usable and existing table ownership/cleanup registrations intact. No new index, table, migration or approval backfill is required. Deploying a schema that permits policy rows requires source-aware readers and writers in the same reviewed change; old backend code must not resume writing against a narrowed old validator after policy rows exist. Deployment remains outside G1 authority.

## Restore and historical preservation

Restore clears flags on student and linked account through the existing mutation. Keep duplicate admission/login checks and active-status count behavior. Old archive metadata may remain for audit, but it cannot drive policy while either record is active. Re-archive assigns a new matching timestamp and actor; subsequent eligibility uses that archive event only.

Before release, restoring a policy-omitted student removes the computed omission, changes the review key and returns the student to normal eligibility checks. Missing marks still block; restore does not certify a report. An explicit manual exclusion remains explicit before and after restore. After release, every stored manual or policy exclusion stays frozen. Never delete exclusions as a side effect of restore.

Current portal archive access restrictions remain in force. Once restored, a student with an older frozen inclusion can again resolve that same pinned card under existing authorization; a frozen exclusion never becomes an inclusion. Keep Admin historical-report access and billing links unchanged.

Add optional `schoolId` to `getStudentProfile` and pass it from the existing profile editor alongside the archive/context calls. This is selected-school argument/auth plumbing required by the new archive entry path, not a rewrite of general student editing. Leave the existing restore API, archive listing and archive browser untouched. Their pre-existing default-school behavior is a separate finding, not authority for a broader fix here. Verify the existing restore mutation's effects on computed/frozen eligibility through its current supported authorization contract.

## Confirmation and roster sketch

Audience is the school admin archiving a student and staff reviewing one class release. Reuse `ConfirmationModal` children for a labeled radio group and conditional reason textarea. Default to Archive only so an old click path does not silently gain a manual exclusion.

```text
Archive student record
Amina Cole, STU-001
Example School / JSS 1 / 2026-2027 / First term

(o) Archive only
( ) Archive and exclude from First term results

Reason for exclusion [shown only for the combined choice]
[10 to 500 characters]

The student will leave active rosters. Existing records and released
reports are kept. While archived, the student is automatically left
out of terms that begin after the archive date unless their records
need review.

[Cancel] [Archive student / Archive and exclude]
```

For Archive only add "This does not exclude the student from this term's results." For the combined choice add "The student will not receive this class release, even if a report is certified." Do not claim archive itself publishes results, permanently deletes history or guarantees every future conflict will be omitted.

While context loads, show "Checking current term..." and disable the combined choice, not Archive only. For unavailable, already released, ambiguous or already excluded context, show the exact reason beside that choice. For a stale offer, keep the dialog open, clear the combined selection/reason or require fresh explicit confirmation, and tell the admin to review the changed context. Reset modal state on student or selected-school changes. Do not let a late response for the previous student close the new student's editor.

Disable submission and dismissal while a request is pending, retain entered reason after a known validation error, and show the failure inside the dialog. Cancellation and Escape before submission write nothing and restore focus. Success notices distinguish "Student archived." from "Student archived and excluded from First term results." Do not claim a failed or uncertain request saved both decisions.

In `ClassReleasePanel`, manual exclusions retain "Excluded" and "Approved by [name]". Policy rows show "Archived before term" and "Archived [date]. This term began [date]." with no approval claim or exclusion button. Frozen rows use the stored dates. Keep existing release confirmation/counts and real roster-change protection. Reuse neutral and semantic status styles; no new tenant color or global color replacement.

## Bounded acceptance

| Requirement | Required proof |
| --- | --- |
| FR-A1 | Archive only preserves the current-term blocker. Combined action with and without subject selections archives both records, inserts exactly one reasoned manual exclusion and changes the count once. Cancellation, short/long reasons, stale tuple, duplicate exclusion, released tuple and injected write/counter failure leave no partial combined writes. |
| FR-A2 | Strict timestamp boundary tests cover before/equal/after, invalid/missing/mismatched metadata and inactive archive flags. A later active term omits an unambiguous archived current-class student without a manual exclusion. Same-session selections alone are allowed; term assessment/report evidence stays reviewable. Foreign, single-other-class, multi-class, duplicate or oversized evidence never disappears. |
| FR-A3 | Earlier-term readiness/history and issued report bytes stay unchanged. Restore before release removes only computed policy eligibility and invalidates review. Restore after release preserves policy/manual exclusions and counts. Restore/re-archive uses the new timestamp. Existing frozen inclusions remain pinned under existing access rules. |
| FR-A4 | Non-default selected branch succeeds only with its admin authority. Default-school-only admin, publish-only officer and cross-school tuple/account fail. Initialized count changes once, withdrawn/graduated archive contributes no delta, missing count stays uninitialized, negative count fails atomically. Legacy manual exclusions still read with original approver. Policy freeze never fabricates approval. Stale/concurrent release produces one publication and one policy row per omitted student. |
| FR-A5 | Existing modal provides both choices, exact tuple, reason validation, cancel, pending/error/loading/unavailable states and keyboard/mobile operation. Roster and frozen view distinguish policy from approval. Counts and confirmation persist after reload. No wider UI redesign. |

Backend tests should extend `resultPublication.integration.test.ts`, `studentEnrollment.integration.test.ts`, `portalResultGate.integration.test.ts` and the relevant initialized-count cases in `functions/platform/__tests__/schoolEnrollmentCounts.integration.test.ts`. Keep issue145 current-term tests unchanged in intent. Add focused profile-archive component coverage and extend `apps/admin/__tests__/class-result-release.test.tsx`; retain generic modal tests rather than duplicating them.

## Verification plan and limits

Run local focused tests and type checks first. The G1 handoff lists exact commands. For touched school-facing implementation files, run `node scripts/audit-theme-colors.mjs` and classify findings rather than globally replacing colors.

Browser acceptance must use `verify-melo`, its feature map and the archive/exclusion entry-point checklist now in `report-lifecycle.md`. B2 added the recipe, not a new QA script. The existing workflow does not execute the archive cases; a future automation extension needs the supported runner contract and review before use. Baseline `qa:roles` and the current scoring workflow do not cover this feature. Use fresh marked synthetic pupils for archive-only, combined and future-term/restore paths, preserve original calendar/cohort records, and inspect actual release counts and Parent withheld/frozen behavior after reload. Do not reuse a released fixture as pre-release proof.

The Windows startup/pnpm blockers tracked in [issue #148](https://github.com/JStaRFilms/Melo_School_Management_System/issues/148) remain blockers, not permission for runner fixes. Before any later browser work, attest the exact isolated backend and worktree through QA doctor; follow exact-target maintenance if a reviewed backend update is needed. No profile copying, cloud access, server startup, maintenance or deployment occurred in G1. Record blocked criteria honestly until the owner environment supports these real paths. Retain reviewed screenshots/report scope and private failure evidence, then stop only owned QA processes through the runner.
