# R1 Critical 1 import remediation

## Status

**Locally remediated in code; release verification remains E0.** The routed `DataMigrationWorkbench` now uses a creator-private, tenant-scoped reviewed plan. The prior unsafe commit behavior is removed. No provider, deployment, production, migration, seed, credential, or code-generation command was run.

## Unsafe path → remediated path

| Prior behavior | Current behavior |
|---|---|
| Admission-number collision silently rebound a row to an existing student | `create_new` rejects existing student/claim collisions at review and revalidates at commit. Only an explicit same-tenant `merge_existing` decision can reconcile to an existing student. |
| Import manufactured `.local` users | Student creation requires selection of an existing, active, same-school student user with no existing student enrollment. No identity is created or rebound. |
| Class/subject text created operational entities or selected a default | Imported class/subject labels are reference data only. The reviewer must select existing same-school class/subject records. Grade rows additionally require existing student/session/term. No class, subject, session, term, family, or relationship is implicitly created. |
| Workspace-local prefix/sequence generated admission IDs | Import-local numbering controls and bulk numbering were disabled. Missing-only IDs receive exact proposals from the active H4 policy and are allocated transactionally at commit. |
| Supplied historical numbers could be regenerated or silently alter the counter | Supplied numbers are preserved only after explicit confirmation and reason. Counter advancement is optional, explicit, version-checked, reflected in subsequent proposals, and audited. |
| Mutable review rows could commit after edits | Every row has a revision; review stores the reviewed revision. Edits invalidate approval. Final approval freezes a versioned plan and commit revalidates row revision, plan version, tenant ownership, collisions, relationships, and numbering policy state. |
| Unbounded/unreconciled commit | Approval and commit are paginated bounded batches. Each committed/ignored/merged row stores an immutable outcome and receipt ID. Each batch and final plan approval emit safe audit events attributed to the current actor. Completed retry returns the existing receipt; partial workspaces can be reopened without modifying committed outcomes. |
| Retry/staging replay could duplicate work | Staging is idempotent by workspace and row number. Commit skips immutable committed rows and resumes from its cursor. The UI shows server-confirmed progress, receipts, row outcomes, and a partial-failure reopen action. |
| Legacy disconnected importer remained another write path | `academic/aiImport.commitImportWorkspace` now always fails after authorization and creates no operational records. The routed migration APIs are the only enabled commit path. |
| Raw/upload handling implied capability that was unavailable | Source-file references are rejected until private temporary upload controls exist. Duplicate raw payload copies are discarded, feature signals never retain sample values, workspaces are creator-private, and unreviewed/unmapped text is not written into canonical student profiles. |

## Reviewed row contract

A row decision is one of `create_new`, `merge_existing`, or `ignore`.

- `create_new` student rows require an existing un-enrolled student user, existing class, and either a confirmed supplied identifier or an exact H4 generated proposal. Family linkage is optional but must select an existing same-tenant family.
- `merge_existing` requires an explicit existing same-tenant student. It is a reconciliation decision; imported text does not overwrite canonical identity or placement without field-level review.
- `create_new` grade rows require explicit existing student, class, subject, session, and term mappings. Duplicate operational or reviewed assessment keys are rejected.
- `ignore` is explicit and may be used for malformed input; it creates an audited immutable ignored outcome and no operational record.
- All accepted rows are revalidated inside the commit transaction. Imported text, duplicate heuristics, and AI-like labels are never database instructions.

## Numbering and reconciliation matrix

| Case | Review | Commit/retry result |
|---|---|---|
| Supplied unique historical ID, no counter advance | Confirmation + reason | Exact identifier claimed and preserved; official counter unchanged |
| Supplied historical ID with explicit advance | Confirmation + reason + exact next sequence + expected policy version | Claim and counter advance occur in one transaction; later missing-only proposals account for the reviewed advance |
| Missing identifier | Active H4 policy/version required | Exact approved proposal is rechecked and allocated transactionally |
| Existing/claimed collision before review | Rejected unless reviewer explicitly chooses same-tenant merge | No create or implicit binding |
| Collision/policy change after approval | Previously approved row becomes stale | Commit rejects and writes no row outcome/claim from the failing transaction; reviewer must correct/reapprove |
| Partial batch failure | Committed rows/receipts stay immutable | Reopen preserves those rows and permits correction/re-review only for incomplete rows |
| Completed retry | No new writes | Existing final receipt and counts are returned |

## Field and privacy classification

- **Operational only after review:** supplied/generated admission number, selected existing entity IDs, student demographic/address fields for an explicitly selected identity, and grade scores for explicit academic mappings.
- **Reference-only staged text:** class, subject, household and guardian labels; these never create or bind entities.
- **Staging-only metadata:** deterministic validation errors, duplicate score/reason, row revision, review status and plan proposal. No AI output is fabricated.
- **Not committed:** unknown/custom columns and raw payload copies. Unknown header signals retain header/count only, without sample values.
- **Audit-safe:** plan version, row ranges/counts, success/failure counts and receipt IDs; imported child/family payload is omitted from audit summaries.
- **Disabled:** temporary source-file uploads and provider AI interpretation remain truthfully unavailable until their private/approved infrastructure exists.

## Evidence

Passed locally:

- `pnpm --filter @school/convex typecheck`
- `pnpm --filter @school/shared typecheck`
- `pnpm --filter @school/admin typecheck`
- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/migrationReviewedImport.integration.test.ts functions/academic/__tests__/migrationLifecycle.test.ts functions/academic/__tests__/emailAndAiImport.integration.test.ts functions/academic/__tests__/admissionNumbers.integration.test.ts functions/academic/__tests__/transfers.integration.test.ts` — **54 passed**
- `pnpm --filter @school/shared exec vitest run src/migration/__tests__` — **30 passed**
- `pnpm --filter @school/admin exec vitest run __tests__/migration-workbench.test.tsx` — **2 passed**
- Focused ESLint — passed
- `git diff --check` — passed
- `node scripts/audit-theme-colors.mjs` — informational; direct colors in touched workbench files remain existing/product/status neutral categories, with no tenant-theme replacement attempted

Regression coverage includes malformed explicit ignore, explicit create/merge decisions, foreign tenant/class/family rejection, grade mapping, collision before and after approval, policy-version drift, missing-only H4 allocation, historical preservation and explicit counter movement, mixed counter/proposal ordering, staging replay, partial batches/reconciliation, immutable receipts, completed replay, creator privacy, legacy commit denial, and 1,005-row bounded processing.

## Self-review / residual gates

- No importer path creates users or implicitly creates/binds classes, subjects, families, sessions, terms, relationships, or students on collision.
- No source files are accepted and no AI output is represented as available.
- Browser/authenticated narrow-screen, keyboard/focus, reload/reconnect and live Convex evidence were not run; evidence remains **E0**.
- Existing deterministic spreadsheet header inference remains the manual parser seam. Unrecognized fields are visible as review signals but are deliberately not written to canonical profiles until a field-level mapping contract exists.
- Runtime schema/function rollout and any historical data remediation require separately authorized deployment/migration work.
