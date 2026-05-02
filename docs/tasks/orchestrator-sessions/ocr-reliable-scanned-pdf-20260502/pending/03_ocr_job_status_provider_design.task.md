# OCR Job, Status, and Provider Design

## Agent Setup

### Workflow to Follow

Read the Takomi `vibe-design` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before design work.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow Design task conventions |
| convex-schema-validator | Design safe schema and indexes |
| convex-functions | Design public/internal function boundaries |
| convex-security-check | Validate tenant/security design |

## Role

Senior Convex Architect.

## Recommended Model

GPT-5.5.

## Objective

Produce a decision-complete technical design for OCR jobs, statuses, provider adapter shape, retry limits, and audit events.

## Inputs

- `docs/features/ReliableScannedPdfOcrFallback.md`
- `docs/tasks/orchestrator-sessions/ocr-reliable-scanned-pdf-20260502/current_ocr_inventory.md`
- `packages/convex/schema.ts`
- `packages/convex/_generated/ai/guidelines.md`

## Outputs

- `ocr_job_status_provider_design.md` in this session directory.

## Acceptance Criteria

- Defines exact schema changes or confirms reuse of existing fields.
- Defines status transitions for native extraction, OCR needed, queued, processing, succeeded, failed, cancelled.
- Defines provider adapter input/output types.
- Defines safe provider error categories.
- Defines retry limit and cooldown rules.
- Defines school-aware indexes.
- Defines audit events.
- Defines rollback feature flag behavior.
- No implementation code is changed in this Design task.
