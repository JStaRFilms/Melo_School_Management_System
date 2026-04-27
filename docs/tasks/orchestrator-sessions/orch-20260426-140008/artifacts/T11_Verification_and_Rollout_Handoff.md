# T11 Verification and Rollout Handoff

Session: `orch-20260426-140008`  
Task: `11`  
Stage: `vibe-build`  
Reviewer: `Takomi Reviewer`  
Date: `2026-04-26`

## Re-review scope

This is a follow-up verification pass focused on the three previously reported P1 issues:

1. source-id preservation via workspace effective ids
2. library topic creation using the selected planning term
3. exam topic-subset invalid-id rejection

Files re-checked:

- `apps/teacher/app/planning/lesson-plans/page.tsx`
- `apps/teacher/app/planning/question-bank/page.tsx`
- `apps/teacher/app/planning/library/page.tsx`
- `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`
- `packages/convex/functions/academic/lessonKnowledgeAssessmentDrafts.ts`
- `docs/tasks/orchestrator-sessions/orch-20260426-140008/artifacts/T11_Verification_and_Rollout_Handoff.md`

## Final verification summary

### Result on prior P1s

- **P1-1 source preservation via workspace effective ids:** ✅ fixed
- **P1-2 topic creation respecting planning term:** ✅ fixed
- **P1-3 exam topic-subset invalid ids rejected:** ✅ fixed

### Final readiness call

- **Feature-slice readiness:** **GO for targeted UI/staging verification**
- **Full repository release-gate readiness:** **NO-GO if a clean repo-wide typecheck is required**, due unrelated pre-existing package/type environment failures outside this planning slice

In short: the three context-first planning blockers from the prior review are resolved. The remaining blockers are repo-level hygiene issues, not regressions in the reviewed Task 05-10 implementation.

## Detailed findings

### Fixed — P1-1 source ids now use workspace effective ids

**What changed**

Both planning pages now derive an `effectiveSourceIds` array from the resolved workspace, falling back to URL ids only before workspace data exists.

**Verified in**

- `apps/teacher/app/planning/lesson-plans/page.tsx`
  - `const effectiveSourceIds = workspace?.sourceIds ?? selectedSourceIds;`
  - remove-source uses `effectiveSourceIds`
  - library attach handoff uses `effectiveSourceIds`
  - save uses `effectiveSourceIds`
  - generate uses `effectiveSourceIds`
  - React key now includes `effectiveSourceIds`

- `apps/teacher/app/planning/question-bank/page.tsx`
  - `const effectiveSourceIds = workspace?.sourceIds ?? selectedSourceIds;`
  - remove-source uses `effectiveSourceIds`
  - library attach handoff uses `effectiveSourceIds`
  - save uses `effectiveSourceIds`
  - generate uses `effectiveSourceIds`
  - React key now includes `effectiveSourceIds`

**Assessment**

This closes the prior regression where context-resumed drafts could display saved attachments but save/generate against an empty or stale URL source set.

---

### Fixed — P1-2 library topic creation now respects planning term

**What changed**

The attach-mode topic creation flow now passes `termId` from the parsed planning context, and the backend mutation now accepts optional `termId`, validates it, and uses it instead of always falling back to the active term.

**Verified in**

- `apps/teacher/app/planning/library/page.tsx`
  - create-topic call now includes `termId: attachPlanningContext?.termId`

- `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`
  - mutation args now include `termId: v.optional(v.id("academicTerms"))`
  - requested term is loaded and school-validated
  - `effectiveTerm = requestedTerm ?? activeTerm`
  - duplicate lookup and topic insert both use `effectiveTerm._id`

**Assessment**

This resolves the prior term-integrity issue for attach-mode topic creation.

---

### Fixed — P1-3 exam topic-subset invalid ids no longer pass silently

**What changed**

Exam scope resolution now:

- rejects empty `topic_subset` selections
- rejects any selected topic ids that no longer resolve
- still validates each resolved topic against school/subject/level/term

**Verified in**

- `packages/convex/functions/academic/lessonKnowledgeAssessmentDrafts.ts`
  - empty subset guard:
    - `if (input.scopeKind === "topic_subset" && normalizedTopicIds.length === 0) ...`
  - missing-topic guard:
    - `if (validTopics.length !== normalizedTopicIds.length) ...`

**Assessment**

This closes the prior determinism gap for exam-scope identity and resume behavior.

## Remaining non-P1 issues

### N1 — React hook dependency warnings remain

Targeted lint still reports warnings:

- `apps/teacher/app/planning/lesson-plans/components/LessonPlanWorkspaceScreen.tsx`
  - missing dependency: `workspace.planningContext?.subjectId`
- `apps/teacher/app/planning/library/page.tsx`
  - missing dependency: `attachPlanningContext?.termId`
- `apps/teacher/app/planning/question-bank/components/QuestionBankWorkspaceScreen.tsx`
  - missing dependency: `workspace.planningContext?.subjectId`
- `apps/teacher/app/planning/question-bank/page.tsx`
  - missing dependency: `updateDraftMode`

**Severity:** low / non-blocking for this review pass.

### N2 — Full repo typecheck is still red from pre-existing unrelated issues

Still failing outside this planning slice:

- `packages/convex/functions/academic/lessonKnowledgePdfExtraction.ts`
  - unresolved `pdfjs-dist` types/modules and unknown-type errors
- `apps/teacher` / `packages/ai`
  - unresolved `ai`, `zod`, `@openrouter/ai-sdk-provider`, plus downstream unknown-type errors

**Severity:** release-process blocker only if your release standard requires clean repo-wide typecheck.

## Verification commands and results

### Preflight

```bash
pi --list-models
```

Result: `oauth-router/gpt-5.4` is available.

### Source preservation / term / invalid-topic re-review

Manual code review confirmed fixes in:

- `apps/teacher/app/planning/lesson-plans/page.tsx`
- `apps/teacher/app/planning/question-bank/page.tsx`
- `apps/teacher/app/planning/library/page.tsx`
- `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`
- `packages/convex/functions/academic/lessonKnowledgeAssessmentDrafts.ts`

### Shared package checks

```bash
pnpm --filter @school/shared typecheck
pnpm --filter @school/shared test
```

Result:
- `typecheck` ✅ passed
- `test` ✅ passed (`62` tests)

### Targeted lint on changed planning/shared files

```bash
pnpm exec eslint apps/teacher/app/planning/page.tsx \
  apps/teacher/app/planning/library/page.tsx \
  apps/teacher/app/planning/lesson-plans/page.tsx \
  apps/teacher/app/planning/question-bank/page.tsx \
  apps/teacher/app/planning/lesson-plans/components/LessonPlanWorkspaceScreen.tsx \
  apps/teacher/app/planning/question-bank/components/QuestionBankWorkspaceScreen.tsx \
  packages/shared/src/planning-context.ts \
  packages/shared/src/__tests__/planning-routes.test.ts
```

Result: ⚠️ 4 warnings, 0 errors.

### Full package typechecks attempted

```bash
pnpm --filter @school/convex typecheck
pnpm --filter @school/teacher typecheck
```

Result:
- `@school/convex` ❌ fails from pre-existing `pdfjs-dist` module/type issues
- `@school/teacher` ❌ fails from pre-existing `ai`/dependency/type issues plus the same downstream convex issues

### Diff hygiene

```bash
git diff --check
```

Result: ✅ no whitespace/conflict-marker issues.

## Updated UI test plan

Run this in staging or local QA after deployment of the current branch.

### A. Topic-first lesson-plan flow
- [ ] Open `/planning`
- [ ] Select class, term, subject, topic
- [ ] Launch lesson workspace with **no** `sourceIds` in the URL
- [ ] Confirm previously attached sources appear if a draft already exists
- [ ] Save immediately and confirm sources remain attached after refresh
- [ ] Generate immediately and confirm generation succeeds with the displayed source set
- [ ] Remove one source and confirm refresh preserves the reduced set
- [ ] Use **Add from library**, attach another source, return, and confirm merged source set persists

### B. Topic-first question-bank flow
- [ ] Launch topic assessment from `/planning`
- [ ] Confirm topic mode does not expose exam-only flow as primary
- [ ] Save and refresh with no manual URL source editing
- [ ] Confirm the resolved source set persists across refresh, sav
