# Admissions Recovery Docs Refresh

**Generated:** 2026-09-14
**Base commit:** `3b391e3` (`recovery/admissions-workflow`, `fix(admissions): approve fees during publication`)
**Worktree:** `_w/docs-admissions-refresh` on branch `docs/admissions-recovery-refresh`
**Scope:** Documentation sync only. No runtime code changed.

## What changed in code since master

The recovery branch built the admissions platform on top of `master` (`cfc8f3d`):

- New public app `apps/apply` (`@school/apply`, port `3004`) with routes `app/s/[schoolSlug]`, `app/s/[schoolSlug]/i/[intakeSlug]`, `app/s/[schoolSlug]/applications/[publicId]`, `app/s/[schoolSlug]/account`, and `app/s/[schoolSlug]/payments/paystack/return`.
- New Convex domain `packages/convex/functions/admissions/` (`applications.ts`, `catalogue.ts`, `conversion.ts`, `documents.ts`, `guardian.ts`, `payments.ts`, `refs.ts`, `retention.ts`, `shared.ts`, `staff.ts`, `uploadHttp.ts`, `validation.ts`) plus integration tests in `__tests__/`.
- Shared contracts in `packages/convex/functions/foundation/` (`applicationLinks.ts`, `contracts.ts`, `paymentDispatch.ts`, `applicationLinks`) and webhook dispatch in `packages/convex/functions/billingWebhooks.ts`.
- Staff UI in `apps/admin/app/admin/admissions/` (`AdmissionsDashboard.tsx`, `admissions-model.ts`, `[publicId]/ApplicationDetail.tsx`, `retention/`).
- Workspace nav gating for `/admin/admissions` in `packages/shared/src/workspace-navigation.ts`, `workspace-capability-matrix.ts`, `workspace-route-access.ts`, and `components/WorkspaceNavbar.tsx`.
- Headline fix at `3b391e3`: fee approval during publication (`assertPublicationApproval` in `catalogue.ts`, Approve and publish path in `AdmissionsDashboard.tsx`).

## Docs updated in this refresh

- Updated: `README.md` (seven apps, apply on `3004`, platform on `3006`, apply env copy, apply filter, structure block).
- Updated: `packages/convex/README.md` (all app env copies, domain-grouped function map, live mode note for all apps).
- Updated: `docs/features/AdmissionsApplicationPlatformArchitecture.md` (status to implemented at `3b391e3`, implementation status block, changelog).
- Updated: `docs/features/AdmissionsExperienceDesign.md` (status to implemented, live component and test links, changelog).
- Updated: `docs/decisions/ADR-008-admissions-application-surface-and-lifecycle.md` (status to accepted and implemented, implementation note).
- Updated: `docs/features/ProductWideModuleEntitlements.md` (status to partially implemented, live gate list, open work).
- Updated: `docs/features/UnifiedWorkspaceNavbar.md` (status header, admissions route gate).
- Updated: `docs/features/PublicSchoolDomainRoutingAndSEO.md` (status header).
- Updated: `docs/Project_Requirements.md` (seven surfaces, FR-022 admissions lifecycle, guardian and admissions staff rows).
- Created: this file. `docs/Builder_Handoff_Report.md` is left untouched as the FR-008 archive.

## Verification

- Read every edited header back from disk in `_w/docs-admissions-refresh`.
- Checked ports against `apps/apply/package.json` (`3004`), `apps/platform/package.json` (`3006`), and `apps/sites/package.json` (`3005`).
- Checked routes against `apps/apply/app/s/[schoolSlug]` on disk.
- Checked Convex files against `packages/convex/functions/admissions/` and `packages/convex/functions/foundation/` on disk.
- No `pnpm typecheck`, lint, or build run. Docs only.

## How to review

```bash
git -C _w/docs-admissions-refresh status --short
git -C _w/docs-admissions-refresh diff --stat
git -C _w/docs-admissions-refresh diff -- docs README.md packages/convex/README.md
```

## Known gaps left open

- Business approvals in ADR-008 section on unresolved approvals still need owner sign off before production launch.
- Backend entitlement checks at every optional module entry point and the full disabled-module test matrix in `ProductWideModuleEntitlements.md` remain open.
- The other 89 files in `docs/features/` were not resynced. Sync them on touch per `docs/Coding_Guidelines.md`.
