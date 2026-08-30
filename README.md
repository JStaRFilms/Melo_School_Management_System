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
- **Admin app** (`apps/admin`, port `3002`) - school operations, academics, billing, report cards, and administrative controls.
- **Portal app** (`apps/portal`, port `3003`) - parent/student-facing portal experience.
- **Platform app** (`apps/platform`, port `3004`) - platform/super-admin school management.
- **Public sites app** (`apps/sites`, port `3005`) - managed public school sites and SEO routes.
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

- Node.js 20+
- pnpm 10+
- A Convex account/deployment for live backend mode
- Optional: OpenRouter API key for AI lesson-planning features

## Quick start

```bash
pnpm install
pnpm convex:dev --once
pnpm dev
```

Then open the app you need:

| App | URL |
| --- | --- |
| Marketing website | <http://localhost:3000> |
| Teacher app | <http://localhost:3001> |
| Admin app | <http://localhost:3002> |
| Portal app | <http://localhost:3003> |
| Platform app | <http://localhost:3004> |
| Public sites app | <http://localhost:3005> |

## Environment setup

Convex is configured from the monorepo root through `convex.json`, with backend functions in `packages/convex`.

1. Start or reconnect Convex and generate backend types:

   ```bash
   pnpm convex:dev --once
   ```

2. Copy app env files as needed:

   ```bash
   cp apps/teacher/.env.example apps/teacher/.env.local
   cp apps/admin/.env.example apps/admin/.env.local
   cp apps/portal/.env.example apps/portal/.env.local
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
pnpm dev                 # Start all app/backend dev tasks through Turbo
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
pnpm --filter @school/platform dev
pnpm --filter @school/www dev
pnpm --filter @school/sites dev
```

## Repository structure

```text
apps/
  admin/       School admin dashboard
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
