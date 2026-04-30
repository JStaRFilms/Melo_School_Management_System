# Task: Backend Page Selection And Page-Aware Ingestion
**Task ID:** T02
**Stage:** build
**Status:** completed
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-T02
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.4
## Context
Parent session: orch-20260430-193734

Task title: Backend Page Selection And Page-Aware Ingestion
## Objective
Implement schema/helper/PDF/action/backend changes for selected PDF page ranges and page-aware chunks.
## Scope
- packages/convex/schema.ts
- packages/convex/functions/academic/lessonKnowledgeIngestionHelpers.ts
- packages/convex/functions/academic/lessonKnowledgePdfExtraction.ts
- packages/convex/functions/academic/lessonKnowledgeIngestion.ts
- packages/convex/functions/academic/lessonKnowledgeIngestionActions.ts
- packages/convex/functions/academic/lessonKnowledgeSourceProof.ts
- packages/convex/functions/academic/lessonKnowledgeTeacher.ts
## Checklist
- [x] Schema widened with optional page-selection and page-aware chunk fields
- [x] Upload request parses and stores page ranges
- [x] PDF extraction reads selected pages and returns page metadata
- [x] Ingestion persists page-aware chunks
## Definition of Done
- Optional selectedPageRanges/selectedPageNumbers/pdfPageCount are persisted
- Selected pages are extracted and chunked with page metadata
- Existing upload flows remain compatible
## Expected Artifacts
- None specified.
## Dependencies
- None specified.
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- complete the task within scope
- use the listed workflow and skills when they are provided
- report blockers clearly
- if review sends this back, continue using the same conversation id when possible
- summarize what changed and what remains
## Notes
Backend implemented across schema, helpers, PDF extraction, ingestion mutation/action, source proof, teacher/admin validators.