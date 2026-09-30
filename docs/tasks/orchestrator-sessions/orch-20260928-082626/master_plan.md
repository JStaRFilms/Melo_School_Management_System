# Comment-based progress reporting

Session: orch-20260928-082626
Stage: Build, with a focused Genesis and Design pass before implementation.
Base: `origin/master` at `23c4880`; worktree `../Melo_School_Management_System-comment-progress`; branch `feat/comment-progress-reports`. Do not touch the dirty original checkout.

## Goal

User's latest v1 decision (2026-09-28): use the normal subject workflow. Admin selects classes and comment-vs-score mode by session; school assigns subjects to classes; teacher uses the normal session, term, class, subject and student selectors and writes a comment per subject rather than a score; admin publishes a clean report. Schools may edit optional Melo starter subject sets/templates. FR-023 is authoritative. The earlier single-comment B1 pass must be revised before UI work; mandatory per-area scales/templates are deferred.

Let a school choose graded or comment-based progress reporting for selected classes, regardless of class level. An enrolled child remains a normal student; choosing a reporting mode never enrolls a child automatically. The requesting school currently wants foundation pupils off-platform until they choose otherwise.

## Proposed product contract to validate in Genesis and Design

- Default to the existing graded report. An authorized school admin selects comment-based mode for one or more classes; clarify whether selection must be scoped to session/term for history and how bulk groups should work. Do not confuse groups of classes with multi-branch `schoolGroups`.
- Reuse report-card extras where they fit: school-defined learning areas with teacher observations and optional descriptive scale labels, not numerical marks. Provide a coherent teacher workflow, printable report, and parent view without grades, averages, rankings, or misleading pending-score warnings.
- A teacher/admin may draft and review; parents see only explicitly published reports or updates. Existing graded report behavior must remain backward compatible unless a specific security issue requires changing it.
- Historical reports remain bound to the mode and learning-area definitions active when published. Mode switches must not silently rewrite issued records or expose drafts.
- Permissions and tenancy must be enforced server-side; test student/class/session membership and parent visibility.

## Discovery and design gate

Read `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, FR-005/006/008/009/010, applicable mockups, `AGENTS.md`, and Convex guidelines before touching Convex code. Map schema, report-card builder, extras, teacher/admin controls, portal, printing, certification and tests. Produce an implementation-ready decision record and FR-023 acceptance checklist; surface material product ambiguities before coding. For nonblocking choices use smallest backward-compatible behavior and record the decision.

## Build slices

1. Mode configuration and class selection. Validated scope, permissions, defaults, and existing-data transitions.
2. Narrative data and publication contract. Teacher entry, editable drafts, explicit publish and immutable/snapshot history; school-defined learning areas or existing extras as appropriate.
3. Teacher and admin UX. Class configuration, narrative workbench, review/publish affordance; preserve graded screens.
4. Parent and printable reporting. Parent-only published visibility, no scores or grade semantics for narrative reports; historical continuity.
5. Tests and verification. Convex tests for tenancy/auth, no subjects, publish/draft, switches and historical snapshots; UI tests for both modes. Run package type checks, focused tests, lint/build as practical, and `node scripts/audit-theme-colors.mjs` on touched school-facing files. Classify direct colors rather than replacing semantic colors.

Keep active-worktree writes serialized. Delegate bounded read-only tasks independently, then implementation in controlled slices; independent reviewer(s) inspect the completed diff, fix and re-review until blocking findings close. Review generated types and cross-app effects. Avoid unrelated changes.

## Delivery gate

Commit only feature files in this worktree, push the feature branch, open a PR against `master`, invoke `@codex` for a PR review after local review, then follow the PR babysitter skill for CI and review comments until green or an external blocker requires a user decision. Record PR, review, checks and blockers in this session. Never claim a PR is green without checking GitHub.
