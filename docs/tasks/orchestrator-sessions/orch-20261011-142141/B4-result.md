# B4 result: PR3 local delivery

## Status and boundary

Implemented in `C:/CreativeOS/01_Projects/Code/Personal_Stuff/2026-03-14_School_Management_System/tmp/worktrees/identity-onboarding-portal` on actual branch `feat/parent-profile-edit-permissions`, stacked on PR2 checkpoint `9132f501fb57b28ee15126ae1115fb50ae54d5ca`.

B4 was the sole application-code writer and Git index owner. The main checkout was not used. No nested delegation, push, PR creation, deployment, live index activation, seed/reset, provider call or real email ran. Parent-owned `build-execution.json`, `B4-execution.json` and other task/runtime packets were preserved and excluded from staging.

This is local implementation delivery, not completion of the whole build or browser acceptance. Parent final review remains outstanding.

## Local implementation commits

- `b6e9eb91f8c9c8559d7783bd54da9990c908d0c7`: scoped correction transactions, closed validators, identity/target checks, retained applied evidence and backend tests.
- `5ba2e8c990f94a719353a1df154becab3aa920d2`: parent request/draft/review/immediate apply UI, admin initial permission/history controls, shared warning/diff rendering and component tests.

A separate documentation checkpoint records this result, the actual feature contract and the blocked browser recipe. Only explicitly owned paths were staged; each staged path list and diff check was inspected before committing.

## Actual behavior

The state machine is `requested -> granted -> applied`, `requested -> rejected`, and `granted -> revoked`. There is no second admin approval of changes. Terminal requests never reopen. One open request is permitted per parent/school; a new editing cycle requires a new request/grant.

Admin grants a nonempty subset of requested exact fields/targets. Parents manually save strict server drafts without live writes, explicitly recover after reload/conflict, review normalized actual changes, acknowledge the exact bold warning, and submit once. Acknowledgement is never draft data and resets with edits, server revision, permission/baseline or account/school/child/live context.

The warning is exactly:

**These changes take effect immediately. You cannot edit again until an admin approves a new request.**

Scope covers school-local own first/middle/last/phone, one exact own family-member address choice/override, and one linked active child's name/DOB/gender/address. Authentication, email, IDs, academics, fees, family links/status, shared residential address, other contacts and uploads are excluded. Names use B1's resolver. B1's contact-address helper was extracted unchanged into `familyContactAddress.ts` and reused by admin family writes and corrections. No admin profile mutation authorization was relaxed.

The shared effective Portal role resolver recognizes already-linked staff through valid same-school family rows. Students remain excluded even when incorrectly linked as contacts. Unlinked staff and email-only matches gain no access. Current identity, school, memberships, exact original family/member/child-user/link bindings and target status are rechecked rather than trusting cached Portal props or client requester IDs.

Grant baselines use scoped values and source IDs, not wall-clock timestamps alone or a new revision field across every writer. Submit is one Convex mutation: validate current access/scope/revisions/baselines/review/acknowledgement, apply only changed fields locally, append safe audit, freeze before/after evidence, consume the grant and clear the draft. Audit or write failure rolls back the whole transaction. Identical retries/concurrent submissions produce one immutable receipt and one apply audit. Changed-content/key/revision retries fail; a successful retry does not stale against its own writes but still rechecks current authorization.

The focused review found that changed links could otherwise strand an open grant. Admins can now reject/revoke invalid open permission from redacted list metadata after current-context rechecking. This close-only operation exposes no draft/evidence, writes no profile fields, and cannot grant/reopen/apply. Its actor still needs current selected-school admin authority. A suspended school remains denied. Closing allows an otherwise eligible parent to request fresh own-profile permission.

Applied private values are available only in authorized parent/restricted school-admin detail. Common audit and request lists carry IDs/state/field names, not addresses, DOB or proposed phone/name values. Admin detail does not return a parent's draft. When current target access is lost, terminal detail is withheld and history metadata marks access changed; retained evidence is not deleted or rewritten.

## Components, table and API

Portal entry points are in dashboard Profiles. Admin's roster header links to `/academic/students/profile-corrections` on desktop/mobile. The parent editor uses B3's fixed draft-header slot and domain-specific manual server controls, with no local storage or cross-context memory recovery. Applied receipts are read-only and offer a fresh-request action. Admin applied history has no approval action.

One table, `profileCorrectionRequests`, contains request/identity/source bindings, closed requested/allowed scopes, bounded reason, monotonic request/draft revisions, baseline, draft, decision metadata and the frozen applied object. Indexed reads cover purge, recent parent history, admin state pagination, active-request exclusion and content-bound request retries. The table is registered in schema coverage, tenant purge and demo reset. Typed retained user/family references participate in existing unused-parent/household guards. No live schema operation ran.

Actual public module: `api.functions.academic.profileCorrections`.

- Parent: `getWorkspace`, `requestCorrection`, `getRequest`, `saveDraft`, `discardDraft`, `refreshBaseline`, `review`, `submit`.
- Admin: `listRequests`, `getAdminRequest`, `decide` with `grant`, `reject` or `revoke`.
- Scope: `{ parentFields, parentMemberId?, childId?, childFields }`.
- Draft: optional typed `parent`, `parentAddress`, `child`; address is `{ mode: "residential" | "different", value? }`.
- Draft/review/apply arguments bind `schoolId`, `requestId`, `expectedRevision`, `expectedDraftRevision`. Review returns actual changes plus `reviewToken`. Submit also requires `submissionKey` and `acknowledged`, and returns `{ requestId, appliedAt, replayed }`.

The complete implemented contract is in `docs/features/ParentPermissionedProfileCorrections.md`. D3's separate submission table, generalized approval engine and profile-revision refactor were not adopted. Notice cooldowns and admissions grants do not apply.

## Final local checks

All checks below actually ran and passed on the final application-code state:

| Check | Result |
| --- | --- |
| Convex focused corrections/identity/name/result-gate/purge/reset/schema suites | 7 files, 72 tests passed |
| Portal complete suite | 9 files, 32 tests passed |
| Admin correction/profile/family suites | 3 files, 14 tests passed |
| Convex, Portal, Admin and Shared `tsc --noEmit` | All four passed |
| Explicit touched-source theme audit | Ran successfully; informational classifications below |
| Working and staged diff checks | Passed |

The 118 final tests cover 19 files. The new corrections backend suite has 28 tests. New Portal suites have 12 tests, plus the added student-entry denial test. New Admin controls have 5 tests. Convex tests include actual rollback after a failed final audit, concurrent identical submission, a fresh request after invalid-grant closure, and preservation of seeded promotions, subject selection, assessment rows, invoices and issued report snapshots. No provider requests were made.

Commands used `pnpm --filter @school/<app> exec vitest run`; the Convex focused command supplied `--testTimeout 20000` for cold module loading. TypeScript used the worktree's `node_modules/typescript/bin/tsc --noEmit -p <target>/tsconfig.json`.

Earlier runs exposed fixture/type issues and a cold-load timeout. They were corrected, not counted as passes. A Vite reference conflicted with this repository's existing global `ImportMeta.glob` declarations; the new test uses those existing declarations. Portal tests provide the actual draft-header context to avoid the harness's classic-JSX fallback issue in the untouched shared status component. Final checks above have no failing assertions or type errors. The full Admin suite was not rerun by B4; the parent's 381-test PR2 pass remains prior evidence, not B4 coverage.

### Theme classification

New rose text is semantic error status. Existing amber/emerald/rose in the Portal is semantic warning/success/error; grade colours still use the grade resolver. Existing Admin indigo actions remain product styling. Slate/white surfaces are product neutrals. No new tenant palette, shared residential branding, global replacement, status/grade substitution or print change was introduced.

## QA blocker and remaining limits

The exported QA doctor was invoked directly with this worktree's explicit `.env.qa.local` and `admin,teacher,portal` apps. It exited 1 with ENOENT for that private profile. No QA servers started, no backend/origin/source attestation completed, and no browser journey, screenshot, mobile measurement, keyboard assertion or reload proof ran. The normal Windows CLI entry-point no-op is not a passing doctor.

The recipe `.agents/skills/verify-melo/features/parent-profile-corrections.md` lists the required parent/admin/student/linked-staff, recovery, stale/concurrent, privacy and mobile/keyboard paths. A later authorized run also needs approved synthetic role/multi-school fixtures and the intended B4 backend source on the isolated target. B4 did not deploy or borrow another profile.

No confirmed blocking defect remains in the locally tested paths. Independent final review and browser QA are still required before an end-to-end completion claim. Parent history is intentionally limited to the latest 20 records; admin state history has pagination. Current-access loss withholds private terminal detail rather than relaxing ownership to show old PII.

Secure email setup/reset links remain future backlog work at the end, not B4. No temporary-password/provider workflow was changed.
