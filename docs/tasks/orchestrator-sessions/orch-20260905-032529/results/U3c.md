# U3c — Fee and configuration protection

**PARTIAL implementation; not packet completion.** Implemented a guard/validation slice after the U3b guard slice. U3b itself remains incomplete. Server recovery and Teacher planning adoption remain substantive code work. Do not mark either packet complete or reinterpret remaining code as U7-only evidence. No live Convex, providers/paid AI, production, migration, deployment or commit.

## Actual form inventory

| Route / owner | Field classification / recovery | Protection and progress delivered |
|---|---|---|
| `/billing` page → `forms/FeePlanForm` | Operational: name/description/currency/mode, target class IDs, fee labels/amounts/category/optional flag, installment count/interval/due days. Bank selection is a same-school record ID, not bank details. UI row UUID is not dirty content. Reserved `fee_plan_builder` schema is still only a minimal projection, **not adopted**. | Shared guard in state owner protects route departure and desktop/mobile close callbacks; pending submit blocks discard and repeated submit. Successful domain response resets, failure retains. Shared mobile sections count valid name and valid complete fee/schedule inputs. Save status explicitly says unsaved/no recovery draft, separate from completion. |
| `/academic/sessions` → `SessionCreationModal` | Operational name, start/end dates, activate and auto-generate-term choices. No persistence adapter. | Shared dirty guard, native unload and awaited Escape/backdrop/close/cancel. Initial suggested fields form the clean baseline. Invalid dates retain state and do not mutate. No global progress for this short modal. |
| Same route → `TermCreationModal` | Operational term name/dates, activation and standalone/cumulative result mode. No persistence adapter. | Same guarded close paths; suggested term fields establish clean baseline. Existing date/domain validation retained. Short-form progress excluded. Existing inline session/term date editors are **not yet adopted**. |
| `/assessments/setup/exam-recording` | Exam input mode, session/term context, editing restriction toggle/start/end dates; operational settings. | Replaced local beforeunload listener with common dirty registration, live and mock variants. Existing domain Save and validation unchanged. No fake private-draft save action; no progress indicator for short settings. Selector/query-driven replacement still needs dirty/context reconciliation. |
| `/assessments/setup/report-card-bundles` → `ReportCardBundlesScreen` | Operational bundle fields/sections, scale options, existing record IDs and sourceUpdatedAt. Existing-entity authority is not supplied by create-only U3a schemas. | Common registrations for both editors replace local unload listener. Bundle/scale selection awaits departure guard; discard retains existing domain reset semantics. Existing save validation/version behavior retained. No private recovery/autosave adapter, progress or persistence claim. |
| Teacher `/planning` | Class/subject/term/topic context and work-library navigation; no proposed curriculum/planner route. | Inspected, **no changes**. Requires per-surface short selector vs long authoring inventory/adoption. |
| Teacher `/planning/lesson-plans` → `LessonPlanWorkspaceScreen` | Existing domain draft title/documentState/plainText, revision, output type, topic/class/term/subject context and source identities. Provider payload/raw source documents must not enter generic drafts. | Existing `getTeacherInstructionWorkspace/saveTeacherInstructionArtifactDraft` untouched. No parallel generic draft or identity replacement introduced. Shared guard, conflict/reauth safety, in-flight edit handling and honest domain-save status still need implementation. |

All new guard-only registrations offer Stay/Discard, not Save draft and leave. Private server schemas, begin/save/recovery and atomic submission tombstones are **not wired in this pass**. No credentials/files/bank secrets/provider payloads enter a new store; no new store was added. Retention remains unimplemented at adopter level (U3a defines ordinary 30-day and planning 90-day create-instance contracts).

## Validation fix

Fee submission formerly filtered out invalid rows and accepted the remaining plan. `feePlanValidation` now rejects any blank/nonfinite/nonpositive item, including optional items, and rejects invalid installment counts/intervals/due days. The same validator controls fee/schedule section completion. Class-universal and bank-default choices remain optional; existing U2d bank selector/payload are preserved. A pure signature ignores ephemeral row UUIDs so new clean forms do not warn solely due to generated IDs.

## Verification

Executed Admin adoption/core bundle: **19 PASS** across 3 files, including new invalid-fee and invalid-date/modal cases; Shared mobile progress: **8 PASS**. Admin/Shared typechecks **PASS**. Explicit changed-file ESLint **0 errors / 9 existing warnings**; diff check **PASS**. See U3b.md for exact commands and initial fixed check failures. No backend/Teacher changes or backend/Teacher-specific verification claims. No browser, screenshot, geometry or provider execution.

Files: billing page, FeePlanForm, new `billing/fee-plan-validation.ts`; SessionCreationModal, TermCreationModal; exam-recording page; ReportCardBundlesScreen; shared adoption test file listed in U3b. No backend/schema/shared-framework edits.

Self-review preserved U2 banking payloads and domain saves, avoided meaningless persistent settings copies, removed duplicate native-unload registrations where common guard owns them, prevented failure-driven family modal close, and made no false offline/recovery claims. No form-draft closure endpoint is called after an unrelated successful mutation to pretend atomic completion.

## Open code work / risks

- Complete U3b before declaring dependency satisfaction; then reviewed complete fee/academic/report projections, creator/branch/entity/version/retention adapters, explicit begin/save/autosave/recovery/resolve, atomic submission tombstone and stale-save tests.
- Report configuration's create/update identities require domain ownership resolvers before enabling existing-entity generic storage. Complete guards for editor internal replacements and save-in-flight departure/edits, not just catalog selection.
- Fee variant changes retain page-owned edits but do not currently prompt; context/branch remount contracts and fee modal runtime tests remain. New validation is client-only; no backend contract strengthening claimed.
- Academic inline date editors and selector/query-refresh overwrite paths still need common protection and revision reconciliation. Short mode/policy settings should remain guard-only, not needless private copies.
- Teacher planning adoption is **not implemented**. Preserve existing domain identities; reconcile multi-tab revisions, source/context changes, reauth, and in-flight editor changes before claiming resilient autosave. Do not paste a create-only generic draft over a saved lesson.
- Bank credential/settings forms remain outside this fee-plan adoption; no payment-secret persistence allowed. Import remains U4b.

U7: after missing code is complete, synthetic 320px/desktop fee-modal Stay/Discard/Save/recovery/error, invalid fee/date/total semantics, report submit/revision error, planning multi-tab/source/context/account/reauth, keyboard/focus and actual Next Back/Forward/reload evidence. Current local tests are not these runtime acceptance checks. **Keep U3c open.**
