# T10 Verification, Docs Sync, And Review

**Mode:** `vibe-review`  
**Workflow:** `/vibe-syncDocs` and `/review_code`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-syncDocs`.
- Read `/review_code`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `sync-docs`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Verify the Exam Recording v1 implementation, sync docs, and produce a final review summary.

## Scope

Included:
- typecheck/build/test verification
- feature doc sync
- related issue status updates
- review findings
- final summary of risks and next steps

Excluded:
- new product scope
- feature additions beyond bug fixes required for passing verification

## Context

Use:
- `docs/features/ExamRecording.md`
- `docs/issues/FR-006.md`
- `docs/issues/FR-007.md`
- completed implementation artifacts from `T07-T09`

## Definition Of Done

- Docs match implemented behavior.
- Verification status is recorded clearly.
- Review findings are documented with severity if issues remain.

## Expected Artifacts

- Updated feature doc
- Updated issue files if acceptance criteria status changed
- Result note or summary placed into the session folder

## Constraints

- Focus on bugs, regressions, missing tests, and risky gaps first.
- Do not expand scope during review.

## Verification

- Report whether typecheck, lint, build, and tests passed.
- Confirm the final docs mention the `/60 -> /40` school-wide rule.
