# Lesson Knowledge Hub v2 - Context-First Planning

## Goal

Shift teacher planning from a source-first workflow to a context-first workflow. Teachers should begin from teaching context, then pull in the right materials, rather than starting from the library and building drafts around whichever files were selected first.

This document is the Genesis brief for the v2 redesign. It defines scope, boundaries, compatibility expectations, and acceptance criteria for later Design and Build stages. It does not authorize implementation beyond the approved v2 planning workflow.

## Mission

Make planning feel like teaching preparation, not document management.

Primary flow:
- `Subject -> Level/Class -> Term -> Topic` for lesson plans, student notes, assignments, and topic-level quizzes
- `Subject -> Level/Class -> Term -> Exam scope` for exam-draft authoring

The library stays important, but it becomes a repository and retrieval surface instead of the primary launch point for authoring.

## Minimum Usable State

### Included in v2 MUS

- Teacher planning hub with clear context launch choices
- Topic-first lesson planning for lesson plan, student note, and assignment outputs
- Topic-first quiz / class-test authoring in the question-bank workspace
- Explicit exam-scope authoring for exam drafts at the subject scope
- Context-aware source suggestions inside topic and exam workspaces
- Add-material flow from within a topic or exam workspace
- Clear separation between broad planning references, topic-bound materials, and portal-facing approved resources
- Safe resume behavior for existing drafts when opened from the new context model
- Backward-compatible handling for existing source-first drafts and links during migration

### Explicitly excluded from this v2 slice

- Full curriculum-to-topic auto-import or syllabus decomposition
- New portal-wide browsing surfaces
- New student-facing approval states
- Collaborative editing
- Changes to the existing approval and visibility model outside what is needed for context-first planning
- Large schema rewrites unless Design stage proves they are necessary

## v2 Planning Model

### 1. Planning hub

The teacher enters planning through a dedicated launcher, not by defaulting straight into the library.

Responsibilities:
- choose planning mode
- choose subject, level/class, and term first
- branch into either topic work or exam-scope work
- surface recent drafts and resumable work by context

The planning hub is the orchestration surface, not the long-term source repository.

### 2. Topic workspace

Use for:
- lesson plans
- student notes
- assignments
- practice quizzes
- class tests tied to one topic

Context contract:
- one active teaching context at a time
- topic identity is explicit
- the workspace can suggest materials already related to the chosen subject, level/class, term, and topic
- teachers can still attach additional sources inside the workspace

### 3. Exam workspace

Use for:
- exam-draft authoring only

Context contract:
- subject-scoped rather than single-topic by default
- launched from `Subject -> Level/Class -> Term -> Exam scope`
- may use multiple topic-bound materials and broad planning references as inputs
- must not pretend an exam draft belongs to one topic unless a later design explicitly adds that as metadata

### 4. Library

The library remains a repository.

Responsibilities:
- upload and manage planning materials
- search and filter materials across private, staff-shared, class-scoped, and approved states
- store broad planning references such as curriculum PDFs
- support cleanup, relabeling, review, and provenance inspection

Non-responsibilities:
- it is not the primary planning launcher in v2
- it should not force teachers to select sources before they can define planning context
- it should not be treated as the system of record for draft identity

## Material Classification Rules

### Broad planning references

Examples:
- curriculum PDFs
- scheme-of-work documents
- subject-wide exam prep packs
- teacher reference notes spanning many topics

Rules:
- may exist without a real topic attachment
- remain reusable across many topic or exam workspaces
- can inform generation and drafting
- do not by themselves define the draft context
- must never become portal-facing content just because they were used during generation

### Topic-bound materials

Examples:
- lesson notes for one topic
- a worksheet tied to a single topic
- a teacher-uploaded explainer for a topic

Rules:
- should be attachable to a real topic context
- can be suggested automatically when the matching topic workspace opens
- may later become portal-facing only through the existing approval and visibility rules
- should remain distinguishable from broad planning references in UI copy and filters

### Portal-facing resources

Examples:
- approved student notes
- approved assignments
- approved topic-linked learning resources

Rules:
- must already satisfy existing approval requirements
- must be attached to a valid topic
- remain topic-first, not library-first
- exam-scope drafts are not portal-facing by default

## Responsibility Matrix

| Surface | Primary responsibility | Must not own |
| :--- | :--- | :--- |
| Planning hub | context selection, recent work, resume entry | long-term repository management |
| Topic workspace | topic-first authoring and source curation in context | school-wide library administration |
| Exam workspace | subject-scope exam drafting | portal publication or topic-only assumptions |
| Library | repository, retrieval, upload, review, cleanup | being the default authoring start point |

## Compatibility Expectations

### Existing draft compatibility

v2 must preserve access to existing lesson-plan and question-bank drafts.

Required expectations:
- existing source-first drafts remain readable and editable
- old links that only carry `sourceIds` should still resolve safely during transition
- when possible, existing drafts should reopen into the most appropriate inferred topic or exam context
- if exact context cannot be inferred, the UI should open in a safe compatibility mode and ask the teacher to confirm context before generating new output

### Existing data compatibility

- broad planning references created under current `imported_curriculum` semantics remain valid
- topic-bound materials already attached to topics remain valid
- no portal-approved material should lose visibility because of the planning redesign
- no migration should require teachers to recreate valid drafts unless a document is already broken

### Draft identity expectations

The future implementation must distinguish draft identity by context, not just source selection.

At minimum, draft identity must separate:
- output type
- planning mode
- subject
- level/class
- term
- topic identity for topic work
- exam scope identity for exam work
- selected source set as supporting context, not the only identity key

## UX Guardrails

- Library entry still exists, but the default planning entry should be the planning hub.
- Topic work should feel like continuing a teaching thread, not launching a generic document editor.
- Exam drafting should make its wider scope obvious in labels and summaries.
- Adding materials from within a workspace should preserve the current planning context.
- Broad planning references must be clearly labeled as reusable references, not mistaken for topic resources.
- Topic-bound resources must be visibly distinct from broad references in filters, cards, and source panes.

## Acceptance Criteria

### Genesis acceptance

- [x] The v2 planning model is defined.
- [x] Library, topic workspace, and exam workspace responsibilities are separated.
- [x] Broad planning reference vs topic-bound vs portal-facing rules are locked.
- [x] Compatibility expectations for existing lesson-plan and question-bank flows are defined.
- [x] Recommended Design and Build fan-out is documented in the session artifacts.

### Design and Build target acceptance

- [ ] Teachers can start planning from context without first selecting library materials.
- [ ] Lesson planning and topic-level assessment drafting launch from explicit topic context.
- [ ] Exam drafting launches from explicit exam scope context.
- [ ] Library materials can still be attached from inside a topic or exam workflow.
- [ ] Broad planning references remain reusable without forced topic binding.
- [ ] Existing source-first drafts continue to open safely during rollout.
- [ ] Portal-facing rules remain unchanged except for clearer topic alignment.

## Relationship to Existing Docs

- `docs/features/LessonKnowledgeHub_v1.md` remains the v1 implementation blueprint and historical baseline.
- This v2 doc supersedes v1 only for planning entry, context orchestration, and workspace responsibility boundaries.
- Approval, visibility, audit, and portal exposure rules from v1 remain in force unless a later task explicitly revises them.

