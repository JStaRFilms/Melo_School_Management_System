# Task P1: Babysit graded release PR #88

## Agent setup
Follow pr-babysitter and git-github-tools. Read `results/release-checklist.md`, `spec.md`, FR-023 integration note and PR #88 details. Record head SHA, all checks, submitted reviews, root comments and unresolved threads. No merge/deploy/migration.

## Objective
Request @codex review, monitor the current PR head until checks settle, classify every comment, correct only confirmed blockers in one consolidated pass, reply to every root comment, and run final preview on settled head.

## Scope
PR https://github.com/JStaRFilms/Melo_School_Management_System/pull/88 against master; Kilo/CodeRabbit/Codex review and Vercel projects including Admin and Portal; exact preview head/route checks when accessible. Compare all reviewer commits with head. Keep graded-only FR-023 dependency visible.

## Definition of done
No failed/pending/stale required check on final head, root comments all have dispositions, final preview results known, readiness classified as code/review/preview/runtime/release separately. Any merge/deploy blockers documented and user asked for authorization rather than auto-merging.

## Expected artifacts
PR comment ledger and status handoff under `results/PR88.md`; GitHub PR with @codex request and replies.

## Constraints
Do not rebase, squash, merge, deploy or migrate; do not mutate FR-023 worktree; do not treat Vercel Preview Comments as application success. Follow initial/intermediate/final preview policy. If checks or review cannot become green due to external blockers, report exact blocker to user.

## Dependencies
B1-B4, C1-C4, reviews and PR #88 open. Production index backfill and joint FR-023 integration are separately approved release gates.

## Verification and review checkpoint
Orchestrator checks comments, last commit, each required preview, security and tenant findings before declaring PR settled.
