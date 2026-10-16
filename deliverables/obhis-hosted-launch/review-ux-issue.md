## Problem

The School site page at `/admin/settings/site` is not usable for a school owner or reviewer trying to launch a real website. During the Olive/Fedrah launch, the user could not tell what they were reviewing or what to enter in the approval form. They explicitly requested image previews and a mini-preview of the actual website.

The supplied screenshots show rows of filenames, checksums and technical buttons, followed by a wall of `Review school_name`, `Review album_intro`, `Review ..._alt` buttons. A reviewer cannot inspect the image or see the corresponding website section from these controls.

## Current behavior

- Uploaded assets show metadata but no thumbnail, enlarged image or placement context. The buttons are named `asset rights`, `asset child applicability` and `asset child consent`.
- Independent fact review exposes raw internal field IDs instead of readable labels and the content being approved.
- `Preview authorized draft` renders text values and image placeholders, not the actual school-site design.
- `Independent source reference`, approval expiry and the confirmation checkbox lack useful guidance. The user did not understand what a source reference meant or whether clicking the item buttons recorded approval.
- The user saw review controls while still signed into the editor account. Source inspection confirms the controls are not individually gated by reviewer capability. The page also uses a broad management-read flag for edit controls.

Seeing the page or its buttons is not proof of an authorization bypass. The backend still requires the explicit school-wide `privacy.approve` grant for approval operations. There is no confirmed unauthorized approval in this report.

## Requested outcome

Make review visual and understandable while retaining the existing school, role and publication boundaries.

### Acceptance criteria

- [ ] Each asset has an authenticated thumbnail, an enlarged view, readable name, alt text/caption, current approval state and the website section where it is used. Put checksums in an optional technical-details disclosure.
- [ ] Provide a private preview of the actual renderer with the current saved draft and its images. Selecting a field/image should show its location or corresponding section. Support desktop side-by-side review and a usable stacked/mobile layout.
- [ ] Add a separately authorized, same-school draft-image preview path if needed. Unapproved images must not become public, enter anonymous caches, or expose upstream storage URLs. Preserve private/noindex behavior and deny other schools, anonymous users and expired/revoked access.
- [ ] Replace raw field IDs and asset operation names with plain-language labels, the actual proposed value/image, its purpose and clear review states. Explain the distinction between selecting an item, recording approval, and publishing.
- [ ] Explain the source-reference field with truthful examples of who confirmed an item, when, and where the confirmation can be checked. Explain the expiry field. Never encourage fabricated evidence, an unverified attestation, or treating school approval alone as guardian consent.
- [ ] Show editor, reviewer and publisher actions according to their actual capabilities. An editor without review permission must not see usable approval controls. A reviewer without edit/publish permissions must not appear able to edit/publish. Explain missing permissions without trapping users in a loading state. Keep backend enforcement and independent reviewer/publisher checks.
- [ ] Provide a review-progress summary with outstanding items, blockers and clear next actions. Offer grouped review only where each exact value/image and required evidence remain inspectable and auditable.
- [ ] Verify the real editor and reviewer journeys, including reload persistence, denied operations, mobile/keyboard use, and that the preview matches the immutable candidates being approved. Retain focused evidence without publishing private school assets or credentials.

## Evidence and implementation notes

User-supplied screenshots and the launch conversation establish the usability report. Screenshot attachments remain in the private source conversation; they have not been uploaded to this issue. This report does not claim a fresh live-browser reproduction or a confirmed security bypass.

Relevant source:
- `apps/admin/app/admin/settings/site/page.tsx`, especially the private preview, image-rights and independent fact-review sections.
- `packages/convex/functions/sites/management.ts`, management capability projections.
- `packages/convex/functions/sites/reads.ts` and `evidence.ts`, immutable candidates and approval enforcement.

This issue requests a scoped UX/preview improvement, not removal of review gates, generic page-builder controls, or permission to deploy, publish school content, change DNS, or modify Preview.
