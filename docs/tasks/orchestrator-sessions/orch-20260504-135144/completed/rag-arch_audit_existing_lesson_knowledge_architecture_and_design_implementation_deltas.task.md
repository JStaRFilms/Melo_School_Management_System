# Task: Audit existing lesson knowledge architecture and design implementation deltas
**Task ID:** rag-arch
**Stage:** build
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-rag-arch
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.5
## Context
Parent session: orch-20260504-135144

Task title: Audit existing lesson knowledge architecture and design implementation deltas
## Objective
Inspect existing Convex/teacher planning library implementation and identify exact changes needed to support multi-format extraction plus oauth-router model strategy without breaking existing PDF/OCR flows.
## Scope
- None specified.
## Checklist
- [x] Existing tables/functions/UI constraints understood
- [x] Minimal safe schema and code changes identified
- [x] Security and tenancy concerns documented
## Definition of Done
- Existing tables/functions/UI constraints understood
- Recommends minimal safe schema and code changes
- Security and tenancy concerns documented
## Expected Artifacts
- Implementation delta notes
- Risk list
- Files to change
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
Architect audit via oauth-router/gpt-5.5 recommended no schema migration, expanded content type allowlist, multi-format extractor, generalized OCR, and frontend accept/copy changes.