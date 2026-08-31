# Universal School Data Migration Engine & Staging Workbench

## 1. Objective & Scope
The Universal School Data Migration Engine provides a fault-tolerant, isolated staging workbench for importing messy legacy student spreadsheets (`.csv`, `.tsv`, `.xlsx`) into the Melo School Management System.

## 2. Hard Invariants & Architecture
1. **Zero Direct-to-Prod Writes:** All ingested raw spreadsheet records are staged in `stagedImportRecords`. Nothing touches `students`, `users`, or `classes` until explicitly committed.
2. **Autosave by Default:** Real-time cell editing in the workbench executes shallow patches via `patchStagedRecord` with optimistic UI feedback.
3. **Dual-Role Authorization:** Endpoints enforce strict tenancy matching either an active `platformAdmins` super admin or a `users` school admin belonging to `schoolId`.
4. **Deterministic Normalization:**
   - **Name Parsing:** Anglo/Nigerian/International format parser supporting `"SURNAME, Firstname Middlename"`, hyphenated surnames, compound prefixes (`Abdullahi`, `van der`, `Ibrahim`).
   - **Phone Normalization:** E.164 conversion supporting Nigerian prefixes (`080...`, `+234...`, `234...`, `080-...`, 10-digit).
   - **Jaro-Winkler Deduplication:** Weighted token similarity (Name 40%, Phone 45%, Class 35%, Gender 10%) with 85% clash threshold, 50-84% warning threshold.
5. **Zero Data Loss (Metadata Attic):** All uncatered spreadsheet headers are preserved in `stagedImportRecords.unmappedFields` and committed to `students.unmappedData`. Signals are also tracked in `migrationFeatureSignals` for product backlog discovery.

## 3. Database Schema
- `importWorkspaces`: Tracks staging sessions per school with status (`staging`, `ready`, `merged`, `cancelled`) and admission number auto-increment configuration.
- `stagedImportRecords`: Staged student/grade records with row numbers, raw payload, parsed attributes, validation errors, clash candidate references, and resolution actions (`create_new`, `merge_existing`, `link_as_sibling`, `ignore`).
- `migrationFeatureSignals`: Aggregate registry of unmapped spreadsheet columns for product intelligence.
- `students`: Extended with `customAttributes` and `unmappedData`.

## 4. UI Components & Mounts
- `DataMigrationWorkbench`: Shared workbench container in `@school/shared` with:
  - `WorkspaceUploadCard`: Dropzone with parsing progress and admission seed configuration.
  - `RosterReviewTab`: Inline table editor, validation badges, clash triggers.
  - `HouseholdReviewTab`: Family clusters by normalized guardian phone numbers.
  - `ResultsReviewTab`: CA1, CA2, Exam score validation within 0-100 bounds.
  - `ClashResolutionModal`: Side-by-side comparison modal with Split/Merge/Sibling/Ignore actions.
  - `ColumnMappingDialog`: Metadata attic preview.
  - `StagingActionBar`: Sticky bottom bar with real-time error counts, auto-increment admission trigger, and commit CTA.
- **Admin App Mount:** `/students/import` and `/academic/students/import` with sidebar navigation under People & Operations.
- **Platform App Mount:** `/schools/[schoolId]/migration` with action buttons in the schools table and mobile cards.
