# G1 — Define Admissions Product, Domain, Payment, And Security Architecture

## Role

Act as a senior SaaS architect with expertise in multi-tenant admissions, payment entitlements, identity lifecycle, minors’ data protection, and Convex-backed TypeScript systems.

## Objective

Produce an implementation-ready Genesis architecture for a reusable paid school admissions platform inside the existing monorepo. The result must be precise enough that later Design and Build agents can work without inventing domain behavior.

## Required Context

Read completely before proposing changes:

- `AGENTS.md`
- `packages/convex/_generated/ai/guidelines.md`
- `docs/tasks/orchestrator-sessions/orch-20260722-114501/master_plan.md`
- `docs/Project_Requirements.md`
- `docs/features/PerSchoolPaystackMerchantRouting.md`
- `docs/features/BillingAndPaymentsFoundation.md`
- `docs/features/StudentEnrollmentProfileCapture.md`
- `docs/features/MultiTenantDomainAndAuthTopology_2026-04-12.md`
- relevant sections of `packages/convex/schema.ts`
- existing auth, family, student, billing-provider, payment-webhook, and storage code

## Confirmed Decisions

- Same monorepo and shared Convex backend.
- Guardian account can own multiple paid application slots, one per child/application.
- Applicant remains staged until acceptance.
- A dedicated public application surface should be independent of the tenant website renderer.
- Existing per-school Paystack routing should be reused where correct, but admissions payments must not masquerade as tuition invoices if that distorts the model.
- Application uploads may become fallback student profile data only after accepted conversion.

## Scope

Design:

1. Tenant-configurable admission cycles/programmes/intakes.
2. Versioned default form definitions with tenant overrides and custom fields.
3. Application products/prices, payment attempts, verified purchases, and slot entitlements.
4. Guardian identity, email/phone verification assumptions, sibling/multiple-slot behavior.
5. Resumable drafts, one application per entitlement, submission snapshots, and edit-after-submit policy.
6. Child, parent/guardian, previous-school, medical, emergency, document, consent, and declaration data boundaries.
7. Staff review queues, completeness checks, document review, entrance exam/interview outcomes, notes, decisions, and communications.
8. Idempotent acceptance/conversion into users, families, familyMembers, students, class placement, admission number, and photo fallback.
9. Authorization, tenant isolation, audit events, storage access, retention, redaction/deletion, and rate limiting.
10. Route/API contracts needed by `apps/apply`, admin admissions UI, and external/managed websites.
11. Testing strategy and failure/recovery behavior.
12. Future AI-assisted document extraction/verification as a disabled, human-reviewed roadmap capability.

## Questions The Artifact Must Answer

- What are the exact state machines for purchase/entitlement, application, document review, and admissions decision?
- What happens when Paystack redirects succeed but the webhook is delayed, duplicated, or arrives first?
- How is an entitlement reserved and consumed without race conditions?
- Can a submitted application be edited, and if so, how are revisions represented?
- How are duplicate guardian identities and repeat applicants detected without unsafe cross-school leakage?
- Which fields are core schema, which belong to custom field answers, and which should be prohibited or optional by default?
- How is an accepted application converted exactly once?
- How do we avoid granting portal/student access before acceptance?
- Which existing billing primitives can be reused, and which require a dedicated admissions-payment model?
- How are private documents served and audited?

## Expected Artifacts

Write:

- `docs/features/AdmissionsApplicationPlatformArchitecture.md`
- `docs/decisions/ADR-AdmissionsApplicationSurfaceAndLifecycle.md`

Include:

- goals/non-goals
- terminology and bounded contexts
- lifecycle/state diagrams in Mermaid or text
- proposed Convex tables with fields, indexes, and ownership
- public/internal function inventory with authorization expectations
- payment sequence and idempotency contract
- applicant conversion algorithm
- sensitive-data classification and retention matrix
- route/link contract for websites
- test matrix
- phased implementation plan
- open questions only where genuinely impossible to resolve from current context

## Constraints

- Do not implement production code in this Genesis task.
- Do not run real payments or external AI services.
- Follow Convex generated guidelines; do not use unbounded arrays for growing child collections.
- Every school-owned row must carry and enforce `schoolId` where appropriate.
- Do not accept caller-provided user IDs for authorization.
- Do not make NIN, passport, religion, genotype, or detailed medical data mandatory defaults.
- Do not convert an application into a student on purchase or submission.
- Do not expose private storage URLs as durable public links.

## Definition Of Done

- The domain is detailed enough to split into backend, public UI, and admin UI build tasks.
- State transitions and idempotency rules are unambiguous.
- Existing billing/auth/student infrastructure reuse is explicitly justified.
- Tenant isolation and minors’ data handling have concrete controls.
- The conversion path preserves provenance and cannot create duplicate students on retry.
- The artifacts clearly identify shared-file changes that the integration owner must land before parallel work.

## Review Checkpoint

Stop after authoring the two artifacts. Report the highest-risk assumptions, likely schema conflicts, and recommended foundation commit. Do not begin implementation without integration-owner approval.
