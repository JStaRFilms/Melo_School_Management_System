# T011 - Authenticated curriculum extraction endpoint

## Objective

Wire the approved OpenRouter runtime to a thin authenticated admin endpoint that loads server-validated page evidence, generates schema-constrained proposals, records the canonical run, and persists proposals.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [ ] Request body exposes only the import ID; school, source text, provider, model, prompt, and schema metadata are resolved server-side.
- [ ] Load only an authenticated admin's matching import and ready page-aware source chunks through bounded Convex functions.
- [ ] Generate with AI SDK 6 `generateText` + `Output.object` and the existing `@school/ai` curriculum schema/runtime.
- [ ] Mock mode performs no network request and remains blocked in production.
- [ ] Record running/succeeded/failed canonical `aiRunLogs` entries linked to the import, then persist proposals against the succeeded run.
- [ ] Return user-safe errors and avoid logging source document bodies.
- [ ] Add focused route/service tests or pure tests for request validation, prompt evidence shape, and failure metadata.
- [ ] Run admin/AI/Convex typechecks and focused lint/tests; no paid calls and no deploy.

## Notes

Own new `apps/admin/app/api/ai/curriculum/import/**`, a new focused curriculum-generation Convex module if required, new `packages/ai` prompt/service modules if required, and focused tests. Do not edit UI pages, readiness files, report-card files, or unrelated routes. Keep every new code file below 200 lines. Use `apply_patch`; do not stage, commit, call paid APIs, or deploy.

## Update 2026-07-18T01:37:05

Second batch implementation.

## Outcome 2026-07-18

- Added an authenticated admin route that accepts only `importId`, forwards the session token to Convex, and returns user-safe errors.
- Added an admin-scoped Convex generation module that resolves the import, ready source, subject, term, and bounded page-aware chunks server-side; it records running, succeeded, and failed canonical curriculum runs and marks failed imports without storing source bodies in errors.
- Added a focused AI generation service that uses AI SDK 6 `generateText` with the existing `Output.object` curriculum contract. Mock mode remains deterministic and uses no provider request; production mock protection remains in the runtime resolver.
- Added focused AI tests for page-evidence prompt shape, mock generation, and safe failure metadata.
- Added the local `@school/ai` workspace dependency to the admin app so the route can use the approved runtime and contract.

### Verification

- `pnpm --filter @school/ai typecheck` — passed.
- `pnpm --filter @school/admin typecheck` — passed.
- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm --filter @school/ai test` — passed (6 tests). Node emitted the existing package-module warning, but no test failed.
- `pnpm exec eslint apps/admin/app/api/ai/curriculum/import/route.ts` — passed.
- `pnpm -C packages/convex exec eslint functions/academic/curriculumGeneration.ts` — passed.
- `pnpm --filter @school/ai lint` — passed.
- `git diff --check` — passed (line-ending warnings only).

No paid model request was made. No explicit deploy command was run. `pnpm convex:codegen` was used solely to refresh generated API bindings; its CLI output unexpectedly included `Downloading current deployment state...` and `Uploading functions to Convex...`. The CLI did not identify a dev or production environment. Per the follow-up instruction, no further Convex or network commands were issued and no rollback/redeploy was attempted.

## Update 2026-07-18T01:47:33

Authenticated server extraction flow completed. AI/admin/Convex typechecks, 6 AI tests, scoped lint, and whitespace validation pass. Codegen accidentally refreshed the configured development deployment; no production deploy occurred.
