# Task B-07 / M6: Institutional Email Operations and AI Import Review Pipeline (H5/F3)

## Objective
Implement institutional email address management and a safe AI-assisted import review pipeline under strict operator verification.

## Scope
- **Institutional Email Operations (H5 / MX-09)**:
  - Non-negotiable invariant: Melo operates ZERO mail servers (delegates to external REST Directory APIs: Google Workspace, Microsoft 365, Zoho Mail).
  - Schema additions in `packages/convex/schema.ts`:
    - `schoolEmailDomains`: Verified institutional domains (`schoolId`, `domain`, `status: pending_verification|verified|failed`, `dnsTxtRecord`, `provider: google|microsoft|zoho|none`, `isDefault`).
    - `institutionalMailboxes`: Mailbox state tracking (`personId`, `schoolId`, `address`, `state: login_only|external_verified|provider_provisioned`, `providerType`, `providerAccountId`, `status: active|suspended|archived`).
  - Backend functions in `packages/convex/functions/academic/institutionalEmail.ts`:
    - Address proposal workbench: Deterministic formatting (`firstname.lastname@domain`), 4-stage collision resolution pipeline (`firstname.lastname`, `firstname.m.lastname`, `firstname.lastname2`), manual overrides.
    - Minor naming privacy safeguards (suppression of full minor names where requested).
    - Fault isolation: External provider API failures never corrupt internal identity.
- **AI Import Review Pipeline (F3 / MX-11)**:
  - Non-negotiable invariant: Zero direct AI commits. All AI extractions stage into a structured review workspace requiring explicit human operator approval.
  - Schema additions in `packages/convex/schema.ts`:
    - `aiImportWorkspaces`: Staged import jobs (`schoolId`, `importerUserId`, `entityType: students|teachers|curriculum|grades`, `status: staged|reviewed|committed|rejected`, `rawTokenCount`, `stagedRows: v.array(v.any())`, `validationErrors: v.array(v.any())`).
  - Backend functions in `packages/convex/functions/academic/aiImport.ts`:
    - `stageAiImport`: Validates extracted rows deterministically against schema rules, redacts PII before logging, stages for review.
    - `commitAiImport`: Commits validated rows in idempotent batches into official operational tables (`students`, `classes`, etc.).
- **Integration Tests**:
  - Email collision resolution tests.
  - Fault isolation tests (provider failure does not affect internal membership).
  - AI staging-to-commit tests (zero commits before explicit review, validation errors caught).

## Definition of Done
- Addresses propose deterministically with collision resolution.
- External directory failures are isolated from internal identity.
- AI import pipeline strictly enforces staging -> validation -> explicit human commit.
- Sensitive credentials/PII redacted from prompts and logs.

## Dependencies
- B-02 (Identity), B-03 (RBAC), B-05 (Verticals) complete.
- D-01 (Compliance) and D-03 (Provider Spikes) frozen.
