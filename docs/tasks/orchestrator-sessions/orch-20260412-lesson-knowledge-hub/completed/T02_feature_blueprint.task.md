# T02 Feature Blueprint

**Mode:** `mode-architect`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/Project_Requirements.md`
- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review `docs/issues/FR-010.md` and `docs/issues/FR-016.md`
- Use `takomi`, `convex-best-practices`, and `sync-docs`

## Objective

Tighten the feature blueprint until it is implementation-grade for future builders and reviewers.

## Scope

Included:

- route contracts
- role rules
- data flow
- schema intent
- regression notes

Excluded:

- actual code changes
- implementation task completion

## Definition of Done

- The feature doc is specific enough that a build agent does not need to invent product behavior.
- The route list, visibility rules, and output types are explicit.
- Sample curriculum inputs are referenced.

## Expected Artifacts

- updated `docs/features/LessonKnowledgeHub_v1.md`
- result note summarizing any blueprint clarifications

## Constraints

- Keep the first editor single-user and rich-text-lite.
- Keep portal scope to topic pages only.

## Verification

- Cross-check the blueprint against the master plan and ensure no contradictions remain.

## Notes

- Tightened route contracts, actor permissions, state transitions, template resolution, artifact output types, approval constraints, and portal exposure rules.
- Kept the first editor single-user and rich-text-lite, and kept portal scope limited to `/learning/topics/[topicId]`.
- Preserved the exact sample curriculum paths and avoided any v2 feature creep.
