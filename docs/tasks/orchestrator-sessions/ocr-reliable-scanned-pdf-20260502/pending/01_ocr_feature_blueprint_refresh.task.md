# OCR Feature Blueprint Refresh

## Agent Setup

### Workflow to Follow

Read the Takomi `vibe-genesis` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before making changes.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow Genesis planning conventions |
| sync-docs | Keep FR and feature docs aligned |

## Role

Takomi Genesis Architect.

## Objective

Refresh the OCR feature blueprint so implementation agents have one authoritative source for reliable scanned-PDF OCR.

## Inputs

- `docs/Project_Requirements.md`
- `docs/Coding_Guidelines.md`
- `docs/issues/FR-016.md`
- `docs/features/SmartPdfPageSelectionAndPageAwareIndexing.md`
- `docs/features/ReliableScannedPdfOcrFallback.md`
- `docs/agent1.md`
- `docs/agent2.md`

## Outputs

- Updated feature docs if the existing blueprint lacks any accepted architecture details.
- A short completion note in this task file or session summary.

## Acceptance Criteria

- The accepted architecture is clearly Mistral OCR MVP plus Convex orchestration.
- OpenRouter/Gemma is not described as the primary OCR fallback.
- Browser-rendered OCR is not described as the primary retry path.
- Existing stored PDF retry, page ranges, tenant boundaries, audit logs, rate limits, and graceful failures are covered.
- No implementation code is changed in this Genesis task.
