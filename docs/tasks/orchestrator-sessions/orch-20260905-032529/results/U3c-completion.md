# U3c completion — fee, academic, report and Teacher planning forms

## Actual status

**Local code complete; U7 authenticated runtime evidence remains gated (E0).** U3c now applies the existing U3a lifecycle to the real fee/session owners, preserves existing report and Teacher domain-draft engines instead of creating parallel stores, and protects short settings with the common departure guard. No live Convex, provider, production, deploy, migration, Astra, paid-AI or credential operation was run.

## Per-form adoption

| Route / real owner | Persistence and identity | Fields / sensitivity | Protection and progress |
|---|---|---|---|
| Admin `/billing` → page-owned `FeePlanForm` | Strict `fee_plan_builder` U3 draft, creator/account/branch/form scoped, 30-day ordinary retention. Explicit/debounced save and Preview/Resume/Discard use the existing persistent adapter. `billing.createFeePlan` accepts the exact draft ID/revision and commits the tombstone in the same Convex transaction as creation. | Name, description, currency, mode, target class IDs, fee labels/amount/category/optional flag, installment values, and optional same-school bank-account record ID. UI row UUIDs are regenerated. Bank details, secrets, credentials, provider payloads and raw files/documents are excluded. | Sidebar/modal close and workspace departures use the common guard. Failed validation or mutation retains edits/draft; successful mutation resets only after acknowledgement. Mobile completion is derived from valid name plus complete valid fee/schedule values and is independent of save state/scroll. Invalid optional rows are rejected, not filtered away. |
| Admin `/academic/sessions` → `SessionCreationModal` | Strict `academic_setup` U3 draft with the same persistent recovery controls and 30-day retention. `academicSetup.createSession` atomically commits the exact draft revision with session/optional generated-term creation. | Session name, start/end dates, active choice and generate-terms choice only. No documents, credentials or provider data. | Escape, backdrop, close, cancel and route departures are awaited. Invalid dates do not mutate. Mobile completion uses valid name and ordered dates, not interaction history. |
| Admin `/academic/sessions` → `TermCreationModal`, `SessionTimelineCard`, `TermCard` | Deliberately no parallel generic store: these are short creation/edit controls and existing version-pinned domain mutations remain authoritative. | Operational term/session names, dates, activation and result mode. | Existing modal guards remain; inline session/term date editors now register their actual dirty state, keep reactive refresh from replacing active edits, guard editor close/departure, validate before guard-save, and block discard/editor mutation while save is in flight. No global progress for short inline settings. |
| Admin `/assessments/setup/exam-recording` | Existing settings mutation remains the only persistence engine. | Exam input mode and session/term editing-policy dates/toggle. | Common guard can invoke the real save. Session/term selector replacement awaits the guard so query/context changes cannot silently erase edits. Existing domain validation remains completion authority; no needless progress for this short settings page. |
| Admin `/assessments/setup/report-card-bundles` → `ReportCardBundlesScreen` | Existing scale/bundle entity IDs and `sourceUpdatedAt` optimistic versions remain authoritative; no create-only generic draft is layered over them. | Operational scale options and add-on sections/fields; no sensitive content. | Catalog/editor replacement awaits the common guard and Save uses the real domain mutation. In-flight saves are shared rather than duplicated, discard is blocked while pending, and edits made during a save remain dirty after the acknowledged snapshot. The existing staged designer/distribution UI is retained instead of adding duplicate global progress. |
| Teacher `/planning/lesson-plans` → `LessonPlanWorkspaceScreen` | Existing `instructionArtifacts`/document/revision domain engine is preserved. Every save now supplies the loaded `expectedRevisionNumber`; the server rejects stale/new-artifact mismatches before writing. Generation also pins the current server revision. No generic form draft is introduced. | Title, rendered document/plain text, output type, school template/context and source IDs already owned by the domain engine. Raw source documents, credentials and provider payloads are not copied to another store. | Autosaves are serialized; edits arriving during an in-flight save trigger a later snapshot and are not overwritten. Source/library/output-context changes await the common guard. Conflict requires a newer reactive revision before explicit Load latest. Disconnect, reauth, save failure and conflict states are distinct and honest. Mobile progress validates title plus required template headings; scroll does not affect it. Manual generation first saves dirty edits. |
| Teacher `/planning` | Route is a selector/launcher rather than a long authoring owner. | Context selection only. | No duplicate draft/progress added. The actual authoring route above owns recovery. Teacher remains default-branch-only; common workspace account/branch departure protection and the context-keyed lesson workspace prevent cross-context reuse. |

## Atomicity and conflict decisions

- Persistent fee/session submission follows `prepareSubmission()` → domain mutation plus `finishFormDraft(..., "committed")` in the same transaction → `submissionSucceeded()` only after acknowledgement. Stale/missing revisions roll back domain creation.
- A committed tombstone cannot be resurrected by a delayed stale save.
- Report configuration continues to use its existing entity/version contract; save-in-flight edits are compared against the acknowledged snapshot rather than incorrectly marked clean.
- Teacher planning continues to use its richer domain revisions. Required revision pins and a server-side latest-revision check prevent multi-tab last-write-wins overwrites; a conflict never auto-merges or silently loads.
- Connection status comes from Convex/auth state, not `navigator.onLine`. Disconnected or reauth-required edits are described as retained only in the current tab until an explicit successful save.

## Focused regressions

- Fee recovery restores the complete approved projection, returns the exact closure revision and rejects bank details/secrets/provider payloads/passwords/raw-document fields.
- Fee and academic backend tests prove atomic tombstone commit, stale-revision transaction rollback and no resurrection.
- Fee progress is validation-based and independent from saving/scroll.
- Academic modal invalid dates and inline term date departures retain edits.
- Report save tests prove edits made during an in-flight mutation remain dirty.
- Teacher tests cover stale conflict, explicit reactive latest load, required revision argument, disconnect, reauth, source/context departure and validation-driven progress.
- Teacher backend test proves stale revision rejection and successful next-revision append.

## Verification

Final local checks:

- Admin focused U3 suite: `draft-core`, `form-adoption-guards`, `long-form-drafts` — **3 files / 25 tests PASS**. A final changed-test rerun — **2 files / 9 tests PASS**.
- Teacher complete suite — **6 files / 33 tests PASS**, including the 2 new planning recovery tests.
- Convex fee/draft/planning suite with a 20s local test timeout — **3 files / 17 tests PASS**. The first parallel run had one 10s timeout in an existing staff-draft case; isolated and final combined reruns passed. Timeout-overflow warnings from synthetic expiry scheduling remain test-runner warnings.
- Shared recovery/progress suite — **2 files / 14 tests PASS**.
- Admin, Teacher, Convex and Shared TypeScript checks — **PASS**.
- Explicit changed-file ESLint — **0 errors / 16 existing unused-symbol warnings**.
- `node scripts/audit-theme-colors.mjs` — completed informationally. Findings are existing product neutrals and semantic success/warning/error colours; no tenant-theme substitution was made.
- `git diff --check` — **PASS**.

## Self-review

- Kept one persistence engine per owner: generic U3 drafts only for new fee/session creation; report and Teacher continue their richer domain stores.
- Verified all generic projections are strict and omit UI UUIDs, credentials, secrets, bank values, provider payloads and raw source/file content.
- Verified draft clearing is neither optimistic nor a second post-domain mutation: it is transactional and revision-pinned.
- Prevented stale planning writes and report in-flight edits from being mislabeled clean.
- Preserved existing billing bank-account selection/snapshot behavior, report optimistic versions, grading semantics, planning generation gates and U3a connection authority.
- Added no global progress to short settings or to report's existing staged designer.

## Remaining U7 evidence / risks

E0 remains. U7 should capture authenticated desktop and 320px runtime evidence for reload recovery, Back/Forward/sidebar/navbar/modal close, keyboard/focus, branch/account/reauth, disconnect/reconnect, save failure, fee/session stale tombstone rollback, report revision failure, planning two-tab conflict and source/context changes. Teacher branch switching is not enabled by the current product route, so runtime evidence must verify the default-branch gate rather than invent a switch. Authorized schema/function rollout is still required before runtime use; no deploy or migration was performed here.
