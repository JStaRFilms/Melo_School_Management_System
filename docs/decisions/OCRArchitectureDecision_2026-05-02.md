# OCR Architecture Decision

## Decision

Use Convex-managed OCR job orchestration with OpenRouter PDF processing as the MVP provider path, explicitly configured to use the `mistral-ocr` engine for scanned/image-heavy planning-library PDFs.

## Context

Teachers upload PDFs and text files into `/planning/library`. Digital PDFs can be parsed through native text extraction. Scanned/image-heavy PDFs currently become `ocr_needed` or pass through unreliable experimental fallbacks. Convex cannot safely host native canvas/PDF rendering packages, and browser-side rendering cannot reliably retry existing stored PDFs.

## Accepted Architecture

- Convex remains the source of truth for materials, statuses, OCR jobs, chunks, audit logs, tenant authorization, rate limits, and retry limits.
- Native PDF text extraction remains first.
- OpenRouter handles scanned/image-heavy fallback in MVP through the `file-parser` plugin with `engine: "mistral-ocr"`.
- Existing stored PDFs are retried from Convex storage without re-upload.
- Page ranges are preserved by sending selected pages when feasible and always indexing only selected pages.
- Provider results are normalized before storage or chunking.

## Rejected Alternatives

- Free OpenRouter/Gemma plus `cloudflare-ai` parsing as primary scanned-PDF OCR because page fidelity, determinism, and auditability are weaker.
- Browser-side rendering as primary OCR because it depends on teacher devices and requires reselecting files.
- Native PDF/canvas rendering inside Convex because native `.node` modules are incompatible with Convex bundling/runtime limits.
- Full external worker as MVP because it adds infrastructure before the project needs it.

## Follow-Up

Implementation is orchestrated in `docs/tasks/orchestrator-sessions/ocr-reliable-scanned-pdf-20260502/master_plan.md`. The MVP uses `OPENROUTER_API_KEY` and pins the PDF engine to `mistral-ocr` to avoid direct Mistral API account setup while still using the stronger OCR engine.
