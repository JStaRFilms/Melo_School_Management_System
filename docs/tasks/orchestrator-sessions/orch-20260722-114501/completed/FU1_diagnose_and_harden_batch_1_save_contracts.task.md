# FU1 — Batch 1 save-contract diagnosis and draft semantics

**Session:** `orch-20260722-114501`  
**Stage:** Build follow-up | **Role:** Coder | **Historical baseline:** B6 complete | **Tracked dependency:** B0 | **Worktree:** `feature/admissions-draft-reliability`

## Objective

Confirm the evidence-backed save failure at the current code boundary, remove the stale-version/no-op write failure mode, and preserve partial draft sections without weakening ownership, tenant isolation, or optimistic concurrency.

## Evidence and confirmed starting diagnosis

- Evidence application `app_ff953eb500f9a33f22937c92dd99d597` is still `draft`, at `draftVersion: 6`, with no applicant-profile row and no contact row.
- Its only answer is `preferred-name`, whose `valueVersion` reached 5 through five successful `application.answer_saved` events.
- `DynamicField` saves that answer on blur. Clicking **Save and continue** can therefore launch `saveAnswer` and `saveCoreByPublicReference` concurrently with the same `expectedVersion`; one write increments the application version and the other fails with `DRAFT_VERSION_CONFLICT`.
- The client also copies reactive query versions into local state while writes are in flight and sends unchanged values again, so later contact saves can retain or reuse a stale version.
- The current retained Convex log window is cron-only; use the development deployment and source/tests to confirm the contract without modifying production or exposing private values.

## Scope

- Read `packages/convex/_generated/ai/guidelines.md` before changing Convex code.
- Trace `ApplicationSurface`, dynamic-field blur behavior, public save wrappers, and admissions draft mutations.
- Define one serialized write path for a draft application so overlapping core/answer/contact saves cannot use the same version.
- Keep `expectedVersion` conflict detection authoritative. Do not turn conflicts into last-write-wins.
- Make partial section persistence independent of unrelated future sections. Full required-field checks remain at progression/submission boundaries as appropriate.
- Avoid writes for unchanged values and avoid repeatedly retrying deterministic validation failures.
- Return safe structured failure information sufficient for named field errors without exposing private values or internal records.
- Add only focused backend/unit coverage for partial draft semantics, no-op behavior, and stale-version protection.

## Must not do

- Do not implement Batch 2 legal-name schema/migration or require a student middle name.
- Do not implement Batch 3 document proxy/deletion/replacement.
- Do not weaken guardian ownership, tenant checks, immutable submission snapshots, or optimistic concurrency.
- Do not modify production data/deployment settings or display Paystack secrets.
- Do not broadly refactor admissions, generated Convex artifacts, schema, or unrelated apps.

## Definition of done

- The screenshot 01–03 failure mechanism is confirmed in the implementation notes and guarded by a focused regression test.
- Partial core and contact drafts can persist without unrelated future sections being complete.
- Concurrent/no-op client writes no longer create avoidable version conflicts.
- Genuine stale writers still receive a safe conflict response and cannot overwrite newer data.
- The implementer runs the narrowest relevant Convex/type checks and records exact results.

## Expected artifacts

- Narrow changes under `packages/convex/functions/admissions/**` and/or focused admissions tests only if the confirmed contract requires them.
- `docs/tasks/orchestrator-sessions/orch-20260722-114501/follow-up/FU1_save_contract_result.md` containing root cause, changed files, validation, migration impact, and FU2 handoff.

## Self-check and handoff

Before returning, inspect the diff for unrelated changes, confirm no production command was used, and report the exact client contract FU2 must consume. Do not request or dispatch an independent reviewer; FU3 is the integrated checkpoint.
