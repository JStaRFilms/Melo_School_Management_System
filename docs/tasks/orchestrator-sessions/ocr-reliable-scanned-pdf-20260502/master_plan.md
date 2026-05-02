# Takomi Orchestrator Master Plan: Reliable Scanned PDF OCR Fallback

## Overview

Implement reliable OCR fallback for scanned/image-heavy teacher planning-library PDFs at `/planning/library`.

Final architecture:

- Convex remains the source of truth for materials, OCR jobs, statuses, chunks, audit logs, and tenant authorization.
- Native PDF text extraction remains first pass for digital PDFs.
- Mistral OCR is the MVP provider for scanned/image-heavy PDFs.
- Existing stored PDFs can be retried using Convex storage without teacher re-upload.
- Page ranges remain supported and indexed chunks remain page-aware.
- OpenRouter/Gemma and browser-side rendering are not primary OCR paths.

## Skills Registry

| Skill | Use |
| --- | --- |
| takomi | Orchestration, task handoff, Genesis/Design/Build lifecycle |
| convex | Convex backend patterns and routing to specific Convex skills |
| convex-functions | Queries, mutations, actions, validators, internal/public boundaries |
| convex-schema-validator | Schema and index design |
| convex-security-check | Tenant, auth, and sensitive function checks |
| convex-migrations | Safe schema rollout if data model changes need migration/backfill |
| nextjs-standards | Teacher app UI and workspace conventions |
| sync-docs | Keep FR and feature docs aligned with implementation |

## Workflows Registry

| Workflow | Use |
| --- | --- |
| vibe-primeAgent | First step for every implementation/review agent |
| vibe-genesis | Feature blueprint and requirements alignment |
| vibe-design | Technical design and UX state design |
| vibe-build | Implementation tasks |
| mode-review | Final security/architecture review |
| vibe-syncDocs | Documentation sync after code changes |

## Task Graph

```text
Genesis inventory and blueprint
  -> Design OCR job/status/provider/UX specs
  -> Backend job model
  -> Mistral provider action
  -> Page-aware chunking integration
  -> Teacher library UX
  -> Docs sync
  -> Final review and Convex deploy
```

## Task Table

| # | Task | Phase | Mode | Recommended model | Dependencies |
| --- | --- | --- | --- | --- | --- |
| 01 | OCR feature blueprint refresh | Genesis | Architect | GPT-5.5 | None |
| 02 | Current OCR attempt inventory | Genesis | Analyst | GPT-5.5 | None |
| 03 | OCR job/status/provider design | Design | Architect | GPT-5.5 | 01, 02 |
| 04 | Teacher OCR UX design | Design | UI/Product | GPT-5.4 | 01, 02 |
| 05 | Convex OCR job model and audit events | Build | Backend | GPT-5.5 | 03 |
| 06 | Mistral OCR provider action | Build | Backend integration | GPT-5.5 | 03, 05 |
| 07 | Page-aware chunking integration | Build | Backend | GPT-5.4 | 05, 06 |
| 08 | Teacher library OCR UX | Build | Frontend | GPT-5.4 | 04, 05 |
| 09 | Documentation sync | Build | Docs | GPT-5.4 Mini | 05-08 |
| 10 | Final review and deploy check | Review | Reviewer | GPT-5.5 | 05-09 |

## Progress Checklist

- [x] Architecture decision accepted.
- [x] Feature blueprint created.
- [x] Orchestrator session created.
- [x] Task files generated.
- [x] Genesis task execution completed.
- [x] Design task execution completed.
- [x] Build task execution completed.
- [ ] Final review completed.
- [ ] `pnpm convex deploy` run after Convex code changes.

## Global Constraints

- Read `packages/convex/_generated/ai/guidelines.md` before Convex work.
- Read `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, `docs/issues/FR-016.md`, and `docs/features/ReliableScannedPdfOcrFallback.md` before implementation.
- Do not add native canvas/PDF rendering packages inside Convex.
- Do not trust client-provided `userId` or school context for authorization.
- Do not expose storage files across schools.
- Keep files focused; if a file approaches 200 lines of new concern-mixing code, split it.
- Update docs in the same change batch as implementation.
