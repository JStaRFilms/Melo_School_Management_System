# B1 — Admissions domain, payment entitlement, documents, review, conversion

**Stage:** Build | **Role:** Coder | **Depends on:** B0, D1 | **Worktree:** `feature/admissions-platform`

## Objective
Implement the approved server-side admissions domain without building the public or staff interfaces.

## Scope
Server-side admissions entities, state transitions, payment entitlement, private documents, review, conversion, audit events, and focused tests; no public or staff UI.

## Ownership
`packages/convex/functions/admissions/**`, admissions validators/tests/docs, and the integration-approved schema hooks. Propose rather than directly edit unassigned shared files.

## Implement
- Programmes/intakes, form definitions/versions/custom fields, application products/prices, guardian identity, slots, drafts, submitted snapshots, documents, review activity, decisions, conversion ledger, and audit events.
- Authenticated tenant-scoped queries/mutations with explicit validators and indexed bounded queries.
- Payment initiation and verified webhook/receipt flow using provider adapter conventions; idempotency keys and replay-safe entitlement creation are mandatory.
- Private upload authorization and signed file retrieval with document category/verification metadata.
- Idempotent accepted-application conversion with linked canonical family/student/user handling and `application_upload` photo provenance.
- Retention-oriented status/cleanup primitives; do not delete records automatically without approved policy.

## Tests
Cover authorization cross-tenant denial, payment replay, single-submission slot invariant, document ownership/access denial, decision transitions, conversion retry/duplicate prevention, and snapshot immutability.

## Done when
Backend contract is documented for B2/B3, tests pass, and every unresolved shared-schema change is an explicit integration-owner request.
