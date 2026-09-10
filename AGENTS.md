<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `packages\convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Tenant theme tokens

- School-facing UI accepts only `primaryColor` and `accentColor`; derive all other tenant branding through `@school/shared/theme`.
- Do not use tenant branding to replace status (`success`, `warning`, `error`, `info`) or grade-policy colours. These are domain semantics.
- Use `--school-*-contrast` for text on a branded fill and preserve white paper plus readable/monochrome rules in print surfaces.
- Static Sites data is an explicitly published configuration seam, not a live Admin or private Convex source. Do not imply an Admin save has synchronized it.
- For touched school-facing files, run `node scripts/audit-theme-colors.mjs`. It is informational: classify direct colours as tenant, semantic status/grade, product neutral, or print-only; do not perform global replacements.
