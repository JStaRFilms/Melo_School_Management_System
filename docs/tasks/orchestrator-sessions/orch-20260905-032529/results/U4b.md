# U4b — Import review safety increment

**PARTIAL / NOT PACKET COMPLETION / E0.** The complete routed human-approved importer is not implemented. Do not deploy or treat this result as acceptance of F3/H4/H5. This pass delivers a small privacy/progress increment only. Remaining work below is substantive implementation, not merely U7 evidence or an unconfigured-provider gate.

Read the packet, normative F3/H4/H5 decisions, U2c/U3a/U3c/U4a results, actual migration workbench/upload/action bar and migration/aiImport code, Convex guidance and existing lifecycle tests. No live provider, production, deploy, migration/backfill, CLI codegen, credential, seed, commit or subagent operation ran. Tests use synthetic in-memory fixtures only. Existing unrelated working-tree work was preserved. No schema or generated file changes.

## Changed old → new contract

| Seam | Previous | This increment |
|---|---|---|
| migrationWorkspace list/summary/records/cancel | Same-branch administrators could access another creator's staging | Exact authenticated creator and school required, including Platform callers. List returns only creator rows within existing bounded discovery window. Mode must match actual actor. |
| migrationIngest / migrationAutosave / migrationMerge | Tenant checks only | Shared private-workspace resolver on all writes. Staging/patch/clash/number edits reject committing workspaces as well as terminal ones. |
| createWorkspace sourceFiles | Unchecked storage references accepted | Nonempty references fail closed: temporary private upload controls are unavailable. No raw file upload introduced. |
| stageRecordsBatch | Unbounded argument length; second raw source copy; source values mined into signals | 1–50 rows; rawPayload stored empty; no new sample values stored in signals. Parsed projection and existing unmapped/custom fields remain unchanged. This is NOT a complete secret/schema allowlist for those fields. |
| getWorkspaceFeatureSignals | School-wide samples regardless of selected workspace | Requires a selected owned workspace, filters signals to it, omits sample values even from old rows. No workspace returns no signals. |
| commitImportWorkspace | Invalid/zero batch sizes accepted; no explicit already-committed-row skip | Integer 1–100 required when supplied; already committed rows skipped before side effects. Existing transactional cursor logic retained. |
| DataMigrationWorkbench | Failed staging hid created workspace; no visible acknowledged batch progress; misleading zero-risk copy | Opens created workspace before batching; server-confirmed processed/total display retained after failure; Back disabled during active stage/commit; explicit unavailable AI, deterministic duplicate scores and separate mailbox approval copy. |

Tabs, mapping/clash dialogs, parser and current APIs are retained. No disconnected new importer added. `aiImport.ts` remains untouched and unused by these routes; its legacy first/default-class commit is NOT endorsed or connected.

## Batch reconciliation / numbering matrix

| Case | Current result / gap |
|---|---|
| Ordinary retry after a successful batch | Existing stored phase/cursor resumes; processed-row guard now avoids repeated side effects. UI preserves the last acknowledged progress. |
| Failed transaction | That batch rolls back; earlier transactions remain. Retry uses the same workspace. UI DOM test covers successful batch → failure → retry completion. |
| Permanent row error after partial commit | **Open:** no correction/re-review/reconciliation endpoint. Committing rows are frozen to prevent unreviewed mutation. Owner may cancel remaining work, but cancellation does not undo already-written rows. |
| Row outcomes | Existing isCommitted/committedStudentId only; ignored/create/merge/result outcome ledger and actual-actor audit are **open**. Existing totalRecords completion accounting has not been redesigned. |
| Stage replay / lost stage response | **Open:** no per-source-row ingest idempotency key. UI now retains the workspace but does not retry failed staging automatically. |
| Supplied historical numbers | Existing path preserves nonempty supplied string, but duplicate can still silently reuse a student at merge: **open and unsafe for launch**. |
| Missing identifiers | Existing import-local prefix/sequence logic still exists: **not adopted to U2c**. No official-numbering completion claim. |
| Official proposal/version/advancement | **Open:** use U2c read-only proposal, missing-only allocation in final successful transaction, and explicit reviewed manual claim/counter choice; never parse historical strings to infer counter. |
| Platform provenance | Existing resolveSchoolAdminActorId can substitute another user: **open**; actual actor audit and schema-safe operational authorship need deliberate integration. |

## Field classification / protection

- Name, DOB, guardian contact, household relationships, historical identifiers and scores: personal/child-confidential staged content. Creator isolation added; expiry, erasure, strict reviewed field allowlist and private recovery are still absent.
- Raw source files: stay browser memory in existing parser; storage references rejected. No scanner/privacy lifecycle is asserted.
- Raw source row copy: no longer duplicated at stage. Parsed custom/unmapped values are still accepted and require further classification/secret rejection before launch.
- Feature header/type: operational schema hints; values omitted. Existing school-wide header de-duplication can suppress a later workspace's hint; pagination/index redesign remains open.
- Mapping drafts: U3a mapping-only registry exists but is not wired. No localStorage/sessionStorage/IndexedDB store was added.
- AI: unavailable, no provider call or generated confidence/explanation fabricated. Existing deterministic clash scores are labelled accordingly. Structured suggestion adapter and explicit uncertain-row approval are still open.
- Email: copy separates approval/provisioning; actual U4a post-canonical-member handoff is not wired. No mailbox action added.

## Verification

- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/migrationLifecycle.test.ts functions/academic/__tests__/emailAndAiImport.integration.test.ts`: **28 PASS** (16 lifecycle, 12 email/legacy-AI).
- `pnpm --filter @school/admin exec vitest run __tests__/migration-workbench.test.tsx`: **1 PASS**, actual component rendering with mocked Convex transport; partial progress, failure retention, retry and unavailable-AI copy.
- `pnpm --filter @school/shared exec vitest run src/migration/__tests__`: **30 PASS**.
- Convex, Shared, Admin typechecks: **PASS**.
- Focused ESLint on four changed backend modules, workbench and new DOM test: **PASS**.
- `git diff --check`: **PASS**, repository CRLF warnings only.
- Theme audit ran informationally. Added slate text is product neutral; existing indigo interactions are existing product branding, emerald badges semantic success. No global replacement or new tenant color input.

Initial new real-API lifecycle case failed because the old test module map was not Windows-normalized. Applied the same URL-root normalization as the email integration suite and reran successfully. Existing lifecycle tests still emit their preexisting direct registered-function-call warnings; the new test uses generated API references. No failing expectation was weakened. Existing passing tests include old import-local numbering/fabricated identity behavior, so passing this suite is expressly NOT proof of F3 acceptance.

## Self-review / remaining required code

This change closes creator privacy leaks and progress overstatement without inventing a second importer. It does **not** finish the packet. In particular: migrate authorization from coarse legacy migration-admin checks to current capability/membership authority; build structured mapping/confidence/explanation adapter; deterministic tenant/class/subject/family selections and validation at review and commit; immutable reviewed revision and edit invalidation; real identity creation/selection without fabricated auth IDs/emails; no automatic class/subject creation/default placement; no family-name auto-link; official numbering/claims; bounded row outcomes/audit and failure remediation; U3a departure/private draft lifecycle; safe classified temporary source retention; retire or redirect the disconnected aiImport commit. These are all remaining code scope. No external access blocker prevented these tasks; they were not completed in this pass.

Files modified: four migration backend modules; shared DataMigrationWorkbench; lifecycle test. Created Admin migration-workbench test and this result. Matrix and packet notes updated.

## U7

E0, no screenshots/browser run. After missing code is complete, capture authorized synthetic Admin and Platform routes at desktop/320px: manual mapping, uncertain confidence/explanation, duplicate resolution, explicit class/family, stale review, historical ID preservation/missing-only preview, commit confirmation, partial failure/reconciliation/retry, owner denial and actual Back/reload/reauth. Existing shared tabs/dialogs require keyboard and narrow-screen evidence. Do not present current UI as production-safe or a connected AI provider.
