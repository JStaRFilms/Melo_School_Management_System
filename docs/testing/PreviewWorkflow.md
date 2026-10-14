# Preview testing and branch workflow

Use this for Melo's copied-data Preview environment. For synthetic, writable QA on `content-poodle-172`, use [Agent QA](AgentQa.md) and the [verify-melo skill](../../.agents/skills/verify-melo/SKILL.md) instead. The standing QA approval does not authorize writes to Preview, normal development, or Production. The Preview sign-ins recorded below are limited browser checks, not full feature acceptance. See the [public status and open work](PreviewStatus.md) for the current follow-ups.

## Keep the checkouts separate

| Checkout | Branch and purpose |
| --- | --- |
| Repository root | Currently `chore/production-env-handoff`, with unrelated uncommitted work. It is **not** the Preview checkout or a safe place to switch to `master`. |
| `_w/preview-env` | Persistent `preview` integration checkout. Its ignored settings select Preview `expert-giraffe-253`; its ignored, encrypted rollback archives live under `tmp/preview-snapshots/`. Keep this worktree. |
| `_w/production-auth-hotfix` | Separate `fix/production-auth-key-rotation` checkout. Do not rewrite or merge it casually. |
| A new feature worktree | One branch per independent piece of work, based on current `master` for a standalone Production change or on `preview` when it depends on Preview-only code. Name and check the base explicitly. |

`git worktree list` shows which branch belongs to each directory. Worktrees share Git history, not uncommitted files, ignored configuration, database contents, or deployment state. Do not copy secrets into a new checkout by default. Do not delete `_w/preview-env`, its branch, or its private archives merely because one test passed. Remove a feature worktree only after its work is integrated or deliberately abandoned and its untracked and ignored files have been reviewed.

`master` is the Production source branch; `preview` is an integration branch, not Production. At the 2026-10-14 pre-integration check, remote `master` was `d825229` and remote `preview` was `9a03865`: master had 26 commits not in preview, while preview had one commit not in master. Both refs advanced afterward. Fetch and reassess before using either count. Do not merge either whole branch into the other on autopilot. A normal merge of a feature based on newer `master` into older `preview` also brings master's other commits. A normal merge of a feature based on `preview` into `master` can bring Preview-only commits. Move only the feature commits across that boundary unless the whole base advance has its own review. [Reconcile the branches](https://github.com/JStaRFilms/Melo_School_Management_System/issues/111) once through a reviewed integration before assuming a teammate's master-based branch can target Preview directly.

## Configuration and recovery

Vercel holds frontend environment variables per project and environment or branch. Convex holds backend variables per deployment. A frontend Git build does not deploy Convex functions, schema, or backend variables. Keep only variable names and safe defaults in versioned `.example` files. Use an organization-controlled secrets manager for credentials, access and rotation instructions, and separate encrypted storage for recoverable backups.

Ignored local `.env*.local` profiles and rollback archives are not saved by Git or automatically recovered from Vercel or Convex. Before deleting a worktree, inventory its ignored and untracked files, preserve private profiles and backups through an approved channel, and verify recovery. Windows CurrentUser DPAPI archives also need the original Windows profile to decrypt. Do not put secret values, copied records or private backups in commits, PRs or issues.

## Bring a change to Preview

1. Work on a feature branch in its own checkout. Read that checkout's `AGENTS.md` and the affected feature's acceptance criteria. Review the changed code and run focused tests, typecheck, lint, and `git diff --check`. For school-facing files, run `node scripts/audit-theme-colors.mjs` and classify flagged colours by purpose.
2. Review the feature branch against current `preview` before merging. Check conflicts, backend/schema compatibility with the copied data, deployment settings, and whether the code enables email, payments, AI, application submissions, file uploads, or Sites-provider writes. Do not silently deploy a newer backend to make a frontend pass.
3. If the feature branch was based on `preview`, merge its reviewed changes back into `preview`. If it was based on `master`, cherry-pick only its feature commits onto a short branch based on current `preview`, then review and merge that branch. Re-run the affected checks there. A commit on another branch does not enter the Preview worktree by itself.
4. Before any Preview backend change, confirm the effective cloud and site URLs are `expert-giraffe-253.eu-west-1.convex.cloud` and `.convex.site`, check permissions and schema/data risk, take an encrypted rollback backup when data may change, and get the required approval. The ignored `.env.staging.local` is a selector, not proof of access scope; never add `--prod`. Do not copy Production runtime secrets or enable a broad legacy identity fallback.
5. Confirm the Git-triggered build rule on the seven linked Vercel projects before pushing. Their intended rule builds eligible `master` and `preview` commits unless the message includes `[skip vercel]`. A skipped push can still create `CANCELED` provider records. The separate `melo-sites-preview` project is not Git-linked; publishing Sites there is a separate action. Verify deployment IDs, branch bindings, backend URL and SSO after any build.
6. Test the specific changed behavior and keep a short result with the source commit, deployed revision if known, backend target, app origin, role, steps, expected and actual outcomes, request ID for failures, and any data side effects. Do not claim a backend revision is attested merely because the frontend built. Fix confirmed regressions on the feature branch, review again, and repeat the targeted Preview test before promoting code toward `master`.

Do not use `pnpm qa:*` against copied-data Preview. That runner and its three attested app origins target the synthetic QA deployment; its read/write authority and fixture assumptions do not transfer to Preview.

## What to test and what a pass means

| Layer | Check | Limit of the result |
| --- | --- | --- |
| Routing and isolation | Check all eight Preview hosts' SSO redirect and expected Vercel alias; verify the browser connects to the Preview Convex cloud. Try only approved, bounded unauthenticated queries and routes. | Vercel SSO protects the website, **not** Convex cloud or site endpoints. A redirect or `READY` build is not app authorization. |
| Real sign-in | Use the reviewed account for Admin, Parent Portal, or Platform. Check the actual landing page and an authorized read-only path; record loading/error/denied states. | These three landing pages opened after the 2026-10-14 account repairs. Teacher opened with the Admin account; Teacher-role features remain unverified. A simulated server identity query is not a browser sign-in. |
| Feature acceptance | Test each affected entry point, correct role and denial, success, validation, cancel, empty/loading/error, reload persistence and relevant mobile/keyboard behavior. If data writes are required, use synthetic QA unless the copied-data Preview effect has been separately reviewed and approved. | One passing screen does not cover unrelated workflows or a different role. Preserve failure evidence and identify skipped criteria. |
| Apply and Sites | Apply begins at `/s/[schoolSlug]`, not `/`. Sites and school pages require explicit published Preview configuration. | A 404 at Apply `/` or "School website unavailable" does not alone prove an admissions or runtime defect. No Sites publication acceptance has passed. |
| Outbound and provider paths | Before email, SMS, AI, payments, admissions submissions, uploads, or Sites-provider writes, review recipient/fixture isolation, keys, spending limit, provider mode and rollback. Paystack must be proven in TEST mode with Preview-compatible configuration. | Copied Production contacts and encrypted provider rows are **not** permission to send, charge, publish, or exercise real student records. Mark these blocked until the safeguards are established. |

Keep login passwords, cookies, tokens, raw browser logs, trace ZIPs, backups and copied records private. Vendor URLs and request logs can carry credentials. Share only redacted outcomes and reviewed screenshots, using the evidence rules in [Agent QA](AgentQa.md) for synthetic QA runs.

## Before `master`

Treat release as a separate review. If the tested feature came from a Preview-based branch, move only its reviewed commits onto a fresh branch from current `master`; do not PR its Preview ancestry wholesale. Compare the exact proposed commit set against current `master`, verify feature and role acceptance, schema/data migration and rollback, provider safety, runtime settings, and Production build effects. The separate Production key-rotation hotfix was merged into `master` at `f55d2f6` with `[skip vercel]`; the merged source declares `rotateKeysForStaticConfig` internal. This Git merge did not deploy Convex. Confirm the function remains internal in any future Production backend source. Do not deploy a new backend merely because Git source was merged, and do not assume a merge only affects one function. Require explicit approval and an exact Production target for a deployment or Production data change.
