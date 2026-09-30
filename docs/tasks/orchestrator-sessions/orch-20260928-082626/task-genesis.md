# Task G1: discover and specify narrative reporting

Role: architect. Stage: genesis. Read-only analysis apart from the two artifacts below.

## Objective

Produce the implementation-ready contract for per-class comment-based progress reporting on the actual `origin/master` worktree. Identify what can be reused, what must change, and any unsafe assumptions from the user's discussion. The customer wants foundation children excluded for now; future support must not silently enroll them. Any school may select classes regardless of level.

## Scope

- Read `AGENTS.md`, `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, FR-005/006/008/009/010, relevant mockups; read `packages/convex/_generated/ai/guidelines.md` before inspecting Convex implementation.
- Trace admin enrollment/class selection, grading/report settings, extras/bundles, teacher edit/review/certification, parent results/report cards and printing, published/issued snapshot behavior, and tests. Distinguish the multi-branch `schoolGroups` concept from selectable sets of classes.
- Recommend exact config scope and transition rules, narrative template fields and storage, teacher workflow, parent visibility, snapshot and print strategy, integration points, and security/tenancy tests. Explicitly check whether the current portal shows uncertified graded reports; do not conflate existing behavior with the new published-only requirement.
- Avoid code changes. Author only the deliverables below, with explicit assumptions, acceptance criteria and risks. If a product choice is genuinely blocking, name it so the orchestrator can ask the user.

## Definition of done

- A decision record cites file paths and function names, notes current behavior versus required behavior, names concrete tasks in implementation order and any blocking decisions.
- `docs/issues/FR-023.md` records testable acceptance criteria for the new feature and its required defaults, including disabled mode, group-of-classes administration, draft/publish, parent tenancy, historical switches, print, and regression safety.
- No application code modified.

## Expected artifacts

- `docs/tasks/orchestrator-sessions/orch-20260928-082626/design-contract.md`
- `docs/issues/FR-023.md`

## Review checkpoint

Orchestrator reviews the contract before decomposing Design/Build and launching write-capable coders. Report any unresolved UX or authorization question. Work in the explicit worktree cwd, not the original checkout.
