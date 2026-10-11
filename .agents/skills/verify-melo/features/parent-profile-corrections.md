# Parent profile corrections

## Evidence limit

B4 has local Convex/component tests and TypeScript checks. It has no browser evidence. Calling the exported QA doctor with this worktree's explicit `.env.qa.local` fails with ENOENT. The ordinary Windows CLI entry point can exit without running doctor and is not a pass.

Do not start normal development or production, borrow another checkout's profile, deploy B4, provision accounts, send notices, or call providers under this task. A later authorized QA run needs the private isolated profile, attested Admin/Portal origins, the intended B4 backend source, and approved synthetic fixtures. Follow QA authority and exact-target maintenance before any separately authorized backend update.

## Required fixtures

Use an active parent and linked child, an authorized school admin, a student-only account, an unlinked staff account, and a staff account already linked as a parent. Multiple-school identity tests need approved school-local projections of the same synthetic parent. Missing roles, links, source revision or trusted origins are blockers, not permission to create or repair real accounts.

## Parent and admin journey

1. Open Portal dashboard. Find Profiles, the own-details entry and the selected active child's entry. Verify a historical/inactive child does not get the child edit entry.
2. Request exact parent/child fields and a bounded reason. Confirm empty scope/reason is disabled. Reopen or reload; the request is requested permission, not submitted changes. In a second tab verify live profile values are unchanged.
3. In Admin > Academic > Students, open Parent profile corrections. Confirm the requested record is discoverable without selecting a class. Select a nonempty subset, grant it, and check omitted fields are unavailable in the parent editor. Also exercise rejection and unused-grant revocation with a reason.
4. Enter permitted changes. For an empty middle and two-word first name, request both fields and verify the induced middle/display-name changes in review. With only first-name permission, the induced ungranted middle must fail. Do not guess legacy name parts during a phone-only edit.
5. Set a parent personal override and a child override/inheritance choice. Verify household address, other contacts, relationships and primary-contact status stay unchanged. A residential selection must not accept a replacement household address.
6. Save a draft. Reload and recover it explicitly. Draft saving must not change live profiles or persist acknowledgement in browser/server draft data. Discard must leave permission available.
7. Review the saved draft. Assert actual before/after values and the exact bold warning: "These changes take effect immediately. You cannot edit again until an admin approves a new request." The checkbox starts unchecked and submit is disabled. Change draft, saved revision, permission/baseline or school/child context; review and acknowledgement must reset.
8. Make a separately authorized synthetic admin profile edit before submission. The parent must see stale protection, retain the saved draft, explicitly refresh/recover/review the current values and acknowledge again. Do not silently retry or overwrite the admin edit.
9. Submit once. Verify immediate profile changes, read-only applied receipt, consumed grant and cleared draft after reload. Admin sees applied history, not an approval button. Verify login/admission IDs, canonical links, enrollment/promotion, subjects, invoices and issued report snapshots are unchanged.
10. Start a fresh permission request. It must have a new request ID and need initial admin permission again. Rejected/revoked/applied requests cannot reopen. A lost-response identical retry must use the original reviewed content/key and show one apply/audit.
11. Change a synthetic child/family link or archive status. Parent draft/read/review/apply and new grants must fail. Admin's redacted list may only close the invalid open permission with a reason; it must not reveal draft values or regrant/apply. After closing, an otherwise eligible parent can request a fresh own-profile correction.

## Denial, errors and privacy

- Student accounts see no correction entries and cannot request/read/draft/review/submit even with forged IDs. A linked student contact remains excluded. Unlinked staff fail; linked staff use effective parent membership without email matching.
- Switch between approved schools and children. Recovery must stay bound to the correct account/request and exact target, with no values or acknowledgements carried across contexts.
- Exercise loading, empty history, invalid-context query errors, save conflicts, failed final submission and cancellation. Never display applied success after a failed transaction.
- Inspect authorized applied detail and the common audit view. Phone/DOB/address/name values belong only in restricted profile/draft/applied views, not audit summaries or list metadata. Do not publish raw network/auth traces.

Repeat relevant actions at mobile width and with keyboard-only input. Assert labels, focus reachability, wrapped controls, readable before/after content and the bold warning rather than inferring them from CSS. Capture reloaded persisted states in a second view. Keep all criteria blocked until those user paths actually run on the attested isolated target.
