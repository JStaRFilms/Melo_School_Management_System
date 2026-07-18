# Melo Curriculum Intelligence

## Goal

Deliver a judge-ready Curriculum Intelligence vertical slice: approved scheme-of-work import into existing academic topics, then a factual readiness map. Keep AI authority constrained by server validation and human approval.

## Context Intake

- Project requirements reviewed: complete
- Relevant knowledge-hub, planning-library, extraction, and OCR feature docs reviewed: complete
- Runtime policy reviewed: complete; no project policy exists, so the feature blueprint supplies the first-release routing policy

## Execution Mode

- Takomi markdown roadbook is the coordination source of truth.
- Active branch: `codex/melo-curriculum-intelligence`.
- Two balanced-tier, read-only audit agents map the existing contracts before design approval.
- Delegated implementers and an independent reviewer begin only after feature approval.
- Premium reasoning is reserved for the deep-audit path and independent release review, never routine coding.

## Tasks

| Task | Status | Notes |
| --- | --- | --- |
| T001 — Architecture and contract audit | Completed | Existing page-aware ingestion, topic, artifact, assessment, and provider seams verified. |
| T002 — Feature blueprint and scope gate | Completed | User approved the blueprint on 2026-07-18. |
| T003 — Curriculum import vertical slice | Completed | Source selection, bounded page-aware extraction, review, approval, audit, and failure recovery implemented. |
| T004 — Curriculum readiness map | Completed | Existing academic artifacts are aggregated into factual topic preparation evidence. |
| T005 — Independent review and release verification | Completed | Final reviewer passed and Convex production deployment succeeded. |
| T006–T022 — Implementation and remediation batches | Completed | AI runtime, Convex lifecycle/read model, admin UI, navigation, tests, and all review findings completed. |
| R001–R009 — Scheduled batch reviews | Completed | Integrity, lifecycle, readiness, and UI gates passed after remediation. |
| Final release review | Completed — passed | Terra high review passed after source-context, cost-bound, race, and multi-page provenance fixes. |

## Verification

- [x] Required feature blueprint created
- [x] User approval recorded before implementation
- [x] Implementation verified with tests, typecheck, lint, production build, and authenticated desktop/mobile browser checks
- [x] Production Convex deployment recorded
- [x] Summary written
