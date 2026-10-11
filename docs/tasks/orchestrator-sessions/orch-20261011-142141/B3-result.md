# B3 result: PR2 local delivery

## Delivery boundary

Implemented on `fix/portal-status-history-notices` in:

`C:/CreativeOS/01_Projects/Code/Personal_Stuff/2026-03-14_School_Management_System/tmp/worktrees/identity-onboarding-portal`

This is B3's local code delivery, dependent on B1/B2. It is not completion of the whole correction backlog or browser acceptance. No delegation, deployment, remote code generation, real email, DNS changes, push or PR was performed.

## Local code commits

- `f41441d` — fixed shared connection/draft header status.
- `405c4cc` — authorized session and published-result continuation.
- `cda6b37` — private idempotent credential notices.

Only B3-owned code/tests were staged. Parent-owned `build-execution.json` and `B3-execution.json` remain outside these commits. B1/B2 changes and runtime records were preserved.

## Implemented behavior

### Connection and draft status

`WorkspaceNavbar` reserves a 32px status row with fixed minimum/maximum height on desktop and mobile. Admin, Teacher and Portal mount the live connection readout there. Browser offline, backend reconnecting and authentication loss are separate states; draft context mismatch is separate from network loss.

Draft actions portal into the reserved row. Standalone forms retain an inline fallback. Workspace mobile progress indicators no longer repeat the draft pills. Admin and Teacher retain recovery/preview/retry actions rather than hiding failures.

`useFormDraft` clears stale reconnect labels for clean forms. Unsaved reconnection requires explicit review/retry, not permission to overwrite the server. Conflict, expiry and failed-save protection, expected revisions, memory recovery and account/context checks remain in place. Unsaved state compares the current approved payload with the last saved payload, rather than treating a successfully saved dirty form as pending forever.

### Published academic history

`functions/portal.ts` adds `listResultSessions` and `listSessionResults`. Session reads are school-indexed and bounded to 20 requested entries; term reads are session-indexed and bounded to six. Empty unpublished pages retain continuation cursors. The Portal presents a session/year selector plus older-session and more-term controls, replacing the capped Results-view list.

Each report resolves through the existing authorized student context, tuple selection and publication gates. Conflicting/invalid tuples and unpublished reports are omitted. Historical archived classes/sessions remain readable only where valid issued evidence permits them. Graded and narrative reports retain their issued details; snapshots are not rewritten.

The read and selection contracts explicitly identify `end_of_term`. Links from the new history carry that kind, and unsupported URL kinds show a warning rather than silently selecting another kind. No midterm schema, grading or publication engine was added. The older bounded workspace history contract remains for compatibility.

### Private account-ready/reset notices

`accountNoticeOutbox` stores operation identity, selected recipient, frozen privacy-safe content, queue/provider state, attempt count and lease timing. `users.lastCredentialOperation` records committed operation evidence without a password.

Parent/student provisioning, teacher creation/reset and admin credential creation/reset integration record success before separate notice work. Notice failures do not replace the temporary-password handoff. Student enqueue requires an explicitly selected eligible linked guardian. Student login identifiers are never treated as inboxes, including public-domain suffixes. Staff and parents use their own eligible addresses. Recipient/linkage/tenant validity is checked again before sending or retrying.

The worker follows the existing admissions Resend HTTP outbox pattern; this repository mounts the rate-limiter component, not a Resend component. It uses that mounted limiter for a five-minute school/recipient cooldown. Target/operation lookup makes repeated enqueue requests idempotent. Workers use five-minute leases, attempt-number fencing, bounded retries, frozen sender/body and a stable provider idempotency key. A crashed final lease or elapsed provider-deduplication window requires operator review rather than another unsafe submission.

`RESEND_API_KEY` and `MELO_EMAIL_FROM` must be configured; the sender must use JStar's domain. There is no source sender fallback and no claim of DNS/provider verification. Missing configuration, suppression, failed submission and provider acceptance are distinct from credential success. Provider acceptance is not labelled delivery. No provider response body or secret is logged/persisted.

`AccountNoticePanel` reads persisted state when credential records are reopened, selects stored guardian IDs, and retries the existing outbox record. The outbox is registered in schema coverage, tenant purge and demo-reset lists. `_generated/api.d.ts` received only the local module declaration; no remote generation ran.

## Local verification

All listed checks passed:

| Check | Result |
| --- | --- |
| Admin focused draft/shell/status/notice/credential/reset/name suites | 59 tests, 7 files |
| Portal complete test suite | 19 tests, 7 files |
| Teacher workspace shell | 7 tests, 1 file |
| Shared recovery modal and mobile indicator | 15 tests, 2 files |
| Convex notices, result gate, identity onboarding, academic setup and root schema coverage | 49 tests, 5 files |
| Additional Convex draft and identity resolver regressions | 19 tests, 2 files |
| Convex tenant purge and seed cleanup | 7 tests, 2 files |
| TypeScript: Convex, Shared, Admin, Teacher and Portal | Passed; changed Convex/Admin/Teacher targets rerun after subsequent edits |
| `node scripts/audit-theme-colors.mjs` | Passed, informational findings classified below |
| `git diff --check` and staged diff checks | Passed |

Coverage includes more than 40 sessions and 56 published reports, empty-page continuation, archived historical tuples, cross-school/unlinked denial, conflicting publication evidence, guardian-selection rejection, concurrent enqueue/leases, cooldown, retry bounds, provider payload/key stability, privacy and a real local credential action preserving its password return when email configuration is missing. All provider requests in notice tests were mocked.

Existing draft timer-overflow warnings and direct-handler warnings in identity-resolver tests did not produce failing assertions. A test lookup at the obsolete academic `schemaCoverage.test.ts` path found no file; root schema coverage and the actual tenant cleanup suites were run successfully instead.

### Theme classification

- Tenant identity continues through existing school theme tokens; no new tenant palette or global replacement was introduced.
- Amber draft/recovery/publication warnings, emerald success and rose errors remain semantic status colors, not tenant branding.
- Slate/white borders, surfaces and copy in the new status/history/notice components are product neutrals.
- Report paper/monochrome fixtures are print-only; report/token color fixtures are test inputs. Existing print behavior was not recolored.

## Blockers and guarded limitations

1. **Browser acceptance remains blocked.** Calling the exported QA doctor directly fails with `ENOENT` for this worktree's `.env.qa.local`. The Windows entry-point no-op is not evidence of a passing doctor. No Admin/Teacher/Portal QA servers or normal-development/production fallback were started. Fixed CSS bounds were asserted in component tests, not measured in a real browser. Retain mobile/desktop connection/recovery, older-session report and credential/guardian/retry journeys for an attested isolated profile.
2. **Unlinked legacy admin records do not receive notices.** The existing new-admin record helper does not establish canonical person/membership linkage. B3 records the committed operation and reports that linkage needs review, but refuses to queue before canonical linkage exists. Linked teacher-to-admin credential resets are eligible and tested. This does not rewrite the existing admin identity/provisioning flow or claim all legacy admin records are notice-ready.
3. **Provider delivery is not verified.** Tests prove mocked submission behavior only. Live sender verification and actual delivery were deliberately not attempted.

## B4 handoff

B4's parent editing permission/draft/apply workflow remains untouched. Reuse the shared fixed status slot and the `context_mismatch` / `recovery_pending` draft states without weakening its school/parent/revision gates. The notice APIs remain staff-authorized and are not parent profile-edit permissions.

## Backlog tail — FUTURE only

Expiring secure setup/reset links, password-choice UI and verified recovery ownership remain **FUTURE**, at the end of the backlog. No link/token/reset-page implementation was added. Continue the private manual password handoff for current credentials.
