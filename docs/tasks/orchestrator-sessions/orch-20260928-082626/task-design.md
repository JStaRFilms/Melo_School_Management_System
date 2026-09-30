# Task D1: design the narrative reporting interactions

## Agent setup

Role: designer. Stage: design. Worktree: `../Melo_School_Management_System-comment-progress`; branch `feat/comment-progress-reports`. Read `AGENTS.md`, `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, `docs/issues/FR-023.md`, `docs/tasks/orchestrator-sessions/orch-20260928-082626/{master_plan.md,design-contract.md,portal-agent-handoff.md}` first. Read the applicable admin/teacher mockups under `docs/mockups/`; inspect existing admin report-card bundle/config, admin publish, teacher workbench, shared report/print and parent portal components. Read Convex guidelines before inspecting backend functions.

## Objective

Define an implementation-ready UI/UX for selecting graded or narrative reports for one or more arbitrary classes, authoring observations and a learning-area template, admin review and explicit publish, and parent report/print. Keep enrollment and class-level reporting independent. Existing graded screens must continue to work.

## Scope

Produce one concise UI spec in `docs/tasks/orchestrator-sessions/orch-20260928-082626/ux_design.md`. Provide screen entry paths and route/component integration options grounded in code; interactions and copy for admin bulk class selection, template creation, mode-switch warning, teacher drafts/required field errors, admin stale-review/publish, narrative ready/not-ready parent state, print on white paper, small-screen layout, focus/accessibility. Note who can act in each state and how the UI signals that unpublished narratives stay invisible to parents. No implementation or backend code; no global graded-report portal changes. Follow tenant theme tokens in AGENTS.md.

## Context and dependencies

G1's `design-contract.md` and FR-023 are the technical and acceptance source of truth. A separate agent handles graded-parent visibility; integrate only with the issued-only narrative contract. If a design choice conflicts with backend feasibility, describe the tradeoff and recommend the smallest usable v1. Follow existing UI patterns instead of starting a new design system.

## Definition of done

The spec names exact screens and components, the user action in each state, draft vs published visibility, class/term scope, error/empty states, parent and print display, keyboard/mobile and contrast behavior. No new app code. Include a reviewer checklist to verify UI matches FR-023 and avoids numeric/grade semantics.

## Expected artifact

`docs/tasks/orchestrator-sessions/orch-20260928-082626/ux_design.md`.

## Review checkpoint

Orchestrator checks the UX spec against FR-023 and design-contract, then authors separate Build packets for backend config, draft/publish, staff UI, portal/print, and tests. Report only genuine blocking decisions, with alternatives.
