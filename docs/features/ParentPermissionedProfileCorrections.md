# Parent-permissioned profile corrections

Status: implemented locally for B4/PR3. Final review and isolated browser acceptance remain outstanding. This is parent self-service, not student self-service.

## Goal and approved behavior

An admin grants initial permission for exact fields and targets. The parent saves a server draft, reviews normalized changes, acknowledges the final warning, and submits once. Successful submission applies those changes immediately and consumes permission in the same Convex transaction. There is no second approval queue.

The final warning is bold and reads exactly:

**These changes take effect immediately. You cannot edit again until an admin approves a new request.**

The acknowledgement is component state only. It is never part of a saved draft. Editing, a changed server draft, permission/baseline revision, live profile context, or a school/child/account switch invalidates the review and acknowledgement. Submission stays disabled during operations, with unsaved edits, before recovery, or on stale data.

## Entry points

- Portal dashboard, "Profiles": "Correct my details" and "Correct this child's profile". Students see neither control. The child entry requires an active selected child; the own-details entry also works while viewing family history.
- Admin, Academic > Students: "Parent profile corrections" opens `/academic/students/profile-corrections`. It lists requested permission, granted access, applied history, rejected requests and revoked requests. Admins select a nonempty subset, reject with a reason, or revoke unused permission.
- Parent request history shows the latest 20 requests. Admin history is paginated by state. Applied detail is read-only and provides a fresh-request action, not another approval action.

## Scope

A request may cover the school-local parent's first/middle/last name and phone, one exact own family-member address, and one currently linked child's first/middle/last name, DOB, gender and personal address.

Address permission is one field encompassing the inheritance choice and target-local override. Residential inheritance reads the existing household address. Neither the parent nor child address editor can update `families.residentialAddress`. Other contacts, links, relationship, primary-contact status and household labels are excluded.

Authentication, email, passwords, login/admission IDs, class/session, subjects, results, fees, house assignment, uploads and unrestricted attributes are excluded by closed validators. No admissions permission or notice API authorizes this workflow.

Omitted fields preserve stored values. Explicit null clears optional middle names, phone, DOB or gender. Name edits use B1's `resolveStoredUserNameFields`; induced first/middle normalization requires permission for every changed part and appears in review, including the derived display name. Full-name-only legacy records are not split during unrelated edits. Personal addresses remain unchanged unless deliberately selected.

## Client components

- Portal `ProfileCorrections.tsx` handles initial scope, bounded reason, status, recent history and applied receipts.
- Portal `ProfileCorrectionEditor.tsx` handles explicit server recovery, manual saves/discard, stale refresh, review and final acknowledgement. It does not use browser storage or cross-context memory recovery. A query denial removes the editor and asks for reload/current-link verification.
- Admin `profile-corrections/page.tsx` handles initial permission and restricted applied detail. Draft values are not returned by the admin detail API. Invalid-link open requests have a separate redacted close-only control.
- Shared `ProfileCorrectionChanges` renders before/after evidence. The editor reuses B3's reserved draft-header slot and status indicator.

## Server authorization

Every parent operation resolves the authenticated token through `resolvePortalMemberships`, selects exactly one effective parent membership in the requested school, and rechecks active school, identity projection and links. Requester IDs are never client arguments. Canonical person/membership/auth bindings and original child-user/family/member/link IDs bind each request.

The shared Portal role resolver now recognizes staff already linked through a valid same-school family-member row as effective parents. It never grants student-role access or matches by email. Unlinked staff remain denied. Corrections write school-local users, not the shared canonical person or other schools' projections.

Grant/read/draft/review/submit reject archived/inactive/reconciliating identities, foreign targets, moved or inactive children, and changed exact links. Admin decisions use selected-school `enrollment.intakes.manage` and the existing school-admin guard; existing student/family admin mutation authorization is unchanged.

A school admin may reject or revoke an invalid open request after rechecking its current context. This close-only path exposes no draft/evidence and writes no profile data. It prevents an old transfer/archive from permanently blocking a fresh request. It cannot grant, reopen or apply permission. An inactive school or unauthorized admin still cannot use it.

Detailed terminal evidence also requires current identity/link authorization. After a target loses access, lists retain IDs/state/timestamps and mark current access invalid, but withhold profile values. The stored evidence remains retained.

## Persistence and data flow

One new table, `profileCorrectionRequests`, stores:

- School, server-derived requester, canonical identity and exact target/source bindings.
- Content-bound request key, reason of 1 to 500 characters, requested and allowed closed scopes.
- `requested -> granted -> applied`, `requested -> rejected`, or `granted -> revoked`.
- Monotonic request and draft revisions, a server baseline, strict draft, save timestamps and decision actor/reason.
- One frozen applied object with submission key, review token, reviewed permission/draft revisions, timestamp and normalized before/after changes.

Indexes support indexed tenant purge, admin state pagination, recent parent history, one-open-request checks, and content-bound request retries. The table is registered in schema coverage, tenant purge and demo reset. Typed retained user/family references participate in B1's existing unused-parent/household deletion guards. No live migration, index activation, deployment or seed/reset ran.

At grant, the server captures the relevant values and source IDs. Names include the parts needed to derive display name; addresses include inheritance/override and household source. Stale checks compare those values and bindings, not only `Date.now()` or `updatedAt`. There is no profile-revision refactor across unrelated writers.

Manual draft saves never write live profiles. A stale baseline preserves the draft and permission. The parent must explicitly refresh, recover the saved draft, review the current before/after values and acknowledge again. Submit never refreshes a baseline automatically.

## API contract

All functions are in `api.functions.academic.profileCorrections`:

- `getWorkspace({ schoolId, studentId? })`: current authorized parent/child/address choices and recent redacted request summaries.
- `requestCorrection({ schoolId, scope, reason, requestKey })`: one open request per parent/school. Identical keys return the original ID; different-content reuse fails. Terminal requests are never reopened.
- `getRequest({ schoolId, requestId })`: private parent detail, server draft, stale indicator and applied receipt. Auth identifiers and baseline content are omitted.
- `saveDraft({ schoolId, requestId, expectedRevision, expectedDraftRevision, payload })`: validates bounded typed payload/scope and returns the next draft revision.
- `discardDraft` with those context/revision arguments: clears the draft, not permission.
- `refreshBaseline` with those context/revision arguments: explicitly captures current values and increments the permission/request revision.
- `review` with those context/revision arguments: returns normalized actual changes and a SHA-256 review token. Empty/no-op changes fail.
- `submit({ ...contextAndRevisions, reviewToken, submissionKey, acknowledged })`: returns `{ requestId, appliedAt, replayed }`.
- `listRequests({ schoolId, state, paginationOpts })`: school-admin redacted paginated summaries, including current-access validity.
- `getAdminRequest({ schoolId, requestId })`: school-admin restricted request/applied detail, current target names and stale indicator. No draft or auth/baseline values.
- `decide({ schoolId, requestId, expectedRevision, decision, allowedScope?, reason? })`: grant a valid requested subset, reject a requested record, or revoke a grant. Closing needs a nonempty bounded reason.

Scope is `{ parentFields, parentMemberId?, childId?, childFields }`. An address field requires the exact own member ID. Child fields require one exact child ID. Draft payload has only optional `parent`, `parentAddress` and `child` objects; address values are `{ mode: "residential" | "different", value? }`.

## Atomic final submit

One mutation rechecks current parent/school/targets, permission and draft revisions, acknowledgement, relevant baselines and review token. It computes only changed allowlisted fields through B1's name resolver and the extracted shared contact-address helper, then performs transaction-local patches. It appends privacy-safe audit and freezes before/after evidence, changes state to applied, and clears the draft.

Any failed validation, profile write or audit rolls back all writes and leaves permission unconsumed. An identical concurrent/retried submit returns the same receipt without a second apply/audit. The retry still checks current authorization, but does not compare the old baseline against its own successful writes. Changed key/content/revisions fail.

Audit contains actor/request/target IDs, state and field names, not addresses, phone values, DOB or names from the proposed changes. Private values remain in authorized drafts and restricted applied detail. No provider, asynchronous profile apply, notice cooldown or second admin change approval is involved.

## Verification and limits

Focused Convex, Portal and Admin tests cover authorization, forgery, scoped/induced changes, recovery, acknowledgement reset, stale/revoked data, invalid-context cancellation, rollback, concurrent retries, one-shot/new-request behavior, privacy, household protection, other-school identity and historical records. TypeScript checks cover Convex, Portal, Admin and Shared. Exact final counts and local commit hashes are in `B4-result.md`.

Browser acceptance is blocked. The direct QA doctor entry point fails because this worktree's `.env.qa.local` is missing. No QA servers, normal-dev/production fallback, screenshots, mobile/keyboard measurements, real emails or provider calls ran. The normal Windows CLI entry-point no-op is not a passing doctor. Follow the [verification recipe](../../.agents/skills/verify-melo/features/parent-profile-corrections.md) when an attested isolated profile is available.

Secure setup/reset links remain future backlog work and are not part of B4.
