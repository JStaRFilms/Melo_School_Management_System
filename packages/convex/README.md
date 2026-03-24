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

### 4. Start development

```bash
pnpm dev
```

Or just the Convex sync loop:

```bash
pnpm convex:dev
```

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
