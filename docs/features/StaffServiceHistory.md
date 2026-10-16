# Staff service history and return

Status: backend and lifecycle UI implemented. Local registered-function, schema coverage and component checks pass. Browser acceptance and backend deployment remain deferred.

## Goal
Record teacher, school-admin and generic staff joining, departure and same-identity rehire. Keep historical work and permission evidence while denying departed staff operational access in that school.

## Client components
`/academic/teachers` has a paginated Active/Departed service directory with retained desktop/mobile profile selection. Existing active teacher credential editing remains alongside `StaffLifecyclePanel`. `/admin` filters the existing administrative grouping by active, departed or archived status, including promoted teachers. Its Active statistic excludes departed administrators.

The same page includes an explicit Other staff section. It uses stored role `staff`, a prepared active `staff_onboarding` draft and `createStaff`, not a teacher-role substitute. It exposes joining, active/departed discovery, departure and reviewed rehire. Teacher, admin and other-staff creation accept an optional joining-day correction, defaulting to server UTC today. Passwords and date corrections are not stored in the name/email onboarding draft.

Service panels show named leadership, direct-report, teaching and independent-access blockers with existing resolution routes. Previous permissions remain labelled previous, not restored. The rehire dialog offers retention or a canonical replacement configuration using the shared capability checklist and existing template catalog. It previews the exact decision, requires acknowledgment, records the review, then rehires with its event/revision. Legacy unmapped staff can retain only; compatibility-grant replacement remains subject to the separate existing authority.

Periods, continuing gaps, unknown legacy starts and event timestamps are read-only and paginated. Empty source pages do not end discovery. Archive remains separate. Archive Audit now includes generic staff, displays service status for every staff role and confirms that Restore does not rehire. Historical attribution and other-school access are unchanged.

The endpoints are exported through `academicSetup` so generated API types can infer their contracts without backend-contacting codegen.

## Server components
`staffService.ts` owns transitions, indexed histories, profiles, directory discovery and review confirmation. `staffServiceContract.ts` supplies schema validators. Existing RBAC authority checks validate both retained and replacement permissions.

- New teacher and generic-staff accounts share the existing reserved staff-onboarding draft and canonical provisioning path. `createStaff` creates a real `users.role: staff` account, not a teacher or teaching assignment.
- School-admin creation and Platform initial-admin assignment create canonical person/membership linkage and joining evidence. Initial-admin provisioning rejects an existing canonical person matched by email or the exact deployment-issued auth token before deleting any presumed orphan login. Legacy initial-admin bootstrap records new joining without inventing canonical metadata; repeating it preserves service and identity. Bootstrap rejects departed/archived accounts and identity replacement. Promotion of an existing teacher does not create another service period or identity.
- New joining and rehire open a dated period. Departure closes the current period. The first departure of a legacy active staff record creates a period with unknown start, without inventing a joining event or historical role.
- Departure rejects self, resolved lead-admin, proprietor, active direct-report and teaching/form links. Teaching blockers apply to every staff role, including promoted teachers. Existing attribution is not deleted.
- An active canonical branch membership is suspended under the departure event and an exact membership revision. Other branches and global person status are unchanged. A previously restricted membership is not claimed by lifecycle.
- Canonical, legacy and foundation compatibility authorization deny departed staff. Active staff metrics include generic staff and exclude departures. New teacher/form/group assignment targets exclude departures.
- Admin upsert, email-linked creation, role changes and group assignment cannot rehire a departed record or replace its identity/service metadata. Reviewed student import already rejects non-student staff targets and is regression-tested.

## Permission-reviewed rehire
Rehire requires `staff.onboard` and a separate authorized access decision under `staff.permissions.manage`. An Admin title is insufficient once canonical permission management is active. Existing proprietor, delegation-ceiling, peer/superior and anti-self-edit checks still apply.

The operator previews previous and proposed templates, grants, restrictions, effective access, legacy baseline and compatibility grants. Confirmation compares the exact server-generated permission state and expected service revision, then writes an append-only `access_reviewed` event. Rehire requires that event, the current revision and the same operator. It rechecks current authority and permission state before committing.

Retained configuration must match the preview. Replacement uses the existing permission saver and audit authority. Previous full permission-row evidence remains in the immutable review event even when live configuration rows are replaced. `permissionsManagedAt` remains terminal; clearing configuration cannot restore role-based fallback.

Compatibility grants expose their scope, expiry and revocation. Rehire does not regrant revoked rows. Active compatibility grants can be explicitly retained under proprietor or existing unmigrated authority. Replacing them requires their separate existing authority first, rather than silently rewriting that permission system.

Return restores only the lifecycle-owned branch suspension. Independent branch revisions/revocation, account archive, global person restrictions, ambiguous linkage and reconciliation problems remain blockers. Old authorized operation replays return their original result without writes; changed payloads or new stale operations reject.

## Dates and context
Days use strict `YYYY-MM-DD`. Joining, departure and return default to the server's UTC day. Recorded timestamps are server milliseconds since epoch. Reasons and request keys are bounded. Invalid/future dates and service actions before the latest participation-effective day reject.

State changes at save, even for a corrected past date. There is no scheduling. Known current session/term names and IDs are captured automatically; missing configuration stays absent and does not block staff service. No first-session or database-creation-date fallback is used.

A period's end is the first inactive day and its start is the first active day. Same-day departure/return is ordered by event revision and does not invent a one-day gap. Legacy start dates and historical starting roles remain unknown.

## Archive separation
Archive/restore appends evidence but does not open or close service periods. Departed teacher archive/restore leaves its lifecycle-owned suspension and global person untouched. Active teacher archive restoration restores only recorded archive-owned access revisions; independent restrictions remain. Older archived canonical records without ownership evidence need separate access review rather than automatic membership resurrection.

Generic staff have explicit account archive/restore APIs. These change the school-local account restriction, not global person state or employment status. Existing admin archive controls retain their leadership/proprietor protections.

## Database
Optional user fields project employment status, service revision/effective day, current period and latest rehire review. Missing employment status means active for staff roles only. Memberships may reference the departure event that owns their suspension. Teacher archive ownership is separate.

`staffServiceEvents` contains joined, departed, rehired, access-reviewed and archive/restore evidence. It records school/user, available person/membership linkage, role at the action, before/after status, date, timestamp, actor, reason, revision, request key/fingerprint, period and access-review facts. Events are append-only.

`staffServicePeriods` contains known or legacy-unknown starts, optional known starting role, current academic context, closing day and opening/closing events. Periods are closed in place. History and period queries paginate through school/user indexes; no history arrays grow on user documents.

Tenant purge, demo seed/reset, branch-split inventory and schema coverage metadata include the new tables. No seed, purge, split or migration was run. Metadata does not authorize copying canonical ownership or permission-review evidence to another branch.

## Verification and limits
Registered-function tests cover joining, repeated periods, rehire review, retries/stale state, canonical and legacy denial, independent/global restrictions, branch preservation, protected staff, assignment links, archive separation, identity/role/provisioning/import bypasses and generic staff metrics/discovery. B1/student-count, staff/group/identity/authorization regressions, typecheck and changed-file lint are listed in the B2 result.

B3 adds component tests for teacher/admin/generic-staff reviewed rehire, retention/replacement, capability and assignment blockers, reviewed revision/event submission, cancel, corrected context, stale conflicts and unchanged uncertain review/rehire retries. Actual page tests cover generic onboarding through a prepared draft and mobile departed-staff discovery. A narrow Archive Audit integration test covers generic-staff discovery before restore without rehire.

These are local checks, not browser evidence or a live Better Auth provisioning trial. A registered-action regression reproduces the canonical-person orphan risk and verifies that provisioning leaves the retained login untouched, including when the person email has changed. Staff browser targets need a separately verified fixture protocol. QA tooling, runtime acceptance and deployment are not included here. Payroll, contracts, global account recovery and RBAC redesign remain out of scope.
