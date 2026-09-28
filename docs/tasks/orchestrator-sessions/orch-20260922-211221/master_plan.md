# Orchestrator Master Plan

## Overview

- Session: `orch-20260922-211221`
- Project: Melo School Management System
- Mission: audit draft PR #49 for regressions, run the complete repository validation suite, repair confirmed defects, obtain an independent review, settle GitHub checks, and hand over all seven applications through Tailscale.
- Current phase: Build review and verification after Genesis intake.

## Context intake

The source of truth is draft PR #49 (`chore/consolidation-stack`) at starting commit `76777d8520036b52087c552944f7c823a813cdf1`, its 22 merged item PRs, their review histories, repository documentation, and the captured contents of deleted issue #72. PR #45 is out of scope.

Hard constraints:

- Keep PR #49 as a draft and never merge it.
- Do not rebase or rewrite pushed history.
- Do not touch Production, production data, or production Convex settings.
- Make only fixes for reproduced regressions, security defects, tenant-isolation defects, data-loss risks, or explicit requirement violations.
- Do not create low-value tests. Add focused coverage only when a confirmed fix lacks meaningful protection.
- Preserve the four product decisions that issue #72 deliberately left open unless the owner resolves them.
- Run all repository-defined tests and checks before handoff.
- Use the confirmed development Convex deployment only after local checks pass and the exact target is verified.
- Preserve existing Tailscale Serve routes and keep Funnel disabled.

Risks include a large cross-cutting diff, stale review results tied to old commits, drift from `master`, authorization changes spanning several domains, and runtime behavior that static checks cannot prove.

## Skills registry

| Overlay | Purpose |
|---|---|
| `code-review` | Separate standards and specification review axes. |
| `code-intelligence` | Trace call paths, blast radius, history, and reproduced failures. |
| `convex` | Apply current Convex function, schema, migration, and security rules. |
| `security-audit` | Review authentication, authorization, payments, tenant boundaries, and secrets. |
| `git-github-tools` | Isolated worktree and safe GitHub operations. |
| `pr-babysitter` | Build the feedback ledger and verify checks on the settled head. |
| `tailscale-app-serve` | Serve production builds on tailnet-only HTTPS. |
| `avoid-feature-creep` | Reject speculative cleanup and unrelated suggestions. |
| `unslop` | Keep written reports direct and readable. |

## Workflows registry

- Genesis: establish the fixed point, scope, constraints, evidence sources, and worktree.
- Build: inspect the diff, run verification, reproduce failures, and repair confirmed regressions.
- Review/finalize: independent review, GitHub feedback ledger, final checks, development runtime activation, and Tailscale handoff.

## Task table

| Task | Subtask | Role | Workflow | Dependency | Status |
|---|---|---|---|---|---|
| 01 | Establish review foundation | Orchestrator | Genesis | None | Completed |
| 02 | Audit PR #49 for regressions | Architect and reviewer | Build | 01 | Pending |
| 03 | Run complete verification suite | Worker | Build | 02 | Pending |
| 04 | Repair confirmed defects | Coder | Build | 02, 03 | Pending, conditional |
| 05 | Review settled changes | Reviewer | Review | 04 | Pending, conditional |
| 06 | Babysit PR and serve all apps | Orchestrator and worker | Finalize | 03, 05 | Pending |

## Progress checklist

- [x] Confirm PR #49 is the requested target.
- [x] Confirm PR #45 is out of scope.
- [x] Read repository, Convex, GitHub, PR babysitting, worktree, and Tailscale instructions.
- [x] Verify GitHub authentication.
- [x] Create isolated worktree `_w/consolidation-review`.
- [ ] Produce standards, specification, security, and runtime-risk findings.
- [ ] Run every repository-defined test and check.
- [ ] Fix only confirmed blockers and add only useful regression coverage.
- [ ] Complete one independent review and correction pass if code changes.
- [ ] Push the settled branch and babysit current-head checks.
- [ ] Confirm the development Convex target before activation.
- [ ] Build and expose all seven applications through Tailscale.
- [ ] Deliver clickable links and a readiness report.

## Notes

The deleted issue #72 was available during intake and described the 22-part consolidation program. GitHub now returns 404 for it. Its intent remains recoverable from the session capture, merged item PRs, tags, and commit history. The orchestration files are tracking artifacts and must not be included in product commits unless explicitly requested.
