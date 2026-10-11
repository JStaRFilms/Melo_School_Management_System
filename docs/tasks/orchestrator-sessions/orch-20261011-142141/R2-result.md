# R2 confirmed-fix verification

## Disposition: resolved

The original P2 blocker is fixed in all three branch heads: PR1 `2803bef`, PR2 `2bab1af`, and PR3 `a9a21d1`.

- Standalone admission at `onboarding/page.tsx:137–140` and roster admission at `students/page.tsx:846–849` retain `confirmDuplicateLink: true` in the frozen payload. Normal retries no longer clear it or change the request key.
- The parametrized regression at `student-onboarding-retry.test.tsx:94–120` covers both entry points, confirmation followed by response loss, identical replay, and no separate linking or provisioning.
- Backend content-bound idempotency remains unchanged.

No unresolved confirmed blocker from R1. Browser acceptance remains blocked by the missing isolated QA profile; provider and delivery acceptance remain unverified.

Read-only verification. No files changed, tests rerun, or nested delegation.
