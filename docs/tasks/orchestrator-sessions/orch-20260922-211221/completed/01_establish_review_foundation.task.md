# Task 01: Establish review foundation

## Agent setup

### Workflow to follow

Takomi Genesis.

### Prime agent context

Read `AGENTS.md`, `packages/convex/_generated/ai/guidelines.md`, PR #49 metadata, the 22 item PRs, and this session's `master_plan.md`.

### Optional skill and context overlays

Use `git-github-tools`, `code-review`, `convex`, `pr-babysitter`, `tailscale-app-serve`, and `unslop`.

## Objective

Pin the target, constraints, worktree, evidence, and execution sequence without changing product code.

## Scope

Validate GitHub access, identify the correct PR, inspect worktrees, load required instructions, create an isolated checkout, and author the durable plan.

## Context

The user initially named PR #45, but issue #72 and repository history identify draft PR #49 as the consolidation integration. The user confirmed PR #49 only.

## Definition of done

- The exact starting head is recorded.
- An isolated clean worktree exists.
- Relevant skills and Convex guidelines have been read.
- Safety boundaries and scope are explicit.

## Expected artifacts

- `_w/consolidation-review`
- This orchestration session
- Registered board state

## Constraints

Do not edit product code, push, merge, deploy, or mutate Tailscale during foundation work.

## Verification

Run `git status`, `git worktree list`, `gh auth status`, and `gh pr view 49`.
