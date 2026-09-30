# Task B1: implement session class modes and per-subject comment report backend

**Revision gate, 2026-09-28:** The first B1 pass built one general comment and is not accepted as final. FR-023 now requires one editable draft comment per applicable subject, using existing `classSubjects` and explicit student session selections as graded reporting does. Snapshot subject names/order with comments on publish. Preserve class-session mode and issued-only parent lookup. Guard score-entry writes for comment-mode classes. Add multi-subject, teacher/class/subject authorization and history tests. Do not build mandatory learning-area templates; optional school-editable Melo starter subject lists may follow in admin UI. Remove or migrate the single-comment draft/issued shape rather than leaving two competing report contracts. FR-023 supersedes contradictory paragraphs below.

## Agent setup

Role: coder. Workflow: vibe-build. CWD: `/Users/toji/Documents/johnsax/Melo_School_Management_System-comment-progress`. Read `AGENTS.md`, `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, `docs/issues/FR-023.md`, `docs/tasks/orchestrator-sessions/orch-20260928-082626/master_plan.md`, `ux_design.md` first. Read `packages/convex/_generated/ai/guidelines.md` before touching any Convex file. FR-023's **v1 scope update** supersedes older term-scoped templates/scale ideas in design-contract and UX notes. Check related FR-005/006/008/009/010 and implementation patterns.

## Objective

Add the secure backend for a plain free-text narrative report for any selected class in one academic session. Leave current graded reporting as default. No enrollment or subjects are created by mode changes. This backend must support simple staff screens and an issued-only parent read in follow-on tasks.

## Scope

- Add bounded Convex schema and indexes for same-school class+session mode choice, per-student/session/term narrative drafts, immutable issued narrative snapshot. A group of classes means a bulk-selection admin control, not `schoolGroups`, a named group entity, or per-learning-area templates. No global toggle required: absence of selections is off. Define typed validators/read contracts and server functions for admin bulk selection/list, teacher/admin draft read/save, staff report preview, admin review-key publish and issued lookup. Use existing capability/assigned-class access and tenant authorization; enforce student enrollment/class/session/term, safe historical class, character bounds, no score/subject requirement. Parents cannot call staff draft endpoints. Save may be incomplete; publish requires nonempty text.
- Protect issued snapshots: no update to issued period, idempotent repeat publish, mode switching locked after any report in that class/session has been issued (graded or narrative). Extend graded certification guard to reject active narrative mode; narrative publish rejects graded mode or previously issued graded card. Snapshot class/student/school presentation and report comment for historical continuity. Audit admin publish. Do not edit `packages/convex/functions/portal.ts`; another agent is changing graded parent publication in another worktree. Clearly document narrow backend interface for B3.
- Add focused Convex integration tests for default/off mode, bulk class selection same school and session, invalid/mixed tenant IDs, auth/teacher class access, no subjects, draft/save/publish and stale review/idempotency, historical snapshot, graded/narrative incompatibility. Follow existing test harness, avoid unrelated refactors. After each TypeScript edit run package-appropriate typecheck and fix before the next edit where feasible. Report commands and baseline failures.

## Definition of done

Secure server-side mode and narrative lifecycle exists with usable typed staff and issued reads; tests prove class/session bounds, no-subject use, draft isolation, publish immutability, and no interference with graded default. Existing graded backend tests pass. Changes confined to schema, academic functions, associated tests/types and minimal shared contracts. No UI or portal query edits.

## Expected artifacts

Modified `packages/convex/schema.ts`, new/updated `packages/convex/functions/academic/*` and focused `__tests__/*` with a backend handoff section in `docs/tasks/orchestrator-sessions/orch-20260928-082626/backend-handoff.md` documenting function names, args, read model and validation results.

## Dependencies and review

Depends on G1 and D1. B2 and B3 consume this backend. Orchestrator reviews diff, test evidence and auth checks; an independent security reviewer checks whole feature later. Stop and report any genuine external blocker, not an implementation choice.
