# Production environment inventory

## Scope and use

This inventory follows runtime reads in `apps/*`, `packages/auth`, `packages/shared`, `packages/ai`, and `packages/convex`. It includes shared-package reads and dynamically selected AI model variables. The audited `preview` checkout has no app/package source differences from local `master`; this is a production configuration inventory, not a staging configuration.

This audit did not read secret values or change Vercel/Convex settings. Vercel dashboard build-command overrides and integrations still need a separate inspection. A variable referenced by a build command can be needed even when the app does not read it at runtime.

Use these collection templates:

- `.env.vercel-production.local.example` -> `.env.vercel-production.local`
- `.env.convex-production.local.example` -> `.env.convex-production.local`

The filled `.local` files are Git-ignored. Keep their values out of chat and tracked documents. Templates collect inputs; an uploader must route only the appropriate variables to each destination. They are not files to copy wholesale into every Vercel project. File order does not affect dotenv parsing.

## 1. Vercel Production settings by app

Set these entries for Vercel's **Production** environment. Use the live Convex deployment `production` / `outgoing-warbler-782`, not staging. Copy its exact cloud/site URLs from the dashboard, including a region segment if present.

### Shared authenticated-app settings

Admin, Teacher, Portal, Platform, and Apply use these settings:

| Variable | Requirement | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Required for live backend/auth functionality | Production Convex HTTPS cloud URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Recommended explicitly; required by some document routes unless their server alias is set | Matching production Convex HTTPS site URL |

Both are public endpoints, not secret keys. All five apps use the same production database and therefore share these values.

`packages/auth/src/config.ts` can derive the site URL from the cloud URL for auth. Admin/Apply admissions document proxies and Apply's upload route do not use that derivation, so explicitly supplying both URLs is the simplest consistent production setup.

### Complete app matrix

| App / Vercel Root Directory | Production variables to configure | Optional runtime settings |
| --- | --- | --- |
| `apps/admin` | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | `NEXT_PUBLIC_APPLY_ORIGIN`, `CONVEX_SITE_URL`, `CONVEX_URL` |
| `apps/teacher` | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | `CONVEX_URL` |
| `apps/portal` | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | `CONVEX_URL` |
| `apps/platform` | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_PLATFORM_SITE_URL` | The platform site URL has a localhost fallback, so set it explicitly for correct production metadata |
| `apps/apply` | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | `CONVEX_SITE_URL` |
| `apps/www` | `RESEND_API_KEY` for contact-form delivery; explicitly set `NEXT_PUBLIC_SITE_URL` for the intended canonical domain | `MELO_EMAIL_FROM`, `MELO_CONTACT_TO` |
| `apps/sites` | None found in current runtime code | Published site configuration supplies domains/content, not environment variables |

The matrix is an operational production checklist, not a claim that every missing variable prevents a build. Auth can derive a site URL; metadata and email settings have the defaults below.

### App-specific values and aliases

| Variable | Where | Behavior |
| --- | --- | --- |
| `NEXT_PUBLIC_APPLY_ORIGIN` | Admin | Optional admissions-link override. Use the production Apply origin. When unset, the Admin uses the canonical link returned by Convex. |
| `NEXT_PUBLIC_PLATFORM_SITE_URL` | Platform | Platform website origin for canonical/Open Graph metadata. Defaults to `http://localhost:3006`; explicitly configure production. |
| `NEXT_PUBLIC_SITE_URL` | WWW | WWW canonical origin. Defaults to `https://meloschool.com`; set explicitly if that is not the intended live origin. |
| `RESEND_API_KEY` | WWW | Required to deliver contact-form emails. The contact endpoint returns 503 without it. This is a Vercel server secret. |
| `MELO_EMAIL_FROM` | WWW | Optional override, default `Melo <hey@jstarstudios.com>`. The sender domain must be verified for the Resend key. |
| `MELO_CONTACT_TO` | WWW | Optional contact recipient, default `melo@jstarstudios.com`. |
| `CONVEX_SITE_URL` | Admin and Apply | Optional server-side document-proxy target. Takes precedence over `NEXT_PUBLIC_CONVEX_SITE_URL` on those routes. If retained, it must point to the same production deployment. |
| `CONVEX_URL` | Admin, Teacher, Portal | Optional fallback for selected server routes when `NEXT_PUBLIC_CONVEX_URL` is absent. It does not configure browser/auth clients; omit it when using the canonical public cloud variable. |

Current frontend auth is a proxy to Convex through `packages/auth/src/server.ts`. The apps do not instantiate Better Auth with their own secrets. Consequently, `BETTER_AUTH_SECRET`, `TRUSTED_ORIGINS`, `SITE_URL`, and `BETTER_AUTH_URL` are not required frontend runtime variables in the audited code. Existing example files that suggest copying auth secrets into every app are stale. Review dashboard build commands before removing existing entries.

Sources: `packages/auth/src/config.ts`, `packages/auth/src/server.ts`, `packages/shared/src/server/proxyRoute.ts`, `apps/apply/app/admissions/document-upload/route.ts`, `apps/admin/app/admin/admissions/AdmissionsDashboard.tsx`, `apps/platform/lib/platform-marketing.ts`, `apps/www/lib/site.ts`, `apps/www/lib/server/contact-email.ts`.

## 2. Convex production environment settings

These go in the Convex dashboard environment variables for **production / outgoing-warbler-782**, not in all seven Vercel projects. The backend serves multiple apps from one deployment, so each backend setting is configured once.

### Auth, admissions, email, AI, and payments

| Variable | Requirement | Purpose / value |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Required for production auth | Existing production auth secret. Preserve during configuration repair; rotate only with a coordinated auth/signing-key plan. |
| `JWKS` | Configure for current deployment/auth config | Existing pinned production signing-key documents, generated through Better Auth. This value contains private signing material as well as public fields; it is a secret, not the public `/jwks` response. Preserve the live value. A fresh deployment can bootstrap an empty value then generate/pin fresh keys; that is not a production rotation procedure. |
| `TRUSTED_ORIGINS` | Required for intended browser auth flows | Comma-separated HTTPS origins for Admin, Teacher, Portal, Platform, and Apply. Include any additional reviewed origins that actually initiate authentication or admissions callbacks. Use origin-only URLs, without paths. |
| `APPLICATION_ORIGIN` | Required for production admissions links unless alias is configured | Canonical production Apply origin. Prefer this name. |
| `APPLY_APP_ORIGIN` | Optional alias | Used only when `APPLICATION_ORIGIN` is unset. Configure one canonical source rather than divergent values. |
| `RESEND_API_KEY` | Required for verification/conversion emails | Backend Resend key. Email verification is sent on signup even though sign-in does not require prior verification. |
| `MELO_EMAIL_FROM` | Required for backend email delivery | Verified sender, such as `Melo <verified-sender@your-domain>`. Unlike WWW, the backend has no default sender. |
| `OPENROUTER_API_KEY` | Required for enabled AI generation/OCR | Shared backend OpenRouter credential for lesson plans, notes, assignments, question-bank/CBT drafts, curriculum generation, and OCR. |
| `BILLING_PROVIDER_SECRET_ENCRYPTION_KEY` | Required for storing/decrypting school payment credentials | Existing backend encryption secret. Preserve its exact live value if payment credentials are already stored. Replacing it without re-encrypting records makes those credentials unreadable. |

`RESEND_API_KEY` and `MELO_EMAIL_FROM` can share the same production values between Convex and WWW if the key permits the sender. They still need to be configured in both runtimes. Separate restricted Resend keys are also valid.

OpenRouter calls run in Convex. The Admin's AI API route delegates to a Convex action; it does not need its own OpenRouter key. Teacher and the other Vercel apps do not need copies either.

Paystack public/secret keys are configured per school and test/live mode through the app's payment-provider settings and stored in Convex. No `PAYSTACK_SECRET_KEY` or `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` environment read was found in current application code. Collect those separately if payment-provider records need repair; do not invent global env variables for them.

Sources: `packages/convex/betterAuth.ts`, `packages/convex/auth.config.ts`, `packages/convex/functions/foundation/applicationLinks.ts`, `packages/convex/functions/admissions/conversion.ts`, `packages/convex/functions/billingProviders.ts`, `packages/convex/functions/billingGateway.ts`, `packages/convex/functions/academic/documentGeneration.ts`, `packages/convex/functions/academic/curriculumGeneration.ts`.

### Optional AI controls, Convex only

Defaults exist in code. Supply overrides only when deliberately choosing another model/runtime.

| Variable | Default / role |
| --- | --- |
| `OPENROUTER_HTTP_REFERER` | `https://www.meloschool.com/`, provider attribution |
| `OPENROUTER_APP_TITLE` | `Melo School OS`, provider attribution |
| `SCHOOL_AI_CURRICULUM_RUNTIME` | `openrouter`; `mock` is rejected in production |
| `SCHOOL_AI_CURRICULUM_MODEL` | `openai/gpt-5-mini` |
| `SCHOOL_AI_LESSON_PLAN_MODEL` | `nvidia/nemotron-3-super-120b-a12b:free` |
| `SCHOOL_AI_STUDENT_NOTE_MODEL` | `nvidia/nemotron-3-super-120b-a12b:free` |
| `SCHOOL_AI_ASSIGNMENT_MODEL` | `nvidia/nemotron-3-super-120b-a12b:free` |
| `SCHOOL_AI_QUESTION_BANK_MODEL` | `openai/gpt-oss-120b:free` |
| `SCHOOL_AI_CBT_MODEL` | `openai/gpt-oss-120b:free` |
| `OPENROUTER_OCR_MODEL` | `openai/gpt-5.6-luna`, PDF OCR |
| `OPENROUTER_OCR_IMAGE_MODEL` | `openai/gpt-5.6-luna`, image OCR |
| `OPENROUTER_PDF_ENGINE` | `mistral-ocr` |

These are current code defaults, not a guarantee of model availability at the provider. References: `packages/ai/src/models.ts`, `packages/ai/src/runtime.ts`, `packages/convex/functions/academic/lessonKnowledgeOcrActions.ts`.

### Optional compatibility and setup controls, Convex only

| Variable | Use |
| --- | --- |
| `LEGACY_SUBJECT_FALLBACK_ENABLED` | Exact value `true` allows legacy subject lookup for this deployment's own issuer. Preserve reviewed production policy; changing it can change existing users' access. |
| `LEGACY_SUBJECT_TRUSTED_ISSUER` | Explicit trusted issuer for legacy identity lookup. Preserve reviewed policy; do not invent a new issuer during env cleanup. |
| `PLATFORM_BOOTSTRAP_TOKEN` | Temporary operator secret for bootstrap actions. Not required for normal logins; configure only for an authorized bootstrap, then remove when no longer needed. |
| `SITE_URL` | Legacy fallback for auth base URL if Convex's built-in `CONVEX_SITE_URL` is absent. The managed cloud deployment supplies the built-in, so a manual `SITE_URL` is normally unnecessary. It is not the list of frontend domains. |

Sources: `packages/convex/functions/academic/identityResolver.ts`, `packages/convex/functions/platform/bootstrap.ts`, `packages/convex/functions/academic/bootstrap.ts`, `packages/convex/betterAuth.ts`.

### Platform-provided values

- Convex supplies `CONVEX_SITE_URL` and `CONVEX_CLOUD_URL` to its backend automatically. Do not replace them with frontend or staging URLs.
- `NODE_ENV` is a runtime/build setting. Let Next.js/Vercel/Convex supply it; it is not a provider credential to collect.
- The automatic Convex `CONVEX_SITE_URL` is distinct from the optional manually configured Vercel server alias of the same name.

### Destructive/test tooling, excluded from normal production setup

These names are present in backend source but are not regular product configuration. Leave them out of the production collection template and enable only under a separately reviewed operator procedure:

- Development demo reset/seed: `DEMO_SEED_OPERATOR_TOKEN`, `DEMO_SEED_DEPLOYMENT_IDENTITY`, `DEMO_SEED_DEPLOYMENT_ENV`, `DEMO_SEED_EXPECTED_CLOUD_URL`. The code requires an independently configured development target.
- Judge fixture/reset: `JUDGE_SEED_OPERATOR_TOKEN`, `JUDGE_SEED_DEPLOYMENT_IDENTITY`, `JUDGE_SEED_DEPLOYMENT_ENV`, `JUDGE_SEED_ALLOW_PRODUCTION`, `JUDGE_DEMO_PASSWORD`. Production judge resets have an explicit opt-in and confirmation guard. Do not add that opt-in as part of environment cleanup.
- Development tenant purge: `TENANT_PURGE_OPERATOR_TOKEN`, `TENANT_PURGE_DEPLOYMENT_IDENTITY`, `TENANT_PURGE_DEPLOYMENT_ENV`, `TENANT_PURGE_PROTECTED_SLUGS`. The code requires development mode.

References: `packages/convex/functions/academic/seedRunnerSecurity.ts`, `packages/convex/functions/academic/seedRunner.ts`, `packages/convex/functions/academic/tenantPurgeAction.ts`.

## 3. Deployment credentials and local tooling

`CONVEX_DEPLOY_KEY` belongs to the CLI or the CI/build job that deploys backend code. It is not a normal Convex runtime variable and is not needed by a Vercel app that only builds Next.js and connects to existing Convex functions. Inspect actual Vercel build commands before configuring it. Prefer a single backend deployment job rather than seven independent deployments of the same backend. A production key must target the production deployment; the existing `.env.staging.local` key targets staging only.

`CONVEX_DEPLOYMENT` selects a local CLI deployment, not a browser backend. Do not populate all Vercel apps with it. Leave the existing local `.env.local` targeting development.

The root `.env.example` also lists reviewer/tooling inputs: `GEMINI_API_KEY`, `GOOGLE_API_KEY` as the documented alternative, `GROQ_API_KEY`, `GEMINI_EMBEDDING_MODEL`, and `REVIEW_MODEL_NAME`. They are not runtime requirements of these seven apps. Likewise, `E2E_*` inputs and `THEME_AUDIT_BASE` belong to test/audit commands, not ordinary production deployment.

## 4. Repair procedure

1. Inspect current Production assignments and dashboard build commands without exposing secrets.
2. Preserve existing production `BETTER_AUTH_SECRET`, `JWKS`, billing encryption key, and reviewed legacy identity settings.
3. Confirm the live cloud/site URLs and app domains. Fill the separate Vercel and Convex collection files.
4. Route Vercel values according to the app matrix and backend values to Convex production. Skip blank/commented optional inputs; they do not authorize deleting existing settings.
5. Redeploy affected production apps after environment changes. Verify authentication, admissions uploads/links, contact email, AI, and payments as applicable.
6. Remove reviewed obsolete settings only after verification. Provider-key revocation and auth/encryption-key rotation are separate operations with their own migration plans.
7. Configure Preview independently afterward, without changing these Production values.

## 5. Build configuration finding

`turbo.json` currently declares only `BETTER_AUTH_SECRET`, `SITE_URL`, `TRUSTED_ORIGINS`, `NEXT_PUBLIC_CONVEX_URL`, and `NEXT_PUBLIC_CONVEX_SITE_URL` in `globalEnv`. Turbo's default strict environment mode filters build-task inputs, although Next.js framework inference can include `NEXT_PUBLIC_*` variables automatically. If a build needs additional server-only variables, verify that they are passed through. Direct per-app `next build` commands do not have that Turbo filtering step. This is separate from Vercel injecting Production variables into deployed server handlers, where contact-email secrets are normally read. Inspect actual dashboard build commands before changing pass-through rules. This audit makes no build configuration changes.
