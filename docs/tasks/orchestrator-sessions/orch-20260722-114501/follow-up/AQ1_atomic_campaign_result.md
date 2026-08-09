# AQ-1 Atomic Admissions Campaign Result

## Delivered

- Replaced the prior campaign commands with `createCampaignConfiguration` and `replaceCampaignConfiguration`. Both validate their complete graph before their first write and return server-resolved IDs, `priceId`, planned status, and replay state.
- Persisted replay records are actor-scoped and use canonical semantic request digests. Reusing an actor's command key with a changed request returns `OPERATION_KEY_REUSED`; a different actor can use the same key independently.
- Draft replacement only creates draft form/declaration evidence. Published replacement leaves paused/closed intake and paused product states unchanged, promotes only draft lifecycle rows, and rejects changed programme declarations when another non-archived intake shares the programme.
- Price replacement computes the next version server-side, compares amount/currency/refund/disclosure exactly, and requires a current same-school finance approval for that exact product/version. No campaign command fabricates approval evidence.
- Conditional fields and requirements require a submitted lower-order field controller. Every supplied approval-evidence ID is checked for current same-school accountable approval and exact subject, including lower-risk rows.
- Added bounded `listLegacyCampaignRecovery` output for untracked drafts. It reports only review-required graph counts, timestamps, and missing/ambiguous flags. Replacement rejects incomplete/ambiguous untracked graphs.
- The Admin builder now sends one command payload, removes unsupported email/phone custom choices, preserves resolved replacement identities server-side, and saves the complete pending command/payload in session storage. Reload/save retries the identical snapshot; operation-key reuse stops the retry.

## AQ-1 second-review revision

- Canonical operation digests now normalize all persisted semantic values: slugs, currency, trimmed text, optional blank values, approval IDs, deterministic MIME arrays, and object-order-independent JSON.
- Replacement reads target form history through the bounded `admissionsFormVersions.by_intake` index and fails closed on overflow or duplicate published evidence.
- Existing open, paused, and closed campaigns retain their availability when an authorized operator publishes a replacement. The Admin control names that operation explicitly and does not offer draft targeting for a live campaign.
- `OPERATION_KEY_REUSED` retains its submitted snapshot and operation key, blocks further commands in the current editor, and offers reload for reconciliation.
- Unchanged price payloads with finance evidence validate that evidence against the currently published exact price version.
- Added behavioral checks for normalized replay, duplicate-field no-write rejection, capability combinations, immutable children, closed/paused preservation, wrong-subject unchanged-price evidence, and actual Admin create-command payload mapping (default omission, selected requirements, one command invocation).

## Verification

- `pnpm --filter @school/convex test -- admissionsCampaignSettings.test.ts` passed: 19 files, 139 tests.
- `pnpm --filter @school/admin test -- admissionsCampaignBuilder.component.test.tsx` passed: 8 files, 44 tests.
- `pnpm --filter @school/convex typecheck` passed.
- `pnpm --filter @school/admin typecheck` passed.
- Targeted `pnpm exec eslint` for the changed Convex/Admin files passed.
- `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud NEXT_PUBLIC_CONVEX_SITE_URL=https://example.convex.site BETTER_AUTH_SECRET=build-only-secret SITE_URL=http://localhost:3002 TRUSTED_ORIGINS=http://localhost:3002 pnpm --filter @school/admin build` passed.
- `git diff --check` passed.

## Residual risk

- Admin browser interaction was not manually exercised. Focused command/retry tests cover persisted snapshots, while the builder continues to use normal Convex transport.
- The current UI can discover exact finance evidence only after an existing product and expected next version are known; no new paid-campaign policy was invented.
