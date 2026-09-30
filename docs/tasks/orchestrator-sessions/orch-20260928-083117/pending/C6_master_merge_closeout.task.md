# Task C6: Reconcile narrative master with graded release before merge

## Agent setup
Follow Vibe Build focused merge reconciliation. Read AGENTS.md and generated Convex guidelines first. Merge is IN PROGRESS in this worktree: HEAD 4208bac includes #92 fix; incoming origin/master 5193b3f includes narrative PR #89 and staged-index preparation PR #90. Do not abort, rebase, commit, push or deploy.

## Objective
Resolve eight merge conflicts preserving both shipped intentions: family graded reports require reviewed class release/frozen certification, narrative reports are issued-only and never fall back to graded. Preserve selected-branch Admin preview/certification/extras fixes and score-free availability states.

## Scope
Conflict files: Admin report-cards/page.tsx, PortalWorkspaceContent.tsx, portal-types.ts, transfers test, seed.ts, tenantPurgeManifest.ts, portal.ts, schema.ts. Inspect narrativeReports.ts and incoming narrative test/UI contracts as needed. Preserve both sets of tables/indexes/purge cleanup; graded issued lookup ordinary queryable index is activation step after #90 staged schema deployment/backfill; keep incoming separate staged narrative index unchanged unless a query already requires activation, in which case report explicitly. No unbounded reads or live graded parent builder.

Preserve narrative dispatch and renderer/history/notifications while applying graded released-only check before any graded payload. If active narrative has no issued copy, never use graded fallback even if grade records/frozen grade release exist. Resolve historical report class from issued/frozen data, not current class. Staff draft/print paths retain narrative mode and selected schoolId checking; no accidental score writes into narrative periods. Preserve known no-eligible state for excluded/late graded student, client now optional, indexed bounded event scan.

## Definition of done
No conflict markers, all combined types valid. Joint tests cover unpublished graded, certified-unreleased graded, released graded, unpublished narrative with graded evidence/release, issued narrative, promotion/history and cross-family/school. Existing narrative entry/authorization/numeric-write tests and existing graded release/portal tests pass. Full Convex suite and Admin/Portal typechecks/tests run; any impossible policy/contract is explicitly reported rather than guessed.

## Expected artifacts
Resolved conflict hunks plus focused joint Convex/UI tests as needed, and results/C6-master-merge.md with exact preserved semantics and verification/blockers.

## Constraints
Only isolated result-publication worktree. Do not edit original checkout or FR-023/comment-progress worktree. No new features/backlog work, no rebase/abort/commit/push/merge-finalization/Convex deployment, no @codex request. Owner requested no further broad review cycle, only fixing #92 and verifying source merge. Parent finishes merge and PR replies.

## Dependencies and verification
#90 source merged by owner authorization, but no backend staging/backfill is performed. Parent verifies your results and exact staged resolution, then checks comments and merges #88 if clear. Preserve capacity helper and its new 50x11, >80 and evidence budget tests.
