# Report Card Documentation Authority

## Overview

This document defines which report-card docs are authoritative for which parts of the system so future agents do not follow stale or conflicting guidance.

## Current Source Of Truth

### Shared preview and print architecture

- Canonical doc: `docs/features/UnifiedReportCardPrintSystem.md`
- Owns:
  - shared A4 sheet rendering
  - toolbar placement
  - preview scaling behavior
  - print CSS behavior
  - cross-surface consistency rules

### Full-class batch print flow

- Canonical doc: `docs/features/FullClassReportCardPrinting.md`
- Owns:
  - `Print Full Class` entry flow
  - `printClass=1` lifecycle in admin and teacher pages
  - stacked class-print query behavior
  - after-print return behavior
- Does not own:
  - low-level print sizing or transform rules
  - toolbar placement inside the sheet

### Original report-card rollout and export capability

- Canonical doc: `docs/features/ArchiveOnlyRecordsAndReportCards.md`
- Owns:
  - why report cards were added to admin and teacher flows
  - archival and historical-data rules
  - student photo, comments, and next-term metadata
  - report-card access and export capability
- Does not own:
  - separate surface-specific print implementations

### Cumulative-result print blocking

- Canonical doc: `docs/features/CumulativeTermResultsAndBackfill.md`
- Owns:
  - cumulative annual calculation rules
  - missing prior-term data handling
  - when printing must be blocked pending backfill

### Extras and report-card field composition

- Canonical docs:
  - `docs/features/ConfigurableReportCardAddOnsAndStudentOnboarding.md`
  - `docs/features/CanonicalReportCardAttendanceFields.md`
  - `docs/features/GroupedReportCardTermSettings.md`
- Own:
  - bundle-driven extras
  - attendance field ownership
  - grouped term-level settings

## Current Implementation Snapshot

The current codebase implements report-card rendering like this:

- `packages/shared/src/components/ReportCardSheet.tsx`
  - owns the printable A4 sheet and injected print CSS
- `packages/shared/src/components/ReportCardPreview.tsx`
  - owns on-screen preview scaling
- `packages/shared/src/components/ReportCardToolbar.tsx`
  - owns back and export/print controls
- `packages/shared/src/components/ReportCardPrintStack.tsx`
  - owns full-class stacked printing
- `apps/admin/app/assessments/report-cards/page.tsx`
  - owns admin report-card orchestration and `printClass=1` class-print mode
- `apps/teacher/app/assessments/report-cards/page.tsx`
  - owns teacher report-card orchestration and `printClass=1` class-print mode
- `apps/portal/app/(portal)/components/PortalWorkspace.tsx`
  - uses the same shared toolbar and preview for portal report-card display

## Conflict Resolution Rules

1. If docs disagree with the code, the code wins.
2. If report-card docs disagree about print architecture, `UnifiedReportCardPrintSystem.md` wins.
3. Historical feature docs should be treated as rollout context unless they explicitly own the subsystem in this document.
4. Do not reintroduce per-surface print or export implementations when shared components already exist.
5. When changing report-card behavior, update both the owning feature doc and this authority map if ownership changed.

## Recommended Reading Order

1. `docs/features/ReportCardDocumentationAuthority.md`
2. `docs/features/UnifiedReportCardPrintSystem.md`
3. The subsystem-specific doc for the change you are making

## Changelog

### 2026-04-17: Documentation authority map added

- **Problem:** multiple report-card docs described different generations of print behavior and could mislead future agents
- **Solution:** defined a canonical reading order and explicit ownership boundaries for report-card documentation
