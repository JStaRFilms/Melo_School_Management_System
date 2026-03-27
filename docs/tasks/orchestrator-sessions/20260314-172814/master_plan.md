# Orchestrator Session Master Plan

**Session ID:** `orch-20260314-172814`  
**Created:** 2026-03-14  
**Status:** Active (audited 2026-03-27)  
**Mode:** Takomi Orchestrator

## Overview

This session operationalizes the School Management System delivery plan as a gated orchestration program. The goal is to create a reusable, multi-tenant-ready school platform for one production school first, using Vibe Genesis, Vibe Design, Vibe Build, Vibe Continue Build, review, docs sync, and finalize workflows.

## Skills Registry

| Skill | Use |
| --- | --- |
| `takomi` | Session orchestration, task routing, lifecycle control |
| `avoid-feature-creep` | Scope discipline during PRD and decomposition |
| `spawn-task` | Detailed task-file generation patterns |
| `monorepo-management` | Workspace structure, package strategy, turbo pipelines |
| `nextjs-standards` | App Router, coding standards, verification discipline |
| `convex-best-practices` | Convex structure and design decisions |
| `convex-functions` | Queries, mutations, actions, domain interfaces |
| `convex-schema-validator` | Schema and validators |
| `convex-realtime` | Reactive data flows |
| `convex-http-actions` | Webhooks, payment callbacks, external events |
| `convex-file-storage` | OCR input files and generated artifacts |
| `convex-cron-jobs` | Background notification and scheduled jobs |
| `convex-security-check` | Quick security constraints during implementation |
| `convex-security-audit` | Deep Convex security review |
| `frontend-design` | High-quality production UI direction |
| `ui-ux-pro-max` | Design system, UX, layout consistency |
| `copywriting` | Public-site and notification copy |
| `seo-ready` | Search metadata and structured data |
| `pdf` | Printable report-card workflows |
| `prompt-engineering` | AI teacher tools and quiz-generation prompts |
| `webapp-testing` | Cypress-related validation flows |
| `security-audit` | Full-app hardening review |
| `jstar-reviewer` | Review and audit loop |
| `sync-docs` | Keep docs/features current |
| `crafting-effective-readmes` | Final handoff and operational docs |

`context7` is intentionally excluded from this session.

## Workflows Registry

| Workflow | Use |
| --- | --- |
| `/mode-orchestrator` | Session setup, decomposition, monitoring |
| `/vibe-genesis` | PRD, FRs, issue pack, architecture decisions |
| `/vibe-design` | Design brief, sitemap, design system, mockups |
| `/vibe-build` | Scaffold and first-pass implementation tasks |
| `/vibe-continueBuild` | Resume and incremental build tasks |
| `/review_code` | Review and audit loop |
| `/vibe-syncDocs` | Documentation synchronization |
| `/vibe-finalize` | Final verification and handoff |
| `/vibe-primeAgent` | Mandatory preflight for every execution task |

## Execution Lanes

### Sequential gates

1. Genesis: `T01-T10`
2. Design: `T11-T18`
3. Foundation: `T19-T24`
4. Domain/Product: `T25-T45`
5. Hardening/Finalize: `T46`

### Parallel opportunities

- `T14-T17` after sitemap and design-system direction are locked
- `T25-T28` after foundation gate
- `T29-T35` and `T36-T40` can partially overlap once shared auth, permissions, and schema conventions are stable
- `T41-T45` can run in controlled parallel after core backend contracts exist

## Progress Checklist

- [x] Session folders created
- [x] Master plan created
- [x] PRD created
- [x] FR issue pack created
- [x] Task pack created
- [x] Initial task execution batch completed for genesis/design foundation
- [x] Session audit reconciliation completed on 2026-03-27
- [ ] Remaining pending tasks reconciled through future execution
- [ ] Final summary completed

## Milestones

| Milestone | Task Range | Exit Condition |
| --- | --- | --- |
| Genesis Complete | `T01-T10` | PRD, issues, guidelines, and orchestration rules are stable |
| Design Complete | `T11-T18` | Sitemap, design system, mockups, and builder enforcement are ready |
| Foundation Complete | `T19-T24` | Monorepo, auth, permissions, backend skeleton, and verification harness are in place |
| Domain Complete | `T25-T45` | Public site, academics, portal, billing, payments, AI, and app surfaces are implemented |
| Release Hardening Complete | `T46` | Security, review, E2E, docs sync, and handoff pass |

## Task Table

See the `pending/` directory for the `46` execution-ready task files. Task ordering is numeric and dependency-safe.

## Audit Notes

An audit pass was performed on 2026-03-27 to reconcile this original session with the current repo state.

Key outcomes:

- `T14` was reverted to pending because the claimed `docs/mockups/www/*` artifacts are not present.
- `T15` was moved back to pending because the current repo does not prove the full original mockup scope.
- `T18`, `T19`, `T21`, and `T30` were verified complete and moved into `completed/`.
- several later tasks were left pending because only partial or narrower work exists relative to their original scope.

See `Audit_Reconciliation_2026-03-27.md` for the conservative status rationale.
