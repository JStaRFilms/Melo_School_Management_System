# D3 — Structured content editing and permissions design

**Stage:** Design | **Role:** Designer | **Depends on:** G1, G2 | **Worktree:** documentation/design only

## Objective
Design the bounded admin experience that lets a school operate content and admissions settings without being given a generic page builder or unsafe access to sensitive application data.

## Scope
- Admin navigation, roles, permissions, draft/preview/publish/revert flow, audit history, and approval guardrails.
- Typed editors for identity/contact data, brand assets, approved page copy, programmes, galleries, policies, CTA/link configuration, domain status guidance, admissions programme/intake/product, form fields, document requirements, and declaration text/versioning.
- Validation, asset constraints, preview behavior, publication rollback, and support/escalation patterns.
- Separation between schools’ editable configuration and code-owned renderer/component/deployment controls.

## Constraints
- Never allow arbitrary HTML/JS, component placement, or layout construction.
- Sensitive admission configuration has least-privilege permissions and auditable publication.
- Content can never overwrite an immutable submitted application snapshot.

## Deliverables
- `docs/features/SchoolContentAndAdmissionsSettingsUX.md`
- `docs/mockups/admin/school-content-and-admissions-settings.html` (or design-file/export reference)
- Permission/action matrix consumed by B0, B3, and B4.

## Done when
- Each editable field has an owner, validator, preview rule, and publication rule.
- The specification identifies which fields live with site core versus admissions domain.
- B3/B4 can implement without reopening the page-builder decision.
