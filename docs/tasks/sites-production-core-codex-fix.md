# PR101 publish version correction

Source: [Codex review comment 4151328162](https://github.com/JStaRFilms/Melo_School_Management_System/pull/101#discussion_r4151328162), thread `PRRT_kwDORvwFBc6nyP6B`, inspected at `393eb83e`.

Status: corrected locally, not committed or deployed. `publishDraft` now advances the private draft version in the same Convex mutation as the immutable publication, public pointer and success audit. A stale publish returns `DRAFT_VERSION_CONFLICT`. The successful response carries `draftVersion`; Admin uses it for the next save. Publication approval and renderer checks remain in place. Synthetic in-process regression covers a retry and two separately authorized clients racing on one version: one publication, one published audit, one public pointer advance, and a subsequent intentional save with the returned version. Existing asset-approval tests use the returned version for later publication attempts. The Admin unit test and Chromium bridge check the updated editor version and next save.

Verification, all offline with synthetic fixtures:

| Command | Result |
| --- | --- |
| `pnpm --filter @school/convex exec vitest run functions/sites/sites.test.ts functions/sites/activation.test.ts functions/sites/browser-bridge.test.ts` | 3 files, 9 tests passed |
| `pnpm --filter @school/convex exec vitest run functions/sites` | 10 files, 29 tests passed, includes headless Chromium |
| `pnpm --filter @school/sites exec vitest run core` | 4 files, 11 tests passed |
| `pnpm --filter @school/admin exec vitest run __tests__/site-management.test.tsx __tests__/site-upload-proxy.test.ts` | 2 files, 7 tests passed |
| `pnpm --filter @school/{shared,convex,admin,platform,sites} typecheck` | All five individual package typechecks passed |
| `node scripts/audit-theme-colors.mjs`; `git diff --check` | Passed. Admin site page uses existing `red-700` as semantic error; slate is product neutral. Audit also reported untouched Platform colours against its HEAD~1 comparison. |

No live Convex, provider, DNS, seed, codegen, deploy, secret reads, commit or push. The in-process concurrency check does not replace a deployed transaction test.
