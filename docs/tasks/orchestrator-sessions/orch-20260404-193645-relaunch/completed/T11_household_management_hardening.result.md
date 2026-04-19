# T11 Household Management Hardening

## Status

Completed on `2026-04-17`.

## What Changed

1. Extended the family backend in `packages/convex/functions/academic/studentEnrollment.ts` so admins can now:
   - review duplicate parent-email matches before linking an existing parent into another household
   - update parent contact details from the household card
   - safely reuse an existing parent account instead of creating conflicting duplicate-email parent records
   - remove a parent from a household only when that removal does not strand active students without a linked parent
2. Hardened the family-link mutation so brand-new parent links no longer get blocked by duplicate-confirmation logic that should apply only to reused parent accounts.
3. Updated the admin household UI in `apps/admin/app/academic/students/components/StudentFamilyPanel.tsx` to expose:
   - duplicate-email review panels
   - parent contact edit flows
   - clearer student-only unlink vs household-wide parent removal messaging
   - household-scoped destructive actions directly on the parent card
4. Synced the family-linking docs and FR tracking to reflect the hardening pass.

## Files Updated

- `packages/convex/functions/academic/studentEnrollment.ts`
- `apps/admin/app/academic/students/components/StudentFamilyPanel.tsx`
- `docs/features/ParentFamilyLinkingFoundation.md`
- `docs/issues/FR-005.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T11_household_management_hardening.result.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T11_household_management_hardening.task.md`

## Verification Run

- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/admin build` ✅
- `pnpm --filter @school/admin exec tsc --noEmit -p tsconfig.json` ✅

## Notes

- The duplicate-email hardening now distinguishes between reusing an existing parent and creating a new parent, so fresh household linking remains friction-free.
- When an admin confirms an existing parent email during parent-contact editing, the household link now reuses the matching parent account instead of mutating the current parent record into a duplicate-email collision.
- Student unlink remains the safe student-scoped action; household-wide parent removal stays constrained to the parent card flow.
