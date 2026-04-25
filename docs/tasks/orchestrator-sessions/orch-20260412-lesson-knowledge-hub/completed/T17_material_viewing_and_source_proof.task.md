# T17 Material Viewing And Source Proof

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review `T07`, `T09`, `T12`, and `T13` outputs in this session
- Use `takomi`, `frontend-design`, `convex-functions`, and `convex-file-storage`

## Objective

Make lesson-knowledge materials feel real and verifiable by adding original-file access and extracted-text proof across the admin, teacher, and portal surfaces where appropriate.

## Scope

Included:

- open/download access for original uploaded files where permissions allow
- extracted-text viewing for staff surfaces where extraction exists
- portal resource cards that expose a useful open/view action instead of a dead placeholder-only experience
- YouTube and external resources continuing to open correctly
- bounded permission-aware handling for file URLs and missing storage

Excluded:

- full PDF in-browser annotation tooling
- OCR redesign
- rich document-reader feature expansion
- unrelated redesign of the planning or portal flows

## Definition of Done

- Staff can open the original uploaded file for eligible knowledge materials.
- Staff can inspect extracted text or a meaningful extracted preview when available.
- Portal topic resources expose a truthful action path instead of a non-actionable placeholder.
- Missing/orphaned storage states fail gracefully and honestly.

## Expected Artifacts

- backend query/mutation support for safe file access
- teacher/admin UI affordances for original file and extracted-text viewing
- portal topic resource action improvements
- verification notes for access boundaries and missing-file behavior

## Constraints

- Do not leak private-owner or staff-only files to portal readers.
- Preserve school boundaries and role-based access rules.
- Keep the experience lightweight; prefer links, drawers, or compact previews over a heavy document system.

## Verification

- A teacher can open the original file for an eligible material and inspect its extracted text.
- An admin can do the same from the library console.
- A student on a topic page can only use actions allowed for portal-approved content.
- Missing files and non-file resource types display honest fallback states.
