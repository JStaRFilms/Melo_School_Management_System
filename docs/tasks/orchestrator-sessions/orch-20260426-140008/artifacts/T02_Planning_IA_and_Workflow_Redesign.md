# T02 — Planning Information Architecture and Workflow Redesign

Session: `orch-20260426-140008`  
Stage: `Design`  
Workflow: `vibe-design`  
Requested model target: `oauth-router/gpt-5.4`  
Prepared after visible preflight: `pi --list-models`

## 1. Outcome

This artifact redesigns teacher planning from **source-first** to **context-first**.

The new planning IA should make `/planning` a launcher and resume surface, while the library becomes a supporting repository. Teachers should start from:

- `Subject -> Level/Class -> Term -> Topic` for:
  - lesson plans
  - student notes
  - assignments
  - practice quizzes
  - class tests
- `Subject -> Level/Class -> Term -> Exam scope` for:
  - exam drafts only

Manual topic entry remains supported only as a **fallback compatibility behavior**, not the primary UX.

---

## 2. Current-state audit of teacher planning routes

## Existing routes

| Current route | Current role | Current issue in v2 context |
|---|---|---|
| `/planning` | Redirects immediately to library | Wrong default entry; bypasses planning context |
| `/planning/library` | Upload, search, filter, select sources, then launch workspaces | Library is overburdened as both repository and launch surface |
| `/planning/lesson-plans` | Lesson / note / assignment drafting using `sourceIds` | Source selection is the primary identity; topic context is inferred or manually typed |
| `/planning/question-bank` | Practice quiz / class test / exam draft using `sourceIds` + `mode` | Topic and exam flows share one source-first entry mental model |
| `/planning/videos` | YouTube resource submission | Fine as a repository-adjacent surface, not a planning launcher |

## Current UX strengths worth preserving

- Existing library upload and filtering are valuable.
- Existing lesson-plan workspace already supports multiple output types in one editor.
- Existing question-bank workspace already separates `practice_quiz`, `class_test`, and `exam_draft` modes.
- Existing `sourceIds` query handoff works and should remain supported during rollout.
- Existing broad planning reference handling (`imported_curriculum`) is compatible with v2.

## Current UX problems to solve

1. Planning starts in the wrong place.
2. Workspaces depend on source selection before context selection.
3. Exam drafting looks like a variant of topic work instead of a distinct subject-scope workflow.
4. Topic identity is currently weak or inferred late.
5. Refresh/resume behavior is tied too heavily to source query params instead of planning context.

---

## 3. IA decision summary

## Primary surfaces in v2

1. **Planning Hub**
   - default `/planning` landing page
   - choose lane: Topic Work, Exam Work, Library
   - resume recent work by context

2. **Topic Workspace**
   - one explicit teaching context
   - owns lesson plan, student note, assignment, practice quiz, class test
   - pulls suggested materials for the chosen topic
   - allows add/remove source actions inside the workspace

3. **Exam Workspace**
   - one explicit exam scope context
   - owns exam draft authoring only
   - uses subject/level/term context, optionally spanning multiple topics
   - allows broad planning references and topic-bound materials

4. **Library**
   - repository and retrieval surface
   - upload, edit labels, review, inspect provenance, search, and attach materials
   - not the default authoring launcher

---

## 4. Proposed route map

## 4.1 Primary route map

| Route | Surface | Purpose | Notes |
|---|---|---|---|
| `/planning` | Planning hub | Default planning entry; lane selection + recent work | Replaces redirect-to-library behavior |
| `/planning/topics` | Topic context launcher | Context-first selection flow for subject, class/level, term, topic | Can be a stepper or progressive selection screen |
| `/planning/topics/[topicId]` | Topic workspace | Main topic-authoring workspace | Default tab can be `lesson` |
| `/planning/topics/[topicId]/lesson` | Topic workspace tab | Lesson plan / student note / assignment authoring | Preserves current output toggle model |
| `/planning/topics/[topicId]/assessment` | Topic workspace tab | Practice quiz / class test authoring | Excludes exam draft mode |
| `/planning/exams` | Exam context launcher | Select subject, class/level, term, exam scope | Separate from topic flow on purpose |
| `/planning/exams/[examScopeKey]` | Exam workspace | Exam draft authoring | Subject-scope and term-aware |
| `/planning/library` | Library | Repository, source management, and attach/search utility | Still directly reachable |
| `/planning/videos` | Video submissions | Repository-adjacent submission flow | May remain standalone or later fold under library tools |

## 4.2 Supporting attach/return routes

These do **not** need separate full-page destinations if implemented as drawers/modals, but the IA should treat them as explicit states.

| Route/state | Purpose |
|---|---|
| `/planning/topics/[topicId]?panel=sources` | Open topic source pane state |
| `/planning/topics/[topicId]?panel=add-material` | Open add-material flow while preserving topic context |
| `/planning/exams/[examScopeKey]?panel=sources` | Open exam source pane state |
| `/planning/exams/[examScopeKey]?panel=add-material` | Open add-material flow while preserving exam context |
| `/planning/library?returnTo=...` | Enter library in attach mode and return to prior context |

## 4.3 Compatibility routes to preserve during migration

| Route | v2 treatment |
|---|---|
| `/planning/lesson-plans?sourceIds=...` | Compatibility entry; infer topic context when possible, else open compatibility mode |
| `/planning/question-bank?sourceIds=...&mode=practice_quiz` | Compatibility entry; attempt topic context inference |
| `/planning/question-bank?sourceIds=...&mode=class_test` | Compatibility entry; attempt topic context inference |
| `/planning/question-bank?sourceIds=...&mode=exam_draft` | Compatibility entry; attempt exam context inference |
| `/planning/library?sourceIds=...` | Still valid as a source-selection state, but no longer the main launch path |

## 4.4 Route naming decision

Use **route families by planning intent**:

- `topics/*` for topic-bound planning
- `exams/*` for subject-scope assessment drafting
- `library` for repository work

Do **not** keep the v2 top-level IA centered on implementation objects like `lesson-plans` vs `question-bank`. Those are authoring modes inside context, not primary entry categories.

---

## 5. Screen responsibility matrix

| Screen | Primary responsibility | Secondary responsibility | Must not own |
|---|---|---|---|
| Planning hub (`/planning`) | Start planning from context, resume work, branch to topic/exam/library | Highlight recent drafts and recent contexts | Raw repository management, deep editing |
| Topic launcher (`/planning/topics`) | Resolve `subject -> class/level -> term -> topic` | Show resumable topic threads | Source picking as required first step |
| Topic workspace (`/planning/topics/[topicId]/*`) | Author topic-bound outputs in a single teaching context | Suggest sources, add/remove materials, resume drafts | School-wide library administration, exam-scope framing |
| Exam launcher (`/planning/exams`) | Resolve `subject -> class/level -> term -> exam scope` | Resume recent exam drafts | Pretending exam work is a topic workflow |
| Exam workspace (`/planning/exams/[examScopeKey]`) | Draft subject-scope exams | Suggest relevant topic materials and broad references | Portal publishing, topic-only assumptions |
| Library (`/planning/library`) | Upload, label, review, filter, inspect, and attach materials | Optional attach-back flow into workspaces | Becoming the required planning start point |
| Videos (`/planning/videos`) | Submit and monitor YouTube resources | Repository support for planning content | Acting as a separate planning lane |

---

## 6. Context-first route behavior

## 6.1 Planning hub behavior

### What users see first

Three lanes:

1. **Topic Wo
