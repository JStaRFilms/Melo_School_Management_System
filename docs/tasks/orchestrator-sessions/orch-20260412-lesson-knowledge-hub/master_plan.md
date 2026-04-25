# Orchestrator Session Master Plan

**Session ID:** `orch-20260412-lesson-knowledge-hub`  
**Created:** `2026-04-13`  
**Status:** Completed  
**Mode:** Takomi Orchestrator

## Overview

This session creates the delivery queue for the Lesson Knowledge Hub v1 domain. It is a fresh, specialized Takomi session and must remain separate from the relaunch backlog in `orch-20260404-193645-relaunch`.

The new baseline is:

1. the currently shipped academic/admin/teacher/portal surfaces
2. the missing AI teacher-tools and lesson-planning domain
3. the need for searchable school-scoped teaching materials
4. the need for a reusable content graph that can feed later student personalization

## Session Objectives

- Define and stage the shared knowledge-library domain
- Add a clean admin template and review lane for lesson materials
- Add teacher generation and editing flows around selected source materials
- Add question-bank and video-link follow-on resources
- Add student topic-page exposure with class-scoped upload promotion
- Keep the session implementation-ready without mixing it into older orchestration queues

## Skills Registry

| Skill | Use |
| --- | --- |
| `takomi` | Orchestration and lifecycle control |
| `spawn-task` | Detailed task-file creation |
| `avoid-feature-creep` | Keep v1 focused on the locked scope |
| `ai-sdk` | Vercel AI SDK integration direction |
| `convex-best-practices` | Schema, function, and tenancy rigor |
| `convex-functions` | Query, mutation, and action design |
| `convex-schema-validator` | Safe schema additions and indexes |
| `convex-file-storage` | Upload and storage patterns |
| `convex-security-check` | Visibility and approval guardrails |
| `frontend-design` | Admin, teacher, and portal UX direction |
| `webapp-testing` | Verification planning |
| `sync-docs` | Keep docs aligned with implementation |

## Workflows Registry

| Workflow | Use |
| --- | --- |
| `/mode-orchestrator` | Session control and sequencing |
| `/vibe-spawnTask` | Task-file creation |
| `/vibe-continueBuild` | Incremental build slices |
| `/review_code` | Verification and review passes |
| `/vibe-syncDocs` | Documentation synchronization |

## Execution Lanes

### Lane A: Session and Blueprint

- session shell
- feature blueprint
- curriculum input audit

### Lane B: Shared Foundation

- AI package
- schema and search
- ingestion pipeline

### Lane C: Admin Surface

- library console
- template studio
- approval lane

### Lane D: Teacher Surface

- library and publish flow
- lesson-plan editor
- question-bank drafting

### Lane E: Student Hub Exposure

- video-link approval
- topic page
- student supplemental uploads

### Lane F: Hardening

- security and rate limits
- verification and docs handoff

## Dependency Order

1. `T01-T03` must complete before implementation work starts.
2. `T04-T06` establish the shared technical foundation.
3. `T07-T09` may overlap once the schema and ACL direction is stable.
4. `T10-T13` start only after the ingestion and template layers are in place.
5. `T16` depends on the assessment authoring baseline from `T11` and the admin template/settings lane from `T08`.
6. `T14`, `T16`, `T17`, `T18`, and final handoff task `T15` are complete.

## Parallel Opportunities

- `T04-T06` can run in parallel after `T03`
- `T07-T09` can overlap after `T05`
- `T10-T13` can partially overlap after `T06` and `T08`
- `T16` built on the assessment authoring baseline from `T11`
- `T15` stayed last as the verification/docs/handoff close-out task and is now complete

## Task Table

| Task | Status | Lane | Notes |
| --- | --- | --- | --- |
| `T01` | Completed | A | Create the Takomi session shell and registry docs; validated and archived in completed/ |
| `T02` | Completed | A | Feature blueprint and route/interface contract |
| `T03` | Completed | A | Curriculum input audit and sample-driven format notes |
| `T04` | Completed | B | Shared `packages/ai` foundation with centralized OpenRouter AI SDK config, typed contracts, prompts, and retry helpers |
| `T05` | Completed | B | Convex schema, ACL, visibility, and search foundation; added school-first indexes, access helpers, and focused tests |
| `T06` | Completed | B | Ingestion pipeline and audit logging; upload/link ingestion is now the home for the parser-first PDF extraction pivot, fallback extraction path, chunk writes, status tracking, and audit events |
| `T07` | Completed | C | Admin library console; added `/academic/knowledge/library` with Convex-backed search, detail inspection, and admin override actions |
| `T08` | Completed | C | Admin template studio; structured lesson template studio delivered at `/academic/knowledge/templates` |
| `T09` | Completed | D | Teacher library and publish flow; `/planning/library` now supports private-first uploads, label editing, explicit publish-to-staff, and lesson-plan source handoff |
| `T10` | Completed | D | Teacher lesson-plan workspace delivered at `/planning/lesson-plans` with source-aware loading, template resolution, autosave, revision snapshots, and bounded generation handlers |
| `T11` | Completed | D | Teacher question-bank workspace delivered at `/planning/question-bank` with item-by-item assessment draft persistence, AI generation, and editable quiz/CBT authoring |
| `T12` | Completed | E | Teacher YouTube submissions delivered at `/planning/videos` with admin library-based approval integration and topic attachment support |
| `T13` | Completed | E | Portal topic route delivered at `/learning/topics/[topicId]` with approved resource rendering, class-scoped student uploads, and teacher-side promotion flow |
| `T14` | Completed | F | Security/rate-limit/audit hardening landed; portal promotion is staff-only and assignment-aware, lesson/assessment source eligibility is server-validated, referential validation is tightened, and Convex-backed abuse controls now gate generation/upload/retry paths |
| `T15` | Completed | F | Verification, docs sync, Convex deploy, task reconciliation, and release-style handoff completed |
| `T16` | Completed | D | School-scoped assessment generation profiles and teacher question-mix overrides shipped into the question-bank authoring flow, with persistence in drafts and AI run logs plus server-side locked-profile enforcement |
| `T17` | Completed | E | Material viewing/source proof shipped across admin, teacher, and portal surfaces, including same-origin original-file access and extracted-text proof previews |
| `T18` | Completed | E | Teacher topic governance and creation shipped in the planning library so teachers can create/attach real topics within bounded classroom scope |

## Exit Criteria

- The session queue is complete and self-contained
- The feature blueprint exists in `docs/features/`
- Each task file has been archived in `completed/` with a paired result note
- The session remains cleanly separated from the relaunch queue
- Final verification and Convex deploy results are recorded in `completed/T15_verification_docs_and_handoff.result.md` and `Final_Handoff_Summary.md`

## Current Known Constraints

- The delivered route set now includes the Lesson Knowledge Hub admin, teacher, and portal topic surfaces listed in the task table; future navigation changes should still be staged carefully.
- `packages/ai` exists as the shared AI SDK foundation for generation route handlers.
- The T06 ingestion foundation uses a real PDF parser plus guarded Gemini fallback extraction path instead of the old ad-hoc manual PDF stream parser.
- Cleanup remains bounded: if another ingestion route later needs the same Gemini fallback, consolidate the request builder rather than reviving multiple extraction implementations.
- The curriculum sample folder is spelled `School curriculim example` in the repo and task files must reference that exact path.
- Convex deploy succeeded during T15, but Convex reported AI files are out of date; run `npx convex ai-files update` in a separate maintenance task if desired.
- Browser/E2E, live AI generation, and deployed upload/PDF extraction smoke checks were not run during T15 and should remain explicit until covered by a seeded QA pass.
