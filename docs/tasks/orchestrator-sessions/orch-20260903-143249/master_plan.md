# Melo School Platform Expansion Program

Session: `orch-20260903-143249`

## Purpose
Capture the complete user-led requirements interview from H1 onward, preserve every product decision through context compaction, then convert the approved features into a dependency-aware implementation program.

## Operating Agreement
- Ask about each feature directly in chat; do not use the structured questionnaire tool.
- Explain current behavior, concrete choices, and a recommended answer before requesting a decision.
- Interview H1, H2, H3, and onward before bundling approved work.
- Record confirmed decisions immediately in `product-decisions.md`.
- Do not begin feature implementation until the interview reaches a mutually agreed stopping point and the implementation program is synthesized.
- Use existing architecture and tests as evidence; avoid invented behavior.
- Production remains read-only during any data refresh. Back up development first, use established Convex export/import tooling, and never commit snapshots or secrets.

## Current Git Strategy
1. Allow PR #21 to complete checks and merge.
2. Branch from updated `master`.
3. First repair teacher conditional-hook lint errors.
4. Investigate the parallel-only foundation test timeout; optimize first, raising the test timeout only if legitimate work remains slow.
5. Implement the approved product program in staged, reviewable branches/PRs rather than one unsafe monolith.

## Product Foundations Identified
- H1 configurable grade-band colors
- H2 granular school-admin RBAC
- H3 school/group bank accounts and financial-document snapshots
- H4 atomic admission-number policies and counters
- F1 application-wide append-only audit log
- F2 school-group and multi-branch tenancy
- F3 AI-assisted import review pipeline
- F4 future Melo-to-Melo transfer network

## Lifecycle
### Genesis — Requirements Interview
Preserve decisions, continue H5 onward, validate dependencies.
### Design — Program Architecture
Define identity, tenancy, RBAC, audit, inheritance, migrations, APIs, UI, tests, and rollback.
### Build — Staged Delivery
Baseline fixes; foundations; multi-branch; bounded features; tests, evidence, reviews, and PRs.

## Definition of Done
Every interviewed feature has explicit decisions; cross-tenant security and privilege boundaries are designed; migrations preserve history; AI never bypasses deterministic review; every build stage has tests, rollback, review, and coherent PR scope.