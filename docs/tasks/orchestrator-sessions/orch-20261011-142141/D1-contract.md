## D1 implementation contract

Verified cwd as the requested `identity-onboarding-portal` worktree. Read the master plan, D1, G1/G2/G3 findings, approved feature document, repository instructions, Convex guidelines, and unslop. No files changed, tests run, credentials accessed, or providers called.

### 1. Source of truth

Store an explicit student-login domain selection on `schools`, referencing `schoolEmailDomains`.

Proposed optional fields in `packages/convex/schema.ts`:

```ts
studentLoginDomainId: v.optional(v.id("schoolEmailDomains")),
studentLoginPolicyVersion: v.optional(v.number()),
```

An absent reference means the school-namespaced `.local` default. Missing version means version zero.

Do not derive student logins from:

- `schools.slug`, which can change.
- A website hostname or public Sites configuration.
- `schoolEmailDomains.isDefault`.
- `emailAddressPolicies.domainId`, whose existing purpose is institutional address proposals.
- Name-based institutional templates.

This separates actual authentication identifiers from institutional address metadata without creating another domain registry.

Existing institutional approval explicitly does not change canonical logins. Preserve that promise in `institutionalEmail.ts:263–306` and the settings UI.

### 2. Domain eligibility and validation

A selected `schoolEmailDomains` record must:

1. Exist and have `status === "verified"` with verification evidence.
2. Belong to the school, or be explicitly shared with its active school group.
3. Have an unambiguous global registry owner.
4. Contain a valid normalized public hostname.

Reuse `resolveDomain` in `packages/convex/functions/academic/institutionalEmail.ts:74–85` for school/group authorization.

Validate the stored hostname server-side. Lowercase and trim at registration, then enforce:

- Maximum 253 characters.
- Labels of 1–63 ASCII characters.
- Letters, digits, and internal hyphens only.
- No scheme, path, port, whitespace, `@`, wildcard, IP literal, or empty label.
- No reserved local/test/example namespace or platform-owned hosting suffix.
- No implicit parent-domain extraction. `portal.school.edu` authorizes only that exact hostname.

The existing Sites `normalizeHostname` in `functions/sites/domainRules.ts` supplies most restrictions. Any shared validation must remain pure and must not invoke its provider configuration helpers. Generated `.local` identifiers use a separate internal path.

**Selecting an eligible verified email-governance domain is sufficient.** Google, Microsoft, or Zoho activation is irrelevant. A login suffix does not require a mailbox provider.

Website records in `schoolDomains` are suggestions only. A verified website hostname must not automatically become a verified `schoolEmailDomains` record. The proof, ownership, and lifecycle mechanisms differ. Website suggestions should point users to existing registration/governance, never copy verification state.

### 3. API and settings interaction

Own these additions in `packages/convex/functions/academic/institutionalEmail.ts`.

#### `getStudentLoginPolicy`

Arguments:

```ts
{ schoolId: v.id("schools") }
```

Require authenticated membership and either `settings.domains.manage` or `enrollment.intakes.manage`.

Return:

- Selected domain ID or `null`.
- Effective suffix or `null` when a configured domain is unavailable.
- Policy version.
- State: `default`, `configured`, or `needs_review`.
- A safe unavailable reason.
- Whether the viewer may change the setting.

Also include this summary in `getEmailWorkbench`. Reuse existing paginated domain discovery rather than adding an unbounded domain list.

#### `saveStudentLoginPolicy`

Arguments:

```ts
{
  schoolId: v.id("schools"),
  domainId: v.union(v.id("schoolEmailDomains"), v.null()),
  expectedVersion: v.number(),
  confirmed: v.boolean(),
}
```

Require `settings.domains.manage`. Derive the actor server-side.

In one mutation:

- Check confirmation and expected version.
- Validate domain eligibility when selecting a domain.
- Remove the optional reference when selecting the default.
- Increment the version.
- Record an audit event.
- Leave every existing user, auth account, institutional allocation, and membership unchanged.

No network or provider action follows this mutation.

#### Settings UI

Modify `apps/admin/app/admin/settings/email-domains/page.tsx`.

Add a distinct “Student login IDs” section using existing controls:

- “School default” option, showing the namespaced `.local` suffix.
- Verified owned/shared domain options.
- Unverified entries visibly unavailable for selection.
- Current unavailable selection retained visibly with a review warning.
- Confirmation stating that the change applies to newly admitted students only.
- Read-only display for enrollment staff without domain-management authority.

Suggested copy:

> Login IDs are not email inboxes. This setting applies to newly admitted students. Existing login IDs and passwords stay unchanged. It does not change the notification sender.

Do not silently select the first registered domain.

### 4. Identifier allocation

Own allocation in `packages/convex/functions/academic/studentEnrollment.ts`, specifically `createCanonicalStudentEnrollmentHelper` at lines 435–577. Admission conversion already calls this helper.

Use an immutable school namespace for the fallback:

```text
<school-namespace>.students.local
```

Derive the namespace losslessly from the school ID, not its name or slug. Validate the generated DNS label; do not truncate or sanitize it into a potentially colliding value.

For new students, allocate a unique local part using the immutable application user ID:

```text
<bounded-admission-prefix>.<immutable-user-id>@<suffix>
```

Contract details:

- Admission prefix uses lowercase ASCII alphanumerics.
- Empty prefix becomes `student`.
- Truncate only the readable prefix to keep the local part within 64 characters.
- Never truncate the immutable ID.
- Validate the complete identifier, including the 254-character address limit.
- Fail explicitly if the immutable ID cannot fit the supported representation.
- Never use first, middle, or last names.

Insert the user and patch its final generated identifier inside the same enrollment mutation. The intermediate value must never escape the transaction.

The immutable user component prevents collisions between `ADM/001` and `ADM-001`, and between branches sharing one verified domain. The fallback suffix also identifies the school.

Keep `users.email` as the persisted login identifier for this change. Do not add a second login-email field or copy it into `persons.email`.

Before committing, check existing indexed global reservations in `users`, `platformAdmins`, and `institutionalMailboxes`. Archived institutional allocations remain reserved. A conflicting allocation must fail closed, not acquire another person's address.

If a configured domain becomes failed, inaccessible, or ambiguously owned, block new allocation with a review message. Do not silently fall back. An administrator can explicitly select the default. Existing account access and password resets continue using stored identifiers.

### 5. Compatibility and provisioning

All existing students retain their stored login identifiers, including unprovisioned students.

- Domain changes do not rename existing accounts.
- Admission-number and identity edits do not regenerate `email` or `authId`.
- Password resets use the persisted identifier.
- Preserve `personId`, `authTokenIdentifier`, canonical memberships, and Better Auth IDs.
- New identifiers are generated once and remain stable.

A legacy collision discovered during first provisioning returns a reconciliation error. Do not automatically rename the student or reset an unrelated auth account. Repair requires a separately reviewed, explicit operation.

Coordinate these constraints with the provisioning implementation:

- `studentEnrollment.ts:3640–3814` passes the persisted identifier, not a newly calculated one.
- `provisioningHelpers.ts:164–268` must reject an existing student auth account whose ID does not match the target's linked account, unless persisted operation evidence proves ownership of a retry.
- An unlinked Better Auth account is not automatically safe to adopt.
- Reserve/freeze the operation target and recheck expected email/auth linkage when committing the result.
- Domain settings must not affect notification recipients. Generated IDs remain non-deliverable even when their suffix is a real domain.

Update restore compatibility at `studentEnrollment.ts:105–132,1550–1600` to compare stored identity values rather than assuming every student has `@students.local`.

### 6. File ownership

| Owner | Files and responsibility |
|---|---|
| Domain backend | `packages/convex/schema.ts`; `functions/academic/institutionalEmail.ts`. Policy fields, authorization, validation, versioning, audit and reads. |
| Enrollment backend | `functions/academic/studentEnrollment.ts`. One-time allocation, immutable identifiers, restore compatibility. |
| Provisioning backend | `functions/platform/provisioningHelpers.ts`; existing internal provisioning checks in `functions/platform/index.ts`. Collision and retry ownership, persisted target checks. |
| Settings frontend | `apps/admin/app/admin/settings/email-domains/page.tsx`. Explicit selection, confirmation and unavailable states. |
| Admission frontend | `StudentFirstOnboardingForm.tsx`. Remove the hardcoded prediction at line 1022. Show the selected suffix before admission and the actual persisted ID afterward. |
| Credential frontend | `PortalCredentialPanel.tsx`. Label student values “Login ID”; copy the persisted identifier. Preserve parent email terminology. |

No Sites DNS/provider implementation changes, mailbox provisioning, Resend sender changes, or login-translation redesign belong to D1.

### 7. Focused acceptance tests

Extend the existing enrollment, email-governance, and settings tests:

- Missing policy produces a school-namespaced `.local` identifier.
- Same admission number across schools and punctuation-equivalent numbers within a school produce distinct IDs.
- Branches sharing one domain receive distinct IDs.
- Empty/long admission prefixes remain valid without truncating the unique component.
- Verified owned and explicitly shared domains are selectable.
- Pending/failed, foreign-school, revoked-sharing and malformed domain records are rejected.
- Stale policy versions and unauthorized actors cannot save.
- Changing or clearing policy leaves existing provisioned and unprovisioned identifiers unchanged.
- Name/admission edits and password resets preserve identity linkage.
- Legacy and global auth collisions fail without modifying another account.
- Website verification cannot satisfy email-domain eligibility.
- Institutional address approval still does not change login identity.
- Settings and credential UI explain that identifiers are not inboxes and display server-returned values.

During Build QA, use verify-melo for selection, admission, provision, reopen, reset, and portal sign-in. Run the theme audit for touched school-facing files.

### Limitation

`institutionalEmail.ts:308–320` states that verification is internal-only. Repository search found test callers but no installed public verification workflow.

The contract can safely ship with `.local` and select already verified records. Enabling self-service verification for newly registered domains requires separate approval for DNS observation and a trusted verifier. Do not expose the internal mutation as a public “mark verified” action.

There is no blocking decision for implementing D1 under this contract.
