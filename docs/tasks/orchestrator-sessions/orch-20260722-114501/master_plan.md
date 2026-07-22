# OBHIS Website + Reusable Admissions Platform — Master Plan

Session: `orch-20260722-114501`
Owner: Integration/orchestration session
Lifecycle: Genesis → Design → Build → Integration Review

## Mission

Deliver two coordinated capabilities in the existing School Management System monorepo:

1. A reusable, tenant-aware, paid online admissions system that any school can link from a platform-managed or externally managed website.
2. A bespoke public website for Olive Blessed Crest Academy (OBHIS), built on shared hosting/domain/content infrastructure without forcing the school into a visually restrictive template.

The website and admissions system are separate product features with an explicit link contract. They stay in the same monorepo and shared Convex backend, but implementation occurs in isolated Git worktrees and merges through an integration owner.

## Confirmed Product Decisions

- Website strategy: shared infrastructure with bespoke school frontends.
- Form entitlement: guardian account plus one paid application slot per child/application.
- Applicant lifecycle: application records remain staged; accepted applicants are converted to student/family/user records only after approval.
- School editing: structured content editing in the admin portal; layouts and bespoke visual design remain code-controlled.
- Execution: this session owns architecture, contracts, sequencing, review, and final integration; specialist Takomi harnesses implement isolated worktrees.

## Core Architectural Decisions

### One project, not separate repositories

Use the current monorepo, shared packages, shared Convex deployment, shared auth, tenant isolation, and payment provider foundation. Do not clone the repository per school.

### Two principal worktrees

- `feature/admissions-platform`: public application surface, application domain, payment entitlement, review workflow, applicant conversion, and admissions admin UI.
- `feature/obhis-public-site`: reusable site-core refactor, structured content consumption, and the bespoke OBHIS public website.

A short foundation phase lands shared contracts before the two worktrees diverge. The integration owner controls schema ownership and final merge order.

### Decoupled public application surface

The admissions funnel must work for schools with either managed or external websites. Therefore, the canonical application experience should not depend on the tenant website renderer. Prefer a dedicated public app/surface such as `apps/apply` with tenant routes, e.g. `apply.<product-domain>/<schoolSlug>`, while managed sites can expose a branded `/apply` link or redirect.

### Shared core, bespoke visual renderer

Retain reusable domain resolution, canonical host handling, content contracts, deployment tooling, SEO primitives, analytics hooks, admissions links, and portal links. Remove the assumption that every school must fit one visual template. Each managed school may have a bespoke renderer/module while still consuming shared content and infrastructure.

### Structured content, not a page builder

School admins may update factual content: contacts, addresses, admissions settings, approved copy fields, galleries, programmes, calls to action, policies, and visibility. They do not receive arbitrary component placement or freeform layout code.

## Source Material Summary

The photographed OBHIS booklet contains:

- school identity, welcome text, vision, mission, services, facilities, rules, address, phone numbers, and email
- application checklist: completed form, birth certificate, two passport photographs, and doctor’s report for pre-existing conditions/allergies
- paid non-refundable application fee (historically ₦5,000)
- requested class/section
- child name, sex, photo, blood group, genotype, date and country of birth, nationality, religion, family position, siblings
- previous schools and dates
- current address, state of origin, country
- father, mother, and guardian contact details
- declaration/signature/date
- official review fields: entrance exam result, interview result, recommendation, reviewer signature

The digital system should preserve necessary information while correcting old paper-form limitations and avoiding unnecessary compulsory collection.

## Admissions Domain Boundary

Expected bounded contexts:

- admissions programmes/intakes
- versioned form definitions and tenant custom fields
- application products/prices and paid slot entitlements
- guardian applicant identity and contact verification
- child applications and resumable drafts
- documents and document requirements
- submission snapshots and declarations/consents
- review, interview, entrance assessment, decisions, and notes
- acceptance/conversion into canonical school records
- audit events and communications

Do not write applicants directly into `students` during purchase or submission.

## Sensitive Data Guardrails

The system processes minors’ identity, medical information, photos, and potentially government identifiers. Build with:

- least-privilege staff access
- explicit school scope on every record
- private storage references and signed URLs
- document category and verification status metadata
- audit trails for view/download/review decisions
- configurable retention/deletion policies for rejected or abandoned applications
- consent/declaration version capture
- no NIN, passport, genotype, religion, or medical field required by default unless a school has a documented need
- no AI document processing enabled by default

Future AI verification (birth certificate name/date matching, OCR extraction, anomaly prompts, NIN/passport validation) is a separate opt-in roadmap item with human review; it must never silently make an admissions decision.

## Student Photo Provenance

Store the application photo as an admissions document and, after acceptance, optionally copy/link it as the student’s fallback profile photo with provenance `application_upload`. A later school photo may become the preferred report-card photo without deleting the original application document.

## Applicant Conversion Contract

Acceptance must run as an idempotent, audited operation that:

1. validates application state and school scope
2. resolves or creates guardian user/family links
3. creates the student user and student record
4. assigns class/admission number only when approved by staff
5. migrates selected profile fields and fallback photo references
6. preserves the immutable submitted application snapshot
7. records all created IDs and prevents duplicate conversion
8. issues portal onboarding separately from the transaction where appropriate

## Worktree And Merge Policy

### Foundation before parallel work

Land an architecture/contract commit that establishes:

- route/link contract between websites and admissions
- naming and table ownership
- shared validators/types boundaries
- content interface boundaries
- migration and compatibility expectations

### File ownership

Admissions worktree owns:

- `apps/apply/**` (new)
- admissions-specific admin routes/components
- `packages/convex/functions/admissions/**`
- admissions validators/tests/docs

Website worktree owns:

- `apps/sites/**`
- website content/admin routes specifically assigned to it
- site renderer and per-school site modules
- site tests/docs

Integration owner owns conflict-prone shared files:

- `packages/convex/schema.ts`
- workspace/package manifests when both branches require changes
- shared navigation exports
- generated Convex API reconciliation
- final cross-feature documentation

Specialist agents should propose schema patches in task notes when direct ownership is withheld, or coordinate through a foundation commit before parallel coding.

### Merge sequence

1. shared foundation/contracts
2. admissions backend/domain
3. site core/content infrastructure
4. public application UI and admin admissions UI
5. bespoke OBHIS site
6. cross-feature linking, end-to-end tests, security review, and documentation

## Lifecycle Plan

### Genesis

- G1: admissions product/domain/security architecture
- G2: managed-site platform and OBHIS content/delivery architecture
- integration owner consolidates decisions and freezes contracts

### Design

- D1: guardian purchase/application UX and admissions staff review UX
- D2: OBHIS bespoke website information architecture and visual direction
- D3: structured school-content editing UX and permissions

### Build

- B0: shared contracts and schema integration foundation
- B1: admissions backend, entitlements, documents, review, conversion
- B2: public guardian/application surface
- B3: admin admissions review and settings
- B4: shared site-core refactor and structured content loading
- B5: bespoke OBHIS site implementation
- B6: integration, payments, security, accessibility, and E2E verification

## Success Criteria

- A school can publish an admissions link regardless of who hosts its website.
- One verified guardian can purchase multiple one-child application slots.
- Payment verification is idempotent and creates an entitlement, not a student.
- Drafts are resumable and each slot can submit at most one application.
- Staff can review, request changes, record assessment/interview outcomes, accept/reject/waitlist, and convert accepted applicants safely.
- Accepted data flows into canonical family/student records without duplicate identities.
- OBHIS has a bespoke, credible public website using the supplied booklet as source material, with modernized and approved content.
- School admins can edit structured factual content without controlling arbitrary layout.
- Managed and external school websites use the same stable application link contract.
- Tests cover tenant isolation, authorization, entitlement replay, conversion idempotency, file access, and core end-to-end flows.
