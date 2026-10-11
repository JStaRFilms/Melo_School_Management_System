# Identity, onboarding, and portal fixes

## Workspace
Branch `fix/identity-onboarding-portal` starts at upstream `origin/master`, commit `cf04c9ee7aa7c5a4d74f81621ea4716575c880b3`.
All edits belong in this worktree. The main checkout's environment-handoff edits are unrelated.

## Objective
Resolve the reported family, admission, name, session, connectivity, and provisioning problems without losing records or changing academic assignments as a side effect.

## User reports and later corrections
1. Parent names differ between household, contact card, and portal after reuse. Keep the existing Edit action. Provide deliberate, safe deletion rather than treating unlink as deletion.
2. Offer existing parents to link without re-entering details.
3. Keep class-assignment confirmation after the user's later clarification in report 12.
4. Unify Quick Admission and Family Onboarding. Explain where guardian fields go and avoid typing student/parent details twice.
5. Put connection and pending state in one consistent place without pushing the page down. Do not call a backend disconnection "no internet".
6. Add optional middle names and propagate names.
7. Provisioning must show pending and actual persisted access state, including after reopening.
8. Explain the current admission-ID synthetic student login policy and decide on its presentation.
9. Fix roster names with blank profile fields. Middle names apply to everyone, including parents, teachers, staff, and students.
10. Parents must retain authorized access to published results from older sessions. Provisioned status must be obvious.
11. Inspect Whisper V2's Resend configuration read-only. Plan provisioning emails through the existing JStar Films sender domain with anti-spam protection.
12. Fix the active class selector using a previous session's class. Identity edits must not undo promotion or change enrollment without explicit assignment confirmation.

## Lifecycle and approval
Genesis investigates existing code and records causes, proposed changes, tests, and questions.
Design specifies the approved admission, contact, login, notification, and status interactions using the existing UI.
Build implements approved changes, adds focused regression tests, and runs one focused review.
Do not start significant schema/product changes before approval.

## Investigation tasks
- G1: identity, admission, family reuse/deletion, and session-class correctness.
- G2: provisioning, login identifiers, historical portal reports, and Whisper Resend reference.
- G3: all-person structured name propagation and compatibility.
- G4: parent agent checks connection and pending-state behavior, consolidates findings, and asks concrete decisions.

## Delivery and commits
The user explicitly requested incremental commits. Plan three PRs:
1. Identity/admission corrections: names, effective-class/confirmed reassignment, unified intake, parent/guardian contacts, addresses, unused-parent deletion and stable configurable login IDs.
2. Portal/notification corrections: persisted provisioning presentation, fixed connection/recovery status, session/term historical-result navigation and simple Resend account notices.
3. Parent-permissioned own/child profile editing: initial admin grant, recoverable drafts, bold warning, immediate atomic submit/lockout and audit.
Use stacked branches when dependencies require it. Do not push/open PRs until their implementation/checks are ready and external action is authorized.
Make small coherent tested local commits, with exclusive index ownership by the current writer. Never stage unrelated changes or commit a known failing partial implementation. Avoid a single huge final commit.
B1 currently owns code and Git index; parent only authors separate planning docs until it completes.

## Added current-build delivery unit
Parent-permissioned own and linked-child nonacademic profile corrections. Parent requests scope, admin grants access, parent drafts/reviews/submits once. Final successful submission applies immediately and atomically consumes editing permission. Bold immediate-effect/lockout warning and audit required. Students excluded. The user's earlier second-admin-review choice is superseded.
D3 investigates, B4 follows current fixes. Keep this a separate delivery unit/follow-up PR if useful. Expiring email setup links remain future work at the end of the backlog.

## Safety
No production deployment, production migration, credential reads, or real emails. Whisper reference repository is read-only. Tenant isolation and report-publication rules remain mandatory.
Existing names must not be guessed or destructively split into middle names. Historical record behavior needs an explicit decision if implementation changes stored snapshots.

## Completion criteria
Every original report is mapped to a verified fix, existing correct behavior, or an explicit unresolved decision.
Focused tests cover identity/name preservation, active-session assignment, family linking, persisted provisioning status, historical result authorization, connection copy, and notification deduplication.
Middle names are optional and old records remain readable.
Touched school-facing files pass the informational theme audit with colour categories recorded.
Real browser acceptance paths use the repository's verify-melo procedure when build reaches QA.

## Deliverables
Investigation findings, approved feature document, task records, implementation diff, relevant test results, and one focused review.

## Tracking note
The T3 thread is bound to the worktree, but this provider's filesystem tools still default to the main checkout. Every filesystem operation therefore uses the explicit worktree path. Do not initialize tool-managed board artifacts in the wrong checkout. These authored packets are the durable tracking records until that binding is available.
