<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `packages\convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Local development configuration

- Normal app `dev` commands use Infisical environment `dev`, reading only `/vercel-<app>` through `scripts/infisical-dev.mjs`. See README.md for bootstrap setup and the explicit `dev:local` fallback.
- Keep `.env.infisical.local` and `tmp/local-env-archive/` private and ignored. Never log bootstrap credentials or fetched secret values. Do not restore archived app dotenv files into the default Infisical startup path.
- For a new PC use `pnpm setup:dev` and supply bootstrap values privately. For an ordinary development worktree use `pnpm setup:dev --from <configured-development-checkout>` after installing dependencies. Never apply this migration over QA, Preview, or production profiles. Git carries setup code, not private files.
- Root `.env.local` remains the development Convex target selector. App injection does not sync Convex environment variables, deploy backend code, change production configuration, or alter isolated QA/Preview profiles. Those operations need their existing target checks and authorization.

## Tenant theme tokens

- School-facing UI accepts only `primaryColor` and `accentColor`; derive all other tenant branding through `@school/shared/theme`.
- Do not use tenant branding to replace status (`success`, `warning`, `error`, `info`) or grade-policy colours. These are domain semantics.
- Use `--school-*-contrast` for text on a branded fill and preserve white paper plus readable/monochrome rules in print surfaces.
- Static Sites data is an explicitly published configuration seam, not a live Admin or private Convex source. Do not imply an Admin save has synchronized it.
- For touched school-facing files, run `node scripts/audit-theme-colors.mjs`. It is informational: classify direct colours as tenant, semantic status/grade, product neutral, or print-only; do not perform global replacements.

## Browser verification

For feature/UI testing, isolated QA startup, or review evidence, read [verify-melo](.agents/skills/verify-melo/SKILL.md). Verify the affected feature's acceptance criteria through real user paths and retain evidence; baseline smoke checks alone are partial coverage. Use its authority and exact-target maintenance procedure for the isolated backend.

## Preview integration

Before merging into `preview`, deploying its backend, or claiming a Preview feature is tested, read [the Preview testing and branch workflow](docs/testing/PreviewWorkflow.md). The synthetic QA backend and copied-data Preview have different write permissions. Keep `_w/preview-env` and its private rollback archives; an app loading there is not permission to test outbound or payment paths. A later merge to `master` needs its own reviewed scope and Production deployment approval.

## Environment and checkout safety

- Before editing, switching branches, merging, or cleaning, check the actual checkout and branch, linked worktrees, and live remote refs. Historical branch names and SHAs in docs are not current state. Inspect untracked and ignored files, especially local settings and rollback archives, before moving or removing a worktree. Confirm the Vercel environment and the Convex cloud/site target separately before a deployment or data operation; an env filename or existing login does not prove authority.
- Synthetic QA has [standing, scoped authority](docs/testing/AgentQaAuthority.md) for test data and exact-target maintenance on its isolated backend. Follow the [QA procedure](docs/testing/AgentQa.md); verify the target and use test-only provider safeguards. That approval does not transfer to any other environment.
- Copied-data Preview is read-only by default. Backend, schema, or data writes and outbound/provider actions need their own exact-target review, approval, and recovery plan. Copied contacts are not test recipients.
- Normal Development and Production are separate from QA and Preview. Do not borrow QA credentials or approval. Get explicit approval and confirm the target before changing their backend, data, environment settings, or deployments.

## PR merge and release flow

For any PR work, load and use the `babysit-pr` skill by default unless the user explicitly opts out. Use its check and review monitoring, comment triage, and limited review rounds; it does not authorize a merge or deployment. This repository's ignored-build rule cancels Git builds on branches other than `master` and `preview`, so verify actual Vercel results instead of assuming the skill's initial or final PR preview commits built anything. Do not add empty commits just to chase a preview that this rule will cancel.

1. **Choose the target before branching.** Default every new PR to `preview`. Target `master` or another branch only when the user explicitly asks, including a separately approved Production promotion. Check the live refs, the current worktree, and the exact commits in the proposed PR; branch names and SHAs in older handoffs are history, not live state. If the bases have diverged, bring only the reviewed feature commits onto a branch from the current target; do not pull unrelated `master` or Preview history into the PR. A deliberate branch reconciliation must preserve both histories through reviewed merges and fast-forwards, never a force-push. Preserve other worktrees, ignored settings, and rollback archives.
2. **Validate the release input.** Review the diff and run affected tests, typechecks, lint, and `git diff --check`. Before a Production frontend release, run the actual build for each app being released with safe representative environment values, or report the gap before approval. `tsc` and passing PR Vercel checks do not prove a Next.js production build succeeds. Check backend/schema compatibility and provider or data-write effects separately; a frontend merge never deploys Convex.
3. **Work through the PR review.** Request the Codex Code Reviewer on each PR. If GitHub Codex has not already started a review, comment `@codex review`; do not duplicate an active review. If Codex is unavailable, tell the user rather than silently substituting another reviewer. Wait for its findings and required CI against the latest PR head. Treat comments as leads, not automatic scope expansion. Fix confirmed defects on the same PR branch, rerun the relevant checks, reply to and resolve addressed threads, and request a fresh review if the earlier one covered an old head. Keep any additional reviewer read-only even if its tool runtime needs full access to run commands. When GitHub permissions allow, react `+1` to a model review comment with a confirmed useful finding and `-1` to a verified false positive. Check the current code first; reply in the same thread with the fix commit or the reason for rejecting it, then resolve only when the disposition is clear. Reactions do not replace replies or justify automatic edits. If reactions are unavailable, report that rather than implying they were posted. Do not merge with an unresolved blocking defect or failed required check.
4. **Decide the build effect before merging.** A qualifying commit on `master` or `preview` without `[skip vercel]` triggers builds for all seven Git-linked Vercel apps, not just the app changed in the PR. When no frontend build is intended, put `[skip vercel]` in the final merge commit message; a skipped commit can still produce `CANCELED` Vercel records. Manual Git-source deployment of that same commit, even with `forceNew`, also runs the ignored-build rule and is canceled. To build later, get approval for a new commit without the marker, even if its tree is identical. Do not silently change a project's ignored-build settings; deployment `projectSettings` overrides can persist.
5. **Promote in separate steps.** Preview merge, its Vercel builds, any exact-target Preview Convex deployment, and role-specific browser acceptance are distinct checks. Copied-data Preview is not synthetic QA; outbound, payment, upload, admissions, and provider writes need their own safeguards and approval. A later Production change gets its own PR to `master` containing only reviewed commits and explicit approval for Production build effects. Do not infer runtime parity from matching Git refs or deploy Production Convex code because a frontend PR merged.
6. **Verify after the merge.** Confirm the merge tree and remote branch head, then advance only the intended local worktree. Record the previous live deployment IDs for rollback. For every requested frontend build, check the source SHA, `READY` state, and Production or Preview domain alias; compare basic routes with the pre-release baseline. A healthy page is not proof of sign-in, roles, school-specific Apply, Sites publication, or backend compatibility. If one build fails, stop further release actions, leave its previous live alias in place, and fix it through another reviewed change. Merging that fix without the marker starts all seven builds again, so agree on that effect first.

Direct pushes to `preview` or `master` are exceptions: require an explicit request, show the exact diff or unchanged release tree for approval before committing or pushing, and push without force. A tree-identical release commit without the skip marker deliberately starts all seven builds. For a docs-only Preview push with no requested build, use the skip marker and verify the branch and deployment effects afterward. Do not create a PR when the owner explicitly asks for this direct-push exception.
