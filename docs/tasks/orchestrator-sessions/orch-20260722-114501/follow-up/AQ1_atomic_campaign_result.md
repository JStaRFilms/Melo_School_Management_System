# AQ-1 Atomic Admissions Campaign Result

## Delivered

- Replaced the prior campaign commands with `createCampaignConfiguration` and `replaceCampaignConfiguration`. Both validate their complete graph before their first write and return server-resolved IDs, `priceId`, planned status, and replay state.
- Persisted replay records are actor-scoped and use canonical semantic request digests. Reusing an actor's command key with a changed request returns `OPERATION_KEY_REUSED`; a different actor can use the same key independently.
- Draft replacement only creates draft form/declaration evidence. Published replacement leaves paused/closed intake and paused product states unchanged, promotes only draft lifecycle rows, and rejects changed programme declarations when another non-archived intake shares the programme.
- Price replacement computes the next version server-side, compares amount/currency/refund/disclosure exactly, and requires a current same-school finance approval for that exact product/version. No campaign command fabricates approval evidence.
- Conditional fields and requirements require a submitted lower-order field controller. Every supplied approval-evidence ID is checked for current same-school accountable approval and exact subject, including lower-risk rows.
- Added bounded `listLegacyCampaignRecovery` output for untracked drafts. It reports only review-required graph counts, timestamps, and missing/ambiguous flags. Replacement rejects incomplete/ambiguous untracked graphs.
- The Admin builder now sends one command payload, removes unsupported email/phone custom choices, preserves resolved replacement identities server-side, and saves the complete pending command/payload in session storage. Reload/save retries the identical snapshot; operation-key reuse stops the retry.

## Verification

- `pnpm --filter @school/convex test -- admissionsCampaignSettings.test.ts` passed: 19 files, 138 tests.
- `pnpm --filter @school/convex typecheck` passed.
- `pnpm --filter @school/admin typecheck` passed.
- `pnpm --filter @school/admin test -- admissionsCampaignBuilder.test.ts` passed: 7 files, 42 tests.

## Residual risk

- Admin browser interaction was not manually exercised. The pending-command helper has focused behavior tests, and the builder still uses the normal Convex transport in the browser.
- The current UI can discover exact finance evidence only after an existing product and expected next version are known; no new paid-campaign policy was invented.
