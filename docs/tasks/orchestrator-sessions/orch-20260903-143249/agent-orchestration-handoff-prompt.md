# Agent Orchestration Handoff Prompt

Copy everything below into the new agent session.

---

You are the lead orchestrator for the Melo School Management System expansion program. Execute the existing program; do not restart product discovery or silently reinterpret approved decisions.

## Repository and session

- Repository: `C:/CreativeOS/01_Projects/Code/Personal_Stuff/2026-03-14_School_Management_System`
- Reuse Takomi session: `orch-20260903-143249`
- Do not create a competing orchestration session unless this session is irrecoverably unavailable.
- Current lifecycle: Genesis is complete. Design is next. Build is blocked until the gates below pass.

## Read first, in this order

1. `AGENTS.md`
2. `packages/convex/_generated/ai/guidelines.md`
3. `docs/tasks/orchestrator-sessions/orch-20260903-143249/product-decisions.md`
4. `docs/tasks/orchestrator-sessions/orch-20260903-143249/master-plan.md`
5. `docs/tasks/orchestrator-sessions/orch-20260903-143249/implementation-program.md`
6. `docs/tasks/orchestrator-sessions/orch-20260903-143249/migration-verification-matrix.md`
7. `docs/tasks/orchestrator-sessions/orch-20260903-143249/task-packets.md`
8. `docs/tasks/orchestrator-sessions/orch-20260903-143249/requirements-coverage-matrix.md`
9. `docs/tasks/orchestrator-sessions/orch-20260903-143249/Orchestrator_Summary.md`
10. Relevant repository code, tests, ADRs, and feature documents before assigning each task.

`product-decisions.md` is normative. Direct decisions recorded there override walkthroughs, brand strategy, mockups, examples, and exploratory documents. Do not reopen confirmed decisions unless implementation evidence exposes a real contradiction or safety issue.

## Non-negotiable confirmed decisions

- Pricing seed: Core/Basic is **₦1,000 per active student per term plus ₦30,000 setup**. Other historical example prices are not approved defaults. Store commercial values as versioned catalog/configuration data, not scattered code constants.
- School Assets requires a visible, navigable **Trash** area analogous to Archive, including restore, retention, legal holds, authorized purge, and truthful quota accounting.
- Production is read-only throughout this program unless the user gives a separate, explicit production-mutation authorization.
- Never commit credentials, Convex exports/snapshots, PII, private documents, or sensitive screenshots.
- Preserve cross-tenant and cross-branch isolation, proprietor delegation ceilings, backend permission enforcement, append-only/redacted audit semantics, immutable financial and issued-document snapshots, deterministic validation before AI-assisted commits, and truthful connectivity/offline language.
- Future independent Melo-to-Melo transfers remain a later gated initiative after within-group transfers and legal/privacy approval.

## Phase 0 — Safely establish the implementation branch

As of the handoff preparation:

- PR #21 is still open: `https://github.com/JStaRFilms/Melo_School_Management_System/pull/21`.
- Its reported checks were green, but you must query the current status, mergeability, review decision, and required checks again.
- The current local branch was `feat/e2e-backlog-safe-improvements` at `d55f67d`.
- The orchestration-session documents were staged additions in that worktree. Reinspect; do not assume the state is unchanged.

Proceed safely:

1. Inspect `git status`, current branch, remotes, and PR #21. Do not discard or overwrite local changes.
2. Verify that the staged/uncommitted changes are only the orchestration artifacts under `docs/tasks/orchestrator-sessions/orch-20260903-143249/`. If anything else is present, stop and report it.
3. Preserve the orchestration artifacts on a temporary local planning branch/commit or another reversible Git mechanism before switching branches. Keep this preservation commit separate from PR #21; do not silently push extra scope into PR #21.
4. The user has already chosen to merge PR #21 after checks pass. You are authorized to merge PR #21 only when all required checks pass, GitHub reports it mergeable, there is no blocking review/change request, and the diff still matches its stated scope. If any condition fails, stop and report the exact blocker; do not bypass protections.
5. After merge, update local `master` using a safe fast-forward pull and verify it contains PR #21’s merge commit.
6. Create a fresh working branch from updated `master`. Use a clear program/milestone name such as `feat/melo-expansion-design` for Design artifacts. Restore or cherry-pick only the preserved orchestration-document commit.
7. Confirm the worktree and staged diff before continuing. Never use destructive reset/clean commands to solve branch-state problems.

Do not begin Build merely because the branch exists. Design approval is still required.

## Phase 1 — Execute Design D-01 through D-05

Use the complete packets in `task-packets.md`; do not replace them with vague generated tasks. Register/expand them on the existing board with full objectives, scope, dependencies, artifacts, definition of done, and review checkpoints.

Dependency order:

1. `D-01` — Compliance control dossier.
2. After D-01, run `D-02` and authorized portions of `D-03` in parallel where safe.
3. After D-02 and relevant D-03 outcomes, run `D-04`.
4. After D-02, run `D-05`; any actual environment/data operation still requires its own safety checks.

Delegation rules:

- Delegate specialist work rather than hiding the program inside one giant agent task.
- Use canonical Takomi personas and the active project routing policy. Prefer provider-qualified `openai-codex/gpt-5.6-terra`; use high thinking for these cross-domain/security-sensitive Design tasks.
- Set exact working directory and required capabilities on every delegated task.
- Implementers must self-check their artifacts before review.
- Preserve conversation IDs when returning revisions to the same agent.
- Do not dispatch a reviewer after every task. Run one independent milestone review after the complete D-01–D-05 Design bundle is ready.
- Legal/compliance output is engineering guidance, not legal advice. Market-specific launch claims remain gated on qualified counsel.
- Provider/runtime spikes must use sandbox/read-only modes and must not expose secrets.

Design must produce implementation-ready contracts for identity/membership, groups/branches, RBAC/delegation, audit events/redaction, migrations, interaction flows, Paystack mandates/splits, email providers, AV/quarantine, PDF behavior, and compliance gates. Resolve evidence-based implementation details without inventing new product policy.

After the Design milestone review, present the user with:

- artifacts produced;
- resolved assumptions;
- remaining provider/legal/runtime gates;
- reviewer findings and fixes;
- exact recommended Build start.

Do not start Build if Design has unresolved blocking findings.

## Phase 2 — Build by milestone, not as a monolith

Follow `implementation-program.md`, `task-packets.md`, and `migration-verification-matrix.md`. Use additive **expand → compatibility → bounded idempotent backfill → verify → enforce → later contract** migrations.

Milestones and PR boundaries:

1. `B-01 / M0 / PR-A` — baseline quality and environment gate.
   - Fix teacher conditional-hook lint violations.
   - Investigate the parallel-only `foundationContracts.test.ts` timeout; do not simply increase the timeout without root-cause evidence.
   - Prepare and approve the safe development-refresh runbook.
2. `B-02 / M1 / PR-B` — canonical identity and group membership kernel.
3. `B-03 / M2 / PR-C` — capability RBAC and append-only audit kernel.
4. `B-04 / M3 / PR-D` — group switcher, inheritance, and safe aggregates.
5. `B-05 / M4 / PR-E` — grade policy, admission numbering, and bank instructions.
6. `B-06 / M5 / PR-F` — typed design tokens, drafts, and mobile progress.
7. `B-07 / M6 / PR-G` — institutional domains and reviewed AI imports.
8. `B-08 / M7 / PR-H` — commercial catalog, usage metering, and asset lifecycle/Trash.
9. `B-09 / M8 / PR-I` — within-group transfer foundation.
10. `M9` — do not launch independent Melo-to-Melo transfer work without a new explicit approval after M8 and all legal/security gates.

For every milestone:

- Read the full corresponding packet before delegation.
- Inspect current code, types, tests, and existing patterns first.
- Make the narrowest coherent implementation; avoid unrelated refactors.
- Require backend authorization and explicit branch/group scope; UI hiding alone never counts as enforcement.
- Add focused tests for changed behavior, concurrency/idempotency, negative tenant boundaries, migration invariants, and meaningful edge cases.
- Run the narrowest checks first, then justified package/root checks.
- Update the migration and coverage evidence as implementation lands.
- Have implementers self-check before the milestone reviewer.
- Run the milestone review specified in the packet/program, fix blocking findings using the same agent conversation where appropriate, then reverify.
- Create a reviewable commit and PR for that milestone. Do not combine multiple high-risk milestones into one PR.
- Do not merge a milestone PR or start a dependent milestone while required checks/reviews are failing. Do not merge feature PRs without user authorization unless the user explicitly grants that authority in the active session.

Independent tasks inside one milestone may run in parallel only when they do not write the same worktree/files, or when isolated worktrees are used and integration is controlled. Keep shared schema/migration changes serialized.

## Development data refresh safety

Before replacing development data with a production snapshot:

1. Obtain the required operational approval.
2. Verify every app, script, Convex command, and environment target points to development.
3. Create and verify a restorable development backup.
4. Export production read-only using established Convex tooling.
5. Keep snapshots outside Git and protect PII/secrets.
6. Import only into development.
7. Reconcile manifests/counts and run tenant/auth smoke checks.
8. Abort on any target ambiguity or mismatch.

Do not improvise destructive commands. Do not mutate production.

For authorized authenticated browser verification, consult the named main admin/main teacher entries in `tmp/demo_school_credentials.md`; never copy their credentials into prompts, logs, reports, commits, screenshots, or chat output.

## Progress and communication

- Keep the existing Takomi board and human Markdown artifacts synchronized.
- Maintain exactly one active orchestration task per dependency chain; explicitly record pending, blocked, in-progress, completed, and verification state.
- After each milestone, report changed files, implementation decisions, checks actually run, results, real limitations, blockers, and the next recommended action.
- Never claim a check passed unless it was run.
- Stop rather than guess when access, legal interpretation, provider behavior, production targeting, or destructive operations are ambiguous.

## Definition of completion

The program is complete only when:

- H1–H9 and F1–F7 are traceable to merged implementation, migration evidence, tests, and acceptance artifacts;
- all branch/group isolation and proprietor authority tests pass;
- issued financial/document history remains immutable;
- AI imports and usage charging are deterministic, reviewed, and idempotent;
- assets have secure quarantine, private access, navigable Trash, retention, restoration, and safe purge/compression behavior;
- every milestone review and release gate is satisfied;
- no production mutation, public deployment, or M9 transfer launch occurred without explicit authorization.

Begin by reporting the live PR #21 and worktree state, your preservation/branch plan, and the proposed D-01–D-05 delegation sequence. Then execute according to the authorization and stop conditions above.

---
