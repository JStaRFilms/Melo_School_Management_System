# U3b — People forms protection

**PARTIAL implementation, not packet completion.** This pass delivers shared departure registration and two concrete enrollment loss/retry fixes. It does **not** deliver the required server-draft adapters, recovery UI or people-form validated progress. Those are remaining code work, not merely U7 evidence or deployment blockers. No live Convex, provider, deployment, migration, production operation or commit was performed.

Read U3a's actual registry/hook/transaction contract, U2a–d results, actual enrollment/billing edits, the packet/implementation ownership plan and H6/H7 decisions before editing. Existing changes were preserved. No shared framework or backend code was changed.

## Actual integration / classification

| Route / state owner | Fields and classification | Implemented protection / remaining adapter |
|---|---|---|
| `/academic/students/onboarding/page.tsx` → `StudentFirstOnboardingForm` | Personal: student first/last names, gender, DOB, house, guardian name/phone, address; parent names/email/phone/relationship/contact preference. Operational enrollment: class, admission number, override reason/confirmation/counter choice, reviewed policy. | Shared `useDirtyForm`, including credential-only and photo-only edits; reset uses awaited guard. **No persistent adapter yet** for reserved `student_onboarding`. |
| `/academic/students/page.tsx` → quick form and `components/FamilyOnboardingForm.tsx` | Same student/contact fields available in this owner, parent contact/link fields, class context. Parent linking already occurs inside its create mutation. | Registration is at actual state owner, not duplicated in desktop/mobile renderers. Both mobile close controls await common guard; modal closes only after successful create, never after caught validation/mutation failure. **No persistent `family_onboarding` adapter yet.** |
| `/academic/teachers` → `TeacherCreationForm` | Personal: display name/email. Credential: temporary password, returned teacher/email/password result. UI-only: copied flag, pending/error state. | Shared dirty guard until successful action result; pending create cannot be discarded; password input masked and raw provisioning error no longer logged by this form. **No persistent `staff_onboarding` adapter yet.** Three-field form receives no redundant progress indicator. |

All fields above remain page memory only in this pass. This table is an inventory, **not an extension to U3a's strict allowlists**. Credentials, provisioning summaries, auth tokens, raw photo `File`, blob preview URLs, upload storage IDs and photo metadata must remain excluded when implementing persistence. Recovered projections need explicit photo reselect and credential re-entry notices; that recovery UI is not implemented. No localStorage/sessionStorage/IndexedDB or draft audit writes were added.

## Submit/retry contract delivered

Standalone enrollment retains U2c's request key for uncertain create responses. After an acknowledged create, it now retains the created student ID and skips create/photo upload on later family/credential retry. A visible noncredential notice explains that the student exists, follow-up is pending, and identity edits do not modify the created record. Generic follow-up failure text avoids exposing provider responses. Reset is guarded; explicit discard still does not delete a created student. Success resets only after the complete requested workflow succeeds. A focused DOM test verifies a failed family action then retry calls create once and links the same ID twice without invoking credential providers.

**Limit:** this continuation identity is RAM-only. Hard reload, close or full-document reauthentication is not a recoverable continuation. Transactional private-draft closure and durable follow-up identity are still required before claiming crash-safe/no-duplicate recovery. Existing family-list create path still needs U2c manual-override controls and durable request identity; no authority bypass was added.

Shared registrations use U3a's common sidebar/link/navbar/native reload/ordinary Back paths. They do not magically guard arbitrary imperative class/session/history replacements. Operational branch switching remains U1b-disabled on unscoped routes. Account reauthentication/remount recovery is not delivered for these guard-only forms. No Save draft and leave action is offered for them.

## Verification / self-review

- Admin `vitest run __tests__/form-adoption-guards.test.tsx __tests__/student-onboarding-retry.test.tsx __tests__/draft-core.test.tsx`: **3 files, 19 PASS** (5 new adoption tests, 14 existing core regressions).
- Shared `vitest run src/components/__tests__/MobileProgressIndicator.test.tsx`: **8 PASS**, shared core progress regression only.
- Admin and Shared `typecheck`: **PASS**.
- Explicit changed-file ESLint: **0 errors / 9 existing unused-import/variable warnings**. `git diff --check`: **PASS**, LF/CRLF advisories.
- Tests cover teacher failure retention, Stay/discard, no fake draft-save option, pending-create departure denial, masked password, session close/invalid dates, invalid optional fee and student partial-follow-up retry. They do not establish authenticated browser behavior or server recovery.
- Initial lint failures from ref-based modal baselines were fixed with state; a test's unsupported accountId intent property was removed and checks rerun. No valid tests were weakened.

Modified U3b files: standalone onboarding page, students page, TeacherCreationForm. Created tests: `apps/admin/__tests__/form-adoption-guards.test.tsx`, `student-onboarding-retry.test.tsx` (first suite also covers U3c). Related U3c changes and limitations are in U3c.md.

## Remaining acceptance / U7 request

Implement reviewed schemas + authenticated branch/account/create-instance adapter, explicit begin, autosave/Save, Preview/Resume/Discard/revision resolution, approved RAM recovery and atomic domain submission closure. Add validated student/family section semantics without duplicating existing presentation. Complete durable partial-creation continuation, all imperative selector/context departures and provider-action retry safety. Add real form integration tests for failure/conflict/reauth/isolation/recovery; core tests are not adopter coverage.

U7 must use synthetic identities, never capture temporary-password/result panels, and verify desktop/320px, keyboard/focus, actual Back/Forward/reload/sidebar/account, failed family create modal retention and same-tab follow-up retry. **No screenshots or browser acceptance are claimed. Keep U3b open.**
