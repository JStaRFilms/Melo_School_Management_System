# Task B8: Implement Private Document Viewing and Management

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Takomi Build (`vibe-build`).

### Prime Agent Context
- `packages/convex/_generated/ai/guidelines.md`
- `docs/tasks/orchestrator-sessions/orch-20260722-114501/future/Admissions_Application_Future_UX_and_Data_Safety_Work.md`
- Current Apply document routes/components and Convex admissions document/access functions.

## Objective
Provide same-origin guardian document viewing plus controlled removal/replacement while preserving private storage, authorization, auditability, and locked-application rules.

## Scope
- Add an application-owned document route that reauthorizes guardian ownership at access time.
- Preserve filename/content type and safe inline/download behavior without exposing raw Convex storage URLs.
- Add confirmed removal for guardian-owned uploads while the application/document requirement is editable.
- Preserve a tombstone/audit event and bounded orphan cleanup behavior.
- Clarify active versus superseded versions and replacement behavior.

## Definition Of Done
- Normal guardian navigation does not expose raw Convex storage URLs.
- Unauthorized route guesses fail closed.
- Editable uploads can be removed with confirmation and accurate UI state.
- Submitted/locked documents cannot be removed unless an explicit correction permits the requirement.
- Tests/typechecks pass.

## Expected Artifacts
- Same-origin Apply route.
- Convex removal/replacement mutation and audit behavior.
- Guardian UI and focused tests.
- Updated implementation notes.

## Constraints
- Never make admissions documents public.
- Do not weaken tenant/ownership checks.
- Do not physically delete shared/referenced storage blindly.
- Keep Admin sensitive-document access policy unchanged.

## Verification
Run focused Apply and Convex tests, affected typechecks/ESLint, and route-level checks. Browser confirmation remains user-owned.
