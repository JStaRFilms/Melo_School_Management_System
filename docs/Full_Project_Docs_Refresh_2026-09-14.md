# Full Project Docs Refresh

**Generated:** 2026-09-14
**Base commit:** `3b391e3` (`recovery/admissions-workflow`, `fix(admissions): approve fees during publication`)
**Worktree:** `_w/docs-admissions-refresh` on branch `docs/admissions-recovery-refresh`
**Scope:** Documentation sync across the whole project, not just admissions. The recovery branch was only the base because it holds the latest code. No runtime code changed.

## Method

1. Toured the app: 7 apps (`www:3000`, `teacher:3001`, `admin:3002`, `portal:3003`, `apply:3004`, `sites:3005`, `platform:3006`), `packages/convex` with `functions/{academic, admissions, foundation, platform}`, and shared packages.
2. Audited every doc area with evidence spot-checks against the code at this commit: all 9 ADRs, all 96 `docs/features/` files, `docs/strategy/`, `docs/testing/`, `docs/issues/`, `docs/clients/`, `docs/tasks/` (empty), root-level docs, and package READMEs.
3. Applied the takomi `vibe-syncDocs` decision rules (UPDATE existing, CREATE only when new, SKIP when accurate), with statuses backed by real paths.

## What changed

### Status headers added to 67 feature docs

Each `docs/features/` file that had no status line now carries one under the title. Almost all say `**Status:** Implemented`. Files with a different reality say so:

- Policy or design-only: `ManagedSchoolSiteDeliveryAndEditingBoundaries.md`, `PublicWebOperatingModesAndOnboardingPolicy.md`, `MultiTenantDomainAndAuthTopology_2026-04-12.md`, `SharedCoreBespokeSchoolWebsiteArchitecture.md`
- Partial: `teacher-resource-rag-plan.md` (extraction and OCR live, vector RAG not), `SchoolContentAndAdmissionsSettingsUX.md` (design handoff, implementation underway)
- Runbook or index: `ProductionReportCardExtrasRandomBackfill.md`, `ReportCardDocumentationAuthority.md`
- Naming drift noted: `Billing_Redesign.md`, `EnrollmentMatrixDeclutter.md`

### Status lines updated where wrong

- `Admin_UI_Overhaul.md`: Phase 2 complete → Phase 2 and 3 complete.
- `SmartPdfPageSelectionAndPageAwareIndexing.md`: accepted → implemented (`pageNumbers` in `packages/convex/schema.ts`).

### ADRs (docs/decisions/)

- `ADR-002-app-split.md`: status now records the three later apps; implementation note appended.
- `ADR-003`, `ADR-004`, `ADR-005`, `ADR-006`: decision text kept as history; dated implementation notes correct the wrong symbols, adapter package, webhook route, and directory layout.
- `ADR-007-ocr-architecture.md`: status line added (`lessonKnowledgeOcrActions.ts`).
- `ADR-008`: already updated earlier this session; index-name correction added (`by_school_and_admission_number`).
- `ADR-009`: status now says B0 schema is implemented, B4 renderer and B5 `obhis-v1` pending.

### Root and package docs

- `README.md`: seven apps, apply on `3004`, platform on `3006`, apply env copy, filter, and structure rows.
- `packages/convex/README.md`: all app env copies, domain-grouped function map, live mode note.
- `docs/Project_Requirements.md`: seven surfaces, FR-022 admissions lifecycle, guardian and admissions staff role rows.
- `docs/Builder_Prompt.md`: app count four → seven; mockup mandate softened to historical reference (mockups date to March 2026).

### Issues, strategy, testing, clients

- `docs/issues/FR-001.md`: first acceptance box checked with schema evidence (`schools` table carries `slug`, branding, `features` config).
- `docs/strategy/PlatformSuperAdminFutureBacklog.md`: Alignment Snapshot stamped with the date and a pointer to the newer `commercial/`, `audit/`, `groups/`, and `migration/` surfaces in `apps/platform`.
- `docs/testing/REALISTIC_SCHOOL_SETUP_TEST_BOOK.md`: added the Apply app row (`http://localhost:3004`).
- `docs/clients/obhis/OBHISWebsiteDesignSpecification.md`: fixed the companion-approvals path to `docs/clients/obhis/OBHISContentApprovalSheet.md`.

### Archive moves

- `docs/e2e code review-M3.md`, `-m3v1.md`, `-m3v2.md`, `-muse.md` moved to `docs/archive/`. They are raw review-session transcripts from the `audit/e2e-ux-polish` branch, not living docs.

## Verification

- Ran a scripted header insert across 67 files with per-file status text; the script reported `added=67 skipped=0 missing=0`.
- Spot-checked diffs on README, ADRs, and sampled feature docs.
- Ports checked against `apps/*/package.json`; routes and Convex files checked with `Test-Path -LiteralPath`.
- No `pnpm typecheck`, lint, or build run. Docs only.

## Known gaps left open

- ADR-008's unresolved business approvals still need owner sign off before production launch.
- Backend entitlement checks at every optional module entry point and the disabled-module test matrix in `ProductWideModuleEntitlements.md` remain open.
- ADR-009's renderer core (B4) and `obhis-v1` (B5) are still pending; `apps/sites` remains template-based.
- `D05_MigrationRehearsalAndDataRefreshRunbook.md` references `.melo-ops/approved-development-targets.json`, which does not exist in this worktree. Left as-is since the runbook is a historical record.
- `docs/tasks/` is an empty directory. Git does not track empty dirs, so it may disappear on a fresh clone.
