# Identity, admission, and portal corrections

Status: approved for implementation; domain integration and bulk-onboarding details are being designed.
Related requirements: FR-003, FR-005, FR-008, FR-009, FR-012, FR-017, FR-018.
Evidence: `docs/tasks/orchestrator-sessions/orch-20261011-142141/G1-findings.md`, G2-findings.md, G3-findings.md, and G4-findings.md.

## Goal
Capture student and family details once, retain structured names for all people, preserve session enrollment and login linkage during identity edits, and show truthful connection/provisioning state. Parents must be able to find authorized older published reports.

## Confirmed causes
- Roster admission submits a combined student name despite collecting separate fields. Compatibility reconstruction only derives parts for exactly two words.
- Profiles read the base class, while session rosters prefer incoming promotions. Identity saves unconditionally reconcile active-session subject selections.
- Student user replacement drops identity fields and rewrites authId whenever admissionNumber is supplied, including unchanged values.
- Existing-parent linking patches identity fields. Parent cards, household labels, and auth session headers use different name sources.
- Guardian text is independent of linked family contacts.
- Provisioning success is held in local component state rather than loaded from persisted account state.
- users has no middleName. Imports and admission conversion can preserve it in full name but compatibility formatting prefers first/last, dropping the middle.
- Teacher renames update full name but can leave stale structured name fields.
- Connection notices are inserted in page flow. Draft connection state can stay stale after reconnect, and account/context mismatches can be mislabelled.
- Old published reports are authorized, but history has visible limits of eight/twelve entries and no continuation.
- Student synthetic login IDs are not school-namespaced and are not mailboxes.

## Client components
Admin student workbench, creation/profile/family forms, standalone onboarding, credential panel, teacher/staff/admin identity forms, import review, and draft recovery.
Shared name formatting, status display, workspace navbar, reports, certificates and attestations.
Portal school/child identity headers, sign-in explanations, and result-history navigation.
Platform school-admin provisioning and admissions contacts must support the approved structured-name policy as well.

## Server components
Convex schema; studentEnrollment/studentNameCompat/studentClassMembership; academicSetup and group/staff projections; migration ingest/merge; admissions conversion; provisioningHelpers; auth/portal identity and publication-gated result queries.
Existing Resend outbox and rate-limiter patterns are the reference for notifications.

## Proposed data flow
1. A single admission screen stores student first/middle/last parts explicitly. A family section can be skipped, select an existing authorized parent, or create a new contact. When no household is linked, an entered address remains the student's own address rather than selecting household inheritance.
2. Existing-parent linking uses an explicit ID and never updates identity as a side effect. Parent editing remains an explicit operation. The contact picker selects Name or Email search and matches word prefixes across the authorized school. Database search and non-student/archive exclusion run before pagination; changing text or field resets the cursor.
3. Primary family contact is the default contact source. A genuinely different emergency contact has a separate, clearly labelled override. Existing guardian text is preserved pending review.
4. Identity-only edits patch named fields and preserve auth/person linkage, promotion and subjects. Class reassignment is a separately confirmed operation against the effective active-session class.
5. Provision/reset operations return server-derived linked-account state. Reopening loads that state. Authorize the target, validate the configured password policy and prepare its hash before claiming an operation. Preparation errors leave the prior account record unchanged and retryable; failures after auth writes may have occurred remain reconciliation-required. Passwords and prepared hashes are not stored in school account-state evidence; account status is independent of email delivery.
6. Parents select session/year, then see all authorized published terms/results for that child in the chosen session. Use bounded continuation to avoid old display caps. Keep result kind explicit for later midterm support without adding a new grading engine. Preserve publication and ownership checks.
7. Successful provisioning queues an idempotent notification to a deliverable authorized address. Synthetic login IDs never receive email. Missing sender configuration or send failure is reported separately from account creation.

## Proposed schema changes
Optional middleName on school user identities and all applicable structured-name contracts. Extend canonical person name parts only under the approved identity-ownership policy; school editing must not silently overwrite unrelated school records.
Provisioning operation/account-state evidence and communication outbox fields, reusing existing components rather than treating users row existence as credentials proof.
If new indexes are needed on large tables, stage them and document activation rather than querying staged indexes.
Household-label and deletion policy remain explicit approval points.
Contact search adds `users.search_name_and_school` and `users.search_email_and_school` over the existing name/email fields, filtered by schoolId. No new profile fields or custom data backfill. The backend deployment must finish building and activating these indexes before dependent queries/frontends roll out. For a large table, a separately authorized operator must stage them in a schema-only revision, then activate them before installing queries that reference them. Local validation does not authorize deployment or index backfill.

Academic history adds `academicSessions.by_schoolId_and_startDate` on `["schoolId", "startDate"]`. `listResultSessions` paginates that index descending, forwarding native pagination options unchanged. Equal academic dates retain Convex's descending `_creationTime` tie order. Archived sessions stay discoverable; parent/child authorization and issued reports are unchanged. Without an explicit session selection, the existing client chooses the first returned session.

The final source declares this index queryable, not staged. Frontend rollout remains gated on separately authorized backend index build/activation and registration of the updated query. For a large target, first deploy a schema-only revision declaring this index with `staged: true` while keeping the previous query registered. Wait for the index backfill to finish. Then remove `staged: true`, activate the index and register the updated query before releasing the frontend. Never install the new query while its index is staged and unavailable. No academic-date migration, deployment, backfill or activation is authorized by local tests.

## Compatibility and safety
Middle name is optional. Omission preserves it; explicit clearing removes it.
Latest user normalization: exactly two words in firstName become first and middle when middleName is absent/empty. Compound surnames stay in lastName unchanged. Existing explicit middle names are preserved, not overwritten. More ambiguous name parts remain intact pending deliberate review. Full-name-only legacy records retain a readable/editable full name until an operator deliberately supplies parts. Never fabricate name parts or truncate a name during an unrelated edit. Import duplicate review compares full-name-only records with live and staged names without filling structured parts. Full-name-only evidence requires the same complete name tokens, ignoring case, spacing and order, with at least two tokens. Shared class, surname or phone alone is not duplicate evidence; exact admission collisions still require review.
Use consistent authorized school identity for displays. Do not silently propagate one branch's edit into another school.
Existing issued narrative snapshots stay as published. Live/new reports and certificates follow corrected names. Historical snapshot correction requires its existing explicit correction/issuance rules.
Use a conditional class-change confirmation dialog when selection differs/conflicts with the saved active-session class, not an always-visible checkbox. Recheck expected effective class/session at commit and require review on stale assignments. Do not retire promotion or rewrite subjects without confirmed, current assignment intent. When no academic session is active, confirmation sends an explicit null session expectation. Missing evidence, session activation/deactivation and changed effective classes require fresh review. A confirmed no-session change updates the base class without changing inactive promotions or subject selections.
Standalone admission keeps the reviewed payload in a ref and its pending status in React state. Retries reuse the frozen request key and any household confirmation. Discard, restored drafts and success clear the pending status.
Unlinking does not delete identity. Permanent parent deletion, if approved, requires an explicit confirmation, no remaining student links or retained references, and preservation of shared auth/person identities and other schools.
Keep existing working student logins stable. Login-email-shaped strings are identifiers, not deliverable inboxes. Newly generated IDs must avoid cross-school and normalization collisions.

## Resend reference
Whisper source uses RESEND_API_KEY and KOE_EMAIL_FROM. It does not prove its deployed domain. School source already uses RESEND_API_KEY and MELO_EMAIL_FROM. The public contact fallback references hey@jstarstudios.com.
Use the approved configured JStar sender, school-branded message content, and a verified school reply-to if available. Do not create per-school domains or change DNS in this task.
Proposed deduplication is one provision/reset notice per school and recipient within five minutes, with durable operation IDs, provider idempotency, and explicit delivery state. Credentials operations still run; throttling affects notices, not whether the account is provisioned.
Never email temporary passwords. Expiring setup links are a separate optional scope decision.

An authorized retry rechecks the school, linked account and original recipient before applying the existing five-submission/23-hour bound. If the bound has been reached, it commits `reconciliation_required` and returns without queueing a worker or submitting to the provider. This also applies after missing-configuration workers have drained. The original attempt count/window, sender, recipient, payload and account evidence remain unchanged. The existing state query and notice panel show operator review without offering another retry; credential status stays separate.

## Approved decisions
- One admission flow using the linked primary family contact by default. Only a genuinely different emergency contact needs separate details.
- Add confirmed permanent deletion of genuinely unused school-local parent records, guarded by remaining student links and retained references. Preserve shared auth/person identities and other schools.
- Keep stable login IDs and preserve working credentials. New default identifiers must be school-namespaced.
- Send simple provisioned/reset account notices now. Keep manual password handoff and never email passwords.
- Apply unification to bulk/student-first onboarding too. Use "Parents and guardians" consistently and a relationship dropdown with Father, Mother, Guardian, Aunt, Uncle, Grandfather, Grandmother, Sibling, and a custom relationship option. Preserve existing custom relationships.
- Enter residential address once, with same residential address or different address for each additional parent/guardian. Inheriting contacts resolve the shared address; different-address contacts retain their own override. Preserve existing addresses and do not silently replace an existing household's address while linking another student.
- Allow a school's student-login suffix to use its configured school domain, linked to existing domain governance. A .local default remains acceptable. These are login identifiers, not mailbox provisioning or changes to the Resend sender. Settings changes must not silently rename working logins.

## Deferred work
Expiring email setup/reset links are explicitly deferred by the user. Keep this at the end of the task list and do not implement it in the current pass. This future task covers secure link expiry, password-choice UI, verified recovery ownership, and tests.

## Verification
Focused integration tests for structured-name preservation, optional/clear semantics, legacy names, teacher rename consistency, family picker isolation and link-only behavior, safe deletion guards, identity linkage preservation, and explicit class assignment.
Persisted credential status and actual portal authorization after reopen; repeated/concurrent notification requests and provider retry idempotency; synthetic recipients rejected.
Historical released records after promotion and beyond history limits, with unpublished/cross-school denial. Focused history coverage checks older-year backfills inserted after newer academic dates, the first session without a chosen selection, and descending chronology across bounded pages. Notice coverage checks committed operator review after configuration-loss workers drain or five submissions are exhausted, persisted query/UI state, preserved account/window evidence and no extra mocked provider submissions.
Connection status clears appropriately and header bounds stay fixed on desktop/mobile.
Use verify-melo for actual browser paths and retain limitations/evidence. Theme audit classifies tenant, semantic status/grade, product neutral and print colours.
The initial investigation had no passing tests because dependencies were absent in the fresh worktree. C4 local verification on `fix/portal-status-history-notices` passed 73 selected backend/Admin/Portal tests, three typechecks and scoped lint after three failing-before regressions. Schema coverage needs no registry change because this pass adds only an index, not tables or reference fields. Provider submissions were mocked. No deployment, index build/activation or browser QA occurred.
