# OCR Architecture Decision

## Decision

Use Convex-managed OCR job orchestration with Mistral OCR as the MVP provider for scanned/image-heavy planning-library PDFs.

## Context

Teachers upload PDFs and text files into `/planning/library`. Digital PDFs can be parsed through native text extraction. Scanned/image-heavy PDFs currently become `ocr_needed` or pass through unreliable experimental fallbacks. Convex cannot safely host native canvas/PDF rendering packages, and browser-side rendering cannot reliably retry existing stored PDFs.

## Accepted Architecture

- Convex remains the source of truth for materials, statuses, OCR jobs, chunks, audit logs, tenant authorization, rate limits, and retry limits.
- Native PDF text extraction remains first.
- Mistral OCR handles scanned/image-heavy fallback in MVP.
- Existing stored PDFs are retried from Convex storage without re-upload.
- Page ranges are preserved by sending selected pages when feasible and always indexing only selected pages.
- Provider results are normalized before storage or chunking.

## Rejected Alternatives

- OpenRouter/Gemma as primary OCR because page fidelity, determinism, and auditability are weak.
- Browser-side rendering as primary OCR because it depends on teacher devices and requires reselecting files.
- Native PDF/canvas rendering inside Convex because native `.node` modules are incompatible with Convex bundling/runtime limits.
- Full external worker as MVP because it adds infrastructure before the project needs it.

## Follow-Up

Implementation is orchestrated in `docs/tasks/orchestrator-sessions/ocr-reliable-scanned-pdf-20260502/master_plan.md`.
