# T12 Video Links And Approval

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review the visibility and approval rules from `T05`
- Use `takomi`, `frontend-design`, and `convex-functions`

## Objective

Add teacher YouTube-link submission and admin approval so videos can attach to topic pages without direct video hosting.

## Scope

Included:

- teacher video-link submission UI
- metadata capture
- admin approval/rejection flow
- topic attachment

Excluded:

- native upload
- transcoding
- video analytics

## Definition of Done

- Teachers can submit YouTube links with labels and topic context.
- Videos remain hidden from student topic pages until approved.
- Approved links attach to the correct topic.

## Expected Artifacts

- teacher video route
- admin review integration
- topic-attachment persistence

## Constraints

- Use the same material-domain contracts as other resources where possible.
- Do not create a separate media hosting subsystem.

## Verification

- Unapproved links stay hidden.
- Approved links appear in the correct topic context only.
