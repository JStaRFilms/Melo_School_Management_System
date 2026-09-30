# PR readiness and rollout checklist

## Branch review status

- Graded-only parent visibility worktree from `origin/master` at `23c4880`. FR-023 narrative report code lives in another unmodified worktree. Reconcile shared `packages/convex/functions/portal.ts` typed selected report, history and notifications line by line before combining branches. No narrative fallback to graded; test unpublished narrative with graded assessment, issued narrative and published graded together.
- Round 1 independent standards, spec and security reviews in `review-round-1.md`. Corrected issues in `C1.md`, `C2.md`, `C3.md`, `C4.md`. Final reviewers found no confirmed graded family leak or release race. C4 removed final 256-selector availability blocker. Keep limits below as explicit conditions, not silently mark release-ready.
- Current new releases require an active session and active term. Legacy historical release awaits authoritative roster and grading-policy reconciliation. Previously visible live drafts and certified-but-unreleased cards become hidden after backend gate deployment. Communicate to schools before rollout. A frozen released term remains readable after archive. Admission changes after release never auto-add a student.

## Production deployment prerequisites, not authorized by opening PR

1. On a large deployment, add the new index on existing `issuedReportCards` as a staged index in a **separate approved schema preparation deployment**, wait for backfill completion and then activate it as a queryable index. This feature branch's `by_class_and_session_and_term` index is immediately queryable; do **not** deploy the feature's functions while the index remains staged or unavailable. New publication and inclusion tables start empty, so their indexes do not need legacy row migration. No historical publication backfill.
2. Sequence schema and default-deny portal backend together before Admin/frontend callers; never deploy the old draft-reading portal query as rollback. If rollout fails, a school admin pauses new releases server-side with a reason. Keep already released pinned copies visible. A separate emergency hide-all requires a new reviewed server rule.
3. Verify authenticated guardian/student, cross-school membership, direct guessed IDs, score-free unpublished states and published immutable snapshots against a production-like backend. Validate one current-term class with complete roster and an explicit admin exclusion, then pilot and monitor. Schema/migration, deploy, merge and production checks each require owner authorization.
4. Combined FR-023 integration and runtime testing remain outstanding until that branch provides implementable narrative code. This graded PR must not claim combined runtime-ready or release-ready status by itself.

## Verification commands

`corepack pnpm --filter @school/convex typecheck`, `corepack pnpm --filter @school/admin typecheck`, `corepack pnpm --filter @school/portal typecheck`, `corepack pnpm -C packages/convex exec vitest run`, focused Admin and Portal Vitest, targeted ESLint, `git diff --check`, `node scripts/audit-theme-colors.mjs` (informational). PR babysitter must verify checks and final Vercel preview on the settled PR head, not on an earlier commit.
