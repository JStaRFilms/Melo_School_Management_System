# Delivery plan

## PR 1: identity and admission fixes
Names for everyone, class/session identity-save safeguards, conditional reassignment confirmation, unified roster and student-first intake, parents/guardians contact picker and relationship controls, residential address inheritance/overrides, safe deletion of unused parents, stable login IDs and school-domain suffix settings.
B1 backend and B2 frontend form this delivery unit.

## PR 2: portal and account notices
Persisted provisioning presentation and delivery status, truthful fixed-header connection/draft state, parent session/year and term/result browsing, durable five-minute Resend account-notice deduplication.
B3 forms this delivery unit. Stack from PR1 where required.

## PR 3: parent editing permissions
Parent own and linked-child nonacademic fields, initial scoped admin permission, drafts/review, bold warning, immediate successful apply + permission consumption, lockout, new requests and audit. No second admin change approval. Students excluded.
B4 forms this delivery unit. Stack from earlier settled identity/portal contracts.

## Commits
User authorized small incremental LOCAL commits for completed tested pieces. Current implementation writer exclusively owns Git index/commits; parent does not stage concurrently.
Record hashes and check results. Never stage unrelated main-checkout changes, secrets, temp logs or known failing partial code. Local commit authorization does not imply deployment or email sends.
Push/PR publication happens only when each delivery is verified and external authorization is established.

## Deferred at the end
Expiring email setup/reset links, per explicit user instruction. Not part of these PRs.
