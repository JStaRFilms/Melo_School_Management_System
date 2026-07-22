# B0 — Shared foundation contracts and schema integration

**Stage:** Build | **Role:** Coder | **Depends on:** G1, G2, D3 | **Worktree:** integration owner only

## Objective
Land the smallest reviewed foundation commit that makes admissions and bespoke sites independently buildable without competing edits to shared contracts.

## Scope
Shared contracts, additive schema integration, authorization/link primitives, compatibility, and contract tests only; no feature UI.

## Ownership
`packages/convex/schema.ts`, shared validators/types, package/workspace manifests, shared auth/link helpers, generated Convex reconciliation, migration notes, and contract tests. No feature UI.

## Implement
- The approved tenant/school identity, permission, domain/link, structured-content boundary, and admissions identifiers/types from Genesis.
- Safe additive schema migration(s), indexes with complete descriptive names, explicit validators, and migration/compatibility strategy.
- Canonical `ApplicationLink` resolver/contract usable by `apps/sites`, external sites, and the new public app; it must not rely on request-host-only guessing.
- Role/authorization primitives required by both branches, without expanding privileges.
- Contract tests covering tenant isolation, canonical link generation, and compatibility with existing records.

## Guardrails
Read Convex guidelines first. No destructive data migration, placeholder security bypass, generated-file hand edits, or scoped feature implementation. Flag anything requiring a backfill/production rollout.

## Deliverables
- A mergeable foundation commit plus `docs/features/AdmissionsAndSiteFoundationContract.md`.
- Admissions and sites worktrees can start using stable types/routes without editing the same shared files.
- Typecheck and targeted Convex tests pass; migration and rollback instructions are recorded.

## Done when
The integration owner has merged the reviewed foundation and both feature worktrees have no unowned shared-file edits remaining.
