# Task C1: Correct release-roster and rollback blockers

## Agent setup
Follow Takomi Vibe Build correction pass. Read `AGENTS.md`, `packages/convex/_generated/ai/guidelines.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/{spec.md,design.md,results/review-round-1.md}`, B1 result and `resultPublication.ts`, schema and existing tests. Use same B1 coder conversation. FR-023 read-only.

## Objective
Fix confirmed round-1 backend review blockers while retaining frozen issued-only read and authorized explicit release.

## Scope
- Stop constructing release-ready historical rosters from incomplete legacy evidence. Only permit a new release when the active session and active term provide a complete current class roster with consistent evidence; all inactive term/session releases fail with clear historical reconciliation message. Already frozen releases remain readable even after term/class archive. Do not silently omit absent historical students.
- Replace school-wide 512-student, promotion and issued scans with tuple-scoped indexed queries. Index release candidates by exact current class and session/term evidence. Enforce MAX_ROSTER bounded atomic checks and never release a partial class. Preserve tenant and class-conflict checks. Add tests: school with >512 students and small current class succeeds; historical student with no marks/evidence cannot be silently omitted; current class late/no-score student blocks unless explicitly excluded after verified enrollment.
- Allow Admin `getClassReadiness` to inspect an already released archived tuple via frozen publication (do not open new archived release). Keep family frozen access.
- Add auditable school-scoped server-side releases-paused setting/mutation for authorized admin/operator, with `releaseClassResults` checking pause even for direct API calls, but never disabling the parent read gate. Describe rollback. Keep initial default false; no migration or automatic backfill.
- Replace reason-string control logic with stable reason code/explicit `canExclude` if practical; UI may need follow-up, keep backend payload compatible.
- Run backend typecheck, focused tests, targeted lint and diff check. Write `results/C1.md` with limitations and file list.

## Definition of done
Current live class release works at large school without whole-school scan, historical unknown roster never releases, archived frozen release remains inspectable, and server-side stop blocks direct new releases with audit. Tests demonstrate these cases; no duplicate release or draft read regression.

## Expected artifacts
`resultPublication.ts`, schema and tests, applicable inventory adjustments, `results/C1.md`.

## Constraints
Only result-publication worktree. Do not edit `portal.ts`, Admin/Portal UI, other worktree, commit/push/merge/deploy. Current active term roster is a conservative present-day release contract, not a historical attestation; note any existing term limitations explicitly. If impossible to prove safe roster with existing data, block unsafe releases and report rather than guess.

## Dependencies
B1, B2 and round-1 reviews. C2 portal query optimization follows; B3 may need UI updates if backend adds pause/reason codes.

## Verification/review checkpoint
Orchestrator checks indexed roster completeness and kill switch before allowing PR review round 2.
