# Master Plan: Exam Recording v1

**Session ID:** `orch-20260324-152442`  
**Mode:** `takomi -> mode-orchestrator`  
**Status:** Initialized

## Overview

This orchestrator session delegates the Exam Recording v1 slice across blueprint, design, task-authoring, implementation, and final verification.

The orchestrator must not implement the feature directly. Each task is assigned to a specialized sub-agent with its own workflow, required skills, artifacts, and constraints.

## Source Of Truth

- `docs/Project_Requirements.md`
- `docs/Coding_Guidelines.md`
- `docs/issues/FR-006.md`
- `docs/issues/FR-007.md`
- `docs/design/brand-brief.md`
- `docs/design/design-system.md`
- `docs/design/sitemap.md`
- `docs/Builder_Prompt.md`

## Scope

- Primary-school exam recording only
- Bulk entry flow only
- Teacher and admin entry surfaces
- School-wide exam input mode:
  - `raw40`
  - `raw60_scaled_to_40`
- Admin-managed grading bands
- Auto-calculated total, grade, and remark

## Explicitly Out Of Scope

- Ranking
- CGPA
- Report cards
- Moderation and publishing
- Student-by-student entry UI
- Teacher-level override of exam scaling

## Skills Registry

| Skill | Why It Applies |
| --- | --- |
| `takomi` | Primary orchestration and workflow routing |
| `avoid-feature-creep` | Keep v1 narrow and stop scope drift |
| `frontend-design` | Teacher and admin mockup quality |
| `ui-ux-pro-max` | Strong UI direction and practical UX patterns |
| `nextjs-standards` | Build and verification rules for App Router apps |
| `convex` | Convex domain guidance umbrella |
| `convex-functions` | Query and mutation patterns |
| `convex-schema-validator` | Schema and validator structure |
| `convex-best-practices` | Production-safe Convex implementation |
| `sync-docs` | Final feature doc updates after implementation |

## Workflows Registry

| Workflow | Purpose In This Session |
| --- | --- |
| `/vibe-genesis` | Author the exam-recording sub-PRD |
| `/vibe-design` | Produce teacher and admin mockups |
| `/vibe-spawnTask` | Create self-contained build briefs |
| `/vibe-build` | Implement backend and app code |
| `/vibe-syncDocs` | Sync docs and issue progress after code lands |
| `/review_code` | Final quality pass after implementation |

## Dependency Map

`T01` -> `T02`, `T03`, `T04`, `T05`, `T06`  
`T02`, `T05`, `T07` -> `T08`  
`T03`, `T06`, `T07` -> `T09`  
`T04` -> `T07`  
`T08`, `T09` -> `T11`  
`T07`, `T08`, `T09` -> `T12`  
`T11`, `T12` -> `T13`  
`T11`, `T12`, `T13` -> `T14`  
`T14` -> `T10`

## Delegated Task Table

| ID | Subtask | Mode | Workflow | Skills |
| --- | --- | --- | --- | --- |
| `T01` | Exam Recording blueprint | `vibe-architect` | `/vibe-genesis` | `takomi`, `avoid-feature-creep` |
| `T02` | Teacher UI design | `vibe-architect` | `/vibe-design` | `takomi`, `frontend-design`, `ui-ux-pro-max` |
| `T03` | Admin UI design | `vibe-architect` | `/vibe-design` | `takomi`, `frontend-design`, `ui-ux-pro-max` |
| `T04` | Shared/backend task brief | `vibe-architect` | `/vibe-spawnTask` | `takomi`, `convex`, `nextjs-standards` |
| `T05` | Teacher app task brief | `vibe-architect` | `/vibe-spawnTask` | `takomi`, `frontend-design`, `nextjs-standards` |
| `T06` | Admin app task brief | `vibe-architect` | `/vibe-spawnTask` | `takomi`, `frontend-design`, `nextjs-standards` |
| `T07` | Shared domain and backend implementation | `vibe-code` | `/vibe-build` | `takomi`, `convex`, `convex-functions`, `convex-schema-validator`, `convex-best-practices`, `nextjs-standards` |
| `T08` | Teacher app implementation | `vibe-code` | `/vibe-build` | `takomi`, `frontend-design`, `nextjs-standards` |
| `T09` | Admin app implementation | `vibe-code` | `/vibe-build` | `takomi`, `frontend-design`, `nextjs-standards` |
| `T11` | Auth and membership integration | `vibe-code` | `/vibe-build` | `takomi`, `convex`, `nextjs-standards` |
| `T12` | Convex project wiring and codegen | `vibe-code` | `/vibe-build` | `takomi`, `convex`, `convex-functions`, `nextjs-standards` |
| `T13` | Seed live exam-recording data | `vibe-code` | `/vibe-build` | `takomi`, `convex`, `nextjs-standards` |
| `T14` | Live integration verification | `vibe-review` | `/review_code` | `takomi`, `sync-docs`, `nextjs-standards` |
| `T10` | Verification, docs sync, and review | `vibe-review` | `/vibe-syncDocs` + `/review_code` | `takomi`, `sync-docs`, `nextjs-standards` |

## Progress Checklist

- [x] `T01` Blueprint complete
- [x] `T02` Teacher design complete
- [x] `T03` Admin design complete
- [x] `T04` Shared/backend task brief complete
- [x] `T05` Teacher app task brief complete
- [x] `T06` Admin app task brief complete
- [x] `T07` Shared/backend implementation complete
- [x] `T08` Teacher app implementation complete
- [x] `T09` Admin app implementation complete
- [x] `T11` Auth and membership integration complete
- [x] `T12` Convex project wiring and codegen complete
- [x] `T13` Seed live exam-recording data complete
- [x] `T14` Live integration verification complete
- [ ] `T10` Verification and docs sync complete

## Orchestrator Notes

- If draft exam-recording files already exist, sub-agents may use them as editable inputs, but they are not locked; the assigned task remains the source of authority.
- Do not use `context7` unless the user explicitly requests it later.
- Keep files under the 200-line rule where practical; split modules early rather than late.
