# T06 Material Ingestion Pipeline

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review the schema work from `T05`
- Use `takomi`, `convex-file-storage`, and `convex-functions`

## Objective

Implement the backend ingestion path for uploaded materials and registered YouTube links.

## Scope

Included:

- upload URL generation
- material record creation
- extraction orchestration
- label suggestion storage
- chunk creation
- indexing status
- audit log writes

Excluded:

- full admin or teacher screens
- portal topic rendering

## Definition of Done

- Admin and teacher materials can enter the system with proper default visibility.
- Processing states are trackable.
- A real PDF parser is used for primary extraction instead of fragile ad-hoc stream parsing.
- A guarded fallback path exists for parser failures or unreadable PDFs.
- Failure states are recoverable and visible in stored status.

## Expected Artifacts

- Convex ingestion actions and mutations
- storage helpers
- indexing helpers
- audit events

## Constraints

- Parser-first extraction is the required baseline for PDFs.
- Any fallback path must stay truthful about whether OCR/LLM extraction actually ran.
- Generated artifacts and uploads must use the same material-domain contracts.

## Verification

- Representative upload and extraction flow completes end to end.
- Failed extraction leaves a usable record with error status.
