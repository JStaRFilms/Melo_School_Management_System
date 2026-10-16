## G3 findings

Verified cwd is the requested `identity-onboarding-portal` worktree. Read `master_plan.md`, `G3.md`, repository instructions, Convex guidelines, and unslop. No files changed, tests run, services mutated, or providers delegated.

All paths below are relative to that worktree.

### Confirmed causes for reports 6 and 9

1. **Middle names exist in admissions and imports, but not in persisted school identities.**
   - `packages/convex/schema.ts:1160–1180`: canonical `persons` stores only `name`.
   - `packages/convex/schema.ts:1441–1450`: school `users` stores `name`, optional `firstName` and `lastName`, but no `middleName`.
   - Applicants already support optional middle names at `schema.ts:586–600`; staged imports do too at `schema.ts:3850–3859`.

   Adding a student input alone will not satisfy "middle names for everybody." Persistence, mutation validators, projections, and staff/admin entry paths need coordinated changes.

2. **Imported and converted middle names disappear from several displays.**
   - `packages/convex/functions/academic/migrationMerge.ts:35–64` constructs `name` with all three parts, but persists only first/last structured fields.
   - `packages/convex/functions/admissions/conversion.ts:246` does the same through `createCanonicalStudentEnrollmentHelper`.
   - `packages/convex/functions/academic/studentNameCompat.ts:74–89,130–135` prefers structured first/last over the stored full name.

   Example: stored `name = "John Michael Doe"`, `firstName = "John"`, `lastName = "Doe"` displays as `"John Doe"`. This affects student profiles, family lists, report cards, portal, billing, and attestations.

3. **Full-name-only records explain blank profile fields without a blank roster name.**
   - `studentNameCompat.ts:92–105,138–148` preserves the full display name, but derives first/last only when there are exactly two space-separated tokens.
   - `packages/convex/functions/academic/studentEnrollment.ts:1231–1240` returns those nullable structured fields.
   - `apps/admin/app/academic/students/components/StudentProfileEditor.tsx:148–150` turns nulls into empty inputs.
   - The save button requires both fields at `StudentProfileEditor.tsx:565`.

   A legacy `"Mary Anne Smith"` can therefore appear correctly in a roster while its profile shows blank first/last fields. This is a confirmed code path, not a reproduction against the user's records. Do not solve it by guessing where the middle name belongs.

4. **Teacher edits can leave old structured names behind.**
   - `packages/convex/functions/academic/academicSetup.ts:182–185,240–242` derives and saves first/last during creation.
   - `academicSetup.ts:583–608` updates only `name` and `email`, including the canonical person.
   - `academicSetup.ts:665–678` also updates the authentication display name.
   - `packages/convex/functions/academic/reportCards.ts:717` reads the teacher through the compatibility helper.

   A teacher created as `"Jane Smith"` and renamed to `"Jane Jones"` can retain `lastName = "Smith"`. Teacher lists read `name` directly at `academicSetup.ts:481–486`, while report-card teacher names prefer the stale parts.

5. **Student and parent edits do not consistently propagate identity names.**
   - Student editing builds a replacement user record at `studentEnrollment.ts:1015–1043` and replaces it at `:1157`. That record omits `personId` and `authTokenIdentifier`, as well as any future middle-name field.
   - Parent editing patches the school user at `studentEnrollment.ts:3459–3495`; it does not update the canonical person or authentication name in that path.
   - Portal provisioning writes the auth name at `packages/convex/functions/platform/provisioningHelpers.ts:218–247`.
   - Viewer names read the school user at `packages/convex/functions/auth.ts:114`.

   Name changes can reach one representation but not another. The student replacement also presents an identity-link preservation risk that the parent investigation should account for.

### Bounded propagation map

| Area | Evidence and implication |
|---|---|
| Shared compatibility | `studentNameCompat.ts:17–70,74–105`. Extend both write resolution and read formatting. Currently supports only first/last and sometimes splits full names. |
| Normalization | `packages/shared/src/name-format.ts:30–35,66–89`. Handles whitespace/casing, not structured-name assembly. Admin and teacher `lib/human-name.ts` re-export it. |
| Student onboarding | `apps/admin/app/academic/students/onboarding/page.tsx:69–70,409–410`; `StudentFirstOnboardingForm.tsx:277,670–682`. First/last only. |
| Parent entry/edit | `StudentFamilyPanel.tsx:61–62,103–104,332–333,713–714`; `studentEnrollment.ts:3052–3053,3331–3332`. First/last only. Keep the existing Edit interaction. |
| Draft recovery | `packages/shared/src/drafts/registry.ts:12–38`. Strict student-onboarding schema lacks both student and parent middle names. New inputs must survive recovery. |
| Teachers | `TeacherEditForm.tsx:38–55,87–92` uses one full-name field. Backend create/update validators also accept full name. |
| Staff/admins | `packages/convex/functions/academic/groups.ts:743–755,847–857` assigns admin/teacher/staff projections using person full name and source first/last. Platform admin provisioning accepts `adminName` at `packages/convex/functions/platform/index.ts:562–600,718–745`. |
| Admission contacts | `schema.ts:823–836` stores `fullName`, including parent, guardian, and emergency contacts. Applicant middle-name support does not cover these adults. |
| Class lists | `studentEnrollment.ts:2737,2782` uses compatibility formatting. Exam entry instead reads `user.name` directly at `assessmentRecords.ts:291`. This explains inconsistent names between lists. |
| Reports | `reportCards.ts:420–426,716–717,1015–1018`; `reportCardExtras.ts:598`; `narrativeEntrySheet.ts:118`. All need the same name policy. |
| Portal and billing | `packages/convex/functions/portal.ts:510–514,707,910`; `billing.ts:302–304,1695`. Compatibility helper consumers inherit its middle-name loss. |
| Attestations | `studentEnrollment.ts:3891,3908,3938–3940` resolves student/principal names live. `AttestationLetterModal.tsx` renders the resulting document. |
| Imports | `packages/shared/src/migration/spreadsheetParser.ts:64–103,506–509` recognizes separate name columns. `migrationIngest.ts:190–202` reparses their combined text and can infer a middle name even when structured columns already supplied first/last. |

No general student CSV export endpoint was established in the inspected enrollment/report modules. Confirm the intended export workflow before adding export-specific work.

### Compatibility strategy

- Add optional `middleName` across approved identity storage, validators, projections, forms, and drafts. Missing values must remain valid.
- Preserve combined first names exactly in their existing field. Do not move tokens automatically.
- Keep full-name-only records readable and editable without requiring fabricated first/last values.
- Treat explicit structured-name edits differently from unrelated profile edits. An address or photo save must not rebuild or truncate a legacy name.
- Define empty-middle-name semantics explicitly: omitted means unchanged; an explicit clear removes it.
- Preserve identity links and academic assignments during name edits. Avoid replacement records that silently omit existing fields.
- Reuse the compatibility utility, but make its behavior person-wide rather than student-specific.

### Decisions needed before Build

1. **Canonical ownership.** Should `persons` own structured names and propagate them to linked school users, or are branch-specific names allowed? Cross-branch writes require deliberate authorization. Current code mixes global full names with branch-local structured fields.
2. **Legacy editing.** Recommend retaining a full-name editing mode until someone deliberately supplies structured fields. Do not automatically split existing names.
3. **Issued documents.** Recommend preserving existing issued snapshots. `narrativeReports.ts:283` returns an issued snapshot unchanged; `:297,428,459` captures and serves its stored student name. Numeric report cards and attestations currently resolve names live. Decide whether correcting identity should change historical printed output.
4. **Import inference.** Recommend preserving explicit first/last columns and limiting inferred splits to reviewed full-name imports. Current ingest can infer additional middle-name content from combined structured fields.

### Focused regression tests

- Shared compatibility: optional middle names, combined first names, full-name-only records, partial fields, omission versus explicit clearing.
- Import and admission conversion: `"John Michael Doe"` remains identical across profile, roster, portal, billing, and report projections.
- Profile editing: unrelated edits preserve legacy names, `personId`, `authTokenIdentifier`, enrollment, and promotion state.
- Teacher rename: school user, person, auth display name, teacher list, and report-card teacher name agree.
- Parent editing: family display, contact display, portal name, and canonical identity follow the approved ownership policy.
- Draft recovery: student/parent/staff name fields round-trip.
- Historical documents: issued narrative snapshots remain unchanged unless an approved correction workflow says otherwise.

Existing tests provide starting points: `packages/shared/src/__tests__/name-format.test.ts`, migration `nameParser.test.ts`, academic `studentEnrollment.integration.test.ts`, `academicSetup.integration.test.ts`, admissions `conversionRetention.integration.test.ts`, and admin `people-draft-adapters.test.tsx`. The inspected conversion fixture uses `middleName: null` at `conversionRetention.integration.test.ts:52`, so it does not catch the confirmed middle-name display loss.
