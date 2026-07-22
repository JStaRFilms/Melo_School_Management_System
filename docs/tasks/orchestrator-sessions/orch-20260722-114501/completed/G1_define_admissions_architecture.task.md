# G1 — Admissions architecture and lifecycle

**Stage:** Genesis
**Role:** Architect (write-capable)
**Dependency:** none
**Worktree:** documentation-only; do not modify runtime code

## Objective

Author the decision-grade architecture for a reusable, tenant-aware, paid admissions platform. It must turn the confirmed guardian-plus-child-slot model into explicit domain, state, security, conversion, and API contracts without prematurely implementing them.

## Required reading

- `00_Handoff_and_Launch_Guide.md`
- `master_plan.md`
- `README.md`
- `packages/convex/_generated/ai/guidelines.md`
- Existing student, family, user, billing/payment, auth, storage, and portal code/schema.
- `C:/CreativeOS/01_Projects/Clients/OBHIS/Enrollment application form/`

## In scope

1. Map reusable existing records/functions and identify what admissions must own separately.
2. Define entities, ownership, cardinality, indexes, and immutable snapshots for programmes/intakes, form versions/custom fields, products/prices, purchase attempts/webhooks, entitlements, guardian identities, applications/drafts, documents, review activity, decisions, conversion, and audit events.
3. Define every state transition, actor, invariants, idempotency/replay key, failure/retry behavior, and terminal state for: payment, entitlement, application, document review, admission decision, and conversion.
4. Specify a stable public route/link contract that external and managed sites can both use. Prefer a dedicated public application surface; do not couple the API to `apps/sites` rendering.
5. Specify consent, declaration, retention/deletion, private storage, signed access, school scoping, least privilege, staff audit logging, and safe handling of minors’ medical/identity data.
6. Define field taxonomy: core identity/contact/class-placement fields; school-configurable fields; document requirements; optional sensitive fields. NIN, passports, genotype, religion, health information, and AI verification are never default-required.
7. Specify acceptance conversion as an idempotent operation that preserves the submitted snapshot, creates/links guardian/family/student records, handles photo provenance, and delays onboarding communications outside the transaction.
8. Define test matrix and the exact foundation changes that require integration-owner ownership.

## Explicit non-goals

- No schema or UI implementation.
- No automatic OCR, document validation, or AI eligibility decision.
- No factual OBHIS price/contact/legal statement treated as approved.
- No direct creation of a canonical student at checkout or form submission.

## Required artifacts

1. `docs/features/AdmissionsApplicationPlatformArchitecture.md`
2. `docs/decisions/ADR-AdmissionsApplicationSurfaceAndLifecycle.md`

The architecture must include tables/indexes, state-machine tables, authorization matrix, sequence diagrams (Mermaid is acceptable), public/API contract, data classification, retention proposal, error/recovery behavior, and phased build mapping to `B0–B6`.

The ADR must record the decision, alternatives rejected (per-site forms, anonymous-only flow, create-student-on-payment/submission), consequences, and rollback/migration notes.

## Acceptance checklist

- [ ] One paid slot cannot yield two submitted applications.
- [ ] A guardian can legitimately buy slots for siblings.
- [ ] Payment webhook replay cannot create duplicate entitlement or application data.
- [ ] A rejected/abandoned applicant’s sensitive files cannot be publicly enumerated.
- [ ] Conversion is idempotent and auditable even after an interrupted first attempt.
- [ ] Every high-risk data item is optional by default or has a stated lawful/operational purpose.
- [ ] Shared-file changes are named as proposals, not applied.

## Result handoff

Return the two artifact paths; a concise list of unresolved business approvals (price, payment methods, required documents, reviewer roles, retention windows); and the exact contracts `D1`, `D3`, and `B0` must consume.
