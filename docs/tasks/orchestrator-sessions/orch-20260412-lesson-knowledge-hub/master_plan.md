# Orchestrator Session Master Plan

**Session ID:** `orch-20260412-lesson-knowledge-hub`  
**Created:** `2026-04-13`  
**Status:** Active  
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
5. `T14-T15` close the session with hardening and handoff.

## Parallel Opportunities

- `T04-T06` can run in parallel after `T03`
- `T07-T09` can overlap after `T05`
- `T10-T13` can partially overlap after `T06` and `T08`
- `T14-T15` stay sequential and last

## Task Table

| Task | Status | Lane | Notes |
| --- | --- | --- | --- |
| `T01` | Completed | A | Create the Takomi session shell and registry docs; validated and archived in completed/ |
| `T02` | Completed | A | Feature blueprint and route/interface contract |
| `T03` | Completed | A | Curriculum input audit and sample-driven format notes |
| `T04` | Completed | B | Shared `packages/ai` foundation with centralized OpenRouter AI SDK config, typed contracts, prompts, and retry helpers |
| `T05` | Pending | B | Convex schema, ACL, visibility, and search foundation |
| `T06` | Pending | B | Ingestion pipeline and audit logging |
| `T07` | Pending | C | Admin library console |
| `T08` | Pending | C | Admin template studio |
| `T09` | Pending | D | Teacher library and publish flow |
| `T10` | Pending | D | Lesson-plan editor and generation routes |
| `T11` | Pending | D | Question-bank and CBT draft flows |
| `T12` | Pending | E | YouTube link approval and topic attachment |
| `T13` | Pending | E | Portal topic view and student uploads |
| `T14` | Pending | F | Security, rate limits, audit, and failure recovery |
| `T15` | Pending | F | Verification, docs sync, and release-style handoff |

## Exit Criteria

- The session queue is execution-ready and self-contained
- The feature blueprint exists in `docs/features/`
- Each task file is specific enough for a build agent to execute without reopening product questions
- The session remains cleanly separated from the relaunch queue

## Current Known Constraints

- The teacher and portal apps currently have no lesson-planning or topic-view routes, so navigation updates must be staged carefully.
- `packages/ai` now exists as the shared AI SDK foundation for later route handlers.
- The curriculum sample folder is spelled `School curriculim example` in the repo and task files must reference that exact path.
