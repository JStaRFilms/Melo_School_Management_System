# School Management System

A multi-tenant school management platform for academic administration, teacher workflows, parent/student portals, public school sites, billing, and AI-assisted lesson planning. The project is a pnpm/Turborepo monorepo with Next.js apps and a Convex backend.

<details>
<summary>🚀 <b>OpenAI Build Week Submission: Melo Curriculum Intelligence</b> (Click to expand)</summary>

<br/>

## OpenAI Build Week Submission

### Melo Curriculum Intelligence

Melo Curriculum Intelligence turns an indexed school scheme of work into evidence-backed weekly curriculum proposals. Administrators review, edit, reject, or approve each proposed unit before it becomes an academic topic inside Melo’s existing teacher-planning system.

The feature includes:

- Weekly curriculum-unit extraction
- Learning objectives and source-page evidence
- Human administrative review and approval
- Approved topics connected to existing teacher workflows
- Curriculum Readiness reporting from real lesson, assessment, and publication records

### How GPT-5.6 was used

GPT-5.6 Terra is used through OpenRouter for curriculum extraction.

It interprets inconsistent scheme-of-work documents and proposes schema-constrained curriculum units containing:

- Week numbers
- Topic titles
- Subtopics
- Learning objectives
- Suggested durations
- Supporting excerpts
- Source-page citations
- Confidence scores

GPT-5.6 does not directly create authoritative school data. Deterministic application code validates academic context, evidence, duplicate topics, permissions, and source compatibility. An administrator must approve each unit before Melo creates or links an academic topic.

### How Codex was used

Codex was used throughout the Build Week implementation to:

- Inspect the existing multi-app Melo monorepo
- Design the curriculum-import architecture
- Integrate the feature with existing knowledge topics and teacher planning
- Implement the Convex schema, actions, queries, and mutations
- Build the admin review and Curriculum Readiness interfaces
- Write focused validation, authorization, seed, and integration tests
- Debug production-shaped source evidence and citation failures
- Prepare and verify the judge demo tenant
- Support deployment and submission documentation

### Technology

- GPT-5.6 Terra through OpenRouter
- OpenAI Codex
- Next.js
- React
- TypeScript
- Convex
- Vercel AI SDK
- Tailwind CSS
- Zod
- Vitest
- Playwright

</details>

## What is included

- **Marketing website** (`apps/www`, port `3000`) - public product website.
- **Teacher app** (`apps/teacher`, port `3001`) - lesson planning, assessments, enrollment, and AI-assisted teacher workflows.
- **Admin app** (`apps/admin`, port `3002`) - school operations, academics, billing, report cards, admissions campaigns, and administrative controls.
- **Portal app** (`apps/portal`, port `3003`) - parent/student-facing portal experience.
- **Apply app** (`apps/apply`, port `3004`) - public guardian-facing admissions application by school slug (`app/s/[schoolSlug]`).
- **Public sites app** (`apps/sites`, port `3005`) - managed public school sites and SEO routes.
- **Platform app** (`apps/platform`, port `3006`) - platform/super-admin school management.
- **Convex backend** (`packages/convex`) - schema, functions, auth integration, billing, portal, and HTTP endpoints.
- **Shared packages** (`packages/auth`, `packages/shared`, `packages/ai`) - shared auth, types/utilities, and AI model helpers.

## Tech stack

- **Package manager:** pnpm `10.33.2`
- **Monorepo:** Turborepo
- **Frontend:** Next.js `16`, React `18`, TypeScript
- **Styling:** Tailwind CSS
- **Backend/database:** Convex
- **Auth:** Better Auth with `@convex-dev/better-auth`
- **Testing:** Vitest, Testing Library, Playwright
- **AI:** OpenRouter via the AI SDK, executed inside native Convex actions in `@school/convex`

## Prerequisites

- Node.js 20.12+ or 22+.
- pnpm 10+
- A Convex account/deployment for live backend mode
- Optional: OpenRouter API key for AI lesson-planning features

## Quick start

```bash
pnpm install
pnpm setup:dev
# On first use, fill the generated .env.infisical.local privately, then rerun:
pnpm setup:dev
pnpm dev
```

Then open the app you need:

| App | URL |
| --- | --- |
| Marketing website | <http://localhost:3100> |
| Teacher app | <http://localhost:3101> |
| Admin app | <http://localhost:3102> |
| Portal app | <http://localhost:3103> |
| Apply app | <http://localhost:3104> |
| Public sites app | <http://localhost:3105> |
| Platform app | <http://localhost:3106> |

## Environment setup

Local app development uses Infisical. Production hosting settings, builds, deployments, and remote Convex environment settings are unchanged. Convex functions still read their variables from Convex, not from the local launcher.

### Infisical, the default local setup

- Store only `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, and `INFISICAL_PROJECT_ID` in ignored `.env.infisical.local`, or supply them through the shell. Never put them in `NEXT_PUBLIC_*` variables.
- Keep root `.env.local` for the existing development Convex selector and URLs. The launcher requires `CONVEX_DEPLOYMENT=dev:...`, `CONVEX_URL`, and the matching `CONVEX_SITE_URL`. It does not run Convex sync or change backend settings.
- `pnpm dev` and `pnpm --filter @school/admin dev` fetch only the selected app's `/vercel-<app>` folder in Infisical environment `dev`. Each app receives its own values through its process environment. The launcher removes Infisical credentials before starting Next.js. Restart to pick up secret changes.
- Fetch failures, incomplete authenticated-app settings, and Convex URL mismatches stop startup. There is no automatic fallback to old env files. The `/shared` and `/convex` folders are not injected into apps. Sites configuration remains explicitly published data, not a live private Admin source.
- Archive app `.env`, `.env.local`, `.env.development`, and `.env.development.local` files outside their app directories in an ignored private location before normal startup. Otherwise Next.js could load stale settings. The launcher refuses these files. `--check` validates the Infisical fetch without launching Next or checking for legacy files:

  ```bash
  node scripts/infisical-dev.mjs admin --check
  pnpm test:infisical
  ```

The initial migration archive is under ignored `tmp/local-env-archive/`. Treat it as secret material. Keep it private and never stage it. Root `.env.local`, QA profiles, and Preview worktree profiles are not archived by this migration.

The current identity has project-wide read access, including production. Fetching only `dev` is a launcher restriction, not an Infisical permission boundary. Do not distribute this credential as if it were dev-only. Startup needs Infisical connectivity, but a running app does not continually fetch secrets.

### New worktrees and new PCs

The integration must be committed on the branch you check out. Git carries the scripts and documentation, never the bootstrap credentials or local env archives.

On a new PC, install Node and pnpm, clone the repository, check out a branch containing this integration, then follow Quick start. Supply the three bootstrap values privately on that PC. `pnpm setup:dev` fetches the development Admin folder and creates an ignored root development selector when absent. It does not authenticate the Convex CLI, run a deployment, or configure remote variables. The selector is derived from Infisical `dev` URLs; that is not independent proof of which backend an Infisical administrator intended.

For another ordinary development worktree on the same PC:

```bash
pnpm install --frozen-lockfile
pnpm setup:dev --from /absolute/path/to/configured-development-checkout
pnpm dev
```

`--from` reads the existing checkout's bootstrap credentials without printing them. Setup retains existing bootstrap files and refuses a different root backend selector. It checks all seven folders before archiving app dotenv files, and refuses to archive any file whose values differ from Infisical. No files in the source checkout are changed. Rerunning setup after a partial failure is safe; already-created local bootstrap or selector files are retained.

Do not run this development migration over QA, Preview, or production profiles. They have separate targets and authority. Their existing manual startup remains available through `dev:local` on branches containing the integration. New worktrees inherit code only from their selected base branch; pulling a different branch does not automatically propagate this change.

### Manual local fallback

Infisical is the default. For deliberate offline/manual use, restore the archived app env files to their original paths or copy `.env.example` files, then run `pnpm dev:local` or `pnpm --filter @school/admin dev:local`. This bypasses Infisical. Do not restore old files and expect the normal `dev` command to accept them.

For a fresh manual setup, Convex is configured from the monorepo root through `convex.json`, with backend functions in `packages/convex`. Verify the target before any Convex sync or environment changes. These manual steps are not part of the Infisical migration.

1. Start or reconnect Convex and generate backend types:

   ```bash
   pnpm convex:dev --once
   ```

2. Copy app env files as needed:

   ```bash
   cp apps/teacher/.env.example apps/teacher/.env.local
   cp apps/admin/.env.example apps/admin/.env.local
   cp apps/portal/.env.example apps/portal/.env.local
   cp apps/apply/.env.example apps/apply/.env.local
   cp apps/platform/.env.example apps/platform/.env.local
   ```

3. Copy the generated Convex values from the repo root `.env.local` into each app `.env.local`:

   - `CONVEX_URL` -> `NEXT_PUBLIC_CONVEX_URL`
   - `CONVEX_SITE_URL` -> `NEXT_PUBLIC_CONVEX_SITE_URL`

4. Set the same `BETTER_AUTH_SECRET` across the authenticated apps and Convex deployment.

5. For teacher AI features (lesson plan, student note, assignment, question bank, and CBT draft generation), set the OpenRouter variables on the **Convex deployment** (these are read by the Convex action runtime, not by the Next.js apps):

   ```bash
   npx convex env set OPENROUTER_API_KEY "your-openrouter-api-key"
   npx convex env set OPENROUTER_HTTP_REFERER "http://localhost:3001"
   npx convex env set OPENROUTER_APP_TITLE "School Management System Teacher"
   ```

   Optional per-output model overrides (defaults are baked into `@school/ai`):

   ```bash
   npx convex env set SCHOOL_AI_LESSON_PLAN_MODEL "openai/gpt-oss-120b:free"
   npx convex env set SCHOOL_AI_STUDENT_NOTE_MODEL "openai/gpt-oss-120b:free"
   npx convex env set SCHOOL_AI_ASSIGNMENT_MODEL "openai/gpt-oss-120b:free"
   npx convex env set SCHOOL_AI_QUESTION_BANK_MODEL "openai/gpt-oss-120b:free"
   npx convex env set SCHOOL_AI_CBT_MODEL "openai/gpt-oss-120b:free"
   ```

   You no longer need to copy `OPENROUTER_API_KEY` or `SCHOOL_AI_*` into `apps/teacher/.env.local` — the AI generation now runs entirely on the Convex backend via `useAction(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft)` and `useAction(api.functions.academic.documentGeneration.generateTeacherAssessmentDraft)`.

If `NEXT_PUBLIC_CONVEX_URL` is missing, apps may run in preview/mock-data mode instead of live Convex mode.

## Common commands

Run from the monorepo root:

```bash
pnpm dev                 # Start local apps with per-app Infisical injection
pnpm dev:local           # Explicit manual env-file fallback
pnpm setup:dev           # Validate/bootstrap local development and archive matching old envs
pnpm test:infisical      # Test local launcher and setup safety
pnpm build               # Build the workspace
pnpm lint                # Lint the workspace
pnpm typecheck           # Type-check the workspace
pnpm test                # Run unit tests
pnpm test:e2e            # Run Playwright tests
pnpm convex:dev          # Start Convex dev sync loop
pnpm convex:codegen      # Regenerate Convex API/types
pnpm convex:deploy       # Deploy Convex backend
```

Run one app directly:

```bash
pnpm --filter @school/teacher dev
pnpm --filter @school/admin dev
pnpm --filter @school/portal dev
pnpm --filter @school/apply dev
pnpm --filter @school/platform dev
pnpm --filter @school/www dev
pnpm --filter @school/sites dev
```

## Repository structure

```text
apps/
  admin/       School admin dashboard (includes app/admin/admissions)
  apply/       Public admissions application (app/s/[schoolSlug])
  platform/    Platform/super-admin app
  portal/      Parent/student portal
  sites/       Public school websites
  teacher/     Teacher workspace
  www/         Product marketing website
packages/
  ai/          AI model and generation helpers
  auth/        Shared authentication utilities
  convex/      Convex schema, functions, auth, and HTTP routes
  shared/      Shared types and utilities
docs/          Architecture decisions, feature notes, and design docs
e2e/           Playwright end-to-end tests
scripts/       Setup and maintenance scripts
```

## Documentation

Useful project docs live in `docs/`, including:

- `docs/Coding_Guidelines.md`
- `docs/decisions/` for architecture decision records
- `docs/features/` for feature-specific planning and implementation notes
- `packages/convex/README.md` for Convex-specific setup and troubleshooting

## Notes for contributors

- Run Convex commands from the repository root so `convex.json` can point at `packages/convex` correctly.
- Keep generated Convex files in sync with `pnpm convex:codegen` after backend changes.
- Use the app-specific ports listed above to avoid auth origin mismatches.
- When changing auth secrets or production origins, update all authenticated apps consistently.
