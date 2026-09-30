# Session scoring policies

**Status note:** Implementation and backend handoff are present in the working tree. This file's original plan and definition of done are historical planning text, not evidence that release gates, PR review, or deployment verification have passed. The implementation has not received replacement certification workflow support. See `backend-handoff.md` for actual API behavior and test coverage.

## Goal
Ship editable per-session assessment scoring policies in the isolated `feat/session-scoring-policies` worktree based on `origin/master` at `23c4880`. Preserve existing sessions and issued documents. Open a PR after local review, request `@codex` review, and monitor checks/comments until green or blocked.

## User contract
- Three editable preset starters: CA 20/20/20 + exam raw /40 worth 40; CA 20/20/20 + exam raw /60 worth 40; CA 20/20/10 + exam raw /50 worth 50. Every CA contribution and exam raw/contribution maximum can be edited; total contribution must equal 100. Exam contribution = round(raw / raw maximum × contribution maximum, 2).
- Scoring policies belong to academic sessions. A change within a session recalculates that session's scores after a clear warning and an audit trail; other sessions do not change.
- Before applying a change, detect existing raw scores that exceed new maxima, block the change with actionable references, and avoid partial regrades. Show clear, lightweight warnings for affected reports when preparing to print. Never silently replace a certified/issued report; provide recertification guidance.
- Honor branch/group governance, school boundaries, teacher permissions and historical reads. Preserve legacy behavior for sessions with no explicit policy. Keep grading bands separate from weight configuration.

## Stages and work
1. Genesis: inspect assessment policy, group-default, score entry, reports, imports and certification; produce architecture and rollout/consistency strategy. Identify edge cases and test seams before editing.
2. Design: define compact admin session selector, editable presets, impact preview/confirmation and report-card print warning using existing UI components, tenant theme rules and accessibility.
3. Build: implement shared policy contract/calculations/validation; Convex session version/save/regrade/audit, including safe scaling and historical fallback; wire teacher/admin grid, setup UI and report warning; update migration/report aggregation paths and tests. Split independent work only where file writes do not overlap.
4. Review: verify against this plan and repo standards with independent standards/spec reviews plus integration/security review; remediate using same agent conversation where possible. Run tests, typecheck, lint, build and theme audit; document limitations.
5. PR: commit/push feature branch, open PR, request `@codex` review, use `pr-babysitter` to handle comments/checks until green or an explicit blocker. Do not merge without user request.

## Safety decisions to confirm during genesis
- Policy edit while scores exist must not race with score entry or publish inconsistent totals. If a single Convex transaction cannot safely cover a large session, use a durable guarded rollout and report completion only after all rows have been recalculated.
- Existing issued reports retain immutable originals; display impact and require explicit recertification. Clarify the current issuance/print behavior in code before implementation.
- Use exact provider-qualified Sol models for complex build/review and Luna for bounded research only. No Astra.

## Definition of done
Three presets remain editable; arbitrary valid configurations work; raw scores recalculate for only the selected session after explicit confirmation and audit; invalid scores block; prints show appropriate warning; old issued report payloads stay immutable; tests and reviews pass; PR receives `@codex` review and checks monitored. If any gate is blocked, report it plainly instead of claiming completion.

## Implementation and release status

The backend handoff documents the implemented scan, guarded batched regrade, audit publication, legacy fallback and mixed-snapshot limitation. Its listed tests cover these paths. The feature code and tests are present in the working tree, but this documentation update did not run tests, typecheck, lint, build, live smoke tests, theme audit, PR review, or deployment verification. Those remain release checks; do not treat this note as a passed release verification. Issued reports remain unchanged and receive a print warning, but no replacement certification flow exists.
