# U4b — Real import workbench and reviewed proposals

## Objective / scope
Connect AI-assisted interpretation to the existing deterministic school import workflow, preserving historical IDs and requiring human review before bounded audited commits. No second disconnected importer.

## Context / dependencies
U2c/U3a/U3c/U4a contracts. Read F3/H4/H5 and current DataMigrationWorkbench. It calls migrationWorkspace.listWorkspaces/getWorkspaceSummary/getWorkspaceRecords/getWorkspaceFeatureSignals/createWorkspace, migrationIngest.stageRecordsBatch, migrationAutosave.patchStagedRecord/resolveRecordClash/bulkResolveAdmissionNumbers and migrationMerge.commitImportWorkspace. Admin `/students/import` and Platform school migration use it; academic import is an alias. Separate aiImport stage/update/approve/commit/get/list APIs are unused, require preexisting user IDs/supplied numbers, and commit to a first/default class.

## Ownership
`academic/aiImport.ts`, `migrationWorkspace.ts`, `migrationIngest.ts`, `migrationAutosave.ts`, `migrationMerge.ts` only reviewed import integration sections; shared migration workbench/components/parsers as needed; wrappers and tests. Schema changes serialized; no identity/RBAC migration code execution.

## Instructions
1. Keep the established roster/household/results tabs and mapping/clash dialogs. Adapter must translate structured suggestions/confidence/explanations into staged records with correct branch/class/relationship selections; never accept AI text as an instruction or direct database write.
2. Make uncertain rows require explicit review, deterministic schema/tenant/uniqueness/relationship validation run again at commit, and approved rows/placement visible. Do not fabricate user IDs/default classes to bypass validation.
3. Preserve supplied historical admission identifiers; use U2c proposal for missing-only IDs and explicit reviewed official-counter advancement. Remove implicit import-local counter inference where exposed; never regenerate all historical numbers.
4. Commit bounded idempotent batches with progress/reconciliation/outcome per row and retry only incomplete/failed work. Record actual actor, safe audit and partial-failure remedy. Provider AI stays optional/gated; manual mapping remains useful.
5. U3a supplies private creator/branch draft/recovery and correct progress; raw files need private temporary controls, not localStorage. AI email suggestions go through U4a approval, never provisioning.

## Definition of done / verification
Focused emailAndAiImport/migrationLifecycle/parser tests plus real workbench tests: valid/duplicate/malformed/uncertain rows, wrong school/class/family, stale review, existing number preservation, missing-only generation, partial batch/replay and owner privacy. Record typechecks/tests/self-review; no live import/customer data.

## Execution note
**PARTIAL, remains open.** Creator-private staging, bounded inputs, raw-copy/sample minimization and actual-workbench acknowledged progress are locally tested. Full reviewed import/identity/official-numbering/draft integration is not completed. See `../results/U4b.md` (session `results/U4b.md`) for exact remaining code scope and verification; do not mark done or reinterpret missing code as a provider/U7-only gate.

## Artifacts
`results/U4b.md` old→new API/row contract, batch reconciliation/numbering matrix, field classification, tests and U7 requests. Update matrix. No production, migration/backfill execution, providers, deploy, credentials or unapproved CLI/PR operations.
