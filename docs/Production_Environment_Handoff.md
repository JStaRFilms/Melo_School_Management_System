# Production environment setup handoff

## Task to continue

Continue the production environment audit and repair on the user's local computer. Finish Production first, then configure the shared Preview environment. The user will supply credentials locally in Git-ignored collection files. Read `AGENTS.md` and `docs/features/Production_Environment_Inventory.md` before acting. Read `packages/convex/_generated/ai/guidelines.md` before Convex work.

This document contains deployment identifiers and public URLs, not secret values. Do not ask the user to paste credentials into chat or commit filled environment files.

## Git and repository state at handoff creation

- Production branch is `master`, not `main`.
- Current local branch is `preview`, created from `master`.
- Current HEAD is `39018bb9`, `chore: restrict Vercel deployments to master and preview`.
- That commit adds `vercel.json` in all seven apps: Admin, Apply, Platform, Portal, Sites, Teacher, WWW.
- Each configuration disables Git deployments with `"**": false` and explicitly enables only `master` and `preview`.
- The previous agent has not pushed branches or modified live Vercel settings. Verify remote state before making assumptions.
- The inventory and two example templates are untracked at handoff creation. Include them and this document in a migration commit.
- Unrelated untracked `docs/tasks/orchestrator-sessions/*` folders are present on the original machine. They are not part of this environment task. Leave them alone.

A temporary branch such as `chore/production-env-handoff` can carry these commits to another computer without intentionally triggering a preview/production Git deployment. It inherits the restrictive app configurations. Manual deployment hooks or external CI should still be checked. Do not push `master` or `preview` as the migration mechanism while their deployment setup is unfinished.

## Convex cloud state

Project: `school-management-system`.

| Reference | Deployment name | Purpose |
| --- | --- | --- |
| `production` | `outgoing-warbler-782` | Existing live production, not modified in this task |
| `dev/ipinrere-oluleke-oke` | `scrupulous-chinchilla-25` | Existing local development target |
| `dev/melo-e2e-isolated-20260923` | `content-poodle-172` | Existing isolated agent/test target |
| `staging` | `expert-giraffe-253` | New persistent staging backend for the shared Git `preview` branch |

Staging was created with `pnpm exec convex deployment create staging --type prod`. Here the deployment type is persistent production-style infrastructure, but its role is staging. It was not made the default deployment.

Staging setup completed:

1. User set a fresh `BETTER_AUTH_SECRET` in the staging Convex dashboard.
2. Agent minted a staging-scoped deploy key named `melo-preview-staging`, saved only in `.env.staging.local` on the original computer with mode 0600.
3. Staging required `JWKS` to be defined for its first deployment. The agent bootstrapped an empty staging value, deployed, invoked `functions/auth:rotateKeysForStaticConfig` on staging, pinned fresh staging-only RS256 signing-key documents into `JWKS`, then redeployed.
4. Backend deployment and schema validation succeeded. Better Auth and rate-limiter components were installed.
5. The staging `/api/auth/convex/jwks` endpoint returned valid RSA public signing keys.
6. Only `BETTER_AUTH_SECRET` and `JWKS` were present in staging user environment settings when checked. Trusted origins, email, AI, payment, admissions origin, and fixtures are not configured yet.

Staging public endpoints:

```dotenv
NEXT_PUBLIC_CONVEX_URL=https://expert-giraffe-253.eu-west-1.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://expert-giraffe-253.eu-west-1.convex.site
```

The region segment matters. Earlier chat examples without it were corrected.

No production backend was deployed or reconfigured. No production records were copied. Local development `.env.local` files were left unchanged.

## Credentials and CLI behavior

- `.env.staging.local` is ignored and will not travel through Git. Either transfer it using a private secure channel or mint a new staging-only key after signing in on the new computer.
- Use the staging deployment name explicitly when minting a new key. The original machine used:

```bash
env -u CONVEX_DEPLOY_KEY pnpm dlx convex@latest deployment token create melo-preview-local --deployment expert-giraffe-253 --save-env .env.staging.local
chmod 600 .env.staging.local
```

- The pinned root Convex CLI was 1.34.1. It supports deployment creation but did not expose newer token management commands. The agent used `pnpm dlx convex@latest` only for token management without changing repository dependency versions.
- The actual staging deploy used:

```bash
env -u CONVEX_DEPLOY_KEY pnpm exec convex deploy --env-file .env.staging.local --codegen disable
```

- Verify the target before any deployment. Plain `convex deploy` defaults to production and is not a staging command.
- Do not rotate live auth secrets/JWKS or the billing encryption key during simple configuration cleanup. Plan those operations separately.
- The previous attempt to download the Vercel CLI timed out. No Vercel account or project configuration was changed. CLI login must be established on the new machine; do not assume original-machine authentication transfers.

## Production audit findings

Full detail and source references are in `docs/features/Production_Environment_Inventory.md`.

- Admin, Teacher, Portal, Platform, and Apply use the same production Convex cloud/site URLs.
- Admin optionally uses `NEXT_PUBLIC_APPLY_ORIGIN`.
- Platform needs an explicit production `NEXT_PUBLIC_PLATFORM_SITE_URL` to avoid localhost metadata.
- WWW uses `NEXT_PUBLIC_SITE_URL` and Resend contact-email settings.
- Sites currently consumes published static configuration, not live/private Convex or environment variables.
- Auth secrets, trusted origins, AI keys/model settings, backend email settings, admissions origin, and payment encryption belong to Convex.
- WWW and Convex can share Resend key/sender values if permissions allow, but each runtime needs its own environment entry.
- Paystack credentials are per-school database configuration, not global env keys.
- Several existing app `.env.example` files suggest unused frontend auth secrets. The code-backed inventory takes precedence.
- Actual Vercel project build-command overrides and integrations have not been audited. A backend deployment job may need `CONVEX_DEPLOY_KEY`; ordinary frontend runtime does not.
- A screenshot showed mixed Production/Preview/Development assignments. The user says some Preview-only assignments were intended for Production. Audit assignments and values; do not blindly flip all Preview variables to Production.

## Artifacts to move through Git

- `apps/*/vercel.json`, already in commit `39018bb9`.
- `docs/features/Production_Environment_Inventory.md`.
- `.env.vercel-production.local.example`.
- `.env.convex-production.local.example`.
- This handoff document.

Filled files are intentionally absent at handoff creation:

- `.env.vercel-production.local`.
- `.env.convex-production.local`.

Both names are ignored. Copy the example templates on the local computer, fill them privately, and route values only to destinations identified by the inventory. Do not upload either collection file wholesale to every project, and do not use blank values as instructions to delete settings.

## Remaining steps

1. Transfer the migration branch and check it out on the local computer. Install repository dependencies using the pinned package manager as needed.
2. Establish Convex and Vercel CLI authentication locally.
3. Inspect all seven existing Vercel projects, their Root Directories, Production Branch settings, build commands, and environment assignments. Inspect names/metadata without leaking values into logs or chat.
4. Preserve live auth/JWKS/encryption/legacy identity settings. Confirm production Convex URLs and live app origins.
5. User fills the two production input files locally. Validate required entries and destination mappings without printing secrets.
6. Apply reviewed Production corrections, redeploy affected apps, and verify auth, email, admissions, AI, and payments as applicable.
7. Configure staging backend origins/feature credentials, Vercel Preview settings, stable preview domains, and suitable non-production test data.
8. Publish `preview` only after those settings are ready. Decide where backend deployment automation runs; avoid accidentally deploying production from a preview build.
9. Remove obsolete settings or revoke old provider keys only after replacements are verified.

## Suggested first prompt on the new computer

> Read `docs/Production_Environment_Handoff.md` and `docs/features/Production_Environment_Inventory.md`. Continue the production environment setup for this repo. Start with a read-only audit of the seven existing Vercel projects and their build/environment configuration. Preserve live auth and encryption keys, keep secrets out of chat, and do not deploy production, push master/preview, or apply destructive changes without an explicit reviewed plan. We will configure Preview after Production is verified.
