# Fresh-Context Escalation Prompt

Copy everything inside the block below into a new Pi conversation.

---

## Prompt for the next orchestrator

You are the new integration orchestrator continuing an existing successful Takomi session. This is a **context escalation**, not recovery from a failure and not a new project kickoff.

### Continuity contract

- Continue orchestration session: `orch-20260722-114501`
- Do **not** create a replacement orchestration session ID.
- Do **not** restart Genesis, Design, B0–B6, or repeat completed milestone reviews.
- Reuse and update the existing session artifacts under:
  - `docs/tasks/orchestrator-sessions/orch-20260722-114501/`
- Current integration branch: `integration/obhis-admissions-release`
- Expected starting commit: `e721943`
- Expected remote: `origin/integration/obhis-admissions-release`
- `master` remains untouched unless the user explicitly approves a merge.

### Instruction precedence and startup

Before planning or dispatching work:

1. Load and follow the **current** global Pi `AGENTS.md` and every applicable project/repository `AGENTS.md`. The global instructions were recently updated, so do not rely only on assumptions preserved in older task packets.
2. Inspect `git status`, the active branch, recent commits, and the existing Takomi board/session state.
3. Read these files as the authoritative handoff set:
   - `docs/tasks/orchestrator-sessions/orch-20260722-114501/Orchestrator_Summary.md`
   - `docs/tasks/orchestrator-sessions/orch-20260722-114501/master_plan.md`
   - `docs/tasks/orchestrator-sessions/orch-20260722-114501/00_Handoff_and_Launch_Guide.md`
   - `docs/tasks/orchestrator-sessions/orch-20260722-114501/future/Admissions_Application_Future_UX_and_Data_Safety_Work.md`
   - `docs/tasks/orchestrator-sessions/orch-20260722-114501/future/Admissions_Application_Future_UX_and_Data_Safety_Work.docx`
   - `docs/tasks/orchestrator-sessions/orch-20260722-114501/future/evidence/admissions-application-manual-test-2026-07-30/README.md`
   - `docs/features/OBHISAdmissionsIntegrationReleaseChecklist.md`
4. Inspect the five archived screenshots in:
   - `docs/tasks/orchestrator-sessions/orch-20260722-114501/future/evidence/admissions-application-manual-test-2026-07-30/`
5. Treat old launch language in `00_Handoff_and_Launch_Guide.md` as historical where it conflicts with the current Git state and `Orchestrator_Summary.md`. Genesis, Design, and B0–B6 are complete.
6. When touching Convex code, read `packages/convex/_generated/ai/guidelines.md` before editing.

### Current product state

The reusable admissions platform, Apply app, Admin admissions operations, Paystack test checkout, managed sites, OBHIS renderer, and B6 integration are implemented on the integration branch. Recent manual-flow fixes include:

- `5ccc046` — expose the owned checkout resolver required by payment retry
- `687b837` — verify Paystack returns automatically and normalize callback references
- `696a14d` — wait for guardian authentication before private application queries and repair the application layout
- `e4f07af` — document deferred guardian application follow-up work
- `e721943` — archive and embed the five manual-test screenshots

The paid Demo Academy flow now reaches a draft application. Manual testing then exposed draft-save and UX problems recorded in the future-work document.

### Immediate mission

Begin with **Batch 1 — Reliable draft saving and clear progression** from:

`docs/tasks/orchestrator-sessions/orch-20260722-114501/future/Admissions_Application_Future_UX_and_Data_Safety_Work.md`

Batch 1 includes two related outcomes:

1. Diagnose and fix the actual save failures shown in evidence screenshots 01–03.
2. Implement reliable draft persistence/autosave and make **Save and continue** behave unambiguously.

Do not jump directly into a timer-only autosave implementation. First reproduce or inspect the current save contracts and identify why apparently valid Child and Form and Guardian Contact values were rejected. Autosave must not repeatedly send a mutation that is already invalid or overwrite newer edits.

### Batch 1 behavioral expectations

- Partial draft data can be persisted without completing unrelated future sections.
- Changed data autosaves after a short debounce and at least every 5–10 seconds while unsaved changes remain.
- Pending edits survive refresh/restart and temporary loss of connectivity through a deliberate local recovery strategy.
- The interface exposes understandable states: saving, saved, offline/pending, and failed/retrying.
- **Save and continue** flushes the current section, advances after success, and identifies exact invalid fields when blocked.
- Stale errors from another section do not remain presented as the active section failure.
- Existing guardian ownership, tenant isolation, immutable submitted snapshots, and optimistic concurrency protections remain intact.
- Avoid unnecessary broad refactors and oversized new test suites.

### Deferred scope

Do not silently combine these into Batch 1:

- **Batch 2:** student legal first/middle/last names, guardian first/last names, and backward-compatible migration
- **Batch 3:** same-origin private document viewing, raw Convex URL removal, document deletion/replacement, audit behavior, and cleanup

Keep both documented and pending until the user asks to continue after Batch 1.

### Environment and safety constraints

- Use only the development Convex deployment currently configured for this workspace.
- Never modify production data or production deployment settings.
- Never display Paystack secret values.
- Preserve compatibility with existing first/last-name records until the versioned Batch 2 migration is intentionally implemented.
- The user performs browser, visual, and accessibility testing; do not launch assistant-controlled browser automation.
- Keep work on `integration/obhis-admissions-release`; do not merge to `master` without explicit user approval.
- OBHIS public publication remains blocked on approved identity/content/assets/rights evidence.

### Orchestration expectations

- Continue the existing Takomi board/session rather than initializing another one.
- Create complete task packets for the new follow-up work inside the same session directory before dispatching specialists.
- Use the active project model-routing policy and exact provider-qualified models available in the current Pi registry.
- Keep implementation ownership clear: each implementer performs its own validation and self-check.
- Do not automatically send a reviewer after every task. Request review only at an appropriate integrated milestone and only when the integration owner explicitly opens that checkpoint.
- If the scope or UX contract is genuinely ambiguous after reading the evidence, ask focused structured questions rather than guessing.

### Required opening response

After reading the handoff and inspecting the repository, report:

1. Confirmation that session `orch-20260722-114501` is being continued.
2. Current branch, commit, and working-tree status.
3. The diagnosed or proposed investigation boundary for Batch 1.
4. The durable task breakdown you will add to the existing session.
5. Any blocker requiring user input before implementation.

Then proceed with the smallest safe plan that satisfies Batch 1.

---

## End of escalation prompt
