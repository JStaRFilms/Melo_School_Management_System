# Admissions UI Quality Backlog

**Session:** `orch-20260722-114501`  
**Captured after:** merge of `feature/admissions-ui-refinement` into `integration/obhis-admissions-release`  
**Status:** Deferred quality and production-readiness work  
**Owner:** Future admissions integration pass

## Purpose

The admissions UI refinement established a strong visual direction and passed scoped typechecks, lint, tests, and production builds after its critical data-integrity and authorization defects were repaired. This backlog records the remaining work needed to make the implementation easier to maintain, more atomic, fully browser-verified, and production-ready.

This file is the source of truth for post-merge UI quality work. Existing legal-name and private-document requirements remain tracked separately in:

- [`Admissions_Application_Future_UX_and_Data_Safety_Work.md`](Admissions_Application_Future_UX_and_Data_Safety_Work.md)
- [`../pending/B7_legal_name_compatibility.task.md`](../pending/B7_legal_name_compatibility.task.md)
- [`../pending/B8_private_document_viewing_and_management.task.md`](../pending/B8_private_document_viewing_and_management.task.md)

## Current baseline

Completed during the UI branch review:

- Removed fabricated approval-evidence creation.
- Removed hardcoded guardian identity/contact values and fake seeded custom form questions.
- Restored the privacy boundary between queue-list metadata and applicant-detail projections.
- Gated staff actions and catalogue controls by their matching capabilities.
- Added the missing catalogue, declaration, intake, and field-order projections required by the UI.
- Restricted campaign deletion to bounded, unused draft data.
- Removed new `any` usage from the primary admissions Admin components.
- Passed focused Admissions tests, changed-package typechecks/lint, Admin and Apply production builds, and final Sites tests.

## Priority summary

| ID | Priority | Work item | Production impact |
|---|---|---|---|
| AQ-1 | P0 | Make form setup/update atomic | Prevent partial catalogue records after a failed multi-step save. |
| AQ-2 | P0 | Complete accountable pricing approval UX | Required before a school can safely configure a paid campaign end-to-end. |
| AQ-3 | P0 | Run full browser workflow and visual QA | Required before claiming the redesigned admissions workflow works for users. |
| AQ-4 | P1 | Decompose oversized admissions components | Reduces regression risk and makes future changes reviewable. |
| AQ-5 | P1 | Finish generated Convex client typing | Removes string-reference/cast drift between UI and backend contracts. |
| AQ-6 | P1 | Complete server-backed queue search and pagination UX | Restores useful name search without weakening queue privacy. |
| AQ-7 | P1 | Accessibility, responsive, and reduced-motion audit | Required for WCAG 2.2 AA confidence. |
| AQ-8 | P1 | Failure recovery and draft-version cleanup | Prevents stale drafts and gives operators a clear recovery path. |
| AQ-9 | P2 | Performance and rendering pass | Controls query fan-out, CSS duplication, and large-component rendering cost. |
| AQ-10 | P2 | Remove or relocate design-only mockup assets | Keeps production Admin assets free of obsolete design artifacts. |

## AQ-1 — Atomic admissions form setup and update

### Problem

`AdmissionsFormBuilder.tsx` currently coordinates several independent Convex mutations for programme, intake, product, price, declaration, form version, fields, requirements, publication, and status. Convex makes each mutation atomic, but the overall browser-driven sequence is not atomic. A network failure or later validation error can leave a partially created campaign.

### Required work

- Introduce one bounded server-side command for creating a draft campaign from validated input.
- Introduce one bounded server-side command for publishing or replacing a draft configuration.
- Validate all dates, field keys, document requirements, declarations, evidence references, and publication capability before the first write.
- Preserve immutable published form and declaration versions.
- Make retries idempotent with a client-provided operation key or equivalent durable command record.
- Return a structured result that identifies the created/updated intake and form version.
- Add cleanup or explicit recovery for partial drafts created by the pre-atomic implementation.

### Definition of done

- A simulated failure cannot leave only part of a new campaign persisted.
- Repeating the same request does not duplicate programmes, intakes, products, declarations, or form versions.
- Focused Convex tests cover success, validation rejection, replay, and mid-workflow failure behavior.

## AQ-2 — Accountable paid-campaign pricing workflow

### Problem

The unsafe branch fabricated finance approval evidence. That behavior was removed. New campaigns now begin without a fee, and price publication requires existing evidence whose subject matches the exact product and price version. The safe backend contract exists, but the operator-facing approval workflow is incomplete.

### Required work

- Define who can request, review, record, revoke, and replace finance approval evidence.
- Show the product ID/version subject in a human-readable approval request.
- Require an accountable evidence reference and approved fee disclosure; never synthesize approval.
- Add explicit states: no price, approval required, approved, published, superseded, revoked/expired.
- Prevent a draft label from implying that an unapproved price was saved.
- Test permission separation between catalogue management and admissions publication.

### Definition of done

- An authorized operator can configure and publish a paid campaign without manual database intervention.
- A catalogue editor without publication authority cannot create valid finance evidence or publish a price.
- The guardian sees only the current approved price and disclosure.

## AQ-3 — Full browser, visual, and workflow QA

### Required journeys

1. Admin creates a free draft campaign, configures fields/documents/declaration, reopens it, and publishes it.
2. Admin configures an approved paid campaign after AQ-2.
3. Guardian opens the copied canonical link, authenticates, pays where applicable, creates/resumes a draft, uploads documents, reviews, and submits.
4. Staff uses list-only access, basic-detail access, document review, decision, and conversion with distinct test users.
5. Guardian handles changes requested, resubmission, withdrawal, and locked states.
6. Error cases: expired evidence, invalid dates, duplicate keys, lost connectivity, stale application version, failed upload binding, denied document access, and conversion retry.

### Viewport and browser matrix

- 320px mobile, common phone width, tablet, and desktop.
- Keyboard-only navigation and visible focus.
- Chromium minimum; add another browser if supported by the release process.
- Reduced-motion preference and 200% text zoom.

### Evidence required

- Screenshots or Playwright traces for the critical journeys.
- No browser-success claim based only on typecheck/build results.
- Record discovered defects in this backlog or dedicated task packets.

## AQ-4 — Decompose oversized components

### Targets

- `apps/admin/app/admissions/AdmissionsFormBuilder.tsx` (approximately 1,800 lines).
- `apps/admin/app/admissions/AdmissionsTriage.tsx` (approximately 950 lines).
- Review `apps/apply/components/GuardianSurface.tsx` for the same concern.

### Constraints

- Refactor by stable domain slice, not arbitrary line count.
- Keep Convex hooks near the owning container and pass typed view models/actions to presentational sections.
- Suggested boundaries: campaign metadata, field canvas, document requirements, declaration/pricing, save controls, queue, applicant detail, document review, decision, and conversion.
- Do not introduce generic form-builder abstractions unless more than one real feature needs them.

### Definition of done

- Each extracted component has one clear responsibility and typed props.
- Existing behavior and visual layout remain unchanged.
- Tests focus on state transitions and data mapping rather than snapshots of styling.

## AQ-5 — Generated Convex client typing

### Required work

- Replace string function references and `as never` call sites with generated `api` references where the repository build permits it.
- Define shared projection types from generated Convex return types instead of manually duplicating backend shapes.
- Remove remaining `any` and broad casts in the surrounding admissions code, especially legacy staff helpers and Guardian Apply projections.
- Ensure schema/codegen output is generated through the normal Convex workflow; never hand-edit generated files.

### Definition of done

- A backend validator/return-shape change causes a useful compile error in affected UI code.
- No new admissions production code uses `any`, `as any`, or untyped function-reference strings.

## AQ-6 — Privacy-safe server-backed queue search and pagination

### Problem

The queue-list capability intentionally returns metadata only. The repaired table therefore searches by application reference; names are loaded only through the stronger basic-detail projection. A useful name search must not reintroduce PII into list-only responses.

### Required work

- Decide whether name search requires `applications.view_basic` or a separately approved search capability.
- Implement bounded, indexed server-backed search/projection appropriate to that capability.
- Keep list-only users on metadata-only rows.
- Wire real pagination controls to Convex cursors rather than treating the first page as the complete queue.
- Reset cursor/selection when intake or filters change.

### Definition of done

- Authorized users can search expected applicant fields without downloading an unbounded queue.
- Unauthorized list-only users never receive applicant names in the payload.

## AQ-7 — Accessibility and responsive audit

- Verify semantic headings, landmarks, labels, table markup, dialogs, and live status announcements.
- Ensure all menus/dialogs trap and restore focus appropriately.
- Check contrast, keyboard reachability, target sizes, 320px reflow, 200% zoom, and reduced motion.
- Ensure loaders expose an accessible status and do not inject conflicting repeated styles.
- Confirm status and validation are never communicated by color alone.
- Validate that mobile triage actions remain understandable without horizontal page scrolling.

## AQ-8 — Draft/version recovery and cleanup

- Define which draft form version is active when multiple historical drafts exist.
- Add explicit discard/archive behavior for superseded drafts.
- Prevent repeated Admin saves from silently accumulating ambiguous draft versions.
- Preserve local unsaved UI recovery without presenting it as server-backed data.
- Add operator-facing recovery when an old partial campaign exists.
- Audit the bounded draft-deletion contract against all referencing tables before extending it.

## AQ-9 — Performance and rendering

- Measure Admin triage and form-builder render/query behavior with realistic queue/form sizes.
- Avoid per-row detail subscriptions unless the viewer has basic-detail authority and the row is visible.
- Review loader CSS injection so multiple loaders do not duplicate large inline style blocks.
- Check client bundle impact of the new admissions components and mockup assets.
- Keep queue and catalogue reads bounded; add indexes rather than Convex `.filter()` or unbounded `.collect()`.

## AQ-10 — Design mockup asset disposition

Review the following files after the live UI is accepted:

- `apps/admin/public/mockups/admissions.html`
- `apps/admin/public/mockups/admissions_v1_dashboard.html`
- `apps/admin/public/mockups/admissions_v2_splitpane.html`
- `apps/admin/public/mockups/admissions_v3_cyclecentric.html`

Choose one:

- move durable design references under `docs/mockups/admissions/`; or
- remove obsolete variants after visual acceptance.

Do not ship stale mockups as public Admin assets without a deliberate reason.

## Recommended execution order

1. AQ-1 atomic command design and implementation.
2. AQ-2 accountable finance approval UX.
3. AQ-3 browser workflow pass, filing concrete defects.
4. AQ-6 queue search/pagination and AQ-8 draft recovery.
5. AQ-4 component decomposition after behavior is stable.
6. AQ-5 typing cleanup alongside extracted boundaries.
7. AQ-7 accessibility and responsive acceptance.
8. AQ-9 performance pass and AQ-10 asset cleanup.

## Verification baseline for every batch

- Read `packages/convex/_generated/ai/guidelines.md` before changing Convex code.
- Run focused changed-package typechecks, lint, and tests first.
- Run affected Admin/Apply production builds for integration milestones.
- Run `git diff --check`.
- Record browser checks separately from automated checks.
- Do not claim deployment or production-data verification unless it actually occurred.
