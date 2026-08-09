# Remaining Admissions Work — Integration Result

**Session:** `orch-20260722-114501`  
**Branch:** `integration/obhis-admissions-release`  
**Status:** Implemented and automated checks passed; final browser/UI confirmation remains user-owned

## Delivered

### FU4 — Existing parent and family conversion

- Added a capability- and tenant-scoped conversion-candidate query.
- Admin now shows the guardian's existing parent account and linked family records.
- Staff explicitly select an existing parent/family; identities are never merged automatically.
- Sibling conversion reuses those records and creates only the new student.
- First-child create/create/create conversion remains supported.
- Resolver validation now requires the selected family to belong to the selected parent.
- Conversion idempotency and one-student-per-application behavior remain enforced.

### B7 — Legal-name compatibility

- Added a form-bound `legalNamePolicyVersion` rollout boundary.
- Existing forms omit the field and continue under policy version 1, preserving first/last-only records and drafts.
- Newly drafted forms use policy version 2.
- Policy version 2 requires the student's legal first, middle, and last names and structured guardian first/last names before submission.
- Draft saving remains partial; authoritative submission enforces completeness.
- Submitted snapshots preserve the policy version and all available name components.
- Accepted conversion carries the student's middle name into the canonical user record and display name without fabricating legacy values.

### B8 — Private document viewing and management

- Added a same-origin authenticated Apply route under the owned application URL.
- The route reauthorizes the guardian/application/document at access time, proxies the private storage response, preserves filename/content type, and does not expose the raw Convex storage URL in normal navigation.
- Added confirmed guardian removal while the application and requirement are editable.
- Removed files retain an audited tombstone and disappear from the normal active list.
- Draft-only storage is deleted immediately after the unique binding is confirmed.
- Storage referenced by a prior immutable submission revision is retained even when a correction removes the active binding.
- Single-file requirements now label a subsequent upload as replacement; superseded versions are hidden from the normal guardian list.

## Verification

Passed on the integrated working tree:

- Convex admissions suites: 43 tests across `admissionsDomain.test.ts` and `admissionsPublic.test.ts`
- Convex typecheck
- Admin admissions suites: 40 tests across 6 files
- Admin typecheck
- Apply suites: 22 tests across 2 files
- Apply typecheck
- Targeted Admin and Apply ESLint
- Apply production build
- Admin production build
- `git diff --check`
- Development Convex synchronization via `npx convex dev --once`

## User-confirmed earlier browser checks

The user confirmed localhost sensitive-document access and temporary-link opening, document acceptance/readiness, requested-correction scoping, reviewer persistence/idempotency, and offline recovery. Secure Paystack checkout through the Tailscale IP remains unresolved; localhost is the accepted development path.

## Final browser/UI handoff

Before merging to `main`, confirm:

1. A first accepted child creates a parent, family, and student once.
2. A later accepted sibling offers the existing parent and family and creates only the new student.
3. A newly published policy-version-2 form requires student middle name and guardian first/last names; a legacy application remains readable and convertible without a middle name.
4. Guardian **View file** stays on the application-owned URL.
5. Removing a draft upload asks for confirmation, removes it from the active list, and permits replacement.
6. Submitted applications do not expose removal; a named document correction permits controlled replacement without changing prior snapshot evidence.

No production deployment or `main` merge was performed.
