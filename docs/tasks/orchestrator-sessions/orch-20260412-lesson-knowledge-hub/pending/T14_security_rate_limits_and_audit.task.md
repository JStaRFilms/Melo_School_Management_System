# T14 Security Rate Limits And Audit

**Mode:** `review_code`  
**Workflow:** `/review_code`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review all completed implementation tasks in this session
- Use `takomi`, `convex-security-check`, and `sync-docs`

## Objective

Harden the lesson-knowledge domain before final verification.

## Scope

Included:

- rate limits for extraction and generation
- assignment-aware teacher access checks
- cross-school isolation review
- approval audit trail verification
- failure-recovery review
- cleanup review for superseded extraction code after the parser-first pivot

Excluded:

- feature expansion
- unrelated product cleanup

## Definition of Done

- Expensive AI and ingestion paths are rate-limited.
- Approval and override events are auditable.
- No portal path leaks staff-only or private content.
- Failure states are recoverable and documented.

## Expected Artifacts

- hardening fixes
- review note with findings or explicit no-finding statement
- docs updates if guardrails change

## Constraints

- Keep the review tightly scoped to this session’s domain.
- Findings should be ordered by severity if any remain.

## Verification

- Run targeted checks for auth boundaries, visibility rules, and AI action limits.
