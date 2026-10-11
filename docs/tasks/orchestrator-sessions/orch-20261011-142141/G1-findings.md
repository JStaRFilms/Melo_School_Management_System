## G1 findings

Verified cwd as the requested `identity-onboarding-portal` worktree. Read the master plan, G1 packet, repository instructions, Convex guidelines, and unslop. No files changed, tests run, services mutated, or credentials inspected.

Paths below are relative to that worktree. Findings establish code-level causes, not the contents of the user's live records.

### 1. Profile edits can change active-session enrollment without confirmation

Reports 3 and 12.

- `packages/convex/functions/academic/studentEnrollment.ts:1239–1243` returns `student.classId` for the profile.
- `apps/admin/app/academic/students/components/StudentProfileEditor.tsx:149–156` initializes the selector from that value.
- Session membership instead gives precedence to the latest incoming promotion in `packages/convex/functions/academic/studentClassMembership.ts:16–35`.

This explains why a promoted student's roster can show the current class while the profile selector shows the previous class. The promotion workflow deliberately leaves the base class pointer unchanged.

The more serious defect is at `studentEnrollment.ts:1054–1073`:

- Promotion retirement runs when the submitted class differs from the base pointer, even without confirmation.
- Subject reconciliation runs on **every profile save**, including name-only changes.
- `studentEnrollment.ts:835–850` deletes subjects unavailable in the target class and rewrites surviving selections' class IDs.

Consequently, saving identity details with the old selector value can alter active-session subject selections while leaving the promotion in place.

**Smallest proposed fix:** Resolve the profile's effective active-session class using the same promotion precedence as academic queries. Keep the confirmation checkbox at `StudentProfileEditor.tsx:517–532`. Gate all assignment changes, promotion retirement, and selection reconciliation behind explicit confirmation. An identity-only save must leave enrollment untouched.

### 2. Roster admission loses structured names when the combined name has more than two words

Report 9.

- `apps/admin/app/academic/students/page.tsx:704–709,793–796` collects separate first and last names but submits only their combined `name`.
- `packages/convex/functions/academic/studentNameCompat.ts:45–56,155–164` reconstructs structured fields only when that name contains exactly two words.
- For longer names, the display name survives but `firstName` and `lastName` remain absent.
- The profile editor initializes absent fields as empty at `StudentProfileEditor.tsx:149–150` and disables saving unless both are filled at line 565.

This directly explains a readable roster name beside blank profile fields. It also affects compound first names or surnames, not only middle names.

**Smallest proposed fix:** Submit the existing structured fields from the roster admission path. The standalone onboarding page already does this at `apps/admin/app/academic/students/onboarding/page.tsx:407–410`. Preserve ambiguous legacy display names without guessing their components. Coordinate optional middle-name handling with G3.

### 3. Linking an existing parent also overwrites that parent's identity

Reports 1 and 2.

`packages/convex/functions/academic/studentEnrollment.ts:3136–3178` patches an existing parent-role user's name and supplied phone using the newly entered linking form.

The duplicate check happens later at lines 3237–3241. A thrown error rolls back the transaction, but a confirmed link commits the identity overwrite. When the parent already belongs to the reused household, `existingLink` exists and that backend confirmation check is bypassed.

There are also separate name sources:

- Household labels are generated once at `studentEnrollment.ts:231–246`. Contact edits do not regenerate them.
- Parent cards read the application user through `getReadableUserName` at lines 2844–2853.
- Portal navbar names come from Better Auth session data at `apps/portal/lib/AuthProvider.tsx:51–64` and `apps/portal/app/(portal)/layout.tsx:129`.
- Portal workspace names come from application users at `packages/convex/functions/portal.ts:705–707`.

Family linking and contact editing do not update the Better Auth name. These mechanisms can produce the reported household, card, and portal differences.

**Smallest proposed fix:** Separate “link existing parent” from “edit parent identity.” Linking should preserve identity fields. Retain the existing Edit action at `StudentFamilyPanel.tsx:661–675`. Use the authorized application identity consistently for portal display names.

**Decision needed:** Is the household name an independent label, or should a generated label follow explicit parent-name changes? Do not automatically rename existing households without that decision.

### 4. Existing-parent reuse requires retyping details instead of selecting a record

Report 2.

- `apps/admin/app/academic/students/components/StudentFamilyPanel.tsx:303–325` requires first name, last name, and email before running duplicate-email review.
- Review is an exact normalized-email lookup, not a searchable existing-parent picker.
- Backend linking likewise requires those fields at `studentEnrollment.ts:3052–3054`.

**Proposed fix:** Add a school-scoped, bounded existing-contact search and an explicit `parentUserId` linking path. Display stored identity details as read-only during linking. Preserve relationship and primary-contact controls. Reject student accounts and foreign-school IDs server-side.

Staff contacts already receive backend identity protection at `studentEnrollment.ts:3380–3410`; preserve that behavior.

### 5. “Remove parent” removes a household link, not the parent account

Report 1.

- `unlinkStudentFromFamily`, at `studentEnrollment.ts:3552–3578`, clears only the student's household reference.
- `removeStudentFamilyLink`, at lines 3582–3637, deletes a `familyMembers` row.
- Neither operation deletes or archives the parent user.
- The last-parent guard at lines 3611–3618 prevents stranding active students.
- `deleteFamilyIfEmpty`, at lines 423–433, deletes a household only when no members and no active students remain.

Therefore, unlinking the last student intentionally retains a household with parent members. It is not necessarily an orphan defect. Editing a contact to reuse another account also leaves the old user record behind at lines 3468–3527.

**Decision needed:** Does “delete parent” mean archive the school-local parent record, remove household relationships, or erase identity and login records? These are different operations.

**Recommended direction:** Keep unlink distinct. Add deliberate school-local archival only after checking all household links and retained-record dependencies. Do not delete shared Better Auth identity or historical records as a side effect.

### 6. Quick Admission and Family Onboarding store different contact concepts

Report 4.

- Quick Admission's guardian fields appear in `StudentCreationOptionalFields.tsx:65–85`.
- `apps/admin/app/academic/students/page.tsx:842–855` sends guardian fields separately from `parentLink`.
- `studentEnrollment.ts:677–696` stores guardian fields on `students`.
- Parent linking creates or reuses `users`, `families`, and `familyMembers`.
- No code synchronizes guardian text with the linked parent's identity.

The standalone onboarding form also exposes both sets of fields. Its submit path creates the student first, then links the family separately at `onboarding/page.tsx:405–494`. Unlike roster admission, it does not pass `confirmDuplicateLink` or offer the corresponding confirmation path.

**Proposed interaction:** One student admission flow with optional family contact entry, choosing an existing contact or creating one. Clearly distinguish a separate emergency contact from a linked portal contact. Reuse entered student identity rather than requiring another admission.

**Decision needed:** Should guardian text represent a separate emergency contact, or default to the selected primary family contact? Do not silently overwrite existing guardian values.

### 7. Identity saves also risk losing identity linkage

Relevant to safe identity editing; hand off to G2/G3.

`studentEnrollment.ts:1025–1052,1157–1158` rebuilds and replaces the student user document. It omits schema fields including `authTokenIdentifier` and `personId`.

It also resets `authId` whenever `admissionNumber` is supplied, even unchanged. The profile editor always supplies it at `StudentProfileEditor.tsx:294–299`. Thus an ordinary profile save can replace a provisioned Better Auth ID with the synthetic student ID.

**Proposed fix:** Patch only edited fields and change login identifiers only through an explicit identifier-change operation. Preserve existing identity linkage.

## Authorization and regression coverage

The inspected entry points derive authenticated school membership, require enrollment capability and admin access, and check student/contact school ownership. Email reuse is school-scoped at `studentEnrollment.ts:310–320`. Preserve these boundaries in any new picker or deletion operation.

Existing tests inspected in `packages/convex/functions/academic/__tests__/studentEnrollment.integration.test.ts` cover promotion/session roster behavior, explicit restoration, class-move reconciliation, tenant-scoped email review, and relationship preservation. They do **not** establish identity-only enrollment preservation or safe identity reuse. The class-move test at lines 425–434 currently changes class without confirmation.

Add focused cases for:

- Name-only edits preserving promotion, selections, base assignment, auth linkage, and person linkage.
- Effective active-session selector values and explicitly confirmed reassignment.
- Compound names retaining structured fields.
- Existing-parent linking preserving identity; explicit Edit updating it.
- Cross-school and student-account rejection.
- Unlink versus archival semantics, including last-parent protection.
- Unified admission using one identity entry and explaining guardian storage.
- Duplicate-parent confirmation and retry without duplicate enrollment.

No runtime checks were performed under the read-only packet. Household-label, guardian-contact, and deletion semantics require approval before Build.
