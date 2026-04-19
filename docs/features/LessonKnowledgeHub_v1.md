# Lesson Knowledge Hub v1

## Goal

Create the first school-scoped teaching-content system for the product. The feature must let admins, teachers, and later students contribute structured learning resources that can be searched, approved, reused for AI-assisted lesson preparation, and exposed back to students through controlled topic pages.

This blueprint is documentation-only for the new Takomi orchestration session. It does not claim implementation yet.

## Product Outcome

- Admins can upload canonical curriculum or school-owned source materials.
- Teachers can upload private source materials, label them, and explicitly publish them to the shared staff library.
- Admins define the lesson-template structure and rule set.
- Teachers generate lesson plans, student notes, assignments, and question-bank drafts from selected materials inside a rich-text-lite workspace.
- Teachers can submit YouTube resources for approval and topic attachment.
- Students can upload class-scoped supplemental material that teachers can promote.
- The portal exposes approved topic pages only; it does not expose a full global learning library yet.

## Locked Scope

### Included in v1 session

- Shared knowledge library with approval and visibility controls
- Template studio for lesson-plan structures and rule enforcement
- Teacher lesson-plan workspace with AI generation and revision history
- Derived student-note and assignment generation
- Question-bank and CBT-draft authoring
- YouTube link submission and approval
- Student supplemental uploads and promotion flow
- Portal topic pages for approved content
- Search, extraction, labels, audit logging, and rate limits

### Explicitly excluded

- Real-time collaborative editing
- Direct video hosting or transcoding
- Student test-taking engine
- Live AI tutoring or chat
- Adaptive personalization engine
- Full portal-wide learning library browsing

## User Roles

### Admin

- Upload canonical source materials
- Override labels, visibility, and approvals
- Manage lesson templates
- Review staff and student submissions
- Force promote, reject, archive, or reclassify resources

### Teacher

- Upload private materials
- Publish approved labels to the shared staff tier
- Select grounding materials for AI generation
- Edit lesson plans and derived outputs
- Build question banks and exam drafts
- Review and promote student uploads
- Submit YouTube links for approval

### Student

- View approved topic pages for their class context
- Upload supplemental class-scoped materials
- Never see private or staff-only materials

## Route Additions

### Admin

- `/academic/knowledge/library`
- `/academic/knowledge/templates`
- `/academic/knowledge/review`

### Teacher

- `/planning/library`
- `/planning/lesson-plans`
- `/planning/question-bank`
- `/planning/videos`

### Portal

- `/learning/topics/[topicId]`

### Teacher API routes

- `POST /api/ai/lesson-plans/generate`
- `POST /api/ai/student-notes/generate`
- `POST /api/ai/assignments/generate`
- `POST /api/ai/question-bank/generate`

## Components

### Client

#### Admin app

- Knowledge library console
- Template studio
- Review and override workspace

#### Teacher app

- Library search and upload workspace
- Lesson-plan editor with source picker
- Question-bank editor
- Video submission screen

#### Portal app

- Topic page view
- Student supplemental upload entry point

### Server

#### Convex

- Storage metadata and upload URL generation
- Material extraction orchestration
- Label suggestion persistence
- Search indexes and retrieval queries
- Template resolution
- Artifact storage and revision snapshots
- Approval workflows
- Audit and rate-limit persistence

#### Shared AI package

- OpenRouter provider setup through Vercel AI SDK
- Model registry
- Prompt builders
- Structured-output schemas
- Retry and failure normalization

#### Teacher route handlers

- Streaming generation responses for lesson artifacts and question-bank drafts

## Data Flow

1. A user uploads a file or registers a YouTube link.
2. Convex creates a `knowledgeMaterials` record with owner, source type, school scope, visibility, and initial labels.
3. Ingestion actions extract text, suggest labels, chunk content, and update search/index status.
4. The teacher searches the library, explicitly selects grounding materials, and opens the lesson-plan workspace.
5. Template resolution uses `subject + level`, then `subject only`, then `level only`, then school default.
6. The teacher API route generates structured lesson output using the selected materials and resolved template.
7. Convex stores the current artifact document, source links, revision snapshots, and AI run logs.
8. The teacher can derive student notes, assignments, and question-bank drafts from the artifact.
9. Approved materials and artifacts are attached to `knowledgeTopics`.
10. Portal topic pages load only approved content that matches the student’s class visibility.

## Database Schema

### `knowledgeTopics`

- Canonical school-scoped topic nodes that tie subject, level, term context, and approved learning assets together.

### `knowledgeMaterials`

- One row per uploaded file, plain-text entry, YouTube link, generated resource, or student upload.
- Core fields:
  - `schoolId`
  - `ownerUserId`
  - `ownerRole`
  - `sourceType`
  - `visibility`
  - `reviewStatus`
  - `title`
  - `description`
  - `subjectId`
  - `level`
  - `topicLabel`
  - `storageId?`
  - `externalUrl?`
  - `searchStatus`

### `knowledgeMaterialClassBindings`

- Separate visibility bindings for class-scoped content instead of embedding growing class arrays.

### `knowledgeMaterialChunks`

- Extracted text chunks for search and semantic retrieval, with per-chunk metadata.

### `instructionTemplates`

- Admin-owned template records for `lesson_plan`, `student_note`, and `assignment`.
- Includes section definitions, rule constraints, and applicability metadata.

### `instructionArtifacts`

- Artifact metadata for generated or manually-authored lesson resources.

### `instructionArtifactDocuments`

- Current rich-text-lite document state and plain-text projection for each artifact.

### `instructionArtifactRevisions`

- Immutable snapshots created on generation, manual milestone save, and publish actions.

### `instructionArtifactSources`

- Join table between artifacts and selected grounding materials.

### `assessmentBanks`

- Metadata for question-bank collections and exam-draft sets.

### `assessmentBankItems`

- One row per question item with answer, explanation, difficulty, and tags.

### `aiRunLogs`

- Model, prompt class, status, actor, and error/cost metadata for each AI run.

### `contentAuditEvents`

- Approval, promotion, publish, reject, archive, and override trail.

## Visibility and Approval Rules

- `private_owner`: default for teacher uploads and draft-generated artifacts
- `staff_shared`: visible to staff search only
- `class_scoped`: visible only to the targeted class context
- `student_approved`: visible to student portal topic pages

Rules:

- Teacher uploads start as `private_owner`.
- Teachers may publish to `staff_shared` after confirming labels.
- Student uploads start as `class_scoped`.
- Moving any content to `student_approved` requires teacher or admin approval.
- Admins may override owner, labels, status, and visibility.

## Search Strategy

- Full-text search is the release-critical search layer.
- Semantic retrieval is allowed behind the same chunk model for AI grounding.
- The teacher generation flow always shows and records the explicit selected sources, even if semantic retrieval enriches context later.

## AI Output Rules

- AI output must remain editable before any publish or student-facing exposure.
- The generation prompt must include only the selected materials and resolved template constraints.
- Template rules must control objective minimums, required sections, and output shape.
- Failure states must preserve the draft and log the error in `aiRunLogs`.

## Sample Inputs

The kickoff sample references already in the repo:

- `docs/School curriculim example/2ND TERM JS 1 SOCIAL STUDIES.pdf`
- `docs/School curriculim example/JSS1 SOCIAL STUDIES SECOND TERM LESSON NOTES.pdf`

These define the first reference format for topic labeling and expected output structure.

## Regressions To Avoid

- Do not bypass existing school-aware auth checks.
- Do not expose staff-only content to the portal.
- Do not add teacher routes under the existing assessments flow when they are conceptually planning workflows.
- Do not store large editable documents or growing child collections in a single Convex document without a dedicated child table.
- Do not couple student uploads directly to staff-shared visibility.

## Orchestration Outcome

This feature is implemented through the dedicated Takomi session:

- `docs/tasks/orchestrator-sessions/orch-20260412-lesson-knowledge-hub/`

The session owns the task pack, sequencing, and future execution reporting for this domain.
