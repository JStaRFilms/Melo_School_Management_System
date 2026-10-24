# School Sites reconciliation scope

S1 returned a concrete manifest and verification plan through OpenCode DeepSeek task `node:delegated-task:command%3Amcp%3A21638829-378e-4387-b995-162279f4b91a%3Adelegate-task%3Amelo-sites-S1-deepseek-reconcile-20261023-r1`. The parent accepts this scope. This was research, not an independent code-review verdict.

## Source and restoration method

Use maintained source from `c03047629d09e206113ecb6a2ffd01ca3384a784`. It already combines the school's `94ef195` upkeep with the reviewed optimizations. Restoring `shared.ts` from `94ef195` alone would lose its optimization; the `c030476` version contains both. Restore the original `public.optimization.test.ts` fixture from the same ref because its favicon and indefinite-approval contracts return.

Use a literal, explicit path manifest and content restoration. Do not merge original history or copy entire directories. That ancestry includes raw school photos and operator artifacts which are not needed by the maintained app and must not be pushed. `apps/www` and root `public` have no source delta in the original upkeep commit.

## Approved manifest

```text
packages/convex/functions/sites/access.ts
packages/convex/functions/sites/accessContract.ts
packages/convex/functions/sites/access.test.ts
packages/convex/functions/sites/domainRules.ts
packages/convex/functions/sites/domainRules.test.ts
packages/convex/functions/sites/domains.ts
packages/convex/functions/sites/domains.test.ts
packages/convex/functions/sites/evidence.ts
packages/convex/functions/sites/management.ts
packages/convex/functions/sites/reads.ts
packages/convex/functions/sites/shared.ts
packages/convex/functions/sites/sites.test.ts
packages/convex/functions/sites/browser-bridge.test.ts
packages/convex/functions/sites/public.optimization.test.ts
packages/convex/schema.ts
packages/convex/schemaCoverageRegistry.json
packages/convex/_generated/api.d.ts
packages/shared/src/site-manifests.ts
packages/shared/src/site-manifests.test.ts
apps/sites/app/manifest.ts
apps/sites/app/icon.png
apps/sites/core/public.ts
apps/sites/core/seo.ts
apps/sites/core/olive-public.test.tsx
apps/admin/app/admin/settings/site/page.tsx
apps/admin/lib/site-logo-copy.ts
apps/admin/__tests__/site-logo-copy.test.ts
apps/admin/__tests__/site-management.test.tsx
apps/platform/app/schools/[schoolId]/site/page.tsx
apps/platform/__tests__/site-ownership.test.tsx
.agents/skills/verify-melo/features/README.md
.agents/skills/verify-melo/features/managed-sites-upkeep.md
docs/features/ManagedSiteUpkeepAndBranding.md
docs/features/ManagedSiteAccessProvisioning.md
docs/features/AdmissionsAndSiteFoundationContract.md
docs/tasks/sites-production-core-operations.md
```

`apps/sites/app/icon.png` is absent in the source ref and must remain deleted, allowing the tenant's published icon to win. `functions/sites/public.ts` already equals `c030476` and needs no replacement.

## Exclusions and verification

Keep launch deliverables and historical PR121/upkeep task-session snapshots out. Keep optimization-owned academic source, Admin academic consumers, onboarding tests, and current release/review records intact. Do not restore the full original tree.

Run focused Sites backend and optimization tests, shared manifest tests, Admin Sites/logo-copy/onboarding tests, Platform ownership tests, and Sites public renderer tests. Run direct backend/shared/Admin/Platform/Sites typechecks and affected frontend builds. The Sites package has no test script, so invoke its local Vitest binary explicitly. Run the informational theme audit and diff/source-parity checks.

The parent attempted the QA doctor. The stock CLI silently no-ops on Windows because its existing main-entry guard compares a drive path against a URL pathname. Calling its exported `main` preserves all safety checks and correctly reports the missing `.env.qa.local` profile. No server or remote write occurred. Record browser coverage as blocked; do not fix unrelated QA portability, invent credentials, use normal dev or Production for writes, or claim a green no-op as evidence.
