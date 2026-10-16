## Summary
First of three **sequential** deliveries, targeting `master`. Only this PR is being opened now; portal/history/notices and parent-edit permissions stay local until the preceding delivery merges. No concurrent stacked reviews.

- Unify roster and student-first admission into one atomic, retry-safe flow.
- Preserve first/middle/last names and captured profile fields across intake, imports, conversion and reopening; retain legacy full names without guessing.
- Link existing parents/guardians without overwriting their identity or credentials; add explicit contact/household edits, address inheritance and conservative unused-parent deletion.
- Use effective session class for profiles and subject selection. Identity-only saves preserve promotions/subjects; actual reassignment requires conditional confirmation and stale-state checks.
- Keep stored login IDs stable; configure verified suffixes for new identities only. Persist truthful portal-account state and keep passwords transient.

## Verification
- Backend/shared implementation checks: 125 Convex and 22 shared tests; relevant TypeScript checks passed.
- Frontend implementation checks: 77 focused tests and six TypeScript targets passed.
- Parent PR1 checkpoint: full Admin suite passed 371 tests before the final small retry correction.
- Final PR1 correction: 16 admission/photo/numbering tests, 12 backend idempotency tests and Admin TypeScript passed. Both admission screens now retain household confirmation after a committed response is lost; backend content-bound idempotency is unchanged.
- Independent cross-PR review identified that retry issue; narrow verification confirmed its resolution. The final merged local integration state passed 388 Admin tests, 32 Portal tests and 91 backend regressions; those broader counts include the unpublished later deliveries.
- Informational theme audit and diff checks completed.

## Draft / acceptance blocker
Real browser acceptance is **not yet performed**. The supplied private profile must pass isolated-backend/source/origin checks before the journeys run. Unit/component evidence is not a browser, mobile, provider or delivery claim. QA must use the attested isolated backend, not normal development or production.

No Convex deployment, production data change, DNS change or real email send was performed. This PR publication may trigger the repository's configured CI/preview integrations.

Secure emailed setup/reset links remain future work. This PR does not implement the later notification/history or parent-edit permission deliveries.
