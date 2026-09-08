# U5a — Commercial catalog/subscription and settlement UI

## Objective / scope
Expose authorized versioned catalog/contract workflows and clearly separate SaaS subscription, usage top-ups and school collection/settlement charges. Separate PR from asset library.

## Context / dependencies
U1c/U1d/U1e; U2d billing edits finished. Read F7/H8 and D03 S1. commercial.listSubscriptionPlans/getSchoolSubscription/getSettlementLedger/getSettlementByRef are public; seedCommercialCatalog/createOrUpdateSchoolSubscription/recordSettlementTransaction are internal. Existing code is not a full Platform editor or a provider connection proof.

## Ownership
commercial.ts, proposed Platform `/commercial`, Admin `/billing/subscription` and settlement read surfaces; commercial tests. Coordinate billing hooks/nav through completed U2d/U1b. No payment-provider runtime changes in this PR.

## Instructions
1. Add narrowly authorized audited Platform catalog/contract operations (not wholesale public aliases of internal mutations), currencies/rates/bands/minimums/discounts/overrides/effective dates and immutable contract/invoice snapshots. Seed only approved Core/Basic anchor as catalog data: ₦1,000 active student/term + ₦30,000 setup; no invented tier prices.
2. Define billable student snapshot exclusions, explicit proration/cadence and setup-fee handling. Show current/future/legacy contract states; issued invoices cannot mutate when rates change. Group totals follow permissions.
3. Present separate charge classes and read-only settlement breakdown with gross/provider fee/Melo fee/net/refund/dispute/adjustment legs. Default school-owned merchant remains separate SaaS billing; connection/estimate must derive from verified evidence.
4. Split/recurring mandate/purchase activation stays unavailable pending provider/finance/legal gates. Never store raw cards or imply universal next-day settlement. Do not trigger payments in verification.

## Definition of done / verification
Commercial tests cover Platform-only writes, delegated read scope, version/effective dates, snapshot immutability, student exclusion/proration and ledger separation. UI loading/no catalog/no contract/denied/confirmation/provider-unavailable states; tests/typecheck recorded. No hidden default discounts or provider claims.

## Local execution status
Safe local rate/contract/invoice and separated read surfaces implemented; **P/G, E0**, not full product/release acceptance. See `../results/U5a.md` and matrix for verified checks, API ownership, explicit remaining group/custom-schedule/batch/correction/draft code gaps, U5b contract and provider/U7 gates. No live or external operation performed.

## Artifacts
`results/U5a.md` API/rate/contract ownership and gate register, tests/self-review, U5b entitlement contract and U7 evidence requests. Update matrix. No production, provider requests, migrations, deploy, credential or unapproved CLI/PR actions.
