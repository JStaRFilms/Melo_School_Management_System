# Task: Implement multi-format upload extraction and UI support
**Task ID:** rag-impl
**Stage:** build
**Status:** completed
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-rag-impl
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.4
## Context
Parent session: orch-20260504-135144

Task title: Implement multi-format upload extraction and UI support
## Objective
Implement support for DOCX, PPTX, TXT/MD, images with OCR, and existing PDFs in teacher knowledge ingestion. Keep Convex validators, tenant scope, and existing flows intact.
## Scope
- None specified.
## Checklist
- [x] Server accepts supported MIME types and file size classes
- [x] Extraction adapters handle PDF, DOCX, PPTX, TXT/MD; images return OCR-needed/provider OCR path
- [x] Teacher upload input accepts all MUS extensions
- [x] Typecheck/tests pass
## Definition of Done
- Server accepts supported MIME types and file size classes
- Extraction adapters handle PDF, DOCX, PPTX, TXT/MD; images return OCR-needed/provider OCR path
- Teacher upload input accepts all MUS extensions
- Typecheck passes or errors are documented
## Expected Artifacts
- Updated Convex extraction and ingestion code
- Updated teacher upload constants/UI
- Updated package dependencies as needed
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
Implemented multi-format ingestion, OCR generalization, frontend upload support, package deps, and updated helper test. Verified @school/convex typecheck/test and @school/teacher typecheck.