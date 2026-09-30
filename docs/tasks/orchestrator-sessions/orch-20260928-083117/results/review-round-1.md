# Review round 1, fixed point origin/master...99bada7

Three independent read-only Sol High passes: repository standards, approved spec, and security/privacy. No FR-023 code touched. Findings classified by orchestrator:

## Confirmed blockers

1. Historical/current class roster inference is not an authoritative term roster. `resultPublication.ts` cannot certify a full historical denominator when a former student has zero records. Limit new releases to a provable *currently active* session/term/class roster and require an explicit separate historical roster reconciliation before releasing old periods. Never silently omit history-only students. Document current-term class changes as a limitation; fail closed if conflicting evidence. Keep existing frozen released history readable after term/archive.
2. School-wide 512-student/promotion/issued scans make small-class release unavailable on large campuses and may exhaust transaction read budgets. Scope indexed evidence and bound per-tuple roster; if proof of completeness cannot be obtained, block with a clear remediation path. No partial release.
3. `portal.ts` loops across every class release per term and 256 terms, with 32-class cutoff and N+1 inclusion reads. Add a student-keyed frozen inclusion index; bound history independently and preserve selected result when history exceeds budget. Test >32 classes and older released term.
4. A released archived class cannot be inspected from Admin; read existing publication first, allow frozen inspection; block only *new* release for archived tuples.
5. Rollback contract requires a server-side stop for new releases; mutation currently lacks it. Implement an auditable, restricted server-side setting/kill switch, tested by direct mutation calls; never turn off parent default-deny reads.

## Partial or optional

- `selectedResultState` does not distinguish no historical enrollment from withheld; current UI test mocks a state the backend rarely returns. Address if there is a safe proof independent of unpublished draft existence, otherwise prefer uniform withheld as privacy default and note explicit limitation.
- Reason prose controls exclusion and button state. Change to stable codes/allowExclusion when touching readiness; string copy should not grant permission.
- FR-023 narrative integration is a separate worktree and must be jointly tested when merging branches. Do not claim narrative integration is complete in this graded PR.

Correct confirmed blockers in one consolidated pass, then final independent read-only review. No PR or deploy before correction and test evidence.
