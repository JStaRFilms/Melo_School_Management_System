# Task: Audit current lesson source ingestion and storage for RAG grounding
**Task ID:** B01
**Stage:** build
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-B01
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.5
## Context
Parent session: orch-20260428-192258

Task title: Audit current lesson source ingestion and storage for RAG grounding
## Objective
Identify where parsed/OCR/imported curriculum text is stored today and design the minimal safe retrieval path for teacher lesson-plan/student-note/assignment generation.
## Scope
- Convex schema and academic lesson knowledge functions
- Teacher generation API
- Existing material ingestion/extraction functions
## Checklist
- [x] Read Convex guidelines first
- [x] Find source text fields/tables and indexes
- [x] Recommend minimal query/function changes
- [x] List school/access/security constraints
- [x] Call out prompt excerpt limits and failure behavior
## Definition of Done
- Find source text storage fields/tables
- Recommend minimal query/function/API changes
- List security/school-scope constraints
- Call out migration needs if any
## Expected Artifacts
- None specified.
## Dependencies
- None specified.
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- Read Convex guidelines first if touching Convex.
- Do not edit files.
- Return a concise implementation plan with exact file/function names.
## Notes
Architecture audit complete. Parsed text is stored in knowledgeMaterialChunks.chunkText/searchText; generation only passed source metadata. Minimal plan: add authorized Convex excerpt query, pass bounded excerpts into prompt, fail when no usable excerpts.