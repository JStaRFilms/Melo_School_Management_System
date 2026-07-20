# Feature Blueprint: Melo Curriculum Intelligence

## Status

**Implemented, independently reviewed, and deployed to Convex production on 2026-07-18.**

## Goal

Turn a school-owned scheme of work into a reviewed, evidence-backed academic plan. A school administrator uploads or selects an extracted curriculum source, Melo proposes weekly curriculum units, the administrator approves or corrects them, and the accepted units become existing `knowledgeTopics` that teachers can use throughout planning and assessment.

The first release also provides a **Curriculum Readiness Map**. It reports preparation evidence from existing Melo records; it does **not** claim that a lesson was taught unless a later, separately approved teaching-confirmation feature is added.

## Product Boundary

### Current workflow

A teacher adds a curriculum PDF as a broad planning reference, manually selects or creates a topic, and asks Melo to use selected source excerpts to generate one artifact.

### New workflow

Melo treats the approved scheme of work as structured school data:

1. Read an existing, school-scoped, extracted curriculum source.
2. Propose week, topic, subtopics, learning objectives, supporting text, source pages, and confidence.
3. Require an administrator to edit, reject, or approve every proposed unit.
4. Create approved units as the system's existing `knowledgeTopics`.
5. Calculate readiness from the existing lesson, note, assignment, assessment, and publication records connected to those topics.

### Explicitly out of scope for the first release

- Silent creation or publication of curriculum topics.
- Declaring that a topic was delivered/taught.
- Student tutoring, parent workflows, or a separate curriculum database that duplicates academic topics.
- Spreadsheet/photo import beyond the existing supported ingestion paths.
- Objective-level question alignment or deep exam conformance; these are a later premium audit increment.

## Users and Permissions

| User | First-release ability |
| --- | --- |
| School admin | Start an import from a ready curriculum source; review, edit, reject, approve, and view the readiness map. |
| Teacher | Consume approved topics through the current planning and assessment workflows; view readiness only if existing academic permissions support it. |
| Student / parent | No new access. |

All reads and writes remain school-scoped and server-authorized. The client must never supply authority for school, source ownership, or approval.

## Components

### Client

- Admin Curriculum Intelligence entry point under Academic Knowledge.
- Source selector restricted to ready, school-owned `imported_curriculum` material.
- Import status and extraction proposal review screen with page evidence, confidence, validation feedback, and per-unit edit/reject/approve actions.
- Curriculum Readiness Map grouped by class, subject, and term; show factual statuses such as lesson plan prepared, assessment drafted, and student resource published.
- Existing teacher planning pages continue to use the approved `knowledgeTopics`; no duplicate teacher workflow is introduced.

### Server

- Curriculum extraction action that receives normalized, page-aware text from the existing knowledge-material ingestion pipeline and returns schema-constrained units.
- Deterministic validation and merge layer for required academic context, week format, duplicate candidates, page references, and topic uniqueness.
- Admin-only Convex mutations/queries for import lifecycle, unit review, approval, audit events, and `knowledgeTopics` creation.
- Read model that calculates readiness from existing instruction artifacts, assessment banks, and approved/published resources.
- Small AI runtime resolver with deterministic `mock` mode and OpenRouter as the single network provider; record the actual provider and exact OpenRouter model ID for every curriculum run.

## Data Flow

```text
Existing curriculum upload
  -> native extraction / OCR fallback
  -> normalized page-aware material and chunks
  -> admin selects a ready source
  -> curriculum extraction request
  -> schema-constrained unit proposal
  -> deterministic validation + duplicate hints
  -> admin review
  -> approved units create existing knowledgeTopics
  -> existing lesson / assessment / publishing records
  -> calculated Curriculum Readiness Map
```

Only an administrator's approval changes academic data. AI output is a proposal, not authority.

## Database Schema Direction

Reuse the existing `knowledgeMaterials`, `knowledgeMaterialChunks`, `knowledgeTopics`, `instructionArtifacts`, `assessmentBanks`, `aiRunLogs`, and `contentAuditEvents` tables.

Add only these curriculum-specific records:

### `curriculumImports`

- `schoolId`, `materialId`, `subjectId`, `level`, `termId`
- `status`: `draft | generating | ready_for_review | partially_approved | approved | failed | archived`
- `requestedBy`, `reviewedBy?`, timestamps
- actual AI `provider`, `modelId`, prompt/schema versions, canonical run-log reference, error metadata
- aggregate counts for proposed, approved, rejected, and duplicate-warning units

Indexes: school/status, school/material, school/subject/term/level.

### `curriculumUnits`

- `schoolId`, `importId`, source `materialId`
- `weekNumber?`, `title`, `subtopics`, `learningObjectives`, `suggestedDuration?`
- `sourcePages`, `sourceChunkHash`, bounded `supportingExcerpt`, `confidence`
- `reviewStatus`: `proposed | approved | rejected`
- editor/reviewer metadata and validation/duplicate warnings
- `knowledgeTopicId?` after approval

Indexes: import/review status, school/topic identity, school/knowledge topic.

Learning objectives are stored on the curriculum unit for traceability in release one. Extending `knowledgeTopics` with objectives is deferred until an objective-level feature needs them, avoiding a broad change to current topic consumers.

Extend the existing `aiRunLogs` vocabulary with a curriculum-extraction output type and an optional `curriculumImportId`, rather than inventing a second disconnected model-run log. Extend the existing content-audit event/entity validators so import creation, unit review, and topic approval are auditable with the same school activity trail. All proposal records refer to source material and bounded page/chunk evidence; they must not duplicate whole document bodies.

## AI and Cost Routing

| Work | Runtime | Guardrail |
| --- | --- | --- |
| UI development and deterministic tests | `mock` fixtures | No network tokens. |
| Normal integration tests | Pinned low-cost OpenRouter model | Never use a moving/free router. |
| Final deployment extraction and routine generation | GPT-5.6 through OpenRouter | Pin the exact OpenRouter model ID; use schema-constrained output and per-run logs. |
| Deep curriculum audit and independent final review | Premium GPT-5.6 tier through OpenRouter | Explicit user-visible action; never default or used for ordinary implementation. |

`OPENROUTER_API_KEY` remains the only network-provider credential. `SCHOOL_AI_CURRICULUM_MODEL` selects the exact extraction model so the final demo can switch to GPT-5.6 without code changes. Logs must store `provider: openrouter` plus that exact model ID. OCR remains independently configured and is not silently changed as part of the generation-runtime refactor.

The credential must be configured on the active Convex deployment because curriculum extraction runs inside a Convex action, not inside the Next.js admin process. Provider authentication, unavailable-model, rate-limit, and invalid-structured-output failures are returned to admins as safe actionable messages without exposing credentials or raw provider payloads.

## Acceptance Criteria

- An admin can choose a ready, school-scoped curriculum source and create a proposal.
- The proposal has schema-validated weekly units with page evidence and supporting excerpts.
- Invalid or ambiguous data is surfaced for review; it is never silently created as a topic.
- Admin approval creates or links the existing `knowledgeTopics` exactly once and records an audit event.
- Teachers can use approved topics in the existing planning workflow without a parallel topic system.
- Readiness status derives from real existing records and uses precise language.
- Cross-school data access, client-supplied school context, and unreviewed publication are blocked by server checks.
- Mock fixtures cover the UI; automated tests cover validation, authorization, approval idempotency, and readiness calculation.
- The actual provider/model/prompt version and curriculum import link are recorded in the canonical AI-run log.
- Before handoff, run focused tests, typecheck/lint as practical, and `pnpm convex deploy` as required by this repository.

## Delivery Sequence

1. Verify current data contracts and finalize provider runtime adapter.
2. Implement import proposal and validation using fixtures first.
3. Implement the admin review and approval workflow.
4. Implement the readiness read model and UI.
5. Add focused tests, run a current-head deployment, and prepare a deterministic judge demo.

## Implementation Notes

- OpenRouter is the single network provider. `SCHOOL_AI_CURRICULUM_MODEL` selects the exact model ID, while deterministic tests use the protected `mock` runtime and make no provider request.
- Production is configured with the OpenRouter model slug `openai/gpt-5.6-terra`; changing models remains an environment-only operation.
- Generation is initiated by one authenticated admin action. Provider, model, source selection, and prompt metadata are derived server-side and written to the canonical AI run log.
- Curriculum sources must be ready, approved, indexed, school-owned `imported_curriculum` materials whose subject and level match the requested academic context.
- Source evidence is page-aware, deduplicated, and bounded by per-entry and aggregate character budgets before it can reach OpenRouter.
- Successful proposal persistence is atomic with run completion. Pre-run and in-run failures move the import into an explicit failed state instead of leaving silent drafts.
- Approval is human-only and idempotently creates or links the existing `knowledgeTopics`; readiness is calculated from existing artifacts and publication evidence.
- The admin production build and authenticated browser flow passed at desktop and mobile widths. The development Convex schema sync also validated all new compound indexes.

### Source compatibility repair (2026-07-20)

Production testing exposed two gaps hidden by fixture-shaped curriculum tests:

- Real ingestion creates indexed chunks without `chunkHash`, while curriculum evidence originally required one and silently discarded those chunks.
- Lesson source selection could attach a readable material before applying the final planning-context subject, level, and topic checks. The later excerpt query then rejected the source but surfaced the rejection as missing text.

The repair must keep existing uploads usable without reprocessing: use the stable Convex chunk ID when a legacy chunk has no hash, preserve real page metadata for curriculum evidence, and apply the same planning-context compatibility rules when listing, attaching, and extracting lesson sources. Regression coverage must use production-shaped chunks rather than manually adding metadata ingestion does not create. Expected source-state failures must remain actionable instead of being collapsed into a generic model-generation error.

### Evidence reconciliation and term selection repair (2026-07-20)

Live generation proved that a provider can return schema-valid units while adding harmless typography or a trailing ellipsis to a copied excerpt. Before persistence, Melo must reconcile each citation only against the bounded source entries sent in that exact prompt. A citation may be repaired only when its canonical excerpt uniquely identifies one prompt entry; authoritative chunk and page metadata then replace copied model metadata. Fabricated, paraphrased, or ambiguous evidence remains rejected, and the database validator remains the final trust boundary.

Curriculum planning is not limited to the currently active term. The admin may choose any term belonging to the active academic session, while imports targeting another or inactive session remain blocked. If source text strongly identifies a different numbered term than the selected term, generation stops before spending model tokens and tells the admin to select the matching term.

## Risks and Decisions Needed

- Confirm the final public OpenAI model IDs available to the deployment environment before recording the demo.
- Keep the existing uncommitted report-card change outside this feature's scope.
- Decide later whether objective-level alignment belongs in the hackathon vertical slice; it is intentionally excluded from the first build to protect delivery quality.
