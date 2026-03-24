# T12 Convex Project Wiring And Codegen Result

## Outcome

Verified and fixed. `T12` now passes.

## What Was Fixed

- Attached the repo root to a real Convex dev deployment and confirmed root `convex dev --once` succeeds.
- Replaced the temporary handwritten `_generated` shim path with real Convex-generated bindings in `packages/convex/_generated`.
- Added the Convex CLI to the repo root and made the repo root the canonical place for `convex dev`, `convex codegen`, and `convex deploy`.
- Changed `packages/convex` package scripts to proxy back to the repo root so future agents do not accidentally initialize a nested standalone Convex app.
- Fixed the Convex auth tests to use real typed `Id<...>` values so live codegen typechecking passes.
- Updated setup docs and helper scripts to copy `CONVEX_URL` and `CONVEX_SITE_URL` from the repo root `.env.local` into app-level env files.
- Added local admin and teacher `.env.local` files for live mode and kept them ignored.
- Removed stray agent metadata and nested Convex scaffolding that were generated during the earlier misconfigured run.

## Verification

- `pnpm convex:dev --once`
- `pnpm convex:codegen`
- `pnpm --filter @school/convex convex:codegen`
- `pnpm typecheck`
- `pnpm test`

## Notes

- The repo root `.env.local` now stores the selected Convex deployment and URLs and remains ignored.
- `apps/admin/.env.local` and `apps/teacher/.env.local` now point at the live Convex dev deployment and remain ignored.
- Real live browser testing still depends on seeded users and data from `T13`, then end-to-end verification in `T14`.
