## D2 implementation contract

Verified cwd is `C:/CreativeOS/01_Projects/Code/Personal_Stuff/2026-03-14_School_Management_System/tmp/worktrees/identity-onboarding-portal`.

Read the master plan, D2, G1/G2/G3 findings, approved feature document, Convex guidelines, and relevant forms and draft contracts. Loaded unslop. No files changed, tests run, services started, or nested tasks delegated.

### 1. One admission interaction

Replace the roster's “Quick Admission” and “Family Onboarding” tabs with one “Admit student” form. Keep the existing desktop placement and mobile sheet.

The standalone student-first onboarding page must use the same fields, validation, contact selection, and submission contract. Its wider layout can remain. Unification does not require redesigning that page.

Field order:

1. Class placement.
2. Student identity: first name, optional middle name, last name, admission number, gender.
3. Existing optional details: date of birth, house, address, photo.
4. “Parents and guardians”.
5. Optional portal provisioning where currently available.

Keep `AdmissionNumberGovernanceFields`, automatic numbering, manual override permissions, review versions, counter decisions, photo cropping, and upload validation unchanged.

Use “Admit student” before submission and “Admitting student...” while pending. Do not warn that guardian details are missing when a linked contact already supplies them.

### 2. Parents and guardians

Provide three explicit choices:

- “Add later”, the default. Admission does not require a contact.
- “Choose existing contact”.
- “Create new contact”.

Choosing an existing contact requires no name, email, or phone re-entry. Search school-authorized contacts by name or email through a bounded backend query. Show stored name, email, phone when present, household label, and actual portal status. Distinguish matching names with email and household information.

After selection:

- Show stored identity as read-only.
- Allow relationship and primary-contact selection.
- Offer “Change contact”.
- State “Linking this contact will not change their details.”
- Keep identity editing in the existing explicit Edit action.

New-contact mode collects first name, optional middle name, last name, email, optional phone, relationship, and primary-contact choice. Keep the current email requirement for new portal-linked contacts. Do not introduce phone-only accounts in this change.

For an email belonging to an existing contact, offer deliberate selection of that record. Never automatically overwrite it with newly typed names. Reject student accounts and unauthorized school records.

Relationship options must be:

Father, Mother, Guardian, Aunt, Uncle, Grandfather, Grandmother, Sibling, and “Custom relationship”.

Selecting the custom option reveals a labelled text input. Store the actual relationship string, not the option label. Existing custom values reopen in custom mode without alteration. Changing other fields must not erase an unspecified legacy relationship.

#### Household confirmation

Before submission, show which household the student will join. Reuse the existing duplicate-link confirmation pattern when another student's household is involved. Cancel returns to the populated form.

A household-wide primary-contact change must state its effect on other linked students. Never silently replace an existing primary contact. If the selected contact is not primary, identify the household's actual primary contact as the default contact source.

### 3. Default contact and emergency override

Remove repeated guardian name and phone inputs from ordinary admission.

Use this copy:

> The household's primary contact is used by default. Add separate details only if the emergency contact is someone else.

Provide “Use a different emergency contact”. When enabled, reveal emergency contact name and phone. This text does not create a user, household membership, or portal access.

For existing records:

- Preserve stored `guardianName` and `guardianPhone`.
- Show populated values under “Previously recorded guardian details”.
- Explain that these details are separate from the linked contact.
- Do not infer whether they describe the same person.
- Permit explicit retention, editing, or replacement with the linked-primary default.
- An unrelated profile save must preserve them.

The backend must distinguish these states:

- Linked-primary default.
- Explicit emergency override.
- Unreviewed legacy guardian text.
- No contact.

Do not copy the primary contact into guardian fields and then treat that copy as independent identity. Resolve the default from the authorized primary contact. An explicit mode change is required before clearing legacy text.

### 4. Household label and contact identity

Display “Household label” separately from each contact's name.

A generated label may remain the default for a newly created household. Existing labels do not change when a contact's name changes.

Provide a separate “Edit household label” action in `StudentFamilyPanel`. It changes only `families.name`. It must not rename users, authentication records, or other households. Cancelling preserves the original label.

This is the smallest editable-label design requested by D2. If household-label editing lacks final product approval, keep the separation and defer that action rather than adding automatic renaming.

### 5. Name-entry contract

Use first name, optional middle name, and last name for new structured identities. Preserve compound values within each field. Assemble display names through the corrected shared compatibility policy.

Existing full-name-only records retain a populated, editable “Full name” field. Offer “Enter name parts” as a deliberate switch:

- Show the existing full name as reference.
- Do not guess or prefill its components.
- Require complete structured input before committing the switch.
- Cancelling restores the full-name mode.
- Address, photo, email, and relationship edits remain possible without supplying name parts.

Backend update semantics:

- Omitted `middleName` preserves the stored value.
- Explicit `null` clears it.
- Nonempty text replaces it.
- Create-form blank middle names mean absent.
- Unchanged name fields must not trigger name reconstruction.

School-local edits must not silently rename the same person in another school. Portal headers should read the authorized school identity rather than a stale authentication-session display name.

Existing issued snapshots remain unchanged. Corrected names apply to live displays and newly generated documents under the approved document policy.

### 6. Frontend file map

Paths are relative to the verified worktree.

- `apps/admin/app/academic/students/page.tsx`
  Remove creation-tab branching. Own one admission state, draft lifecycle, duplicate-link review, structured-name payload, and submission result.

- `apps/admin/app/academic/students/components/StudentCreationForm.tsx`
  Become the roster's unified admission form. Add middle name and the optional parents/guardians section.

- `.../FamilyOnboardingForm.tsx`
  Retire its duplicate rendering once existing draft recovery remains supported. Do not leave a second admission implementation.

- `.../StudentCreationOptionalFields.tsx`
  Keep house, date of birth, and address. Move guardian inputs into the explicit emergency-contact interaction.

- `apps/admin/app/academic/students/onboarding/StudentFirstOnboardingForm.tsx`
  Replace “Household & Primary Guardian”, repeated guardian fields, and separate parent entry with the same parents/guardians interaction. Keep placement, readiness, photo, and portal sections.

- `apps/admin/app/academic/students/onboarding/page.tsx`
  Use the shared submission contract. Remove the current create-student-then-link discrepancy.

- `.../StudentProfileEditor.tsx`, `StudentProfileFormFields.tsx`, and `types.ts`
  Add structured/legacy name modes and contact-source display. Load the effective active-session class. Retain explicit assignment confirmation.

- `.../StudentFamilyPanel.tsx`
  Add the existing-contact picker, middle-name and legacy-name editing, relationship dropdown, separate household label, and persisted portal status. Preserve Edit.

- `.../PortalCredentialPanel.tsx`
  Render server-derived account state separately from transient password results.

Share the repeated name/contact field rendering where useful. Do not force the entire standalone page into the roster sheet component or introduce a new form framework.

#### Other identity forms and projections

Apply the same name policy to:

- `apps/admin/app/academic/teachers/components/TeacherCreationForm.tsx` and `TeacherEditForm.tsx`, including their page callbacks and `TeacherRecord` projection.
- `apps/admin/app/admin/components/AdminCreationForm.tsx` and `adminLeadership.ts`.
- `apps/platform/app/schools/[schoolId]/assign-admin/page.tsx` and its provisioning arguments.
- `apps/platform/app/bootstrap/platform-admin/PlatformAdminBootstrapForm.tsx` for person-name entry.
- Staff/admin/teacher projections in `packages/convex/functions/academic/groups.ts`.
- Admissions adult-contact contracts that currently accept `fullName`.
- Import review, ingest, merge, and admission conversion.

No dedicated general staff identity-edit form was established during this inspection. Extend existing staff contracts and entry points; do not invent a staff-management page.

### 7. Submission and backend requirements

`studentEnrollment.ts` must accept an explicit contact choice:

- None.
- Existing `parentUserId`, relationship, and primary-contact intent.
- New structured contact details, relationship, and primary-contact intent.

Existing-ID linking must never accept identity fields as an implicit update. Derive actor and school authorization server-side. Revalidate contact eligibility, household consequences, and confirmation at commit time.

Both admission entry points should create student identity and the selected family link in one mutation. Preserve the existing enrollment request key and numbering review checks. Photo uploads and credential provisioning remain separate follow-up operations.

Required results include the committed student ID and selected contact ID when applicable. Retries must resolve to the same admission, not allocate another student or admission number.

Identity updates must patch edited fields while preserving `authId`, `authTokenIdentifier`, `personId`, promotion records, and subject selections. Class changes require explicit confirmation against the effective active-session class.

### 8. Provisioned status and follow-up behavior

Display persisted account status on selected-contact summaries, family cards, and credential panels:

- “Checking portal access...”
- “Not provisioned”
- “Provisioning...”
- “Provisioned”
- “Resetting password...”
- “Needs reconciliation”

Query failure shows “Could not check portal access”, not “Not provisioned”. A user row or successful email does not prove provisioned access.

Use “Provision access” for an unprovisioned account and “Reset password” for an existing provisioned account. Linking an existing contact must not reset their password.

Temporary passwords remain transient and copyable only after the current successful operation. Reopening restores account status, not a previous password.

Show notification state separately. “Account provisioned. Notice could not be sent.” is a valid outcome. Never email passwords or send notices to synthetic login identifiers, including identifiers using a configured school domain.

Partial completion must identify what succeeded and offer the corresponding follow-up:

> Student admitted. Photo upload failed. Upload the photo from the profile.

Provisioning retries must not rerun admission or silently repeat successful password resets.

### 9. Drafts, reopen, and cancellation

Extend `packages/shared/src/drafts/registry.ts` and the existing adapters with:

- Student and contact middle names.
- Contact choice and selected contact ID.
- Relationship/custom relationship.
- Primary-contact intent.
- Emergency-contact mode and values.

Continue recovering existing `family_onboarding` and `student_onboarding` drafts. Do not reject old drafts because the UI tabs disappeared. Revalidate recovered contact IDs, school context, and numbering reviews before submission.

Preserve server-only draft recovery. Do not store passwords, uploaded files, photo data, or authentication secrets. Tell users to reselect a photo after recovery.

Cancelling a contact or duplicate-link review preserves entered student data. Leaving a dirty admission uses the existing save/discard/stay guard. Cancelling an unsent form creates no records. Closing after a committed admission does not undo it.

### 10. Mobile, keyboard, and acceptance tests

Keep existing surfaces, typography, sheets, and progress controls. Stack name fields on narrow screens. Picker results must wrap long names and emails without horizontal scrolling.

Every field needs an associated label. Contact choice uses labelled native controls. Search results must be keyboard-selectable; loading, empty, error, and selected states must be distinct. Return focus after modal cancellation. Announce submission and account-status changes without announcing every keystroke.

Build acceptance must cover:

1. Roster and standalone admission collect student/contact details once.
2. Existing-contact linking preserves identity, credentials, and custom relationships.
3. Cross-school, archived, and student-account selections fail safely.
4. Household and primary-contact effects receive explicit confirmation.
5. Linked-primary defaults, emergency overrides, and legacy guardian text round-trip correctly.
6. Middle names and compound names survive admission, editing, conversion, imports, drafts, and display projections.
7. Ambiguous legacy names remain editable without forced splitting.
8. Identity-only saves preserve promotion, subjects, and auth/person linkage.
9. Duplicate submission and recovered retries create one student and consume one admission number.
10. Provisioned status survives reopen; actual portal authorization succeeds.
11. Photo or provisioning failure does not require another admission.
12. Mobile, keyboard, loading, empty, error, cancel, and reopen paths work.

Use verify-melo for Build-stage browser evidence. Run the informational theme audit on touched school-facing files. Tenant fills use shared theme tokens and contrast tokens; account status retains semantic colours.

### Limits

No referenced standalone screenshot was supplied or identified. The duplication was verified in the current form source instead. The standalone route admits one student per submission; no new batch-import engine is proposed.

Domain configuration belongs to D1. Expiring setup/reset links remain deferred. This contract is inspection-based, not browser-verified.
