# Result publication index preparation

This PR only declares `issuedReportCards.by_class_and_session_and_term` as a staged index on an existing table. It does not query the index, publish results, or alter parent visibility. Staging lets Convex backfill it without blocking a large schema deployment.

## Dependency for graded result release

PR #88 uses this index to review every issued card for a class, session and term before releasing results. A staged index **cannot be queried**. Do not deploy #88's functions against the staged index.

With the owner's separate approval for each deployment step:

1. Merge/deploy this preparatory staged-index PR to the target Convex deployment and wait for the backfill to complete. Verify the index is ready in Convex, not just that CI passed. Do not change parent portal behavior in this step.
2. In PR #88, remove the `staged: true` flag to activate the now-backfilled index, then deploy the schema, default-deny portal gate and release functions in a coordinated backend step. An old live-draft-reading portal handler must not be restored as rollback.
3. Deploy the Admin and Portal frontends after backend registration, check parent/student visibility on a production-like school, then request separate production rollout approval. FR-023 narrative portal integration is an independent pre-merge/release gate.

Opening these PRs does not authorize merging, deploying, migrating data, or publishing any school results. If the staging/backfill has not completed, keep #88 unmerged. Historic terms without an authoritative class roster remain unreleasable even after the index is ready.
