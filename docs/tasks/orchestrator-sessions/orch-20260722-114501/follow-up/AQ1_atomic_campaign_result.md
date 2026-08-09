# AQ-1 Atomic Admissions Campaign Result

## Delivered

- Added `createDraftCampaign`, a bounded transaction that validates the complete campaign graph before it writes a programme, intake, product, declaration, form, fields, and document requirements. It may publish the validated initial graph in that same transaction when the caller has `admissions.publish`.
- Added `replaceDraftCampaignConfiguration`, which validates before writes, creates new form/declaration versions, and only retires prior published versions when publishing. Published evidence content is not rewritten.
- Added `admissionsCampaignOperations`, a durable tenant-scoped operation-key ledger. Replays return the stored IDs and status; reusing a key for a different payload is rejected.
- Added `listCampaignRecovery`, which identifies pre-atomic draft campaigns without an atomic ledger as review-only legacy draft/partial states. The Admin builder shows a non-destructive recovery notice.
- Replaced the builder’s browser mutation chain with the two atomic commands and a stable retry operation key. Price changes remain in the separate accountable finance workflow; AQ-1 does not create finance evidence or define a free/paid publication policy.

## Verification

- `pnpm --filter @school/convex test -- admissionsCampaignSettings.test.ts` passed (the package script ran the Convex suite: 19 files, 134 tests; the new three focused tests passed).
- `pnpm --filter @school/convex typecheck` passed.
- `pnpm --filter @school/admin typecheck` passed.
- `pnpm --filter @school/admin test -- admissionsCampaignBuilder.test.ts admissionsOperations.test.ts` passed (7 files, 41 tests; including the focused Admin builder contract test).
- Targeted ESLint passed for the changed Convex and Admin files.
- `pnpm --filter @school/admin build` compiled and typechecked the changed Admin code, but failed while prerendering unrelated existing routes because `NEXT_PUBLIC_CONVEX_URL` is unset and those routes call `useQuery` outside a `ConvexProvider`. No browser validation was performed.

## Constraints and residual risk

The requested `follow-up/AQ1_atomic_campaign_architecture_brief.md` was absent from this worktree, so implementation followed the AQ-1 packet and existing repository contracts. Browser workflow QA and the accountable price-approval UX remain out of scope.
