# Parent result publication gate

Session: orch-20260928-083117
Branch: feat/term-class-result-publication
Base: origin/master at 23c4880f29ff51e2fa19909119be92cb517f3ac6
Worktree: /Users/toji/Documents/johnsax/Melo_School_Management_System-result-publication
Stage: Genesis first, then Design and Build.

## Decision and scope

A school's score-entry window governs staff editing, not family visibility. Staff may work with draft results; parents and students may see results only after an authorized release for their class, term and session. Keep existing per-student immutable certification, then publish only certified copies. Existing results are not silently grandfathered. An explicit release is needed for every class and term; rollout must tell schools that previously visible drafts will be hidden until release. No automated time-based publication. Do not merge or deploy without user authorization.

## Build plan

1. Genesis: verify all family-facing result paths and historic enrollment behavior; write an implementable spec, release-state model, authorization and rollout contract. Resolve gaps before code.
2. Design: specify admin class readiness, release confirmation, withheld-state and family empty states; keep scope narrow.
3. Build backend: persistent school/session/term/class publication state; mutation with capability, tenant and readiness checks, audit trail; portal queries return issued data only when released. Decide how to handle incomplete/withdrawn/transferred students in the spec.
4. Build UI: admin release controls/readiness and clear portal withheld copy, with no draft result leaks through summary, history, notifications or report-card detail.
5. Verify: Convex integration tests for draft privacy, certification without publication, readiness, cross-school and historical/transfer cases, idempotency and parent regression; UI tests; lint/typecheck and theme-color audit for touched school-facing files.
6. Review: two independent axes against this spec and repo standards, plus security/tenant-isolation review; correct confirmed blockers and rerun verification.
7. Create PR from this branch into master, request @codex review through the available GitHub mechanism, and run pr-babysitter on comments/checks/preview. Keep code-ready, review-ready, preview-ready, runtime-ready and release-ready distinct. Stop before merge/deploy/migration without explicit approval.

## Parallel FR-023 coordination

FR-023 narrative-report work lives in `/Users/toji/Documents/johnsax/Melo_School_Management_System-comment-progress` and must not be edited from this session. Its `portal-agent-handoff.md` identifies `packages/convex/functions/portal.ts` as a shared integration hotspot. This branch owns graded visibility only; FR-023 owns issued-only narrative visibility. Reconcile shared selected-report/history/notification validators and logic line by line during PR integration; test both unpublished types together. Details and the common-base test matrix are in `spec.md`.

## Owner decisions recorded after Genesis

Exam officers with the existing publish-final capability may release. Only school admins may approve named, reasoned and audited exclusions; exam officers may release the reviewed roster. Release freezes eligible students; post-release additions require a separately reviewed process. Older reports without certifiable policy snapshots remain withheld. Ambiguous within-term class histories fail closed; family history lists released results only.

## Reviewed safety limit

Review round 1 found that legacy historical records lack a complete class-term enrollment roster. New releases are deliberately limited to the currently active session and term with bounded present-day class evidence; old terms remain withheld unless they were already frozen and released while active. A separate authoritative historical roster reconciliation is required to release older periods. The backend has an audited school-admin pause switch for new releases; it does not revoke already published copies. See `results/review-round-1.md`, `results/C1.md`, and `results/C2.md` for tests and index rollout dependencies.

## Acceptance criteria

- Before release, family API returns no score-bearing values or derived metrics for the class/term, whether drafts are partially saved or cards certified; history and notifications cannot reveal them either.
- After release, an authorized family sees only the certified, immutable report for their eligible student, never fresh draft edits.
- Release is explicit, tenant-scoped, class/term/session scoped, authorized, audited, idempotent and conditioned on defined readiness. Cross-tenant and mismatched IDs fail closed.
- Existing results have no implicit release; school staff have a documented path to certify/release historical results and a rollout note about previously visible drafts.
- No public result data leaks through alternative portal endpoints, stale cached UI state or unvalidated term/class combinations.
- Focused tests and project verification pass; reviews have dispositions; PR checks are verified against head commit.

## Constraints and handoff

Read AGENTS.md and packages/convex/_generated/ai/guidelines.md before Convex work. Keep branding/status semantics intact; run node scripts/audit-theme-colors.mjs after touching school-facing UI. Work only in the new worktree, preserve the dirty original checkout. The original local master is ahead 1 and behind 48; use origin/master as fixed review/base point. No rebase, squash, merge or deployment. Follow pr-babysitter when the PR is opened.
