# Task AQ-1: Make Admissions Campaign Setup Atomic

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Takomi Build (`vibe-build`) on `feature/admissions-atomic-campaigns`.

### Prime Agent Context
- `AGENTS.md`
- `packages/convex/_generated/ai/guidelines.md`
- `docs/tasks/orchestrator-sessions/orch-20260722-114501/future/Admissions_UI_Quality_Backlog.md` — AQ-1
- `apps/admin/app/admissions/AdmissionsFormBuilder.tsx`
- `packages/convex/functions/admissions/settings.ts`
- `packages/convex/schema.ts`
- Focused admissions settings/domain tests

### Optional Skill / Context Overlays
No optional skill is mandatory. Follow existing Convex transaction, authorization, audit, and closed-validation patterns.

## Objective
Replace the browser-orchestrated multi-mutation campaign setup flow with bounded server-side commands that validate first, write atomically, and replay idempotently.

## Scope
- Map the current programme/intake/product/declaration/form/field/requirement setup and publication sequence.
- Add one server-side command for creating a complete draft campaign from validated input.
- Add one server-side command for publishing or replacing a complete draft configuration without mutating immutable published evidence.
- Validate scope, dates, slugs, field keys/order, conditional rules, document requirements, declaration content, approval evidence, and capabilities before the first write.
- Use a client-provided operation key and durable replay result, or an equivalent bounded idempotency contract.
- Return structured IDs/status needed by the Admin UI.
- Replace the Admin browser sequence with the atomic command while preserving the refined UI.
- Provide explicit, safe recovery visibility for partial drafts left by the pre-atomic implementation; do not mass-delete or guess ownership.
- Add focused success, validation-rejection, replay, authorization, and no-partial-write regression coverage.

## Context
The current Admin form builder coordinates multiple independent Convex mutations. Each mutation is transactional, but a network failure or later validation error can leave a partial campaign. AQ-2 finance approval remains separate: do not fabricate approval evidence or weaken paid-price publication policy.

## Definition Of Done
- A rejected request writes none of the campaign graph.
- Replaying the same operation key returns the same durable result and creates no duplicate programme, intake, product, declaration, form, field, or requirement rows.
- Publication/replacement preserves immutable published form/declaration evidence and enforces existing capabilities and approvals.
- The Admin UI invokes the bounded command rather than sequencing graph writes in the browser.
- Pre-atomic partial drafts are surfaced with a clear recovery state instead of being silently overwritten or deleted.
- Focused Convex/Admin tests, affected typechecks/ESLint/builds, and `git diff --check` pass.

## Expected Artifacts
- Convex schema/function changes for atomic commands and replay state.
- Admin form-builder integration.
- Focused Convex and Admin tests.
- `follow-up/AQ1_atomic_campaign_result.md`.

## Constraints
- Work only in `_w/atomic-campaigns` / `feature/admissions-atomic-campaigns`.
- Do not modify `main` or the integration worktree.
- Use development/test data only; do not deploy or mutate production.
- Do not fabricate finance/privacy approval evidence.
- Do not weaken tenant isolation, scoped capabilities, publication immutability, or audit requirements.
- Keep AQ-2, browser QA, component decomposition, and unrelated cleanup out of scope.

## Dependencies
- Baseline commit `4f3b1f0` from `integration/obhis-admissions-release`.
- Existing safe settings/publication contracts.

## Verification
Run the narrowest relevant Convex/Admin tests first, then affected typechecks, targeted ESLint, Admin production build if the UI changes, and `git diff --check`.

## Handoff Notes
The implementer must self-check its complete scope before milestone review. Browser verification is not required for this backend-heavy slice and must not be claimed.

## Result
Completed on `feature/admissions-atomic-campaigns` through commits `7af2f09`, `9a9194a`, `77e7584`, and `7367d5d`. Independent milestone review returned two revision rounds and then approved with no blockers. Integration-owner checks passed: 51 focused Convex tests, 45 Admin tests, affected typechecks, targeted ESLint, Admin production build, and `git diff --check`. See `follow-up/AQ1_atomic_campaign_result.md`.
