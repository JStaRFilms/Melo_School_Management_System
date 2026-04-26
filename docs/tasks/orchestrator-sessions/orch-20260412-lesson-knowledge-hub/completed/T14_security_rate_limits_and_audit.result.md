# T14 Security Rate Limits And Audit — Result

## Status

Completed

## Summary

This hardening pass closed the highest-risk Lesson Knowledge Hub security and abuse-control gaps identified after T13/T17/T18.

Delivered in this task:

- locked down portal student-upload promotion so students cannot self-promote content
- made class-scoped teacher access assignment-aware across teacher review/source-proof/original-file flows
- hardened lesson-plan and assessment source eligibility checks for server-side save paths
- enforced subject/topic referential validation in ingestion and admin relabel/update paths
- improved audit coverage for promotion and admin topic creation
- added Convex-backed rate limiting for the highest-cost / abuse-prone paths
- capped generation source selections at 12 in both Next route validation and Convex business logic

## Key Changes

### Security and access hardening

- `packages/convex/functions/academic/lessonKnowledgePortal.ts`
  - `promotePortalStudentUpload` now requires a real staff actor
  - only exact eligible student uploads can be promoted:
    - `sourceType: student_upload`
    - `ownerRole: student`
    - `visibility: class_scoped`
    - `reviewStatus: pending_review`
    - `processingStatus: ready`
    - `searchStatus: indexed`
    - active matching topic attachment
  - promotion now uses assignment-aware class access
  - promotion now patches chunk visibility/review state too
  - richer before/after audit fields added

- `packages/convex/functions/academic/lessonKnowledgeAccess.ts`
  - added `resolveClassScopedKnowledgeMaterialStaffAccess(...)`
  - class-scoped staff access now evaluates real active bindings and teacher subject/class assignment
  - reviewer follow-up fix removed the earlier `take(50)` auth-bound correctness cap by iterating all matching bindings

- `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`
  - teacher library visibility is now assignment-aware for class-scoped materials
  - teacher source proof and original-file access use the same class-scoped access resolution
  - selectable-source state now respects class assignment context

### Source eligibility hardening

- `packages/convex/functions/academic/lessonKnowledgeLessonPlans.ts`
  - lesson-plan workspace/save paths now cap source selections at 12
  - save path now rejects inaccessible same-school source IDs instead of only rejecting cross-school references
  - class-scoped source eligibility now respects assignment-aware teacher access

- `packages/convex/functions/academic/lessonKnowledgeAssessmentDrafts.ts`
  - assessment workspace/save paths now cap source selections at 12
  - class-scoped source loading/saving now respects assignment-aware teacher access too

### Referential integrity hardening

- `packages/convex/functions/academic/lessonKnowledgeIngestionHelpers.ts`
  - added `assertActiveKnowledgeSubjectTopicScope(...)`

- `packages/convex/functions/academic/lessonKnowledgeIngestion.ts`
  - upload URL requests and YouTube link registration now validate:
    - subject belongs to the same school
    - subject is active
    - topic belongs to the same school
    - topic is active
    - topic subject matches selected subject
    - topic level matches selected level

- `packages/convex/functions/academic/lessonKnowledgeAdmin.ts`
  - admin material detail updates now validate subject/topic/level consistency
  - reviewer follow-up fix also validates topic integrity before admin `student_approved` state transitions

### Audit coverage

- `packages/convex/functions/academic/lessonKnowledgePortal.ts`
  - promotion audit rows now include before/after visibility/review/topic fields

- `packages/convex/functions/academic/lessonKnowledgeAdmin.ts`
  - admin topic creation now writes a content audit event

### Rate limiting and abuse control

- `packages/convex/schema.ts`
  - added `rateLimitCounters`

- `packages/convex/functions/academic/lessonKnowledgeRateLimits.ts`
  - added Convex-backed rate-limit helper and generation-limit mutations
  - final reviewer-adjusted implementation enforces both per-user and per-school buckets via scoped keys

Rate-limited actions:

- teacher lesson-plan generation
- teacher assessment/question-bank generation
- staff material upload URL requests
- staff YouTube link registrations
- staff ingestion retries
- student portal supplemental upload URL requests

### Teacher route behavior

- `apps/teacher/app/api/planning/lesson-plans/generate/route.ts`
- `apps/teacher/app/api/ai/question-bank/generate/route.ts`

Both routes now:

- enforce max 12 source IDs at request validation time
- consume Convex-backed rate limits before expensive model calls
- return honest HTTP `429` with `Retry-After` when limited

## Verification

Ran successfully:

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `pnpm -C apps/teacher typecheck`
- `pnpm -C packages/convex test -- functions/academic/__tests__/lessonKnowledgeAccess.test.ts functions/academic/__tests__/lessonKnowledgeIngestionHelpers.test.ts`
- `git diff --check`

## Review Notes

- initial `gpt-5.5` review surfaced the promotion/auth/rate-limit/referential gaps
- implementation was done via `gpt-5.5` subagent plus orchestrator review
- orchestrator self-review caught and fixed an assignment-aware source-loading regression affecting lesson-plan/question-bank class-scoped sources
- final reviewer pass found no blockers; two medium issues were patched before acceptance:
  - auth helper no longer truncates bindings at 50
  - admin `student_approved` state path now revalidates attached topic integrity

## Remaining Follow-up

- `T15` should still reconcile the session folders more broadly and record the final handoff honestly
- `T16` remains the next implementation task for assessment generation profiles and question-mix overrides
