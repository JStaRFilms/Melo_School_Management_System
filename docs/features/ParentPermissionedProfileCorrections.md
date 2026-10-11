# Parent-permissioned profile corrections

Status: scope approved; architecture investigation pending.
New current-build delivery unit after the identity/onboarding fixes. Not student self-service.

## Goal
Parents request permission to correct their own details and an authorized child's nonacademic profile. Admin grants a specific scope. Parents draft, review and submit once. Successful submission applies changes immediately and consumes permission.

## Latest decision
The user changed the earlier second-admin-review choice. There is NO second approval of submitted changes. Draft review and a bold final warning precede immediate apply.

## Behavior
1. Parent requests edit access for named targets/fields.
2. Admin approves that scope or rejects.
3. Parent saves recoverable drafts without changing live profiles.
4. Parent reviews actual changes and acknowledges: "These changes take effect immediately. You cannot edit again until an admin approves a new request."
5. Final submission validates ownership/scope/revision, applies only permitted changes and consumes edit access atomically.
6. Submitted changes and audit are retained; further editing requires a fresh request.
7. Students cannot request, draft or submit this feature.
8. A stale/revoked/invalid submission cannot silently overwrite newer data or claim changes were applied.

## Components
Portal request/status/draft/review/submit UI; admin initial grant/reject/revoke and post-submit audit.
Convex workflow storage, scoped authorization and audited atomic apply.
Generic draft primitives may be reused. Admissions business grants do not authorize profile editing.

## Proposed data flow
Authenticate requester and derive school/child context server-side at every operation.
Persist scoped request/grant and draft without changing live profiles.
Submit a validated immutable patch with grant/target revision checks, through corrected canonical B1 identity/profile helpers.
Preserve auth/person linkage, academic assignments, family boundaries, address inheritance and issued snapshots.
Approval of access and final apply are distinct transactions, but there is no later change-approval queue.

## Schema
D3 will finalize a bounded request/grant/submission lifecycle with requester/target/school, allowed fields, baseline revisions, draft, state and grant/apply audit metadata. Never accept arbitrary client profile patches or a global canEdit flag.

## Field boundaries
Own parent names/phone/address and specifically granted child nonacademic identity fields.
Exclude authentication/email/password, enrollment/results/subjects/fees, household links, another contact's identity and unreviewed uploads.

## Verification
Parent/student denial, linked-child and multi-school isolation, per-field grant enforcement, drafts, bold warning/acknowledgement, idempotent atomic apply/permission consumption, stale versions, revocation, new request, audit, preservation of login/promotion/subjects/history.
No implementation or runtime verification of this feature yet.
