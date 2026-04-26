# Lesson Knowledge Hub v1

## Goal

Create the first school-scoped teaching-content system for the product. The feature must let admins, teachers, and later students contribute structured learning resources that can be searched, approved, reused for AI-assisted lesson preparation, and exposed back to students through controlled topic pages.

This blueprint is implementation-grade and locked to v1. It is the source of truth for the Lesson Knowledge Hub lane and should not be expanded without a new Takomi task.

## Locked Scope

### Included in v1

- Shared knowledge library with approval and visibility controls
- Template studio for lesson-plan structures and rule enforcement
- Teacher lesson-plan workspace with AI generation and revision history
- Derived student-note and assignment generation
- Question-bank and CBT-draft authoring
- YouTube link submission and approval
- Student supplemental uploads and promotion flow
- Portal topic pages for approved content only
- Search, extraction, labels, audit logging, and rate limits

### Explicitly excluded

- Real-time collaborative editing
- Direct video hosting or transcoding
- Student test-taking engine
- Live AI tutoring or chat
- Adaptive personalization engine
- Full portal-wide learning library browsing
- Any extra portal surface beyond topic pages

## Route Contracts

### Admin routes

| Route | Responsibility | Allowed actions | Notes |
| :--- | :--- | :--- | :--- |
| `/academic/knowledge/library` | School-wide knowledge console | Search, filter, upload canonical resources, override labels, change visibility, and review material state | Admin-only. This is the canonical review surface for school-owned content. |
| `/academic/knowledge/templates` | Template studio | Create and edit lesson-plan, student-note, and assignment templates; preview resolution | Admin-only. Teachers can consume resolved templates but cannot edit them. |
| `/academic/knowledge/review` | Approval queue | Review student uploads, YouTube submissions, publish requests, reclassification requests, reject, archive, and approve | Admin-only. Every decision must be audited. |

### Teacher routes

| Route | Responsibility | Allowed actions | Notes |
| :--- | :--- | :--- | :--- |
| `/planning/library` | Teacher knowledge workspace | Search school materials, upload private source material, label resources, publish approved resources to staff-sharing, and choose grounding sources | Teacher-only. Private uploads remain private by default. Broad planning references such as curriculum PDFs may be uploaded without a real topic attachment and reused across multiple topic generations. |
| `/planning/lesson-plans` | Single-user lesson editor | Create, edit, save, and revise lesson plans, student notes, and assignments from selected sources | This is the first editor in v1 and it must remain single-user and rich-text-lite. |
| `/planning/question-bank` | Assessment draft workspace | Create and edit question-bank drafts and CBT drafts from approved source materials | Teacher-only. No live CBT engine is introduced here. |
| `/planning/videos` | YouTube submission queue | Submit YouTube URLs, track approval state, and attach approved links to topic records | External URLs only. No video storage or transcoding. |

### Portal route

| Route | Responsibility | Allowed actions | Notes |
| :--- | :--- | :--- | :--- |
| `/learning/topics/[topicId]` | Approved topic page | Read approved topic resources, view topic-linked lesson outputs, and submit class-scoped supplemental uploads when enabled | This is the only portal surface in v1. There is no library browse route. |

### AI API routes

| Route | Contract | Required inputs | Expected result |
| :--- | :--- | :--- | :--- |
| `POST /api/ai/lesson-plans/generate` | Generate a lesson-plan draft | School-scoped source material IDs, resolved template key, subject, level, and topic context (either resolved from selected sources or supplied explicitly when using broad planning references) | Creates or updates a draft artifact and records an AI run log after generation prechecks and quota checks pass. |
| `POST /api/ai/student-notes/generate` | Generate a student-note draft | Same grounding inputs plus the target lesson-plan artifact | Creates an editable student-note artifact derived from approved sources. |
| `POST /api/ai/assignments/generate` | Generate an assignment draft | Grounding sources, template context, and target topic | Creates an editable assignment artifact with a revision snapshot. |
| `POST /api/ai/question-bank/generate` | Generate a question-bank or CBT draft | Grounding sources, subject/level context, topic context (resolved or explicit), and output constraints | Creates a structured assessment draft and logs the model output after generation prechecks and quota checks pass. |

## Actor Permissions

| Action | Admin | Teacher | Student |
| :--- | :---: | :---: | :---: |
| Search school materials in staff surfaces | Yes | Yes | No |
| Upload canonical source material | Yes | No | No |
| Upload private source material | Yes | Yes | Yes, but only as class-scoped supplemental content from the topic page |
| Publish own upload to staff_shared | Yes | Yes, for teacher-owned content only | No |
| Approve content for student_approved visibility | Yes | Yes | No |
| Override labels, visibility, and review state | Yes | No | No |
| Edit templates | Yes | No | No |
| Generate lesson artifacts | Yes | Yes | No |
| View private_owner content | Yes | Owner only | No |
| View staff_shared content | Yes | Yes | No |
| View class_scoped content | Yes | Yes, for the matching class context | No |
| View student_approved content | Yes | Yes, in staff surfaces | Yes, only through the approved topic page and matching class context |

## Schema Intent

### `knowledgeTopics`

Canonical school-scoped topic nodes that tie subject, level, term context, and approved learning assets together.

Required intent:
- one topic record per school/subject/level/term combination that needs a portal page
- topic attachment is required before any portal exposure
- topic records store only stable identifiers and display metadata, not large document bodies

### `knowledgeMaterials`

One row per uploaded file, plain-text entry, YouTube link, generated resource, or student upload.

Core intent:
- `schoolId`, `ownerUserId`, `ownerRole`, `sourceType`, `visibility`, `reviewStatus`, `title`, `description`, `subjectId`, `level`, `topicLabel`, `storageId?`, `externalUrl?`, `searchStatus`
- material records always stay school-scoped
- private content must never leak across school boundaries

### `knowledgeMaterialClassBindings`

Separate visibility bindings for class-scoped content instead of embedding growing class arrays.

Core intent:
- one binding row per material/class relationship
- supports student uploads and class-specific review queues
- prevents unbounded arrays inside a single Convex document

### `knowledgeMaterialChunks`

Extracted text chunks for search and semantic retrieval, with per-chunk metadata.

Core intent:
- one row per extracted chunk
- search uses chunk records as the release-critical text layer
- semantic retrieval may enrich AI grounding, but explicit selected sources are always recorded

### `instructionTemplates`

Admin-owned template records for `lesson_plan`, `student_note`, and `assignment`.

Core intent:
- store section definitions, required sections, objective minimums, output type, and applicability metadata
- templates are school-aware but admin-managed
- teachers may resolve and preview templates, but they do not edit them

### `instructionArtifacts`

Artifact metadata for generated or manually-authored lesson resources.

Core intent:
- record the current artifact status, visibility, resolved template, subject, level, topic link, and owning actor
- keep generated lesson content separate from source materials
- support one current artifact record plus immutable revisions

### `instructionArtifactDocuments`

Current rich-text-lite document state and plain-text projection for each artifact.

Core intent:
- store the editable body for the active artifact version
- keep a plain-text projection for search, export, and verification
- avoid storing large editable documents in a single parent record

### `instructionArtifactRevisions`

Immutable snapshots created on generation, manual milestone save, and publish actions.

Core intent:
- capture who changed the document, when it changed, and which sources and template were used
- revision snapshots are the audit-friendly source of truth for history

### `instructionArtifactSources`

Join table between artifacts and selected grounding materials.

Core intent:
- preserve explicit source selection for every generation run
- make source provenance visible to future reviewers

### `assessmentBanks`

Metadata for question-bank collections and exam-draft sets.

Core intent:
- keep assessment drafts separate from lesson plans
- preserve school-scoped ownership, topic attachment, and review state

### `assessmentBankItems`

One row per question item with answer, explanation, difficulty, and tags.

Core intent:
- model question-bank content as child rows, not embedded arrays
- support moderation before any student-facing exposure

### `aiRunLogs`

Model, prompt class, status, actor, and error/cost metadata for each AI run.

Core intent:
- log generation success and failure
- preserve the exact prompt class and source selection used for each run

### `contentAuditEvents`

Approval, promotion, publish, reject, archive, override, and topic-attachment trail.

Core intent:
- every visibility change and approval must be auditable
- the audit trail must include the acting user and the before/after state

## Visibility, Approval, and State Transitions

### Visibility rules

| Visibility | Read access | Typical creator | Portal exposure |
| :--- | :--- | :--- | :--- |
| `private_owner` | Owner and admins only | Teacher uploads and draft-generated artifacts | Never |
| `staff_shared` | School staff only | Teacher-owned content after self-review, or admin override | Never |
| `class_scoped` | Staff and the matching class review flow | Student uploads and class-bound supplemental material | Never |
| `student_approved` | Staff plus approved portal readers in the matching class context | Teacher or admin approved content attached to a topic | Only through `/learning/topics/[topicId]` |

### Review states

| Review state | Meaning |
| :--- | :--- |
| `draft` | The item is still being authored or generated. |
| `pending_review` | The item is waiting for teacher or admin review. |
| `approved` | The item passed review for its current visibility. |
| `rejected` | The item was reviewed and blocked from exposure. |
| `archived` | The item is retired but retained for audit/history. |

### Allowed transitions

| From | To | Who can do it | Constraints |
| :--- | :--- | :--- | :--- |
| `draft/private_owner` | `approved/staff_shared` | Teacher or admin | Teacher-owned uploads must have labels and subject/level context confirmed before publishing. |
| `draft/private_owner` | `pending_review/class_scoped` | Teacher or student | Student uploads are class-scoped by default and stay non-portal until approved. |
| `pending_review/class_scoped` | `approved/student_approved` | Teacher or admin | The item must be attached to a topic and match the class context. |
| `approved/*` | `rejected/*` | Teacher or admin | Rejection hides the item from normal staff and portal exposure. |
| Any non-archived state | `archived/*` | Admin | Archive is the final off-ramp for retired content. |
| `rejected/*` | `draft/*` | Owner or admin | Resubmission starts a new review cycle. |

### Approval constraints

- Teachers can self-publish their own uploads to `staff_shared` after confirming labels, subject, and level.
- Teachers can create drafts and request review, but `student_approved` content requires an explicit human approval action and topic attachment.
- Admins can override labels, visibility, status, and ownership for any school-scoped item.
- AI-generated drafts must remain editable until a human approval action occurs.
- A portal topic page must never infer approval from topic attachment alone; the item must already be `student_approved`.

## Template Resolution Rules

1. Resolve by `subject + level` first.
2. If no exact match exists, fall back to `subject only`.
3. If no subject-only template exists, fall back to `level only`.
4. If no level-only template exists, use the school default template.
5. If no template is still available, generation must stop and the teacher must choose a template manually.

Additional rules:

- Template applicability is school-scoped; there is no cross-school fallback.
- The resolved template ID and the resolution path must be saved with the artifact revision and AI run log.
- Templates must declare the output type they govern and the sections that are required.
- Template rules are the source of truth for objective minimums, required headings, and output shape.

## AI Output Types and Editor Rules

### Output types

| Output type | Purpose | Default visibility | Portal eligible |
| :--- | :--- | :--- | :--- |
| `lesson_plan` | Teacher-facing lesson structure for a single topic or lesson slot | `private_owner` | No, unless later approved as topic content |
| `student_note` | Learner-facing note derived from a lesson plan or approved source material | `private_owner` | Yes, only after approval and topic attachment |
| `assignment` | Practice work derived from the lesson context | `private_owner` | Yes, only after approval and topic attachment |
| `question_bank_draft` | Structured question set with answers, explanations, and difficulty tags | `private_owner` | No |
| `cbt_draft` | Exam-style draft built from the question-bank schema | `private_owner` | No |

### Editor rules

- The first editor in v1 is single-user only.
- There is no live collaboration, multi-cursor editing, or track-changes workflow.
- The editor is rich-text-lite: headings, paragraphs, lists, checklists, links, and simple tables are allowed.
- Every save creates a revision snapshot.
- The editable document body and the plain-text projection must stay in sync.
- Output content remains editable until a human review or publish action occurs.

## Data Flow

1. A user uploads a file or registers a YouTube link through the role-appropriate route.
2. Convex creates a `knowledgeMaterials` record with owner, source type, school scope, visibility, and initial review state.
3. Ingestion actions extract text, suggest labels, chunk content, and update search/index status.
4. Teachers search the library, explicitly choose grounding materials, and open the lesson workspace.
5. Template resolution uses `subject + level`, then `subject only`, then `level only`, then school default.
6. The generation route validates topic, subject, level, and generation settings before consuming teacher quota.
7. The generation route creates a draft artifact using only the selected materials and the resolved template constraints.
8. Convex stores the current artifact document, source links, revision snapshots, and AI run logs.
9. Teachers revise the artifact in the single-user rich-text-lite editor and save revision snapshots as needed.
10. Teachers or admins approve the item, set the final visibility, and attach the content to a `knowledgeTopic` when portal exposure is intended.
11. The portal topic page loads only approved content that matches the student's class visibility and the topic attachment.

## Portal Exposure Rules

- The portal surface is limited to `/learning/topics/[topicId]`.
- There is no portal-wide search, library browse, or global learning dashboard in v1.
- Only `student_approved` content attached to the topic may render on the page.
- The page may show approved lesson notes, assignments, approved YouTube links, and promoted student uploads that match the class context.
- Private, staff-only, rejected, and archived content must never render on the portal.
- Student supplemental upload entry points, when enabled, live inside the topic page and return content to the teacher/admin review queue.

## Sample Inputs

The kickoff sample references already in the repo are:

- `docs/School curriculim example/2ND TERM JS 1 SOCIAL STUDIES.pdf`
- `docs/School curriculim example/JSS1 SOCIAL STUDIES SECOND TERM LESSON NOTES.pdf`

Use these as the reference pair for label extraction, topic naming, and expected lesson-note structure. The first file is the canonical curriculum source sample; the second is the reference lesson-note shape.

## Regression Notes

- Do not bypass existing school-aware auth checks.
- Do not expose staff-only content to the portal.
- Do not add teacher routes under the assessments flow when they are planning workflows.
- Do not make AI output publishable without an explicit human approval step.
- Do not store large editable documents or growing child collections in a single Convex document without a dedicated child table.
- Do not couple student uploads directly to staff-shared visibility.
- Do not add a general portal library or search surface in v1.
- Do not introduce collaborative editing before a later Takomi task authorizes it.

## Delivery and Verification Status

The Takomi delivery session `docs/tasks/orchestrator-sessions/orch-20260412-lesson-knowledge-hub` is closed as completed.

Final T15 verification recorded:

- `pnpm typecheck` passed: `16 successful, 16 total`.
- `pnpm lint` passed clean: `10 successful, 10 total` with zero warnings.
- `pnpm build` passed clean after the final verification cleanup.
- Targeted Convex lesson-knowledge helper tests passed: `2 passed`, `18 passed`.
- `pnpm exec convex deploy --yes` deployed successfully to `https://outgoing-warbler-782.eu-west-1.convex.cloud`.

Verification not covered in T15:

- authenticated browser/E2E smoke for admin, teacher, and portal flows
- live AI generation smoke against configured provider credentials
- deployed upload/PDF extraction smoke

Convex deploy noted that Convex AI files are out of date; `npx convex ai-files update` remains a separate maintenance follow-up.

## Scope Alignment

This blueprint covers the lesson-workspace portion of FR-010 and the AI-assisted teacher tools portion of FR-016 without adding any v2 surface area.
