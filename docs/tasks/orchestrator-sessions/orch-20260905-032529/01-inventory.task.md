# G0 — UI coverage inventory and integration decomposition

## Agent Setup (first)
Use Takomi Genesis inventory workflow, prime repository context by reading AGENTS.md and relevant source/types/tests. Required skill: takomi. Read packages/convex/_generated/ai/guidelines.md before backend inspection. Read parent product-decisions.md and required D02/D03/D04/D05 designs, coverage matrix, realistic school test book. They are design/context, not proof of routes.

## Objective
Determine actual application wiring for every U1–U6 foundation and create precise reviewable build packets, without implementation or repeated historical audit.

## Scope
Inspect Platform/Admin/Teacher/Portal/Sites routes, shells/navigation, shared components/types/tests, foundation backend APIs, authorization and branch context. Cover groups/branches/switching, RBAC/audit, grade colors/admission numbering/banks, theme/drafts/progress, email/imports, subscriptions/usage/assets/archive/Trash, within-group transfers. Inspect repository commands and browser tooling availability without reading credential values or printing environment values.

## Artifacts
Write ui-coverage-matrix.md in this session with columns: requirement, API, shared component, integration/route, missing UI/nav/settings, persona, permission, missing states, tests, screenshot evidence, target slice, status. Write implementation-plan.md with exact file ownership, dependencies, PR boundaries and risks. Author complete U1–U7 task Markdown packets with objective/scope/context/DoD/artifacts/instructions including specific API/function and component seams found in code. Split large slices into reviewable subpackets rather than giant assignments.

## Definition of done
Every requested foundation is inventoried against real implementation (not inferred from schemas), full packets exist for dependency-aware delivery, no missing UI is marked complete. Record discovered gates truthfully. Self-review documentation consistency.

## Constraints
Documentation writes only. No code mutations, commands reaching Convex, credentials, production, live providers, M9, migrations, deployment, commits or PR creation. Exact repository cwd supplied by launcher. User authorized autonomous continuation: do not ask planning approval. Return concise inventory summary and artifact paths.
