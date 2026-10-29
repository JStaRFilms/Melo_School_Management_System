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
