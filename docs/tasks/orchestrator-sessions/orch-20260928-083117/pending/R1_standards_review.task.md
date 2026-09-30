# Task R1: Review implementation against repository standards

## Agent setup
Follow Takomi review. Read `AGENTS.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/{master_plan.md,spec.md,design.md}`, and the diff `git diff origin/master...HEAD` at `99bada7` in this worktree. Read generated Convex guidelines for backend code. No edits.

## Objective
Report documented standards violations and Fowler baseline smells, separating hard violations from judgement calls. Repo standards override smells; skip tooling-enforced style.

## Scope
All changed code and tests in branch versus `origin/master` at `23c4880`; no parallel FR-023 worktree edits.

## Definition of done
Only actionable, line-cited findings ranked by impact, with clear rule source; report zero if none. Distinguish release blockers from suggestions. Under 400 words.

## Expected artifacts
Short review returned to orchestrator; no file edits.

## Constraints
Read-only. No merge/push/deploy. Smells to check: Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man, Refused Bequest. Each is a judgement call; documented standard takes precedence.

## Dependencies
B1-B4 code committed at `99bada7`.

## Verification and review checkpoint
Orchestrator records findings and sends real blockers back to implementer before PR.
