# Convex OCR Job Model and Audit Events

## Agent Setup

### Workflow to Follow

Read the Takomi `vibe-build` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before implementation.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow Build handoff conventions |
| convex | Convex project patterns |
| convex-schema-validator | Schema validators and indexes |
| convex-functions | Mutations/actions with validators |
| convex-security-check | Tenant/security verification |

## Role

Backend Engineer.

## Recommended Model

GPT-5.5.

## Objective

Add the Convex OCR job/attempt model, audit events, retry caps, and school-aware guards.

## Files Likely Touched

- `packages/convex/schema.ts`
- `packages/convex/functions/academic/lessonKnowledgeIngestion.ts`
- `packages/convex/functions/academic/lessonKnowledgeIngestionHelpers.ts`
- `docs/features/ReliableScannedPdfOcrFallback.md`

## Dependencies

- Task 03 complete.

## Acceptance Criteria

- OCR jobs or attempts are persisted with `schoolId`, `materialId`, `storageId`, provider, status, attempt, timestamps, page ranges, and safe errors.
- Public functions derive auth server-side and do not accept client `userId`.
- Cross-school OCR queue/retry attempts fail.
- Duplicate active OCR job per material is prevented.
- Retry caps and cooldowns are enforced.
- Audit events are written for request, start, success, failure, and retry.
- Docs are updated if implementation differs from the plan.

## Verification Commands

- `pnpm typecheck`
- Targeted Convex tests if available
