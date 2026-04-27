# T04 — Implementation Sequencing, Migration, and UX Risk Review

Session: `orch-20260426-140008`  
Stage: `Design`  
Workflow: `vibe-design`  
Requested model target: `oauth-router/gpt-5.4`  
Preflight: `pi --list-models` confirms `oauth-router/gpt-5.4` is available.

## 1. Purpose

Review the v2 context-first planning redesign for:
- IA ↔ context-contract consistency
- dependency-aware build order
- migration and backward-compatibility risk
- UI/UX regression guardrails
- QA coverage for topic, exam, add-source, refresh/resume flows
- explicit go / no-go release gates

This is a **design review artifact only**. It does **not** authorize implementation.

---

## 2. Inputs reviewed

### Genesis and design artifacts
- `docs/tasks/orchestrator-sessions/orch-20260426-140008/Genesis_Brief.md`
- `docs/features/LessonKnowledgeHub_v2_ContextFirstPlanning.md`
- `docs/tasks/orchestrator-sessions/orch-20260426-140008/artifacts/T02_Planning_IA_and_Workflow_Redesign.md`
- `docs/design/LessonKnowledgeHub_v2_ContextContract.md`

### Current teacher app surfaces
- `apps/teacher/app/planning/page.tsx`
- `apps/teacher/app/planning/library/page.tsx`
- `apps/teacher/app/planning/lesson-plans/page.tsx`
- `apps/teacher/app/planning/question-bank/page.tsx`

### Current Convex surfaces
- `packages/convex/_generated/ai/guidelines.md`
- `packages/convex/schema.ts`
- `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`
- `packages/convex/functions/academic/lessonKnowledgeLessonPlans.ts`
- `packages/convex/functions/academic/lessonKnowledgeAssessmentDrafts.ts`

---

## 3. Review summary

## Verdict

**Conditional go for build planning only. No go for implementation release until the blockers below are resolved in design and enforced in build sequencing.**

The v2 direction is sound, but the current app and backend are still strongly source-first. The main implementation risk is not visual complexity; it is **identity migration**. If the team ships new context-first screens before changing save/retrieve identity, teachers can land in a UI that appears context-first while silently resuming, overwriting, or duplicating drafts using old source-set semantics.

---

## 4. Blockers

### B1. Route IA does not yet fully encode resumable context
**Why it matters:** `T02` proposes routes like `/planning/topics/[topicId]` and `/planning/exams/[examScopeKey]`, while the context contract requires identity to include `classId`, `termId`, and for exams a normalized scope. Topic route shape with only `[topicId]` is insufficient for deterministic refresh/resume unless class and term are always separately encoded in URL state or draft id.

**Risk if ignored:** reloads can reopen the wrong draft or require hidden client state to restore context.

**Required decision before build:** define one canonical deep-link strategy:
- either context-complete URL params
- or draft-id URL with server-resolved context
- or hybrid: launcher URLs for creation, draft-id URLs for resume

### B2. Current save/retrieve logic is still source-set keyed
Current behavior:
- lesson workspace loads with `outputType + sourceIds`
- lesson save falls back to `findMatchingArtifact(...sourceIds)`
- assessment workspace loads with `draftMode + sourceIds`
- assessment save falls back to `findMatchingAssessmentBank(...sourceSelectionSnapshot/sourceIds)`

**Why it matters:** shipping context-first UI on top of this would create false confidence and unstable resume behavior.

**Required before workspace rollout:** parent-level context fields, indexes, exact-context retrieval, and exact-context upsert behavior must land before topic/exam workspace default routing.

### B3. Exam flow is still implicitly topic-shaped in current UI
`apps/teacher/app/planning/question-bank/page.tsx` currently requires `effectiveTopicLabel` before save/generate when no topic can be inferred from sources.

**Conflict with v2:** exam drafts are explicitly subject-scope and must not require a single topic label.

**Required before exam workspace build:** separate topic assessment requirements from exam-scope requirements in both API contract and UI validation.

### B4. Add-source and refresh semantics are not yet contract-safe
Current workspaces round-trip through `/planning/library?sourceIds=...` and depend on query params. The v2 contract requires preserving context through add-source, refresh, and resume.

**Required before release:** define canonical `returnTo` and context payload behavior for library attach mode, including what happens if sources change, disappear, or become inaccessible.

---

## 5. IA and context-contract consistency review

## Consistent
- Planning starts from context, not library.
- Topic work and exam work are separated conceptually.
- Library remains a repository, not draft identity owner.
- Broad references remain reusable and must not become portal-facing by use alone.
- Legacy `sourceIds` links remain supported through compatibility mode.

## Inconsistent or underspecified

### 5.1 Topic route family lacks explicit class/term deep-link clarity
The context contract makes `classId` and `termId` part of identity. `T02` route examples do not show them in path or query.

**Design correction:** document exactly where `classId` and `termId` live for:
- launcher URLs
- workspace URLs
- saved-draft URLs
- refresh/reload recovery

### 5.2 Exam route family needs a canonical scope serialization rule
`[examScopeKey]` is directionally correct, but the serialization rules must match the context contract exactly:
- full-subject-term
- topic-subset with sorted topic ids
- stable normalization across client and backend

**Design correction:** one shared encoder/decoder spec must be defined before implementation.

### 5.3 Resume behavior needs a draft-id precedence rule at the route level
The context contract says explicit draft id wins over context lookup. `T02` mostly describes context routes, but not when resume links should become `draftId` links.

**Design correction:** add route/opening rules for:
- `resume recent work`
- `open saved draft`
- `open legacy sourceIds link`
- `open context launcher after draft already exists`

### 5.4 Add-material flow needs explicit compatibility behavior
`T02` allows modal/drawer or attach-mode routes, but does not define the failure behaviors when returning with:
- zero selected sources
- removed inaccessible sources
- a broad reference only
- cross-subject source attempts

**Design correction:** codify these return states in the UI state machine.

---

## 6. Current-state implementation risks found

### R1. `/planning` still redirects directly to library
File: `apps/teacher/app/planning/page.tsx`

This is expected current-state behavior, but it means the new planning hub must replace a hard redirect, not just add a new page.

### R2. Current topic retrieval foundation is incomplete for v2 launcher needs
File: `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`

`listTeacherKnowledgeTopics` currently filters by subject and level, but not by full class/term context in the way the new launcher requires.

### R3. Draft identity is inconsistent between lesson and assessment flows
- lessons compare source sets unordered via `sameSourceSet`
- assessments may match exact snapshot string or ordered `sourceIds`

This creates migration risk and inconsistent duplicate-draft behavior.

### R4. Current context inference still uses “first accessible source”
Both workspace loaders infer subject/level/topic from selected sources and warn when sources span contexts.

That is acceptable only for legacy compatibility mode, not for new v2 primary flows.

### R5. Topic creation currently binds to active term, not selected term
File: `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`

`createTeacherKnowledgeTopic` uses the active term. In v2, add-topic inside a workspace may need the currently selected term, not globally active term.

### R6. Schema/index support is not yet sufficient for exact context resume
Current schema lacks parent-level planning context fields and their indexes on:
- `instructionArtifacts`
- `assessmentBanks`

Recommended retrieval index on `knowledgeMaterials` by school+subject+level+sourceType is also absent.

### R7. Current exam draft parent can still carry topic-shaped assumptions
`assessmentBanks` has optional `topicId` and current UI always wants a topic label fallback. This is acceptable for legacy topic assessments but unsafe as default exam semantics.

---

## 7. Dependency-aware safe build order

## Principle
**Backend identity first, then compatibility layer, then launcher UI, then workspace refactors, then library attach UX, then rollout hardening.**

## Recommended sequence

### Phase 0 - Lock design contracts
Ship no code yet.
- finalize route/deep-link rules
- finalize `planningContextKey` normalization
- finalize exam scope serialization
- finalize compatibility mode copy and generation-block rules

**Exit criteria**
- one written source of truth for context key generation
- one written source of truth for route precedence

### Phase 1 - Schema/index foundation
Convex-only, no default UX change yet.
- add parent-level optional fields to `instructionArtifacts`
- add parent-level optional fields to `assessmentBanks`
- add exact-context indexes from context contract
- add material retrieval helper index for broad references

**Why first:** new queries/upserts need bounded indexed access before launcher/workspace changes.

### Phase 2 - Context envelope and legacy parsing layer
- implement snapshot v2 envelope writer/reader
- implement legacy draft classification helpers
- implement compatibility resolution helpers
- keep old read paths functioning during transition

**Why before UI:** prevents new screens from writing old identity shape.

### Phase 3 - Exact-context query layer
- implement `getTopicPlanningContext`
- implement `getExamPlanningContext`
- implement `getPlanningDraftById`
- implement context-aware source search / attach query
- preserve old source-first routes as compatibility-only adapters

**Dependency:** Phases 1-2 complete.

### Phase 4 - Save/upsert refactor
- evolve lesson save to upsert by exact `planningContextKey`
- evolve assessment save to upsert by exact context key
- ensure source changes update provenance only
- block silent merge between legacy and v2 drafts

**Do not ship new default hub before this phase is complete.**

### Phase 5 - Planning hub and launchers
- replace `/planning` redirect with planning hub
- build topic launcher
- build exam launcher
- recent/resume surfaces should open by explicit draft id or exact context

**Dependency:** exact-context retrieval and save behavior must already be live.

### Phase 6 - Workspace refactors
- topic lesson workspace
- topic assessment workspace
- exam workspace
- compatibility mode banners and generation blocking
- refresh-safe URL state

### Phase 7 - Library repositioning and attach mode
- preserve context on entry/return
- show context badges in attach mode
- label broad refs vs topic-bound materials clearly
- disable cross-context attach paths unless explicitly allowed

### Phase 8 - Migration verification and rollout gates
- run backfill where safe
- verify legacy open paths
- test no data loss / no silent merge scenarios
- stage rollout behind flag if possible

---

## 8. Migration and backward-compatibility notes

## 8.1 Recommended migration posture
Use **widen -> dual-read/dual-write -> verify -> narrow**.

### Widen
- add optional fields and indexes
- keep old source-first reads functional
- do not require all old drafts to be backfilled before deploy

### Dual-read
- new retrieval checks exact context first
- fallback reads legacy snapshot/source-set shape when no v2 context exists
- legacy links open in compatibility mode

### Dual-write
- all new v2 saves write:
  - parent-level context fields
  - v2 snapshot envelope
  - existing provenance tables/snapshots as needed
- compatibility-upgraded drafts rewrite into v2 envelope on first confirmed save

### Verify
- compare draft-open counts and save success rates
- sample legacy lesson, quiz, class test, exam drafts
- verify no route becomes dead-end for source-only links

### Narrow
- only after compatibility confidence is high, demote source-set matching from normal logic to compatibility-only logic

## 8.2 Safe in-place upgrade candidates
Good candidates for in-place upgrade after teacher confirmation:
- lesson artifacts with real `topicId`
- practice/class-test banks with real `topicId`
- drafts whose subject/level/topic/term can be unambiguously recovered

## 8.3 Must-not-auto-upgrade cases
These must stay compatibility-gated until user confirms:
- old lesson/assessment drafts with only `topicLabel` and no real `topicId`
- source-only links with broad references only
- exam drafts inferred from topic-shaped sources
- mixed-subject or mixed-level source sets
- cases where a v2 exact-context draft already exists for the same owner/context

## 8.4 Backward-compatibility hazards to explicitly test
- source ordering changes creating duplicate assessment drafts
- source removal causing wrong draft lookup
- imported curriculum docs being mistaken for a topic
- refresh after launcher selection losing class/term
- resume surface opening a legacy draft straight into editable generation without confirmation

---

## 9. Risk register

| ID | Risk | Severity | Likelihood | Why | Mitigation |
|---|---|---:|---:|---|---|
| RK-01 | New UI ships before exact-context save logic | Critical | High | Source-set matching will cause wrong resume/overwrite behavior | Make backend context identity a hard dependency before workspace rollout |
| RK-02 | Topic route lacks class/term reconstruction | High | Medium | Refresh/resume may open wrong draft or rely on hidden state | Encode full context in URL or use draft-id routes for resume |
| RK-03 | Exam drafts remain topic-labeled | Critical | High | Violates v2 spec and narrows exam scope incorrectly | Separate exam validation rules from topic assessment rules |
| RK-04 | Legacy source-only links silently create new v2 drafts | High | Medium | Duplicate drafts and teacher confusion | Compatibility mode must block generation/save until context confirmed |
| RK-05 | Source reorder creates duplicate assessment drafts | High | Medium | Assessment matching still uses ordered snapshot/source fallback | Normalize source order for provenance only; identity must ignore source order |
| RK-06 | Broad references auto-infer canonical topic | High | Medium | Curriculum docs could distort context | Never infer topic from `imported_curriculum` without confirmed topic selection |
| RK-07 | Add-source round-trip loses context | High | High | Library currently works via `sourceIds` query coupling | Add explicit `returnTo` + context payload contract |
| RK-08 | Class-scoped access changes break resumable drafts | Medium | Medium | Previously selected sources may become inaccessible | Allow editing existing draft but block generation until source set repaired |
| RK-09 | Topic creation uses active term instead of selected term | Medium | Medium | Newly created topic may land in wrong term | Pass selected term explicitly in v2 topic-create flow |
| RK-10 | Parent-level indexes missing or insufficient | High | Medium | Context lookups may degrade or force scans | Add indexes before context-based queries ship |
| RK-11 | Existing portal-facing materials lose discoverability | High | Low | Library repositioning could confuse retrieval | Preserve portal rules and ensure topic workspace suggestions include approved topic-bound resources where allowed |
| RK-12 | Compatibility merge conflict handled silently | Critical | Medium | Legacy draft could overwrite exact v2 draft | Force explicit teacher choice: resume existing v2 vs save copy |

---

## 10. UI/UX regression guardrails

## Mandatory guardrails

### G1. Context header must be sticky and explicit
Every topic/exam workspace must visibly show:
- subject
- class/level
- term
- topic or exam scope
- mode/output family

Teachers must never wonder what context they are editing.

### G2. Source pane changes must not masquerade as draft identity changes
Adding/removing/reordering sources can change provenance and generation inputs, but must not implicitly create a different draft when context is unchanged.

### G3. Compatibility mode must be visually distinct and action-limited
For legacy/source-only opens:
- show compatibility banner
- show inferred vs confirmed fields
- block generation until confirmation when required
- explain why the teacher is being asked to confirm context

### G4. Exam workspace must not ask for a single target topic unless scope kind requires it
Exam authoring labels should reinforce wider subject scope. Topic subset is valid; single-topic fallback as default is not.

### G5. Add-material flow must preserve return path losslessly
Leaving a workspace to attach materials must preserve:
- planning context
- draft id if present
- open tab/panel if relevant
- selection intent

### G6. Refresh/reload must be deterministic
A hard browser refresh on a v2 workspace must reopen the same draft or the same creation context without relying on transient client memory.

### G7. Broad references and topic-bound materials must be visibly different
Badges, labels, filters, and grouping must clearly distinguish:
- broad planning reference
- topic-bound material
- approved portal-facing resource

### G8. Missing/inaccessible source states must degrade safely
If a previously attached source disappears or access changes:
- draft remains readable
- teacher can still edit existing text/items
- generation/save rules follow the contract
- system explains what is blocked and why

---

## 11. QA checklist

## 11.1 Topic flow QA
- [ ] Teacher can start from planning hub without first selecting library materials.
- [ ] Teacher can choose subject -> class/level -> term -> topic and enter topic workspace.
- [ ] Context header shows exact selected context.
- [ ] Lesson plan, student note, assignment, practice quiz, and class test all open from topic context.
- [ ] Suggested sources separate topic-bound materials from broad references.
- [ ] Selecting or removing a source does not create a new draft when context is unchanged.
- [ ] Save/resume returns the same draft for the same owner + context + mode.
- [ ] Changing output type creates/separates only the expected draft family variant.
- [ ] Topic creation inside flow lands in the selected term, not merely the globally active term.

## 11.2 Exam flow QA
- [ ] Teacher can choose subject -> class/level -> term -> exam scope from planning hub.
- [ ] Full-subject-term exam opens without requiring a topic label.
- [ ] Topic-subset exam uses sorted canonical topic ids in scope identity.
- [ ] Exam workspace labels clearly indicate subject-scope authoring.
- [ ] Exam draft does not auto-bind to a single topic when broad references only are attached.
- [ ] Reopening the same exam scope resumes the same draft.
- [ ] Changing source selection within the same exam scope does not create a new draft.
- [ ] Legacy exam drafts require confirmation before generation if scope cannot be safely inferred.

## 11.3 Add-source flow QA
- [ ] Opening add-source from topic workspace preserves topic context on return.
- [ ] Opening add-source from exam workspace preserves exam scope on return.
- [ ] Library attach mode clearly shows return destination.
- [ ] Cross-subject or cross-level attach attempts are blocked or clearly warned per contract.
- [ ] Broad references can be attached without forced topic binding.
- [ ] Class-scoped materials obey staff access rules.
- [ ] Returning with zero newly selected sources leaves draft/context intact.
- [ ] Returning with inaccessible or removed sources surfaces repair guidance.

## 11.4 Refresh/resume QA
- [ ] Hard refresh on topic workspace reopens same draft or exact creation context.
- [ ] Hard refresh on exam workspace reopens same draft or exact creation context.
- [ ] Recent work opens by explicit draft id or exact context, not ambiguous source-set match.
- [ ] Legacy `sourceIds` links still resolve to compatibility mode.
- [ ] Old lesson-plan links and old question-bank links remain non-destructive.
- [ ] If exact context cannot be inferred, UI asks for confirmation before generation.
- [ ] If a v2 draft already exists and a legacy draft is reopened, the user must choose how to proceed; no silent merge.

## 11.5 Regression QA on current behaviors worth preserving
- [ ] Library upload still works.
- [ ] Existing teacher-access restrictions still apply.
- [ ] Approved topic materials remain available under existing portal rules.
- [ ] Broad references remain valid reusable planning materials.
- [ ] AI run logging still records provenance safely for new saves.

---

## 12. Explicit go / no-go guardrails

## Go for implementation of subsequent build tasks only if all are true
- [ ] Context key normalization spec is written and shared across frontend/backend.
- [ ] Route precedence spec is written for draft-id vs context vs legacy source links.
- [ ] Parent-level context fields and indexes are defined for both draft families.
- [ ] Compatibility mode rules are written for legacy lesson, topic assessment, and exam drafts.
- [ ] Exam flow contract no longer requires a topic label by default.

## No-go for production release if any of the following remain true
- [ ] New planning hub is live but save/retrieve still keys drafts primarily by `sourceIds` or raw source snapshot.
- [ ] Topic/exam workspace cannot survive hard refresh deterministically.
- [ ] Legacy source-only links bypass compatibility confirmation when context is incomplete.
- [ ] Source add/remove creates duplicate drafts for unchanged context.
- [ ] Exam drafts still use single-topic assumptions in validation or labels.
- [ ] Broad references can silently become topic identity.
- [ ] A legacy draft can silently overwrite or merge into an existing v2 draft.

---

## 13. Recommended build handoff

### Safe next build order
1. Schema/index changes
2. Context envelope + legacy parsing helpers
3. Exact-context retrieval queries
4. Exact-context save/upsert refactor
5. Planning hub and launchers
6. Topic/exam workspace refactors
7. Library attach-mode refactor
8. Migration verification and rollout hardening

### Reviewer recommendation
**Proceed to build only after the route/deep-link decision and exact-context identity decision are locked.** Those are the two gates most likely to prevent destructive regressions.

---

## 14. Final review position

Current Takomi stage: `Design`  
Recommended next stage: `Build`

Recommendation: **Proceed to build planning, not production implementation, until blockers B1-B4 are explicitly closed in the build brief.**
