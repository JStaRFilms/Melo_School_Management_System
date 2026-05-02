# Smart PDF Page Selection And Page-Aware Indexing

## Status

Accepted for implementation. OCR fallback architecture updated on 2026-05-02 by `ReliableScannedPdfOcrFallback.md`.

## Problem

Teachers upload large or crowded PDFs into the teacher planning library, but they often only need specific pages for a subject or topic. Processing the full file can fail, waste storage/indexing capacity, and produce noisy AI grounding.

## Product Direction

The library should keep a clean one-material UX while supporting advanced page selection and page-aware indexing behind the scenes.

A teacher can upload one PDF and enter ranges such as `1-5,7-8,70-72`. The teacher library indexes only those pages and omits the rest from search and AI generation. The material remains one visible library item with a clear summary of which pages were indexed.

## MVP Scope

- Optional PDF page range input during teacher planning-library upload.
- Supported syntax: individual pages and inclusive ranges, comma-separated.
- One visible `knowledgeMaterials` row per upload.
- Store selected page metadata on the material.
- Extract text only from selected PDF pages when page ranges are provided.
- For image-heavy/scanned PDFs, queue provider-backed OCR from the stored Convex file. Mistral OCR is the MVP provider. OpenRouter/Gemma PDF parsing and browser-side rendering are not primary OCR paths.
- Store page metadata on generated chunks.
- Show selected/indexed page summary in teacher UI and source proof.
- Preserve existing full-document upload behavior when no page range is provided.

## Out Of Scope For This Slice

- Visual PDF page thumbnails.
- User-facing management of compact selected-pages PDF files. The backend may create an internal trimmed PDF for safer selected-page OCR and preview.
- Advanced multi-provider OCR routing beyond the Mistral MVP provider.
- Multiple visible child materials for one upload.
- Student-facing citation UI changes.

## Data Model Additions

`knowledgeMaterials` gains optional fields:

- `selectedPageRanges?: string`
- `selectedPageNumbers?: number[]`
- `pdfPageCount?: number`

`knowledgeMaterialChunks` gains optional fields:

- `pageStart?: number`
- `pageEnd?: number`
- `pageNumbers?: number[]`

All fields are optional for backward compatibility.

## UX Rules

- Page selection is optional and only meaningful for PDFs.
- Empty page selection means index the whole PDF using existing behavior.
- The upload UI must explain: only selected pages are indexed; unselected pages are ignored for search and AI generation.
- The library should not show internal splits as separate uploads.

## Acceptance Criteria

- Valid input like `1-5,7-8,70-72` is accepted and normalized.
- Invalid input like `0`, `8-7`, `1,,3`, or `abc` is rejected.
- Selected pages outside the PDF page count fail with a clear error.
- Page-aware chunks record source page metadata.
- Existing text and full-PDF uploads continue to work.
- Selected-page scanned/image-heavy PDFs use provider OCR while indexing only selected pages. When feasible, send a trimmed selected-pages PDF or provider page-selection request instead of the original full PDF.
- Teacher material detail shows selected page summary when available.
