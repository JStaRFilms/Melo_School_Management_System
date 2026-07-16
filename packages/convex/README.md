# Convex Package

This package contains the Convex backend configuration and functions for the School Management System.

## Setup

### 1. Install workspace dependencies

From the monorepo root:

```bash
pnpm install
```

The repo root owns the Convex CLI dependency and `convex.json`.

### 2. Initialize or reconnect the live Convex project

From the monorepo root:

```bash
pnpm convex:dev --once
```

This will:
- create or reconnect a Convex project
- generate real files in `packages/convex/_generated`
- write `CONVEX_DEPLOYMENT`, `CONVEX_URL`, and `CONVEX_SITE_URL` to the repo root `.env.local`

If you already have a deployment selected, you can rerun codegen with:

```bash
pnpm convex:codegen
```

Important:
- run Convex CLI commands from the repo root so `convex.json` can point at `packages/convex`
- `packages/convex` package scripts proxy back to the repo root for this reason
- `T12` is not complete unless `pnpm convex:dev --once` or `pnpm convex:codegen` succeeds against a real deployment

### 3. Configure app environment variables

Copy the app env templates:

```bash
cp apps/teacher/.env.example apps/teacher/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Then copy the `CONVEX_URL` value from the repo root `.env.local` into:
- `apps/teacher/.env.local` as `NEXT_PUBLIC_CONVEX_URL`
- `apps/admin/.env.local` as `NEXT_PUBLIC_CONVEX_URL`

Also copy `CONVEX_SITE_URL` from the repo root `.env.local` into `NEXT_PUBLIC_CONVEX_SITE_URL` for each app.

Then set `BETTER_AUTH_SECRET`, `SITE_URL`, and `TRUSTED_ORIGINS` for each app.

Production note:
- `SITE_URL` must be the real deployed URL for that specific app, not `localhost`
- `TRUSTED_ORIGINS` should include the real admin and teacher origins that are allowed to share auth flows
- use the same `BETTER_AUTH_SECRET` across the admin app, teacher app, and Convex deployment
- if you deploy admin and teacher as separate Vercel projects, make sure each public domain is attached to the matching project root (`apps/admin` vs `apps/teacher`)
- after any `BETTER_AUTH_SECRET` change, rotate the Better Auth keys and set the returned value as the Convex `JWKS` env:

```bash
pnpm exec convex run functions/auth:rotateKeysForStaticConfig
pnpm exec convex env set JWKS '<paste-the-json-string-returned-above>'
```

- once `JWKS` is set, both `packages/convex/auth.config.ts` and the Better Auth Convex plugin will use the static key set instead of the database row

### 4. Start development

```bash
pnpm dev
```

Or just the Convex sync loop:

```bash
pnpm convex:dev
```

## Demo-school reset and population

`demo:seed` is an **operator-only, destructive reset** for the single tenant whose
slug is `demo-school`. It does not deploy, run `convex dev`, call AI providers, or
create gateway payment attempts. Do not run it against an environment you have not
identified.

1. Set non-public `DEMO_SEED_OPERATOR_TOKEN`, `DEMO_SEED_DEPLOYMENT_IDENTITY`, and
   `DEMO_SEED_DEPLOYMENT_ENV` (`development`, `preview`, or `production`) in the
   target Convex environment. The caller must supply exactly the same identity and
   environment; this is deliberately not inferred from `NODE_ENV`.
2. Identify the target deployment independently, then pass the confirmation and
   target fields as one JSON argument to `pnpm demo:seed`. The Playwright setup uses
   `execFileSync` for this so the command is cross-platform. This mutates data and
   is not part of normal setup.
3. Production additionally requires `DEMO_SEED_ALLOW_PRODUCTION=true` in that
   deployment and `productionConfirmation: "RESET demo-school IN PRODUCTION"`.

   The runner preflights and reconciles the three Better Auth accounts through its
   internal adapter before deleting data. It rejects an ID/email linked to a
   non-demo tenant or platform admin, resets credentials and sessions, and never
   sends auth requests to a hard-coded localhost origin. Deletion is child-first,
   bounded, and records storage IDs in a durable cleanup ledger before database
   rows are removed; a failed storage deletion is retried on the next run. Population
   is persisted in `demoSeedRuns` and proceeds through foundation, 12-student,
   6-student assessment/history, 12-student billing, and knowledge/final-validation
   phases. A failed run is marked failed; the next confirmed operator run resets its
   partial demo tenant before starting over. It returns emails and counts only; it
   never returns passwords.

The intentionally public local-demo credentials are:

| Workspace | Email | Password |
| --- | --- | --- |
| Admin | `admin@demo-academy.school` | `Admin123!Pass` |
| Teacher | `teacher@demo-academy.school` | `Teacher123!Pass` |
| Parent portal | `parent@demo-academy.school` | `Portal123!Pass` |

The reset creates 36 students across three classes, complete assessment records
for all three terms plus cumulative term history, report-card attendance/comments/extras,
families, manual-only billing, events,
reviewed knowledge materials, a saved lesson plan, and a teacher assessment bank.
It intentionally leaves `schoolPaymentProviderSecrets`, payment gateway events and
attempts, OCR jobs, AI run logs, and rate-limit counters empty. School branding and portraits are deterministic local **PNG** raster artwork generated by
`functions/academic/demoAssets.ts`: polished synthetic illustrated portraits with
varied deterministic features, not photorealistic photos of real people. They remain
pending optional licensed photo/brand asset replacement. No real-person or remote image asset is used.

If an interrupted run leaves partial data, rerun the same confirmed command. Asset
uploads that fail before database attachment are deleted immediately; cleanup IDs
survive a failed delete for retry.

### Playwright environment

Playwright's global setup intentionally performs the same destructive `demo-school`
reset. Local shells and CI must provide these values to the Playwright process:

- `DEMO_SEED_OPERATOR_TOKEN` — the non-public value configured on the target Convex deployment
- `DEMO_SEED_DEPLOYMENT_IDENTITY` — the verified deployment name
- `DEMO_SEED_DEPLOYMENT_ENV` — `development` or `preview` for normal E2E runs

Never configure production E2E implicitly. A production run also requires an
independently supplied `DEMO_SEED_PRODUCTION_CONFIRMATION` equal to
`RESET demo-school IN PRODUCTION`, in addition to the server-side production gate.
Store tokens in the CI secret manager rather than `.env` files or source control.
The global setup invokes the resolved local Convex CLI through Node so JSON arguments
remain cross-platform.

## Project Structure

```text
packages/convex/
|-- _generated/        # Auto-generated Convex types and API
|-- functions/         # Academic and auth functions
|-- auth.config.ts
|-- betterAuth.ts
|-- convex.config.ts
|-- http.ts
|-- schema.ts
`-- package.json
```

## Available Scripts

From the repo root:
- `pnpm convex:dev`
- `pnpm convex:deploy`
- `pnpm convex:codegen`

From `packages/convex`:
- `pnpm convex:dev`
- `pnpm convex:deploy`
- `pnpm convex:codegen`

Those package-level scripts route back to the repo root automatically.

## Environment Variables

### Repo root `.env.local`

- `CONVEX_DEPLOYMENT`
- `CONVEX_URL`
- `CONVEX_SITE_URL`

### App `.env.local`

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `BETTER_AUTH_SECRET`
- `SITE_URL`
- `TRUSTED_ORIGINS`

## Troubleshooting

### Real codegen is not updating `packages/convex/_generated`

Run:

```bash
pnpm convex:codegen
```

If that fails, confirm the repo root `.env.local` contains `CONVEX_DEPLOYMENT`.

### Live mode is not activating in admin or teacher

1. Confirm `NEXT_PUBLIC_CONVEX_URL` is set in the app's `.env.local`
2. Restart the app dev server
3. Confirm the repo root `.env.local` and app `.env.local` point to the same deployment URL

### Preview mode still appears

If `NEXT_PUBLIC_CONVEX_URL` is missing, the apps intentionally stay in preview mode with mock data.
