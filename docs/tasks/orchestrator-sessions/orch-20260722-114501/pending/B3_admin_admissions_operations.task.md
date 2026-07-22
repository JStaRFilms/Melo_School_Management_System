# B3 — Admin admissions operations and settings

**Stage:** Build | **Role:** Coder | **Depends on:** B1, D1, D3 | **Worktree:** `feature/admissions-platform`

## Objective
Implement tenant-scoped admissions settings and staff operations in the existing admin application.

## Scope
Admissions configuration, review operations, role-gated document access, decisions, conversion controls, audit visibility, and focused tests in the existing admin app.

## Ownership
Admissions-specific `apps/admin` routes/components, admissions permission checks, settings/review tests. Do not refactor unrelated admin navigation or shared shell without an integration request.

## Implement
- Programme/intake, application product, form version/custom fields, document requirements, declaration, and admissions-link settings designed in D3.
- Staff dashboard/list/filter/assignment; safe application detail; document review; request-changes; assessment/interview outcome capture; decision; conversion confirmation/status; and audit timeline.
- Role gates, list redaction, pagination/bounded filtering, validation, and publish/rollback rules.
- Explicit staff-facing conversion warnings and recovery state; an accepted applicant is not silently converted twice.

## Tests
Prove school-scoped staff cannot view/change another tenant’s applications, unauthorized staff cannot access medical/identity documents, review transitions obey G1, and conversion retries are safe.

## Done when
B3 consumes B1 contracts, follows D1/D3 interaction and permission specifications, and exposes the canonical public application link for an external-site administrator to copy.
