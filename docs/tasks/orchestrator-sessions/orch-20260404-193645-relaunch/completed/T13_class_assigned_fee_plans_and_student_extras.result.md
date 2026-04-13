# T13 Class-Assigned Fee Plans and Student Extras

## Status

Completed on `2026-04-13`.

## What Changed

1. Extended the Convex billing schema to support:
   - fee-plan billing modes for `class_default` vs `manual_extra`
   - optional target class ids on fee plans
   - auditable bulk fee-plan application records
   - invoice linkage back to a bulk application run
2. Updated `packages/convex/functions/billingShared.ts` so billing validators now expose the class-targeting fields and bulk-application document shape.
3. Extended `packages/convex/functions/billing.ts` to:
   - create fee plans with class targeting
   - enforce class-targeted fee-plan use when appropriate
   - bulk-apply a class-default fee plan to covered students for a selected session/term
   - skip duplicate invoices for the same student/class/session/term/fee-plan combination
   - preserve the existing one-off student invoice flow for manual extras
   - return recent fee-plan application runs in the billing dashboard payload
4. Updated `apps/admin/app/billing/page.tsx` to:
   - create class-default or manual-extra fee plans
   - select target classes during fee-plan creation
   - bulk apply a class-default fee plan to a selected class/session/term
   - keep the one-off student extra invoice flow available
   - display recent application runs and fee-plan targeting badges
5. Synced docs and tracking notes:
   - `docs/features/BillingAndPaymentsFoundation.md`
   - `docs/issues/FR-013.md`
   - `docs/issues/FR-015.md`

## Files Updated

- `packages/convex/schema.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/functions/billing.ts`
- `apps/admin/app/billing/page.tsx`
- `docs/features/BillingAndPaymentsFoundation.md`
- `docs/issues/FR-013.md`
- `docs/issues/FR-015.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T13_class_assigned_fee_plans_and_student_extras.result.md`

## Verification Run

- `pnpm convex:codegen` ✅
- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/admin build` ✅
- `pnpm --filter @school/admin exec tsc --noEmit -p tsconfig.json` ✅ after build regenerated `.next/types`

## Notes

- Manual extra plans stay out of the bulk-application flow on purpose.
- Legacy fee plans without target classes still resolve as class-default plans for backward compatibility.
- The billing dashboard now shows recent bulk application runs, but it does not yet include deeper per-student audit drill-down or repayment workflows.
