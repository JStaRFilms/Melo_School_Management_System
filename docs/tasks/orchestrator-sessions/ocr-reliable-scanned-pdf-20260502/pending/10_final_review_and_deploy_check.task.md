# Final Review and Deploy Check

## Agent Setup

### Workflow to Follow

Read the Takomi `mode-review` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before review.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow review handoff conventions |
| convex-security-check | Verify tenant/security correctness |
| security-audit | Review risky provider and auth behavior |

## Role

Senior Reviewer.

## Recommended Model

GPT-5.5.

## Objective

Perform final security, architecture, and deployment readiness review.

## Files Likely Touched

None unless fixes are required.

## Dependencies

- Tasks 05 through 09 complete.

## Acceptance Criteria

- No public function trusts client-provided `userId`.
- No cross-school material/job/chunk access is possible.
- Provider secrets are server-only.
- Signed URLs are never persisted.
- Provider errors are graceful and safe.
- Retry limits, rate limits, and audit logs are present.
- No native canvas/PDF rendering packages are added to Convex.
- Docs are in sync.
- `pnpm typecheck` passes or failures are documented.
- `pnpm convex deploy` succeeds after Convex code changes, or failure is documented clearly.

## Verification Commands

- `pnpm typecheck`
- Targeted tests if available
- `pnpm convex deploy`
