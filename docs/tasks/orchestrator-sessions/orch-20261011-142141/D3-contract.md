# D3 architecture contract

Verified cwd as:

`C:/CreativeOS/01_Projects/Code/Personal_Stuff/2026-03-14_School_Management_System/tmp/worktrees/identity-onboarding-portal`

Read D3, B1/B2, G1/G2/G3 findings, feature documents, repository instructions, Convex guidelines, identity resolution, drafts, admissions submission, RBAC, audit, and schema. Loaded unslop. No writes, delegation, tests, deployments, credentials, or provider calls.

## 1. Delivery boundary

This is **approved current work**, queued after B1/B2. It is separate from deferred email setup/reset links.

The workflow is:

1. Parent requests permission for named targets and fields.
2. Admin grants a subset or rejects the request.
3. Parent drafts and reviews changes without altering live records.
4. Parent acknowledges the final warning.
5. One successful mutation applies changes immediately, records immutable submission evidence and audit, and consumes permission.

There is **no second admin review**, pending-change approval queue, or post-submit approval action.

B1 remains the sole active code writer. D3 must not interrupt its implementation.

## 2. Existing contracts and integration limits

Paths are relative to the verified worktree.

| Existing contract | D3 consequence |
|---|---|
| `packages/convex/functions/academic/portalIdentity.ts`, `resolvePortalMemberships` | Reuse token-first identity resolution and active school membership checks. |
| Same file, `getPortalStudentAccess` and `resolvePortalStudentContext` | These also admit students. D3 must explicitly select a **parent** membership before resolving children. |
| `packages/convex/functions/academic/drafts.ts:18-37` | Existing generic draft authorization is admin/staff-oriented and rejects entity editing. Registering a new form key alone does not authorize parent drafts safely. |
| `packages/shared/src/drafts/registry.ts` | Reuse strict, bounded payload validation and server-only recovery conventions. Existing onboarding payloads are too broad for D3. |
| `packages/shared/src/drafts/useFormDraft.ts` | Its callbacks support a domain-specific backend adapter. Recovery includes optional in-memory caching; D3 must disable that recovery path and use server recovery only. |
| `packages/convex/functions/admissions/applications.ts`, `saveDraft` and `submit` | Reuse version checks, scoped correction validation and immutable submission patterns, not admissions ownership, entitlements or lifecycle states. |
| `packages/convex/functions/academic/rbac.ts`, `requireCapability` | Admin decisions require explicit selected-school authorization. |
| `packages/convex/functions/academic/audit.ts:95` | Use `recordAuditEventHelper` inside the successful apply transaction. |
| `packages/convex/schema.ts`, `families`, `familyMembers`, `students` | Address inheritance is shared state. A personal address grant must not become permission to edit the household address. |

The inspected checkout contains in-flight B1 changes, including optional middle names, address modes, identity-preserving patches and gated class assignment. These are not a completed or tested integration contract.

The existing public `updateStudent` and `updateStudentFamilyParentContact` mutations remain admin-authorized and accept fields outside D3 scope. Do not relax their authorization or call them as a parent. Extract only the required transaction-local profile helpers after B1 settles.

## 3. Editable-field matrix

Each grant names an exact target and allowed fields. No wildcard or blanket `canEditProfile`.

For the first delivery, one request may cover the requesting parent's school-local identity, one linked child, or both.

| Target | Allowed fields | Storage and restrictions |
|---|---|---|
| Own parent identity | `firstName`, `middleName`, `lastName`, `phone` | Requester's resolved school-local `users` row. No supplied requester ID. |
| Own parent address | Address choice and custom address | Exact own `familyMembers` row, identified by household context. Change only its `addressMode` and `addressOverride`. |
| Linked child identity | `firstName`, `middleName`, `lastName` | Child's school-local user through corrected B1 name handling. |
| Linked child profile | `dateOfBirth`, `gender`, address choice/custom address | Exact `students` row. Address changes affect only this child. |

Explicitly exclude:

- Email, password, login/admission identifiers and auth/person linkage.
- Class, session, promotion, subjects, results, fees and house assignment.
- Family links, relationship, primary-contact status and household label.
- Household residential address and another contact's identity.
- Photos, uploads, documents and unrestricted custom attributes.

Additional rules:

- Omission preserves a value. Explicit `null` clears only fields whose domain permits clearing.
- Preserve full-name-only legacy records during unrelated edits. Do not require guessed name parts.
- B1's two-word first-name normalization must appear in the review diff. If normalization changes `middleName`, that field also needs grant coverage.
- Derived display `name` may change with authorized structured-name edits; it is not an independent unrestricted input.
- Switching to residential inheritance displays the resolved household address. Setting a custom address creates a target-local override. Neither operation patches `families.residentialAddress`.

## 4. States

Persist these request states:

```text
requested -> granted -> applied
requested -> rejected
granted   -> revoked
```

`applied`, `rejected` and `revoked` are terminal.

Drafting and reviewing are UI stages within `granted`, not additional approval states. `applied` means the live changes committed and the editing permission was consumed in the same transaction.

Discarding a draft clears draft content but leaves the grant available. It does not apply changes.

Allow only one open request per parent and school. A fresh request receives a new ID; never reopen a terminal request or reuse its grant.

## 5. Minimal persistence

### `profileCorrectionRequests`

One bounded operational record:

- `schoolId`, server-derived `requesterUserId`.
- Optional requester person/membership IDs where canonical identity exists.
- `state`, `revision`, timestamps.
- `requestedScope`, bounded reason.
- `allowedScope`, granting actor/time.
- Server-captured target baselines and relationship/address-source bindings.
- Strict `draftPayload`, `draftRevision`, `lastSavedAt`.
- Reject/revoke actor, time and bounded reason.
- Optional `submissionId`.

Scope entries use typed target variants. Parent-address entries bind an exact own family-member row; child entries bind an exact student row.

Indexes:

- `by_schoolId_and_requesterUserId_and_state`
- `by_schoolId_and_state`

Enforce the open-request rule through an indexed read in the request mutation. Do not assume indexes provide uniqueness constraints.

### `profileCorrectionSubmissions`

One insert-only record per successful request:

- Request, school and submitting actor IDs.
- Grant revision, reviewed draft revision and submission key.
- Canonical payload digest.
- Exact normalized changed fields, before values and applied values.
- Baseline/result revisions.
- Acknowledgement version and server timestamp.
- Applied timestamp.

Index `by_requestId` supports one-submission enforcement and retry lookup.

No update/delete API for submission evidence. Clear operational draft content after apply.

Reuse generic draft UI controls through domain-specific callbacks. Keep D3 drafts in the request record rather than broadening the existing admin/staff draft authorization machinery. Validate a dedicated shared payload schema; do not reuse onboarding schemas or accept arbitrary database patches.

## 6. Authorization and stale checks

Every parent request, recovery read, draft save, review and submit must:

1. Resolve identity server-side.
2. Select an active **parent-role** membership for the requested school.
3. Verify request ownership and school equality.
4. Verify every selected child through current same-school family links.
5. Verify target users, students, family members and families remain valid and unarchived.
6. Reject transferred/moved children for editing, even where historical report reading remains allowed.
7. Reject identity reconciliation ambiguity.

Never authorize by client email, requester ID, subject alone, cached child list or request ownership alone.

Admin grant/revoke must independently resolve the actor and selected school, then recheck the requester's current parent membership and target links.

### Revision contract

Keep three checks separate:

- Request/grant `revision`.
- `draftRevision`.
- Live target profile revisions.

Add optional monotonic `profileRevision` fields where B1 does not already supply an equivalent. Legacy absence means zero. Relevant profile writers must increment them through the shared helpers.

Capture revisions for the parent/child user, child profile, selected family-member address and household address source as applicable. Also bind the exact identity and family-link IDs. Recheck current membership and linkage regardless of revision equality.

A stale baseline returns `STALE_PROFILE`. Preserve the draft and grant, but require a new baseline review and acknowledgement. Provide an explicit refresh operation guarded by the expected request/draft revisions. Never refresh baselines automatically during submit.

## 7. Proposed API contract

Names below are proposed D3 APIs, not existing exports.

### Parent

- `getCorrectionWorkspace({ schoolId, studentId? })`
  Returns authorized targets, effective addresses, open request/status and editable-field definitions.

- `requestCorrection({ schoolId, requestedScope, reason, requestKey })`
  Derives requester, validates targets and creates one request. Identical retries return the original request.

- `getCorrectionDraft({ schoolId, requestId })`
- `saveCorrectionDraft({ schoolId, requestId, expectedGrantRevision, expectedDraftRevision, payload })`
- `discardCorrectionDraft({ schoolId, requestId, expectedGrantRevision, expectedDraftRevision })`
- `refreshCorrectionBaseline({ schoolId, requestId, expectedGrantRevision, expectedDraftRevision })`
- `reviewCorrection({ schoolId, requestId, expectedGrantRevision, expectedDraftRevision })`
  Returns normalized actual changes and a review digest bound to baselines and revisions.

- `submitCorrection({ schoolId, requestId, expectedGrantRevision, expectedDraftRevision, reviewDigest, submissionKey, acknowledged: true })`
  Returns `{ submissionId, appliedAt, replayed }`.

### Admin

- `listCorrectionRequests({ schoolId, state, paginationOpts })`
- `getCorrectionRequest({ schoolId, requestId })`
- `grantCorrection({ schoolId, requestId, expectedRevision, allowedScope })`
- `rejectCorrection({ schoolId, requestId, expectedRevision, reason })`
- `revokeCorrection({ schoolId, requestId, expectedRevision, reason })`
- `getCorrectionSubmission({ schoolId, submissionId })`

Grant scope must be a nonempty subset of the valid requested scope.

Reuse existing `enrollment.intakes.manage` plus the existing school-admin guard for initial grant/reject/revoke controls. Do not grant parents that capability. Parent authority is the explicit domain grant. Submission-detail access also requires school-scoped administrative authorization; general audit readers receive redacted summaries.

## 8. Atomic final submission

The final mutation must:

1. Authenticate and recheck parent, school, ownership and current links.
2. Detect an identical completed retry using the stored submission key and bound digest. Return its receipt without another write or audit event.
3. For a new submission, require `granted`, matching grant/draft revisions and acknowledgement.
4. Normalize the stored draft, reject unapproved fields and recompute the review digest.
5. Verify live target revisions and address/link dependencies.
6. Apply only the validated changed fields through transaction-local B1 helpers.
7. Insert immutable submission evidence.
8. Append the apply audit event.
9. Mark the request `applied`, consume permission and clear draft content.

Use one Convex mutation. No provider action, provisioning operation or asynchronous apply step belongs here.

An identical retry need not match live profile revisions after its own successful write. It must still authenticate and satisfy current access checks. Changed-content key reuse fails.

Any validation or write failure rolls back application, receipt, audit and permission consumption together. No successful-apply claim survives a failed transaction.

## 9. UI and audit

Portal entry points:

- "Request profile correction" in own details and the selected child's profile.
- Request status and granted-field editor.
- Server draft recovery.
- Before/after review showing only actual normalized changes.
- Applied receipt followed by read-only details.

Immediately above final submission display:

**These changes take effect immediately. You cannot edit again until an admin approves a new request.**

Require an unchecked acknowledgement checkbox. Do not autosave acknowledgement. Any draft, grant, baseline or school/child-context change clears it. Disable submission until pending draft saves finish and the reviewed revision matches the saved revision.

Admin entry points belong beside student/family management. Show pending permission requests, granted access with revoke, and applied history. Do not label applied history "awaiting approval."

Audit request, grant, rejection, revocation and successful apply. Record actor, school, request/submission correlation, target IDs and field names. Keep names, addresses, birth dates and phone values in restricted submission evidence, not broad audit summaries. Audit failure must roll back apply.

## 10. Focused acceptance tests

- Students and non-parent contacts cannot request, read drafts, save, review or submit.
- Forged requester, foreign school, other contact and unlinked child fail.
- Request and grant scope cannot admit excluded fields.
- Draft/recovery leaves live profiles unchanged and does not use local persistent recovery.
- First/middle/last normalization, clear semantics and legacy preservation round-trip.
- Address overrides affect only the approved parent/child. Household address, other contacts, overrides and legacy values remain intact.
- Final warning is bold; acknowledgement is required and resets after changes.
- Stale draft/grant/profile, revocation, archived membership and moved/unlinked child fail without consuming access.
- Successful multi-target apply is atomic, audited and immediately locked.
- Concurrent identical submit produces one receipt and one audit event. Different-content retries fail.
- Concurrent admin edit versus submit cannot silently overwrite newer data.
- Auth/person links, login IDs, promotion, subjects, fees and issued snapshots remain unchanged.
- Fresh permission request works after a prior apply.
- Browser verification covers parent, admin and student-denial paths, reload recovery, keyboard and mobile behavior using verify-melo. Run the informational theme audit for touched school-facing UI.

## 11. Dependencies and blockers

D3 needs B1's settled name/profile/address helper contracts and B2's corrected portal identity display and form conventions. The inspected public mutations are not suitable parent apply helpers yet.

The D3 delivery must add revision handling to relevant profile writers and prove school-local name changes do not mutate unrelated schools through a shared canonical person.

No further product decision is required by this contract. Runtime verification remains outstanding; this was read-only architecture research.
