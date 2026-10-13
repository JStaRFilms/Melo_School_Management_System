## G2 findings

Verified cwd matches the requested worktree. Read the master plan, G2 packet, repository instructions, Convex guidelines, and unslop. No files changed, credentials read, tests run, emails sent, or deployments performed.

All school paths below are relative to the verified worktree.

### Report 7: provisioning status disappears after reopening

**Confirmed UI defect.** `apps/admin/app/academic/students/components/PortalCredentialPanel.tsx:38-48` stores success only in local `result` state and clears it when the user or default password changes. “Portal Access Ready” appears only when that local result exists at `:104-115`. Reopening shows “Provision / Reset Access” again at `:200`, regardless of the persisted account.

Pending feedback already exists at `:80` and `:196-200`, but only as a disabled button saying “Updating...”.

The backend actually creates or updates Better Auth credentials, invalidates sessions, and saves the resulting auth ID:

- `packages/convex/functions/platform/provisioningHelpers.ts:164-268`
- `packages/convex/functions/academic/studentEnrollment.ts:3703-3727`
- Auth-ID persistence at `studentEnrollment.ts:249-267`

However, `packages/convex/schema.ts:1441-1479` has no persisted provisioning operation/status fields. An application `users` row alone does not prove login access.

**Recommendation:** return an authorized, server-derived account state to the student profile and parent contact card. Separate “Not provisioned”, “Provisioning”, “Provisioned”, “Resetting password”, and “Needs reconciliation”. Keep temporary passwords transient. Reopening must recover account status, not recover the password.

**Related authorization defect:** provisioning patches only `authId`, not `authTokenIdentifier` or canonical identity links. Portal authorization uses canonical token identity first and allows subject fallback only for explicitly trusted legacy issuers:

- `studentEnrollment.ts:249-267`
- `packages/convex/functions/academic/portalIdentity.ts:44-164`
- `packages/convex/functions/academic/identityResolver.ts:20-31,44-74`

Thus action success does not necessarily mean portal authorization succeeds. Whether this currently affects users depends on deployment configuration, which I did not inspect.

For staff, the inspected path is teacher provisioning. It already reserves the draft, records the created auth account, commits canonical identity records, and handles rollback/reconciliation at `packages/convex/functions/academic/academicSetup.ts:359-449`. Teacher password reset changes the password and invalidates sessions at `:687-736`. These are separate flows from student/parent provisioning.

### Report 8: admission-ID synthetic login policy

**Current policy is explicit in code.**

`packages/convex/functions/academic/studentEnrollment.ts:526-527` creates:

- Application auth placeholder: `student:<schoolId>:<lowercase admission number>`
- Login email: admission number stripped of non-alphanumeric characters, lowercased, then suffixed with `@students.local`

Example: `ADM/001` becomes `adm001@students.local`. This is a login identifier, not a deliverable mailbox.

The onboarding form exposes that transformation at `apps/admin/app/academic/students/onboarding/StudentFirstOnboardingForm.tsx:1022`. Portal login uses email authentication at `apps/portal/lib/AuthProvider.tsx:102` and an email input at `apps/portal/app/(auth)/sign-in/page.tsx:70`.

**Confirmed collision risk.**

- School-local normalized duplicates are rejected at `studentEnrollment.ts:528-534`.
- The synthetic email contains no school namespace.
- Better Auth lookup is global by email at `provisioningHelpers.ts:196-220`.

Two schools can enroll students with the same admission number, but the second student's provisioning will conflict once the first owns that login email. Within one school, punctuation variants such as `ADM/001` and `ADM-001` also normalize identically.

**Confirmed identity-edit hazard, hand off to G1/G3:** passing `admissionNumber` during profile update rewrites `authId` to the synthetic placeholder at `studentEnrollment.ts:1045-1052`. The subsequent replacement at `:1157` also omits canonical identity fields from the reconstructed user at `:1025-1043`. Provisioned identity must survive ordinary profile edits.

**Decision needed:**

1. Keep email-shaped identifiers, but make new identifiers school-namespaced and stable. Explain “Login ID, not an email inbox”.
2. Offer school plus admission-number login. This is friendlier but needs an authentication translation design.
3. Use real student email addresses where available. This adds ownership, recovery, and duplicate-address decisions.

Do not silently change existing working logins or derive a replacement login whenever an admission number changes.

### Report 10: historical parent results

**No blanket active-session restriction found.** Existing code already supports older released results:

- Family access comes from current authorized family links, `portalIdentity.ts:211-254`.
- Explicit session/term IDs are validated against the selected student's school, `packages/convex/functions/portal.ts:445-467`.
- Historical class resolution prefers the issued report's class rather than today's class, `packages/convex/functions/academic/narrativeReports.ts:471-481`.
- Archived historical class/session/term tuples remain readable after release, `packages/convex/functions/academic/resultPublication.ts:485-505`.

Graded access still requires exactly one frozen publication inclusion and its pinned issued report. Conflicting issued classes fail closed at `portal.ts:314-345`. Narrative access returns issued snapshots, not mutable drafts, at `narrativeReports.ts:439-460`.

**Confirmed discoverability limit:** history is capped at twelve entries by the backend, defaults to four, and scans bounded windows of 48 records per report type at `portal.ts:557-579`. The results page requests only eight at `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx:99`. There is no history pagination in this path. An older report may remain authorized through its explicit URL but disappear from the visible history.

Other legitimate blockers include removed family links, inactive membership/account/school, archived student records, missing release evidence, and conflicting historical data. These must not be bypassed to “fix older sessions”.

**Recommendation:** preserve the existing publication checks and add authorized history pagination or a period selector. Diagnose the reported tuple before changing authorization.

Existing tests cover pinned older reports, withheld newer terms, invalid tuples, conflicting evidence, and bounded history at `packages/convex/functions/academic/__tests__/portalResultGate.integration.test.ts:215-245,345-387`. I inspected these tests but did not run them.

### Report 11: Resend and safe provisioning notifications

Whisper reference root:

`C:/CreativeOS/01_Projects/Code/Personal_Stuff/2026-02-28_whisper_alt-V2`

Its `koe-website/lib/server/email.ts` uses:

- `RESEND_API_KEY`, lines 28-34
- `KOE_EMAIL_FROM`, lines 24-25
- `KOE_APP_URL` and `NEXT_PUBLIC_SITE_URL`, lines 20-21

Verification/reset emails contain expiring links, not passwords, at `:89-139`. The sender fallback is `noreply@example.com`; source code does **not** establish the live verified sender domain.

Whisper limits password-reset requests to 20 per minute per IP and five per hour per email at `koe-website/app/api/v1/auth/request-password-reset/route.ts:19-20`. Verification requests have five-per-hour user limits at `request-email-verification/route.ts:13`. Its email helper supplies no provider idempotency key at `email.ts:6-7`.

**The school repository already has a better notification starting point.**

`packages/convex/functions/admissions/conversion.ts:258-352` implements a persisted onboarding outbox:

- One event per conversion and event key.
- Transactional delivery claim and five-minute lease.
- Five attempts with backoff.
- Persisted pending/sending/sent/failed states.
- Resend `Idempotency-Key` based on outbox ID at `:339`.
- No password in the notification.

This currently sends application enrollment-status messages, not student/parent credential notifications. Its schema is `packages/convex/schema.ts:941-959`.

School configuration uses `RESEND_API_KEY` and `MELO_EMAIL_FROM` in both `packages/convex/betterAuth.ts:81-93` and `conversion.ts:333-340`. The public contact sender defaults to `Melo <hey@jstarstudios.com>` at `apps/www/lib/server/contact-email.ts:14`. That is source evidence for the intended JStar domain, not proof of live Resend verification.

The rate-limiter component is already mounted at `packages/convex/convex.config.ts:2-8`; transactional quota usage exists at `packages/convex/functions/admissions/shared.ts:22-26,46-71`.

**Recommended notification design, subject to approval:**

- Queue only after persisted credential linkage succeeds.
- Keep account state separate from email delivery state.
- Reuse the outbox pattern with a stable provisioning/reset operation ID and provider idempotency key.
- Rate-limit explicit resend requests per recipient, actor, and school. A proposed starting policy is a 60-second recipient cooldown plus five sends per hour.
- Send a short account notice or expiring setup/reset link, never a password.
- Never send to `@students.local`. Decide whether student notices go to an authorized guardian or a verified student address.
- Use an approved `MELO_EMAIL_FROM` address on the verified JStar domain. Domain verification remains unconfirmed.
- Preserve manual credential handoff until a secure link-based setup flow is approved. Better Auth currently has no password-reset email callback in `betterAuth.ts:125-147`.

### Focused verification plan

- Provision, close, reopen, and verify persisted status and actual portal authorization.
- Reset an existing account without presenting it as newly provisioned.
- Preserve login identity through profile and admission-number edits.
- Test same admission number across schools and punctuation-normalization collisions.
- Read an older released report after promotion and session archival; reject foreign-school tuples and unpublished cards.
- Retrieve history beyond the eighth and twelfth entries through the approved navigation.
- Test concurrent provisioning, duplicate queue requests, repeated resend clicks, provider timeout after acceptance, stable retry payloads, exhausted retries, and missing email configuration.
- Assert that notifications contain no passwords and synthetic student identifiers are never email recipients.

The unresolved decisions are login presentation/migration, historical-history navigation, notification recipients, and whether to build expiring setup links now or retain manual password handoff.
