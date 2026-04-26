# Lesson Knowledge Hub v2 - Context Contract

**Session:** `orch-20260426-140008`  
**Task:** `03 - Domain model and retrieval contract for context-first planning`  
**Stage:** Design (`vibe-design`)  
**Status:** Proposed for review  
**Date:** 2026-04-26

---

## 1. Purpose

Define the backend contract for moving Lesson Knowledge Hub planning from **source-first** to **context-first** without introducing unnecessary new tables.

This contract covers:
- topic-context retrieval
- exam-scope retrieval
- draft identity and resume rules
- compatibility handling for existing source-first drafts
- minimal recommended schema evolution on existing tables only

This document is **design only**. It does not authorize implementation code.

---

## 2. Inputs reviewed

### Required guideline review
- `packages/convex/_generated/ai/guidelines.md`

### Genesis and session artifacts
- `docs/Project_Requirements.md`
- `docs/features/LessonKnowledgeHub_v2_ContextFirstPlanning.md`
- `docs/issues/FR-016.md`
- `docs/tasks/orchestrator-sessions/orch-20260426-140008/pending/03_domain_model_and_retrieval_contract_for_context_first_planning.task.md`
- `docs/tasks/orchestrator-sessions/orch-20260426-140008/pending/06_context_aware_query_layer_and_draft_identity_refactor.task.md`
- `docs/tasks/orchestrator-sessions/orch-20260426-140008/pending/08_question_bank_workspace_refactor_for_topic_first_and_exam_scope_flows.task.md`
- `docs/tasks/orchestrator-sessions/orch-20260426-140008/pending/09_lesson_plan_workspace_refactor_for_topic_first_planning.task.md`

### Current Convex surfaces mapped
- `packages/convex/schema.ts`
- `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`
- `packages/convex/functions/academic/lessonKnowledgeLessonPlans.ts`
- `packages/convex/functions/academic/lessonKnowledgeAssessmentDrafts.ts`
- `packages/convex/functions/academic/lessonKnowledgeAccess.ts`
- `packages/convex/functions/academic/lessonKnowledgeSearch.ts`
- `packages/convex/functions/academic/lessonKnowledgePortal.ts`

---

## 3. Current-state map

### 3.1 Stable entities already in place

| Entity | Current role | Relevant fields now | Notes |
| :--- | :--- | :--- | :--- |
| `knowledgeTopics` | Canonical topic node | `schoolId`, `subjectId`, `level`, `termId`, `title`, `status` | Already carries the strongest topic identity. |
| `knowledgeMaterials` | Reusable repository source | `subjectId`, `level`, `topicId?`, `topicLabel`, `sourceType`, `visibility`, `reviewStatus`, `processingStatus`, `searchStatus` | Already supports broad refs via `sourceType = imported_curriculum` and optional `topicId`. |
| `knowledgeMaterialClassBindings` | Class-scope bridge | `materialId`, `classId`, `bindingPurpose`, `bindingStatus` | Needed for class-aware source visibility. |
| `instructionArtifacts` | Lesson-plan / note / assignment parent | `outputType`, `subjectId`, `level`, `topicId?`, `templateId?`, `currentDocumentId?`, `currentRevisionId?` | Missing explicit term/class/context identity. |
| `instructionArtifactDocuments` | Active lesson document | `artifactId`, `documentState`, `plainText`, `topicId?`, `outputType` | Mirrors current active content only. |
| `instructionArtifactRevisions` | Immutable lesson snapshots | `artifactId`, `revisionKind`, `sourceSelectionSnapshot`, `templateId?` | Snapshot exists, but it is source-led today. |
| `instructionArtifactSources` | Lesson artifact source join | `artifactId`, `materialId`, `sourceOrder` | Good provenance table; should remain provenance, not identity. |
| `assessmentBanks` | Question bank / CBT / exam draft parent | `outputType`, `draftMode`, `subjectId`, `level`, `topicId?`, `sourceSelectionSnapshot?`, `effectiveGenerationSettings?` | Missing explicit term/class/exam-scope identity. |
| `assessmentBankItems` | Question rows | `bankId`, `itemOrder`, `questionType`, `difficulty` | No change required for context model. |
| `aiRunLogs` | Generation audit | `sourceSelectionSnapshot`, target ids | Snapshot contract must evolve with context contract. |

### 3.2 Current query/mutation behavior

| Surface | Current behavior | Limitation for v2 |
| :--- | :--- | :--- |
| `lessonKnowledgeTeacher.listTeacherKnowledgeTopics` | Lists active topics by subject/level with teacher access filtering | Good base for launcher, but not a full context contract. |
| `lessonKnowledgeLessonPlans.getTeacherInstructionWorkspace` | Loads workspace from `outputType + sourceIds` | Source set is acting as draft identity. |
| `lessonKnowledgeLessonPlans.saveTeacherInstructionArtifactDraft` | Upserts by `artifactId` or matching `sourceIds` | Distinguishes drafts poorly when same sources support multiple contexts. |
| `lessonKnowledgeAssessmentDrafts.getTeacherAssessmentBankWorkspace` | Loads workspace from `draftMode + sourceIds` | Exam scope is inferred from sources instead of explicitly modeled. |
| `lessonKnowledgeAssessmentDrafts.saveTeacherAssessmentBankDraft` | Upserts by `bankId` or matching `sourceSelectionSnapshot` | Existing identity still source-led and weak for multiple exam/topic variants. |
| `lessonKnowledgeAccess.*` | Enforces school and visibility boundaries | Must remain authoritative. |

### 3.3 Main design gap

The current model already separates:
- canonical topics
- reusable materials
- lesson artifacts
- assessment banks
- provenance joins

The main gap is **not table shape**. The main gap is **context identity**.

Today, the system can store context hints in snapshots, but it cannot deterministically answer:
- “What is the resumable lesson draft for this exact topic context?”
- “What is the resumable exam draft for this exact term/class/scope?”
- “Which materials are required vs suggested for this context?”
- “When should a legacy source-first draft open in compatibility mode instead of auto-resuming?”

---

## 4. Design decision summary

### Decision A — Do not add new tables

**Recommendation:** do not introduce new tables for exam scopes, draft keys, or planning sessions in this slice.

**Reasoning:**
- `knowledgeTopics`, `knowledgeMaterials`, `instructionArtifacts`, and `assessmentBanks` already cover the core domain.
- The missing capability is deterministic context identity and retrieval, which can be solved with **optional fields and indexes on existing parent tables** plus richer snapshots.
- This keeps rollout smaller and aligns with the requirement to avoid unnecessary new tables.

### Decision B — Make planning context first-class on parent draft records

Draft parents, not sources, should carry the resumable identity.

**Recommendation:** extend `instructionArtifacts` and `assessmentBanks` with explicit planning context fields.

### Decision C — Keep source joins and snapshots as provenance, not identity

`instructionArtifactSources` and `sourceSelectionSnapshot` remain important, but only for:
- grounding provenance
- AI replay/audit
- source refresh UX
- compatibility resolution

They must no longer be the primary key for resume behavior.

---

## 5. Recommended domain model evolution

## 5.1 New context concepts

### Planning context kinds

| Kind | Meaning | Applies to |
| :--- | :--- | :--- |
| `topic` | Work anchored to one canonical topic | lesson plans, student notes, assignments, practice quiz, class test |
| `exam_scope` | Work anchored to subject + level/class + term + optional topic subset | exam drafts only |
| `legacy_source_set` | Transitional compatibility context for old drafts without full context | existing v1 drafts during rollout |

### Planning mode semantics

| Workspace family | Valid mode(s) |
| :--- | :--- |
| `instructionArtifacts` | `topic` only in v2 |
| `assessmentBanks` | `topic` for `practice_quiz` and `class_test`; `exam_scope` for `exam_draft` |

## 5.2 Recommended optional fields on existing parent tables

### `instructionArtifacts`

Add optional fields:
- `planningContextKind`: `"topic" | "legacy_source_set"`
- `planningContextKey`: `string`
- `termId?`: `Id<"academicTerms">`
- `classId?`: `Id<"classes">`
- `contextSnapshot?`: `string` (JSON envelope)

### `assessmentBanks`

Add optional fields:
- `planningContextKind`: `"topic" | "exam_scope" | "legacy_source_set"`
- `planningContextKey`: `string`
- `termId?`: `Id<"academicTerms">`
- `classId?`: `Id<"classes">`
- `contextSnapshot?`: `string` (JSON envelope)

### Why parent-level fields are needed

They allow deterministic and bounded queries for:
- recent drafts by context
- exact resume by context
- compatibility triage
- future migration verification

without scanning all drafts and re-parsing snapshots.

## 5.3 Recommended indexes

### `instructionArtifacts`
- `by_school_and_owner_user_and_output_type_and_planning_context_key`
- `by_school_and_subject_and_level_and_term` *(if term-based recent listing is needed directly)*

### `assessmentBanks`
- `by_school_and_owner_user_and_draft_mode_and_planning_context_key`
- `by_school_and_subject_and_level_and_term_and_draft_mode` *(optional if needed for context dashboards)*

### `knowledgeMaterials`
Recommended retrieval helper index:
- `by_school_and_subject_and_level_and_source_type`

This avoids weak fallback scans when pulling broad planning references for a context.

---

## 6. Context snapshot envelope

All new or rewritten snapshots should use one normalized envelope shape.

```json
{
  "version": 2,
  "planningContextKind": "topic",
  "planningContextKey": "topic|school:...|subject:...|class:...|level:...|term:...|topic:...|output:lesson_plan",
  "subjectId": "...",
  "classId": "...",
  "level": "JSS1",
  "termId": "...",
  "topicId": "...",
  "topicLabel": "Fractions",
  "draftMode": null,
  "outputType": "lesson_plan",
  "examScope": null,
  "sourceIds": ["...", "..."],
  "sourceCount": 2,
  "templateId": "...",
  "templateResolutionPath": "subject + level",
  "compatibility": {
    "isLegacy": false,
    "inferredFromSourceSet": false,
    "requiresContextConfirmation": false
  }
}
```

For exam scope:

```json
{
  "version": 2,
  "planningContextKind": "exam_scope",
  "planningContextKey": "exam|school:...|subject:...|class:...|level:...|term:...|topics:topicA,topicB|mode:exam_draft|output:cbt_draft",
  "subjectId": "...",
  "classId": "...",
  "level": "JSS1",
  "termId": "...",
  "topicId": null,
  "topicLabel": null,
  "draftMode": "exam_draft",
  "outputType": "cbt_draft",
  "examScope": {
    "scopeKind": "topic_subset",
    "topicIds": ["topicA", "topicB"],
    "topicLabels": ["Fractions", "Decimals"],
    "label": "Fractions + Decimals"
  },
  "sourceIds": ["..."],
  "sourceCount": 1,
  "templateId": null,
  "templateResolutionPath": null,
  "compatibility": {
    "isLegacy": false,
    "inferredFromSourceSet": false,
    "requiresContextConfirmation": false
  }
}
```

### Snapshot rules
- `version` is mandatory for all new writes.
- `planningContextKey` must be stored both top-level on the parent record and inside the snapshot.
- `sourceIds` remain ordered for provenance, but identity logic must always use normalized context rules.
- `compatibility.requiresContextConfirmation = true` blocks generation until the user confirms or upgrades the context.

---

## 7. Draft identity rules

## 7.1 General rules

1. **Owner-scoped**: drafts remain unique per `schoolId + ownerUserId`.
2. **Context-first**: context identity outranks source selection.
3. **One resumable draft per exact context per family/mode** unless product later adds explicit multi-draft-per-context support.
4. **Source changes do not create a new draft** when context is unchanged.
5. **Template changes do not create a new draft** when context is unchanged.
6. **Broad references never define draft identity** by themselves.
7. **Explicit draft id beats context lookup** when opening a saved draft route.

## 7.2 Topic draft identity

Exact identity tuple:
- `schoolId`
- `ownerUserId`
- `planningContextKind = topic`
- `outputType` *(or `draftMode` for topic-scoped assessments)*
- `subjectId`
- `classId` *(if launcher is class-specific; recommended for v2)*
- `level`
- `termId`
- `topicId`

### Topic key examples
- lesson plan: `topic|subject:S1|class:C1|level:JSS1|term:T1|topic:K1|output:lesson_plan`
- class test: `topic|subject:S1|class:C1|level:JSS1|term:T1|topic:K1|mode:class_test|output:question_bank_draft`

## 7.3 Exam draft identity

Exact identity tuple:
- `schoolId`
- `ownerUserId`
- `planningContextKind = exam_scope`
- `draftMode = exam_draft`
- `outputType`
- `subjectId`
- `classId`
- `level`
- `termId`
- `examScope.scopeKind`
- normalized topic subset key if scope is not full subject term

### Exam scope kinds
| Scope kind | Meaning | Identity impact |
| :--- | :--- | :--- |
| `full_subject_term` | Whole subject for one class/level and term | No topic subset in key |
| `topic_subset` | Selected subset of topics inside same subject/term | Sorted topic ids must be part of key |

### Exam key examples
- full term exam: `exam|subject:S1|class:C1|level:JSS1|term:T1|topics:*|mode:exam_draft|output:cbt_draft`
- subset exam: `exam|subject:S1|class:C1|level:JSS1|term:T1|topics:K1,K3,K4|mode:exam_draft|output:cbt_draft`

## 7.4 What is intentionally not part of identity

These may change without creating a different draft:
- `sourceIds`
- template resolution result
- title
- description
- question mix overrides
- ordering of attached sources

---

## 8. Retrieval contract

## 8.1 Topic workspace retrieval contract

### Query: `getTopicPlanningContext`

**Purpose**  
Return the normalized context payload for topic-first planning before the editor opens.

**Inputs**
- `subjectId: Id<"subjects">`
- `classId: Id<"classes">`
- `level: string`
- `termId: Id<"academicTerms">`
- `topicId: Id<"knowledgeTopics">`
- `workspaceFamily: "instruction" | "assessment"`
- `outputType?: "lesson_plan" | "student_note" | "assignment" | "question_bank_draft"`
- `draftMode?: "practice_quiz" | "class_test"`

**Returns**
- normalized context header
- canonical `planningContextKey`
- validated topic summary
- teacher access summary
- suggested source groups
- resumable drafts for that exact context
- compatibility drafts that could be upgraded

**Response shape**

| Field | Meaning |
| :--- | :--- |
| `context` | Canonical context object with subject/class/level/term/topic |
| `topic` | Topic metadata from `knowledgeTopics` |
| `sourceGroups.topicBound` | Ready/indexed accessible materials with exact `topicId` |
| `sourceGroups.broadReferences` | Same subject/level accessible broad references, usually `imported_curriculum` or unbound planning references |
| `sourceGroups.recentlyUsed` | Optional source suggestions from the latest draft in the same context |
| `drafts.primary` | Exact context-keyed draft if it exists |
| `drafts.related` | Other same-context family drafts, e.g. note/assignment around the same topic |
| `compatibility` | Legacy drafts/source-only links that need confirmation |

### Topic retrieval rules

1. Topic must exist, be school-scoped, and match `subjectId`, `level`, and `termId`.
2. Class access must be enforced using existing assignment/binding rules.
3. `topicBound` materials require exact `topicId`, same `schoolId`, staff access, `processingStatus = ready`, `searchStatus = indexed`, and `reviewStatus != archived`.
4. `broadReferences` require same `schoolId`, same `subjectId`, same normalized `level`, and no forced real topic match.
5. `imported_curriculum` must never be used to silently infer a canonical topic when `topicId` is absent.
6. If an exact `planningContextKey` draft exists, return it as `drafts.primary`.
7. If only legacy candidates exist, return them under `compatibility` with generation blocked until confirmed.

## 8.2 Exam workspace retrieval contract

### Query: `getExamPlanningContext`

**Purpose**  
Return explicit subject/term/class exam context and suggested sources before opening exam drafting.

**Inputs**
- `subjectId: Id<"subjects">`
- `classId: Id<"classes">`
- `level: string`
- `termId: Id<"academicTerms">`
- `draftMode: "exam_draft"`
- `outputType?: "question_bank_draft" | "cbt_draft"`
- `scopeKind: "full_subject_term" | "topic_subset"`
- `topicIds?: Id<"knowledgeTopics">[]`

**Returns**
- normalized exam scope object
- canonical `planningContextKey`
- term topic roster for the selected subject/class/term
- suggested source groups
- resumable exact-match exam draft
- compatibility candidates

**Response shape**

| Field | Meaning |
| :--- | :--- |
| `context` | Canonical exam context header |
| `examScope` | `scopeKind`, `topicIds`, labels, and summary label |
| `topicsInTerm` | Allowed topic list for the subject/class/term |
| `sourceGroups.scopeTopics` | Materials attached to selected topic subset, if any |
| `sourceGroups.broadReferences` | Same subject/level reusable references |
| `sourceGroups.recentlyUsed` | Sources from latest exact exam draft, if any |
| `drafts.primary` | Exact context-keyed exam draft |
| `compatibility` | Legacy exam or source-first assessment candidates |

### Exam retrieval rules

1. Exam work is valid only for `draftMode = exam_draft`.
2. `topicId` on the bank parent must remain `null` for subject-scope exam drafts unless a future ADR changes that rule.
3. If `scopeKind = topic_subset`, every topic id must belong to the same `schoolId`, `subjectId`, normalized `level`, and `termId`.
4. `sourceGroups.scopeTopics` can include materials from the subset topics.
5. `sourceGroups.broadReferences` can include `imported_curriculum` and other reusable refs for the same subject/level.
6. A full-subject exam without explicit subset must not auto-bind itself to one topic even if only one topic source is selected later.
7. Exact resume uses `planningContextKey`, not `sourceSelectionSnapshot`.

## 8.3 Draft-open contract

### Query: `getPlanningDraftById`

**Purpose**  
Open an explicit saved draft safely.

**Inputs**
- `artifactId` or `bankId`

**Returns**
- parent record
- active content/items
- normalized context summary
- compatibility status
- selected sources provenance

### Open rules
- Explicit id wins over context lookup.
- If the draft has a complete v2 context, open directly.
- If the draft is legacy, open in compatibility mode with upgrade guidance.
- If linked materials are missing/inaccessible, editing may continue but generation must be blocked.

## 8.4 Context-aware source search contract

### Query: `searchPlanningSourcesInContext`

**Purpose**  
Search additional materials from inside a topic or exam workspace without losing context.

**Inputs**
- `planningContextKind`
- `subjectId`
- `classId`
- `level`
- `termId`
- `topicId?`
- `draftMode?`
- `searchQuery`
- `includeBroadReferences: boolean`

**Returns**
- bounded source results with badges for `topic_bound`, `broad_reference`, `class_scoped`, `selected`, and `legacy_linked`

---

## 9. Save/update mutation contract

## 9.1 Lesson family mutation contract

### Evolve existing mutation
`saveTeacherInstructionArtifactDraft`

### Required save inputs
- existing `artifactId?`
- `outputType`
- `title`
- `documentState`
- `plainText`
- `sourceIds`
- `planningContextKind = topic`
- `planningContextKey`
- `subjectId`
- `classId`
- `level`
- `termId`
- `topicId`
- `topicLabel`
- `revisionKind`
- optional `contextSnapshot`

### Save rules
1. If `artifactId` is supplied, validate ownership and school boundary, then update in place.
2. Else look up by exact `planningContextKey` and owner.
3. Never look up by source set alone on the v2 path.
4. `instructionArtifactSources` should be synchronized as provenance only.
5. Revision snapshots must store the v2 envelope.

## 9.2 Assessment family mutation contract

### Evolve existing mutation
`saveTeacherAssessmentBankDraft`

### Required save inputs
- existing `bankId?`
- `draftMode`
- `outputType`
- `title`
- `description?`
- `sourceIds`
- `items`
- `effectiveGenerationSettings`
- `planningContextKind = topic | exam_scope`
- `planningContextKey`
- `subjectId`
- `classId`
- `level`
- `termId`
- `topicId?` *(topic mode only)*
- `topicLabel?` *(topic mode only / compatibility only)*
- `examScope?` *(exam mode only)*
- optional `contextSnapshot`

### Save rules
1. Topic-scoped practice/class-test drafts upsert by exact topic context key.
2. Exam drafts upsert by exact exam context key.
3. `sourceSelectionSnapshot` is still written, but it must embed the context envelope.
4. No save path may auto-reuse another draft just because `sourceIds` match.

---

## 10. Compatibility and migration rules

## 10.1 Legacy draft classification

A draft is **legacy** if any of the following is true:
- no `planningContextKey`
- no `planningContextKind`
- no `termId` on a v2-required flow
- no `classId` on a class-specific flow
- bank/artifact matching currently depends only on `sourceIds` or old snapshot shape

## 10.2 Compatibility opening rules

### Existing lesson artifacts
1. If parent has `topicId` and the topic still exists, infer `planningContextKind = topic`.
2. If topic resolves to a canonical topic with one clear `termId`, open in upgradeable compatibility mode.
3. If only `topicLabel` exists and no real `topicId` exists, require topic confirmation before generation.
4. If sources are only broad references, never auto-promote them into a canonical topic.

### Existing assessment banks
1. If `draftMode` is `practice_quiz` or `class_test` and a real `topicId` exists, infer topic compatibility mode.
2. If `draftMode = exam_draft`, do not infer a single-topic identity from old source selection.
3. Legacy exam drafts must require explicit term/class/scope confirmation before new generation or auto-resume into v2 context.

## 10.3 Upgrade-on-save rules

When a legacy draft is reopened and the teacher confirms context:
1. Compute the v2 `planningContextKey`.
2. Look for an exact v2 draft for the same owner and mode.
3. If none exists, upgrade the legacy parent in place.
4. If one exists, **do not silently merge**; prompt to resume the v2 draft or save a copy.
5. The first v2 save must rewrite snapshots into the v2 envelope.

## 10.4 Old link compatibility rules

### Old source-only links
- Continue to resolve enough data to open the workspace.
- Treat them as `compatibility.requiresContextConfirmation = true` unless a complete canonical context can be recovered safely.
- Do not create new v2 draft identity until the user confirms context.

### Existing broad planning references
- remain valid reusable references
- remain unattached to a real topic unless already attached
- remain allowed for generation after a valid context is selected
- do not become portal-facing because they were used in planning

---

## 11. Retrieval ranking rules

### Topic workspace source ranking
1. exact topic-bound, ready/indexed, accessible materials
2. same subject/level broad planning references
3. previously attached sources from the exact context draft
4. other accessible same-subject/level materials returned from in-context search

### Exam workspace source ranking
1. materials bound to selected scope topics
2. same subject/level broad planning references
3. previous exact exam draft sources
4. other accessible same-subject/level materials from search

### Exclusions
Do not suggest by default:
- archived materials
- non-ready or non-indexed materials
- inaccessible class-scoped materials
- cross-school materials
- portal-only reasoning that bypasses staff access logic

---

## 12. Constraints preserved

This contract preserves existing rules:
- school boundary remains mandatory
- auth remains server-derived
- existing `lessonKnowledgeAccess` permission logic stays authoritative
- source materials stay reusable across multiple drafts
- portal approval/visibility rules stay unchanged
- no new table is required for this redesign slice

---

## 13. Acceptance criteria for implementation handoff

- [ ] Topic workspace retrieval is keyed by explicit topic context, not source ids.
- [ ] Exam workspace retrieval is keyed by explicit subject/class/term scope, not inferred topic-only context.
- [ ] One exact resumable draft can be found deterministically per owner + context + mode.
- [ ] Changing attached sources does not create a new draft when context is unchanged.
- [ ] Broad planning references remain reusable without forced permanent topic binding.
- [ ] Legacy source-first drafts open safely in compatibility mode.
- [ ] Legacy drafts are not silently merged into newer context-keyed drafts.
- [ ] Existing school, class-scope, approval, and portal rules remain intact.
- [ ] No unnecessary new tables are introduced.

---

## 14. Recommended build follow-up

This contract is ready to hand off to:
- **Task 06** — Context-aware query layer and draft identity refactor
- **Task 08** — Question bank workspace refactor for topic-first and exam-scope flows
- **Task 09** — Lesson-plan workspace refactor for topic-first planning

### Suggested sequencing
1. add parent-level context fields + indexes
2. evolve snapshot envelope and legacy parsing
3. implement exact-context retrieval queries
4. refactor save/upsert matching away from source-set identity
5. wire compatibility mode in teacher workspaces
