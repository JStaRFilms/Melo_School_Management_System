# Infisical for local app development

## Goal and scope

Use Infisical as the default configuration source for local Melo apps. Leave production, build/start commands, remote Convex settings, isolated QA profiles, and Preview worktree profiles unchanged.

## Components and data flow

1. The root `pnpm dev` command runs app dev tasks through Turbo. Individual `pnpm --filter @school/<app> dev` commands use the same launcher.
2. `scripts/infisical-dev.mjs` reads three bootstrap fields from ignored `.env.infisical.local` or the shell. Turbo passes these shell fields through for dev tasks only.
3. The launcher authenticates with Universal Auth and reads Infisical cloud environment `dev`, folder `/vercel-<app>`. It does not fetch `/shared`, `/convex`, other app folders, staging, or production.
4. Required app keys and Convex URLs are validated against the existing root development selector in `.env.local`. A failed fetch or mismatch stops startup without falling back to cached values.
5. A separate Next.js dev process receives that app's values. Bootstrap credentials are removed before launch. Secret values are not written to disk or logged. Restart the app to refresh its snapshot.

Normal startup refuses app development dotenv files so Next cannot silently fill missing configuration from old files. The explicit `dev:local` scripts retain the previous manual startup behavior. Production `build` and `start` scripts do not use the launcher.

## Client and server boundaries

Only `NEXT_PUBLIC_*` values are intended for browser bundles. Other fetched values remain in the app's server process. Convex-hosted actions still use their existing Convex environment, including AI and email credentials. This change does not synchronize those values. Sites data remains an explicitly published configuration source.

## Repeatable setup

`pnpm setup:dev` creates a private bootstrap template when credentials are missing. After the user supplies credentials privately, it reads the `dev` Admin folder and derives a local `dev:<deployment>` selector from matching hosted cloud/site URLs, including regional URLs. It never runs Convex commands. Existing root selectors must agree exactly or setup stops without replacing them.

`pnpm setup:dev --from <configured-checkout>` imports only bootstrap fields from an existing checkout when the destination has none. Existing bootstrap files win. After validating all seven app folders, setup preflights every legacy app dotenv value before moving any file into the private archive. A mismatch stops archiving rather than discarding overrides. A failure may leave newly created bootstrap/selector files in place; rerunning retains them.

Fresh clones and worktrees need the integration in their selected Git branch, a dependency installation, and this local setup. Credentials and archives never travel through Git. Protected QA/Preview/production targets retain their own profiles and manual startup.

## Local migration and rollback

Bootstrap credentials stay in `.env.infisical.local`. Existing app `.env.local` files move into a timestamped private directory under ignored `tmp/local-env-archive/`, preserving original relative paths. Root `.env.local` and profiles in other worktrees remain in place. No old credentials are revoked by this migration.

To roll back locally, restore the app files to their original paths and use `pnpm dev:local`, or use an individual app's `dev:local`. Do not use the normal `dev` command with restored dotenv files. The archive contains secrets and must never be committed or published.

## Limits and verification

The current identity reads the entire Infisical project. The hardcoded `dev` request is not a provider-enforced permission boundary. A leaked pair can access production secrets even though the launcher does not request them.

`pnpm test:infisical` covers app-value precedence, credential removal, required fields, target mismatch, the dev-only request path, and redacted provider failure. `node scripts/infisical-dev.mjs <app> --check` verifies live authentication, retrieval, and target agreement without starting a server. These checks do not prove payment, email, AI, or authenticated user workflows.

### Verification on 2026-10-29

- All seven live app-folder checks matched the root development target.
- All seven package dev commands reached Next.js through the launcher.
- All seven servers became ready. Anonymous root requests returned 200 for WWW, Teacher, Admin, and Portal, 307 for Platform's sign-in redirect, and 404 for Apply and Sites. Apply has no root page; Sites had no configured local published host. These 404s are not proof of working admissions or published-site journeys.
- Three launcher tests, focused ESLint, `git diff --check`, and the informational theme audit passed. No theme colors were changed.
- Six existing app env files were checked against Infisical and archived byte-for-byte in ignored `tmp/local-env-archive/2026-10-29T04-39-44-287Z/`. All test servers were stopped and their ports released. Private startup evidence is retained under ignored `tmp/infisical-proof/`.

No authenticated, payment, outbound email, AI-generation, or backend-write workflows were exercised.

## Database schema

No changes.
