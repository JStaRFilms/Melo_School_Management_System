# Orchestrator Session Master Plan

**Session ID:** `orch-20260404-193645-relaunch`  
**Created:** `2026-04-04`  
**Status:** Active  
**Mode:** Takomi Orchestrator

## Overview

This session supersedes using the old March 14 backlog as the primary execution queue.

The new baseline is:

1. the actual shipped admin, teacher, and platform surfaces
2. the still-missing MUS gaps
3. the new cumulative-results requirement
4. the operational need to refresh dev data from production safely

## Session Objectives

- Add cumulative third-term reporting with historical backfill support
- Stabilize the currently shipped academic surfaces before expanding scope
- Rebuild the backlog around the real current state, not stale pending tasks
- Prepare a guarded dev-data reset path from production data
- Sequence remaining portal, billing, and public-site work behind the correct foundations

## Skills Registry

| Skill | Use |
| --- | --- |
| `takomi` | Orchestration and lifecycle control |
| `spawn-task` | Task-file generation |
| `avoid-feature-creep` | Keep cumulative-results scope tight |
| `convex-best-practices` | Schema, function, and tenancy rigor |
| `convex-functions` | Query, mutation, and action design |
| `convex-schema-validator` | Safe schema additions |
| `convex-security-check` | Data-migration and auth guardrails |
| `nextjs-standards` | App Router implementation discipline |
| `frontend-design` | Clear admin/teacher UX for cumulative reporting |
| `webapp-testing` | Verification and smoke coverage planning |
| `sync-docs` | Keep docs aligned with implementation |

## Workflows Registry

| Workflow | Use |
| --- | --- |
| `/mode-orchestrator` | Session control and sequencing |
| `/vibe-spawnTask` | Detailed task-file creation |
| `/vibe-continueBuild` | Incremental implementation slices |
| `/review_code` | Verification and review passes |
| `/vibe-syncDocs` | Documentation synchronization |

## Execution Lanes

### Lane A: Stabilize Shipped Core

- test drift
- verification harness gaps
- docs drift
- release confidence

### Lane B: Cumulative Annual Results

- feature blueprint
- schema and backend support
- admin backfill workflow
- teacher/admin report-card UX

### Lane C: Dev Data Reset

- inspect deployment targets
- obtain production snapshot or access
- import into dev with validation

### Lane D: Remaining MUS Delivery

- parent/family linking
- portal
- billing and payments
- public website

## Dependency Order

1. `T01` must complete before cumulative implementation starts.
2. `T02-T04` deliver the cumulative-results slice.
3. `T05` is complete; the dev deployment now reflects the exported production snapshot.
4. `T06` closes stabilization and verification after the cumulative slice.
5. `T07-T10` are follow-on product lanes after the core academic/report-card path is stable.

## Task Table

| Task | Status | Lane | Notes |
| --- | --- | --- | --- |
| `T01` | Complete | A | Shipped-core hardening and regression baseline |
| `T02` | Complete | B | Cumulative-results domain and schema |
| `T03` | Complete | B | Admin and teacher cumulative-report UX plus print-blocking review pass |
| `T04` | Complete | B | Historical backfill workflow, admin route, and prior-total entry |
| `T05` | Complete | C | Dev deployment replaced from exported production snapshot on 2026-04-04 |
| `T06` | Pending | A | Verification, docs sync, and release-readiness pass |
| `T07` | Complete | D | Parent and family linking foundation |
| `T08` | Complete | D | Portal MVP academic surface |
| `T09` | Complete | D | Billing and payment foundation |
| `T10` | Complete | D | Public website and SEO surface in `apps/www` with core pages and SEO baseline |
| `T11` | Pending | D | Household management hardening: parent email maintenance, duplicate-link review, and child-parent unlink/edit flows |
| `T12` | Pending | D | Platform pricing and packaging strategy: segmented setup/recurring plans, entitlements, and upgrade model |
| `T13` | Complete | D | Class-assigned fee plans with default billing coverage and student-specific extras |
| `T14` | Complete | D | School-scoped Paystack setup plus front-desk payment links and QR handoff |
| `T15` | Complete | D | Parent portal billing, receipts, self-serve pay-now flow, and portal payment return verification |
| `T16` | Pending | D | Cross-device payment reconciliation hardening: pending-payment polling and durable callback/session flow |
| `T17` | Pending | D | Platform marketing website for selling the SchoolOS product itself, separate from tenant school public sites |
| `T18` | Pending | D | Per-school Paystack credential management and merchant routing |
| `T19` | Pending | D | Public web operating modes: platform site, school-keeps-existing-site support, and managed school-site onboarding policy |
| `T20` | Pending | D | Multi-tenant school public-site engine foundation with hostname resolution and runtime branding |
| `T21` | Pending | D | School website template library and flexible page/section composition model |
| `T22` | Pending | D | School public-domain mapping, verification, canonical routing, and custom-domain onboarding |
| `T23` | Pending | D | Managed school-site delivery workflow, optional school-admin editing boundaries, and page expansion model |

## Current Known Blockers

- `T02-T15` plus `T10` are now completed foundation/product slices. The next recommended product task is `T11`, while `T16` remains a follow-up billing hardening slice for cross-device reconciliation edge cases, `T17` records the platform-marketing-site lane, `T18` records the per-school Paystack credential lane, and `T19-T23` now capture the full public-web strategy: platform site, schools that keep their own websites, managed school-site delivery, multi-tenant public-site runtime, templates, and custom-domain onboarding. `T12` remains a pricing/packaging strategy follow-up, and `T06` is still deferred to the release-readiness pass.
- E2E coverage now exists as a Playwright smoke baseline, but it still needs wider business-path expansion before a final release-hardening pass.
- Lint and build still surface non-blocking verification noise in the teacher and platform apps that should be cleaned up before a release-hardening pass.

## Exit Criteria

- Cumulative third-term reporting is fully specified and delegated
- The new orchestration queue reflects the real current state
- Dev-data reset is completed with a rollback backup preserved on disk
- Remaining product work is staged behind the right foundations
