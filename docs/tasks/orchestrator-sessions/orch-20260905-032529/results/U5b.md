# U5b — Versioned usage entitlements and safe heavy-operation preflight

**PARTIAL/GATED implementation, E0. Keep U5b open for provider/action adoption and U7 browser evidence.** The local entitlement and preflight workflows are implemented and verified. Provider execution remains deliberately unavailable; no live AI/payment/provider request, money movement, mandate, Convex CLI/codegen, schema rollout, deployment, migration, production mutation, browser/server run, or credentials operation occurred.

## Implemented contract

- Immutable, effective-dated `usageEntitlementVersions` own explicit meter allowances, grace, increasing notice/urgent/hard-stop thresholds, file/page caps, and task-to-meter/model profiles. No default prices or invented plan limits were added.
- Explicit `usageCycles` copy the selected entitlement snapshot and bind it to a same-school commercial contract whose effective dates cover the full cycle. Catalog configuration, invoices, and mandates do not infer or activate allowance.
- `usageAllowanceGrants` records top-ups and approved exceptions separately. Top-ups require reviewed evidence and are grants, not purchases. Expired grants are excluded. Exception requests grant nothing until one immutable Platform decision.
- `usageGroupPools` and append-only branch allocations enforce active proprietor authority, linked branches, matching current entitlement versions/cycles, effective dates, bounded reads, and a transactional pool-total ceiling.
- Existing meter allocation rows now carry cycle/source totals and configured thresholds. Effective allowance is base + grace + active top-up + active exception + branch pool. Dispatch availability applies the configured hard-stop percentage and subtracts consumed and held units. Dashboards keep every source separate.
- Platform `/commercial` has explicit version, cycle, top-up, decision, and group-pool controls. Admin `/billing/usage` shows current contract-bound cycle, source breakdown, thresholds/caps, exception request flow, and proprietor pool allocation. Customer usage prices/purchases remain unavailable and separate from Platform provider economics, SaaS invoices, school fee collection, and settlement.
- Teacher lesson-plan and selected-page OCR surfaces expose a compact authoritative estimate/confirm/cancel preflight. Quotes are capability- and tenant-scoped, profile-bounded, use exact configured units, report exact shortfall, and bind idempotency to school/work/user.
- Confirmation rechecks the quoting user, capability, cycle, estimate, and capacity. In one transaction it records `reserved → dispatch_started → provider_unavailable → released`, applies and releases the meter hold, dispatches no provider, emits no customer usage event, and returns `chargedUnits: 0`. Repeated/concurrent confirmation returns the same terminal zero-charge result. Cancellation is idempotent before confirmation.
- All new histories and dashboard reads are capped at 100; excess ambiguity fails closed. U5a owns cursor-paginated commercial invoice history and append-only invoice corrections.

Because generated Convex API files were intentionally not regenerated, new frontend references use explicit Convex function-name strings with narrow local call signatures. Authorized schema rollout/codegen is still required before runtime acceptance.

## Operation manifest

| Seam | Current result |
| --- | --- |
| Teacher lesson-plan generation | Real configured quote/confirm/cancel UI exists; existing paid generation remains server-gated. Confirmation reaches only the unavailable dispatch state and charges zero. |
| Provider OCR for selected pages | Selected-page count is quoted through the configured OCR task profile; existing request/worker provider paths remain gated. No OCR dispatch or charge. |
| Knowledge upload/storage | Entitlement schema can model a storage task and cap, but the real upload/finalize path is not adopted by this follow-up. Existing technical limit remains distinct. |
| Curriculum generation / AI import / other AI seams | Profiles can be configured but runtime actions were not adopted. They remain ungated/unmetered by this workflow and must not be claimed covered. |
| Provider cost ledger | Existing U5b internal cost evidence remains independent from customer allowance. No runtime provider ingestion adapter exists. |

## Verification actually run

- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/usageEntitlements.integration.test.ts functions/academic/__tests__/usage.integration.test.ts`: **10 PASS**. Covers immutable version/cycle authorization and conflicts, source-separated allowance, concurrent/retried unavailable confirmation with no charge, transition order, exact shortfall/profile cap, cancellation, top-up conflict/idempotency, request-before-decision, immutable decision, and proprietor pool ceiling.
- `pnpm --filter @school/admin exec vitest run __tests__/usage-surfaces.test.tsx __tests__/platform-commercial.test.tsx __tests__/usage-preflight.test.tsx`: **7 PASS**. Covers loading/denied/no-cycle, truthful monetary/provider copy, Platform controls coexistence, authoritative estimate/confirm unavailable result, and failed estimate with no confirm action.
- Convex, Admin, Platform, and Teacher `typecheck`: **PASS**.
- Focused ESLint on touched U5b backend/frontend/tests: **PASS, no output** after removing two obsolete imports exposed by the UI change.
- `node scripts/audit-theme-colors.mjs`: **informational run**. Touched Teacher amber/emerald literals are semantic warning/success states; slate/white are product neutrals. No tenant branding replacement or print change.
- `git diff --check`: **PASS**, line-ending warnings only.

## Remaining gaps and gates

- E0: no U7 authenticated browser, 320px, keyboard, screen-reader, revoked-permission, or conflict-state evidence.
- No provider dispatch lease, timeout/unknown reconciliation, provider idempotency evidence, actual-over-estimate policy, settlement adapter, or real provider-cost ingestion. These remain required before enabling paid work.
- Upload byte/range preflight and failed-batch-only retry are not integrated. Lesson/OCR preflight is adjacent to the currently gated actions rather than an enabling runtime adapter.
- Group/cycle/grant dashboards are bounded recent views, not cursor-paginated full ledgers. Cycle correction/closure and allowance correction records are not implemented; immutable replacement is required.
- New frontend function references require authorized schema rollout and generated API refresh in a later approved session.
- No customer usage price, purchase, provider approval, finance/legal evidence, payment activation, or mandate authorization exists. Keep all such controls unavailable.
