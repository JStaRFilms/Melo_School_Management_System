# R1: Review selectable billing delivery

## Agent setup

Follow the Review-only role. Read the master plan, G1 architecture, D1 design, all Build results, and the complete branch diff. Do not edit code.

## Objective

Report only confirmed correctness, security, accounting, compatibility, and requirement defects in the selectable billing delivery.

## Review scope

- Tenant isolation and parent/student authorization
- Class eligibility and collection/item ownership
- Duplicate and idempotent invoice creation
- Legacy optional-item compatibility
- Invoice total, balance, status, installment, and outstanding calculations
- Stale selection handling and lock after any payment/allocation
- Payment-link revision and amount consistency
- Admin and Parent Portal discoverability and failure states
- Focused test coverage for changed behavior

## Definition of done

- Findings cite exact files and lines, explain user impact, and distinguish blockers from non-blocking observations.
- No style-only or speculative finding is treated as a blocker.
- The report states whether the branch is ready to merge.
- No files are modified.

## Expected output

Return the review in the subagent response. Do not write files. The orchestrator will record accepted findings and merge readiness.

## Handoff

If a confirmed blocker exists, provide the smallest correction and verification required. Revisions return to the original implementing conversation when possible.
