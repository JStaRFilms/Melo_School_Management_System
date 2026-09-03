# E2E backlog implementation assessment

**Assessment date:** 2026-09-03
**Status:** implementation assessment and completion record — selected work implemented, reviewed, and verified; no database, production, or environment mutation was performed.

## Executive summary

This assessment accounts for the **53 unchecked feature-backlog entries** in `00_Notes/e2e_ux_findings.md` and separates small, reviewable follow-ups from product/architecture work that needs an approved design. The recommended implementation batch is deliberately narrow: eight missing Convex test gaps plus six verified local fixes. It does **not** include a database operation, production operation, deployment, environment change, or schema migration.

Repository review confirms several statements in the backlog are stale or narrower than written: standard grading bands already have a client-side preset; the admission-import schema already has a prefix and next-sequence fields; `provisionSchoolAdmin` accepts `origin` but its helper does not receive it; and the billing gateway-event predicate is indeed tautological for invoice-less events. The backlog item is retained in every case because the requested assessment is of the recorded backlog, not a deletion of history.

### Counting methodology

The count is exactly **9 High Priority + 8 Architecture/Medium-Term + 34 Post-Review + 2 Scope Creep = 53**.

* `Current Status & Active Focus` tasks are operational walkthrough/sync work, not feature backlog, and are excluded.
* The unchecked bullets under **Downstream Blast Radius & Verification Checkpoints** are validation checkpoints for completed work, not new backlog features, and are excluded.
* Parent bullets containing multiple acceptance details are counted once at their bold title. Their child bullets refine that item rather than creating extra entries.
* The 34 Post-Review entries are 8 Testing Gaps, 8 Security & Auth Hardening, 4 Refactoring, 5 Data Integrity, 3 AI Migration Completeness, and 6 UX Polish items.

### Classification policy and verified totals

Classes are human-in-the-loop routing, not severity:

| Class | Meaning | Total |
|---|---|---:|
| A | Clear, localized code/test work; reviewer verifies behavior. | **9** |
| B | Bounded change, but needs an owner to approve the precise user/product contract. | **9** |
| C | Cross-cutting behavior or data contract; design/security/product review before coding. | **22** |
| D | Separate roadmap/architecture/scope work; defer from this polish batch. | **13** |
| **Total** |  | **53** |

The totals are intentionally fixed at **A=9, B=9, C=22, D=13**.

## Repository evidence and method

Read-only inspection was limited to repository source and tests. In particular:

* `packages/convex/_generated/ai/guidelines.md` was read before assessing Convex paths. It requires validated Convex args, `tokenIdentifier` for identity linkage, bounded/indexed queries where practical, and `convex-test`/Vitest for Convex behavior.
* `packages/convex/functions/academic/events.ts` exposes `listEvents` with no args, collects school events, and only filters archived events; `apps/admin/app/admin/dashboard/page.tsx` renders `events.slice(0, 2)` under “Upcoming Events.”
* `packages/convex/functions/billing.ts` (`getBillingDashboard`) has the invoice-less gateway-event tautology; it also uses unbounded collections in that dashboard path.
* `apps/admin/app/admin/settings/page.tsx` calls native `confirm()` in `handleRemoveLogo`; `apps/platform/app/schools/ResetSchoolAdminPasswordModal.tsx` only clears `newPassword` after successful submission; and `apps/platform/app/schools/page.tsx` renders hard-coded development-status copy.
* `packages/convex/functions/platform/index.ts` declares `provisionSchoolAdmin.origin`; `apps/platform/app/schools/[schoolId]/assign-admin/page.tsx` passes `window.location.origin`; `packages/convex/functions/platform/provisioningHelpers.ts` takes no origin. Thus the argument is unused in the verified path rather than forwarded to Better Auth as the stale finding says.
* Test evidence exists but is incomplete: `packages/convex/functions/academic/__tests__/studentGraduation.test.ts` models roster logic rather than calling `graduateStudents`; `updateSessionDates.test.ts` similarly needs real-mutation coverage; and `sessionScopedFormTeacher.test.ts` uses a mocked context with partial branches.
* Large-scope evidence includes `packages/convex/functions/academic/documentGeneration.ts` (about 1,898 lines), `packages/shared/src/components/WorkspaceNavbar.tsx` (about 1,145 lines), existing `importWorkspaces` fields in `packages/convex/schema.ts`, and existing admission-number indexing in that schema.

No environment files, values, credentials, databases, storage, or deployments were inspected or changed.

## Complete matrix

| ID | Backlog item | Class | Batch decision |
|---|---|:---:|---|
| H1 | Pre-Populated Default Grading Bands & Custom Color Coding per Grade Tier / Level | C | Defer |
| H2 | Granular Admin Role-Based Access Control (RBAC) & Scoped Staff Permissions | D | Defer |
| H3 | School Bank Account Details for Invoices & Statements (Billing Settings / Defect Later) | C | Defer |
| H4 | Sequential Auto-Incrementing Admission Numbers & Starting Counter Seed | B | Defer; verify existing partial model |
| H5 | Institutional Email Domain & Standardized Staff/Student Email Convention | B | Defer |
| H6 | Form Unsaved State Guard & Draft Protection | C | Defer |
| H7 | Mobile Scroll Progress Bar for Long Forms | B | Defer |
| H8 | AI & Document Ingestion Usage Limits, Storage Quotas & Over-Usage Buffers | C | Defer |
| H9 | School Assets & PDF Compression Foundation | D | Defer |
| M1 | Migrate All AI Generation from Vercel to Convex — Reliability & Offline Resilience | D | Defer |
| M2 | Multi-Arm Class Architecture & Grade-Level Hierarchy | D | Defer |
| M3 | Multi-Parent Household & Guardian Linking Architecture | D | Defer |
| M4 | Comprehensive Student Lifecycle, Enrollment History & Timeline Audit Logs | C | Defer |
| M5 | Comprehensive Staff Onboarding & HR Profiles | C | Defer |
| M6 | Multi-Tenant Campus & School Switcher (Proprietor Portal) | D | Defer |
| M7 | Intelligent School Bulk Data Import & Full Export Engine | C | Defer |
| M8 | Smart Transactional & Batched Notification Engine | C | Defer |
| T1 | Promotion roster isolation test | A | Select |
| T2 | Historical report card form-teacher test | A | Select |
| T3 | Class roster session-switching test | A | Select |
| T4 | Backwards-promotion rejection test | A | Select |
| T5 | Graduation mutation end-to-end test | A | Select |
| T6 | `updateSessionDates` integration test | A | Select |
| T7 | `sessionScopedFormTeacher` coverage expansion | A | Select |
| T8 | `getParentEmailReview` test coverage | A | Select |
| S1 | `auth.ts` email fallback tenant isolation | C | Defer |
| S2 | `auth.ts` use `identity.tokenIdentifier` | C | Defer |
| S3 | Platform audit log middleware | C | Defer |
| S4 | `setSchoolStatus` session invalidation | C | Defer |
| S5 | `provisionSchoolAdmin` origin validation | B | Select narrowed removal |
| S6 | AI generation rate limiting | C | Defer |
| S7 | `school.features.*` backend enforcement | C | Defer |
| S8 | Platform password reset: rate limit + confirmation | C | Defer |
| R1 | Split `documentGeneration.ts` | C | Defer |
| R2 | Split `WorkspaceNavbar.tsx` | C | Defer |
| R3 | Extract shared modal primitive | D | Defer |
| R4 | `callGenerateObject` type safety | D | Defer |
| I1 | Promotion re-target audit trail | C | Defer |
| I2 | Graduation multi-session guard | C | Defer |
| I3 | Unbounded `.collect()` in matrix builder | C | Defer |
| I4 | `toggleInvoiceOptionalLineItem` installment schedule | C | Defer |
| I5 | `getBillingDashboard` filter tautology | B | Select |
| A1 | 3 missing AI actions | D | Defer |
| A2 | AI SDK version | D | Defer |
| A3 | `consumeTeacherLessonPlanGenerationLimit` retry semantics | C | Defer |
| U1 | `SchoolSettingsPage.handleRemoveLogo` native confirmation | B | Select |
| U2 | `SchoolSuspendedLockScreen` hard-coded helpline | D | Defer |
| U3 | Hard-coded “Convex Dev — 100% Online” copy in platform admin page | A | Select |
| U4 | `ResetSchoolAdminPasswordModal` retained password state | B | Select |
| U5 | Dashboard “Upcoming Events” includes past events | B | Select |
| U6 | Dashboard `totalEnrolledStudents` double-count | B | Defer |
| SC1 | Navigation chrome scope creep | D | Defer to separate branch |
| SC2 | Future-spec docs scope creep | D | Defer to follow-up |

## Detailed assessment

### High Priority / Next Up

#### H1 — Pre-Populated Default Grading Bands & Custom Color Coding per Grade Tier / Level
* **Current → desired / user flow:** The findings say first-time setup is blank, but the Done log and grading-band UI already describe a “Load Standard Scale” preset. Verify first-school initialization separately; desired color propagation spans setup, score entry, analytics, progress bars, and report cards.
* **Scope / complexity:** `apps/admin/app/assessments/setup/grading-bands/**`, `packages/shared/src/exam-recording/validation.ts`, grading/report-card consumers, and likely `packages/convex/schema.ts`; high, cross-cutting persisted presentation semantics.
* **Ambiguity / class:** **C** — decide color ownership, defaults, accessibility contrast, historical rendering, and whether policy colors change existing reports.
* **Modularity:** A policy-color field can be isolated, but every rendering consumer is coupled; relocation cost is medium-high.
* **Tests / dependencies / risks:** Unit validation, Convex persistence, visual/browser checks across desktop/mobile and printed cards; depends on an approved color contract. Risks are unreadable colors and historical report inconsistency.
* **Recommendation:** Defer; first reconcile the already-present preset with a product decision on initialization and color inheritance.

#### H2 — Granular Admin Role-Based Access Control (RBAC) & Scoped Staff Permissions
* **Current → desired / user flow:** `getAuthenticatedSchoolMembership` currently treats admin broadly and callers use module-specific assertions. Desired departmental roles must hide navigation and reject direct backend calls.
* **Scope / complexity:** `packages/convex/functions/academic/auth.ts`, platform/auth helpers, schema/membership records, every protected query/mutation, and `packages/shared/src/workspace-navigation.ts`; very high.
* **Ambiguity / class:** **D** — capability matrix, delegation, migration, owner recovery, and audit policy require security/product approval.
* **Modularity:** A central permission helper is desirable but retrofitting all endpoints is deliberately cross-cutting; relocation cost high.
* **Tests / dependencies / risks:** Permission matrix integration tests, negative endpoint tests, migration and break-glass review. Risks are tenant data exposure or lockout.
* **Recommendation:** Defer to a security-design branch with a signed capability matrix.

#### H3 — School Bank Account Details for Invoices & Statements (Billing Settings / Defect Later)
* **Current → desired / user flow:** Billing supports gateway settings and printable finance documents; desired verified manual-transfer details appear only when configured and appropriate.
* **Scope / complexity:** Billing settings schema/mutations, admin billing settings UI, `packages/convex/functions/billing.ts`, and `PrintableFinanceModal.tsx`; medium-high.
* **Ambiguity / class:** **C** — decide verification, encryption/redaction, multi-account/currency behavior, and whether historical invoices snapshot details.
* **Modularity:** A settings record is modular, but document snapshots make relocation cost medium.
* **Tests / dependencies / risks:** Auth/tenant tests, invoice/statement rendering tests, manual browser/print review. Risks: displaying wrong banking instructions or sensitive account data.
* **Recommendation:** Defer pending finance owner specification.

#### H4 — Sequential Auto-Incrementing Admission Numbers & Starting Counter Seed
* **Current → desired / user flow:** `students` already indexes `schoolId, admissionNumber`; `importWorkspaces` already stores `admissionNumberPrefix` and `nextAdmissionSequence`. Desired enrollment-time allocation needs an authoritative counter and collision handling.
* **Scope / complexity:** `packages/convex/schema.ts`, enrollment/import mutations, School Settings UI; medium due to atomicity and migration.
* **Ambiguity / class:** **B** — format grammar, reset by year, legacy imports, and manual override need registrar approval.
* **Modularity:** Counter/allocation helper is localizable; relocation cost medium because all admission paths must share it.
* **Tests / dependencies / risks:** Concurrent mutation tests, duplicate/collision tests, import regression tests. Risk: duplicate official identifiers.
* **Recommendation:** Defer from polish; inventory existing import behavior before an owner chooses format and seed rules.

#### H5 — Institutional Email Domain & Standardized Staff/Student Email Convention
* **Current → desired / user flow:** Current auth/provisioning takes supplied email addresses; desired generated institutional addresses need collision, domain ownership, and account lifecycle rules.
* **Scope / complexity:** Settings, provisioning, enrollment, Better Auth integration, notifications; medium-high.
* **Ambiguity / class:** **B** — determine whether addresses are aliases or login identities, who provisions the domain, and opt-out/reuse policy.
* **Modularity:** Generator can be a helper, but identity semantics make relocation cost medium-high.
* **Tests / dependencies / risks:** Collision and Unicode-name tests, auth provisioning tests, domain verification dependency. Risk: creating unusable or conflicting login identities.
* **Recommendation:** Defer until identity/product owner supplies the convention and domain-management boundary.

#### H6 — Form Unsaved State Guard & Draft Protection
* **Current → desired / user flow:** Long enrollment/setup forms have local state; desired navigation/reload warning and resilient local drafts protect interrupted data entry.
* **Scope / complexity:** Multiple admin forms/routes, a shared dirty-state contract, browser storage versioning; high despite a simple-looking UX.
* **Ambiguity / class:** **C** — identify protected forms, draft retention/expiry, PII policy, conflict behavior after server updates, and native browser limitations.
* **Modularity:** A hook/provider can centralize mechanics, but form integration and storage schema make relocation cost high.
* **Tests / dependencies / risks:** Component/browser tests for route, refresh, discard, restore, stale drafts; privacy review for local PII. Risk: stale or sensitive drafts.
* **Recommendation:** Defer to a scoped product/security design.

#### H7 — Mobile Scroll Progress Bar for Long Forms
* **Current → desired / user flow:** Desired mobile-only progress indicates position in enrollment/wizard forms without obscuring controls.
* **Scope / complexity:** Relevant form shells and scroll containers; low-medium.
* **Ambiguity / class:** **B** — choose target screens, completion semantics, reduced-motion behavior, and whether it represents scroll or form-step progress.
* **Modularity:** A reusable visual component is feasible; relocation cost low once scroll ownership is known.
* **Tests / dependencies / risks:** Mobile browser checks, dynamic-height and accessibility checks. Risk: misleading progress or fixed overlay conflicts.
* **Recommendation:** Defer until UX selects target forms and interaction definition.

#### H8 — AI & Document Ingestion Usage Limits, Storage Quotas & Over-Usage Buffers
* **Current → desired / user flow:** Document ingestion and AI actions exist; desired tenant metering, soft buffers, upload guidance, top-ups, and possibly token accounting spans billing cycles.
* **Scope / complexity:** Convex schema/actions, storage, billing/plan entitlement, teacher/admin UI, OCR/AI providers; very high.
* **Ambiguity / class:** **C** — quota units, grace rules, billing ownership, reconciliation, failure messaging, and enterprise exceptions are product/finance decisions.
* **Modularity:** Metering ledger can be isolated, but every cost-producing action must be instrumented; relocation cost high.
* **Tests / dependencies / risks:** Deterministic time/cycle tests, concurrent consumption tests, provider-response tests, browser upload checks. Risks: wrongful service denial or unbounded cost.
* **Recommendation:** Defer; define commercial entitlement and audit model first.

#### H9 — School Assets & PDF Compression Foundation
* **Current → desired / user flow:** Existing lesson-knowledge storage is separate; desired private general assets, quotas, deletion, and conditional server compression adds a new asset domain.
* **Scope / complexity:** `packages/convex/schema.ts`, storage actions, cron/retry, admin UI, runtime capability verification; very high.
* **Ambiguity / class:** **D** — retention, access/download policy, compression library/runtime guarantees, and quota ownership are architecture decisions.
* **Modularity:** A distinct assets module is possible, but storage and operational lifecycle relocation cost is high.
* **Tests / dependencies / risks:** Storage authorization, retry/idempotency, malformed PDF, quota and browser acceptance tests. Risks: data loss, resource exhaustion, or unsupported Node dependencies.
* **Recommendation:** Defer to its referenced feature design and runtime spike.

### Architecture & Medium-Term Enhancements

#### M1 — Migrate All AI Generation from Vercel to Convex — Reliability & Offline Resilience
* **Current → desired / user flow:** `documentGeneration.ts` already provides Convex actions, while the finding proposes retiring teacher API generators and unifying runtime configuration. Desired reconnect-safe generation needs durable result state.
* **Scope / complexity:** `apps/teacher/app/api/**`, `packages/ai/**`, `packages/convex/functions/academic/documentGeneration.ts`, call sites, action state, and deployment configuration; very high.
* **Ambiguity / class:** **D** — streaming contract, retries/idempotency, provider configuration migration, and rollout/rollback must be designed.
* **Modularity:** Per-output actions help, but UI and provider contracts make relocation cost high.
* **Tests / dependencies / risks:** Action retry/disconnect tests, output parity, feature-flag rollout and observability. Risks: double charges, lost generations, or secret/config drift.
* **Recommendation:** Defer to a dedicated migration plan; do not alter environment values in this batch.

#### M2 — Multi-Arm Class Architecture & Grade-Level Hierarchy
* **Current → desired / user flow:** Current class records model grade/label per arm; desired grade parents and arm children add shared defaults and cross-arm operations.
* **Scope / complexity:** Schema, classes, rosters, assessments, fees, analytics, timetable, reporting; very high.
* **Ambiguity / class:** **D** — inheritance/override precedence and historic data migration are core domain design.
* **Modularity:** New grade/arm domain can be introduced, but existing class assumptions make relocation cost very high.
* **Tests / dependencies / risks:** Migration fixtures and all downstream workflows. Risk: corrupting class, billing, and report-card history.
* **Recommendation:** Defer as an architecture initiative.

#### M3 — Multi-Parent Household & Guardian Linking Architecture
* **Current → desired / user flow:** Family linking exists, including staff-as-parent safeguards; desired legal-parent/guardian roles, address inheritance, and household grouping expands identity relationships.
* **Scope / complexity:** Family schema, enrollment, portal permissions, contact rendering, privacy controls; very high.
* **Ambiguity / class:** **D** — legal relationships, consent, custody, duplicate merges, and notification recipient rules need policy approval.
* **Modularity:** Household model is a new bounded domain, but identity links give it high relocation cost.
* **Tests / dependencies / risks:** Authorization and consent tests, sibling merge tests, portal browser tests. Risk: privacy or guardianship disclosure.
* **Recommendation:** Defer to a privacy-reviewed data model.

#### M4 — Comprehensive Student Lifecycle, Enrollment History & Timeline Audit Logs
* **Current → desired / user flow:** Promotions and graduation hold fragments of history; desired chronological lifecycle and official exports require immutable, understandable event history.
* **Scope / complexity:** Enrollment/promotion/graduation mutations, schema, profile/portal UI, report exports; high.
* **Ambiguity / class:** **C** — decide event taxonomy, correction/void semantics, retention, visibility, and certificate legal wording.
* **Modularity:** An append-only lifecycle module is possible; retrofitting producers gives medium-high relocation cost.
* **Tests / dependencies / risks:** Event-order, historical export, authorization, and migration tests. Risk: inaccurate official history.
* **Recommendation:** Defer pending audit/event model approval.

#### M5 — Comprehensive Staff Onboarding & HR Profiles
* **Current → desired / user flow:** User/admin/teacher records support current operational roles; desired HR identifiers, employment dates, exits, documents, and progression logs adds personnel records.
* **Scope / complexity:** Schema, staff UI, archive workflow, storage, permissions; high.
* **Ambiguity / class:** **C** — HR retention, document access, employment classifications, and regional compliance require owner decisions.
* **Modularity:** HR profile can be separate from auth user, but archive and document links raise relocation cost.
* **Tests / dependencies / risks:** Role/visibility, archive, upload authorization, audit tests. Risk: sensitive employment data exposure.
* **Recommendation:** Defer to HR/privacy requirements.

#### M6 — Multi-Tenant Campus & School Switcher (Proprietor Portal)
* **Current → desired / user flow:** Authentication and membership are school-scoped; desired cross-campus switcher adds a proprietor identity spanning tenants.
* **Scope / complexity:** Auth/membership schema, platform authorization, navbar, tenant selection, data isolation; very high.
* **Ambiguity / class:** **D** — proprietor relationship, cross-school roles, session behavior, and billing boundaries are foundational tenancy decisions.
* **Modularity:** A new proprietor layer is feasible but changes core isolation; relocation cost very high.
* **Tests / dependencies / risks:** Cross-tenant negative tests, session switching, audit logging. Risk: cross-tenant data disclosure.
* **Recommendation:** Defer to tenancy architecture work.

#### M7 — Intelligent School Bulk Data Import & Full Export Engine
* **Current → desired / user flow:** `importWorkspaces` and staged records already exist, but desired full export plus AI parsing/dedup review broadens entities and commit semantics.
* **Scope / complexity:** Existing import schema/actions, storage, export jobs, reconciliation UI, all tenant entities; high.
* **Ambiguity / class:** **C** — export scope, PII, dedup authority, AI confidence threshold, and rollback need product/security design.
* **Modularity:** Import/export services can be modular; entity adapters create medium-high relocation cost.
* **Tests / dependencies / risks:** Large fixtures, idempotent commit, malformed spreadsheet, export authorization tests. Risk: duplicate data or privacy breach.
* **Recommendation:** Defer; first document supported entity/version contract.

#### M8 — Smart Transactional & Batched Notification Engine
* **Current → desired / user flow:** Current workflows surface in-app feedback; desired immediate alerts plus debounced guardian digests requires durable outbox and preferences.
* **Scope / complexity:** Event producers, schema/outbox, schedules, email/SMS provider, user preferences; high.
* **Ambiguity / class:** **C** — channels, consent, templates, timing, failures, and legal compliance remain unspecified.
* **Modularity:** Outbox is modular, but producer adoption gives high relocation cost.
* **Tests / dependencies / risks:** Idempotency, dedupe, scheduling/timezone, unsubscribe, provider-failure tests. Risk: notification storms or missed safety messages.
* **Recommendation:** Defer to a communications design.

### Post-Review — Testing Gaps

#### T1 — Promotion roster isolation test
* **Current → desired / user flow:** Promotion code in `packages/convex/functions/academic/studentEnrollment.ts` stages promotions; users rely on future placement not polluting the active roster. Add a real `convex-test` fixture that inserts a promotion and queries both roster paths.
* **Scope / complexity:** One focused test file near `academic/__tests__`; low, localized.
* **Ambiguity / class:** **A** — expected behavior is already explicit.
* **Modularity:** Test-only; no relocation cost.
* **Tests / dependencies / risks:** Depends on module-map/schema/auth fixture conventions. Assert active and future session results; risk is fixture setup masking the real query.
* **Recommendation:** **Select**; reviewer should confirm both `getBaselineRoster`/`getClassRoster` (or their actual exported equivalents) are invoked.

#### T2 — Historical report card form-teacher test
* **Current → desired / user flow:** `packages/convex/functions/academic/reportCards.ts` resolves session-specific form teachers; historical cards must retain the past teacher rather than the current assignment.
* **Scope / complexity:** Focused Convex integration test plus existing report-card fixture; low-medium.
* **Ambiguity / class:** **A** — historical attribution is a defined integrity contract.
* **Modularity:** Test-only; no relocation cost.
* **Tests / dependencies / risks:** Seed two sessions and changed teacher assignment; assert generated result. Risk is over-testing presentation rather than resolver output.
* **Recommendation:** **Select**.

#### T3 — Class roster session-switching test
* **Current → desired / user flow:** `listClasses({ sessionId })` should resolve the selected session’s form teacher, not the active session’s pointer.
* **Scope / complexity:** `academicSetup`/class query integration test; low-medium.
* **Ambiguity / class:** **A** — expected session selection is clear.
* **Modularity:** Test-only; no relocation cost.
* **Tests / dependencies / risks:** Fixture active/future sessions and distinct mappings; depends on standard authenticated-admin test setup. Risk: only asserting a display label and missing session parameter behavior.
* **Recommendation:** **Select**.

#### T4 — Backwards-promotion rejection test
* **Current → desired / user flow:** `studentEnrollment.ts` explicitly rejects a target session starting before the source; users need a stable protection against history reversal.
* **Scope / complexity:** Focused mutation integration test for same-session and earlier-session rejection; low.
* **Ambiguity / class:** **A** — error paths are explicit in code.
* **Modularity:** Test-only; no relocation cost.
* **Tests / dependencies / risks:** Assert rejection class/message fragment without overfitting full prose. Risk: missing tenant/auth setup makes it reject too early.
* **Recommendation:** **Select**.

#### T5 — Graduation mutation end-to-end test
* **Current → desired / user flow:** Existing `studentGraduation.test.ts` is a local model, while `graduateStudents` lives in `studentEnrollment.ts`; actual student state and history must be verified through the mutation.
* **Scope / complexity:** Replace/extend with `convex-test` mutation fixture; medium.
* **Ambiguity / class:** **A** — real mutation coverage is unambiguous.
* **Modularity:** Test-only; no relocation cost.
* **Tests / dependencies / risks:** Seed class/session/admin/student and assert mutation outputs/doc state. Risk: fixture could omit validation branches, so retain current behavior assertions if useful.
* **Recommendation:** **Select**.

#### T6 — `updateSessionDates` integration test
* **Current → desired / user flow:** `academicSetup.ts` recalibrates/validates actual term dates. The current unit-style test must call `updateSessionDates` rather than duplicate handler logic.
* **Scope / complexity:** One integration fixture with session/terms; medium.
* **Ambiguity / class:** **A** — mutation behavior is already the contract.
* **Modularity:** Test-only; no relocation cost.
* **Tests / dependencies / risks:** Assert valid adjustment and rejected invalid boundary through API; guard optimistic-concurrency setup. Risk: dates/timezones make tests flaky unless fixed timestamps are used.
* **Recommendation:** **Select**.

#### T7 — `sessionScopedFormTeacher` coverage expansion
* **Current → desired / user flow:** Existing test only covers one branch of archive guardrail resolution; users need correct archive blockers whether ownership comes through form teacher, class subject, assignment, subject, or no active session.
* **Scope / complexity:** Extend `packages/convex/functions/academic/__tests__/sessionScopedFormTeacher.test.ts`; low-medium.
* **Ambiguity / class:** **A** — uncovered branches are named in the finding.
* **Modularity:** Test-only; no relocation cost.
* **Tests / dependencies / risks:** Add focused cases for the four listed branches, preserving typed fixtures. Risk: test mock diverges from Convex query semantics.
* **Recommendation:** **Select**.

#### T8 — `getParentEmailReview` test coverage
* **Current → desired / user flow:** Parent email review needs predictable valid plus-address behavior and malformed-input rejection before a user sees a misleading review state.
* **Scope / complexity:** Locate its helper and add focused unit tests; low.
* **Ambiguity / class:** **A** — valid `+tag` and malformed cases are defined.
* **Modularity:** Test-only; no relocation cost.
* **Tests / dependencies / risks:** No database dependency expected; include only representative malformed strings. Risk: codifying a too-narrow email standard.
* **Recommendation:** **Select**.

### Post-Review — Security & Auth Hardening

#### S1 — `auth.ts` email fallback tenant isolation
* **Current → desired / user flow:** `packages/convex/functions/academic/auth.ts` looks up `users` by `identity.subject` and uses unscoped identity assumptions; the finding reports an email fallback at `auth.ts:29`, which must be revalidated before changing behavior. Desired lookup cannot map another tenant’s identity by email.
* **Scope / complexity:** Academic auth helper and every dependent function; high security impact.
* **Ambiguity / class:** **C** — establish actual fallback path, identity migration, and legitimate cross-school identity rules.
* **Modularity:** Central helper is modular but has very high blast radius.
* **Tests / dependencies / risks:** Cross-tenant auth negative tests and migration fixtures; risk is account denial or tenant crossover.
* **Recommendation:** Defer to a security-reviewed fix after confirming the deployed branch’s exact fallback.

#### S2 — `auth.ts` use `identity.tokenIdentifier`
* **Current → desired / user flow:** The Convex guideline prefers `tokenIdentifier`, but the verified helper uses `identity.subject` for `by_auth` lookup. Desired migration preserves all existing memberships while moving to stable canonical identity linkage.
* **Scope / complexity:** Auth schema/data mapping and all identity lookups; high.
* **Ambiguity / class:** **C** — need a safe compatibility/migration policy for existing stored `authId` values.
* **Modularity:** Centralize identity resolution; data migration raises relocation cost.
* **Tests / dependencies / risks:** Old/new identity fixtures and cross-tenant negatives. Risk: universal login failure or mistaken account mapping.
* **Recommendation:** Defer; design a backward-compatible migration before code changes.

#### S3 — Platform audit log middleware
* **Current → desired / user flow:** `resetSchoolAdminPassword` and `setSchoolStatus` in `platform/index.ts` perform sensitive operations without the requested platform audit event. Desired audit has actor, target, action, time, and safe metadata.
* **Scope / complexity:** Platform schema/helper and all platform mutations; medium-high.
* **Ambiguity / class:** **C** — event taxonomy, retention, immutable fields, redaction, and failure semantics need security owner approval.
* **Modularity:** A platform-specific append-only helper is modular; producer coverage creates medium relocation cost.
* **Tests / dependencies / risks:** Actor/action audit tests and no-secret-payload checks. Risk: audit gaps or logging sensitive password data.
* **Recommendation:** Defer to an approved audit design.

#### S4 — `setSchoolStatus` session invalidation
* **Current → desired / user flow:** `setSchoolStatus` only patches status. Desired suspension revokes active sessions while preserving an authorized reactivation path.
* **Scope / complexity:** Platform mutation, Better Auth adapter/action boundary, possibly status guards; medium-high.
* **Ambiguity / class:** **C** — decide which sessions, reactivation behavior, read-only access, and transactional failure ordering.
* **Modularity:** Could use a platform session-revocation helper; relocation cost medium.
* **Tests / dependencies / risks:** Suspend/revoke/reactivate integration tests; risk is either continued access or unintended lockout.
* **Recommendation:** Defer for security design and adapter transaction review.

#### S5 — `provisionSchoolAdmin` origin validation
* **Current → desired / user flow:** The backlogged claim that origin is forwarded is disproved here: the action receives `origin`, the only caller sends browser origin, and `provisionSchoolAdminAuthUser` has no origin parameter. Desired behavior is no dead client-controlled argument.
* **Scope / complexity:** `packages/convex/functions/platform/index.ts` and `apps/platform/app/schools/[schoolId]/assign-admin/page.tsx`; low.
* **Ambiguity / class:** **B** — confirm no generated/API consumer outside repository before changing the public action signature; no allowlist is needed for an unused value.
* **Modularity:** Local signature/call-site cleanup; relocation cost low.
* **Tests / dependencies / risks:** Existing provisioning test if present, typecheck, and reviewer API-compatibility review. Risk: an external caller sending the now-invalid extra arg.
* **Recommendation:** **Select narrowed removal** only after reviewer confirms public-action compatibility; do not implement the stale “validate forwarded origin” premise.

#### S6 — AI generation rate limiting
* **Current → desired / user flow:** AI actions can consume provider resources; desired per-teacher daily budget and bounded generation protect costs without blocking valid use.
* **Scope / complexity:** AI actions, schema ledger, provider wrapper, plan policy/UI; high.
* **Ambiguity / class:** **C** — define tokens/cost, time zones, retries, exemptions, and user messaging.
* **Modularity:** Metering helper can be shared; all generators require instrumentation.
* **Tests / dependencies / risks:** Retry/concurrency and provider-failure tests. Risk: duplicate debit or bypassed cap.
* **Recommendation:** Defer with the broader quota initiative H8.

#### S7 — `school.features.*` backend enforcement
* **Current → desired / user flow:** Feature flags currently gate UI routes; desired endpoint checks deny disabled module operations even if called directly.
* **Scope / complexity:** Feature helper plus billing/curriculum/knowledge mutations and possibly queries/actions; high.
* **Ambiguity / class:** **C** — distinguish read/history access, platform overrides, grandfathering, and error UX.
* **Modularity:** `assertSchoolFeatureEnabled` is modular but producer coverage is cross-cutting.
* **Tests / dependencies / risks:** Positive/negative endpoint matrix. Risk: bypass or accidental loss of legitimate data access.
* **Recommendation:** Defer to entitlement policy review.

#### S8 — Platform password reset: rate limit + confirmation
* **Current → desired / user flow:** The UI submits only a password and action resets immediately. Desired server-side rate limit, explicit confirmation, and audit protect powerful resets.
* **Scope / complexity:** Platform action/UI, rate-limit persistence, audit model; medium-high.
* **Ambiguity / class:** **C** — confirmation wording, reset-window policy, emergency/admin recovery, and audit dependencies must be approved.
* **Modularity:** Rate limiter can be a platform utility; relocation cost medium.
* **Tests / dependencies / risks:** Limit, confirmation, session revoke, and audit tests. Risk: account recovery lockout or brute-force admin abuse.
* **Recommendation:** Defer together with S3 audit design.

### Post-Review — Refactoring

#### R1 — Split `documentGeneration.ts`
* **Current → desired / user flow:** Verified `packages/convex/functions/academic/documentGeneration.ts` is roughly 1,898 lines with prompts, repair, rendering, logging, and actions. Desired modules make behavior testable without changing generation results.
* **Scope / complexity:** One large Convex module plus imports/function references/tests; high refactor risk.
* **Ambiguity / class:** **C** — choose public/internal action boundaries and preserve runtime/export registration.
* **Modularity:** Target structure is modular; relocation cost medium-high due to imported types and action references.
* **Tests / dependencies / risks:** Characterization tests for outputs/error/retry paths and typecheck. Risk: changing AI prompt or retry behavior during a no-feature refactor.
* **Recommendation:** Defer until after AI migration decisions.

#### R2 — Split `WorkspaceNavbar.tsx`
* **Current → desired / user flow:** Verified `packages/shared/src/components/WorkspaceNavbar.tsx` is roughly 1,145 lines and owns desktop/mobile navigation and document effects. Desired extracted components preserve all navigation states.
* **Scope / complexity:** Shared component plus all app consumers; high UI regression exposure.
* **Ambiguity / class:** **C** — settle navigation variants/preference direction first, especially given SC1.
* **Modularity:** Components can be extracted; relocation cost medium-high because all workspaces consume it.
* **Tests / dependencies / risks:** Responsive browser review, keyboard/navigation checks, app smoke tests. Risk: route, overflow, or title/favicon regression.
* **Recommendation:** Defer and keep separate from E2E fixes.

#### R3 — Extract shared modal primitive
* **Current → desired / user flow:** Multiple bespoke modals exist; desired focus trap, Escape behavior, and `aria-modal` consistency improves keyboard and assistive-tech flows.
* **Scope / complexity:** Ten-plus modal implementations across apps/shared; very high regression surface.
* **Ambiguity / class:** **D** — choose dependency versus implementation, stacking/portal semantics, destructive-confirm contracts, and migration sequencing.
* **Modularity:** A primitive is modular, but replacement cost is high.
* **Tests / dependencies / risks:** Accessibility/browser tests for focus restore, nested dialogs, mobile sheets. Risk: trapping focus incorrectly or breaking scroll locking.
* **Recommendation:** Defer as an accessibility architecture project.

#### R4 — `callGenerateObject` type safety
* **Current → desired / user flow:** The AI helper uses `unknown`/casts around schemas; desired typed per-output helpers makes invalid generator wiring harder.
* **Scope / complexity:** AI module types and all call sites; medium-high.
* **Ambiguity / class:** **D** — align with the pending SDK-version decision and model output contracts.
* **Modularity:** Typed helpers improve locality but output types span generators; relocation cost medium.
* **Tests / dependencies / risks:** Compile-time checks plus behavior characterization. Risk: type-only refactor masks a runtime schema mismatch.
* **Recommendation:** Defer with AI SDK/migration work.

### Post-Review — Data Integrity

#### I1 — Promotion re-target audit trail
* **Current → desired / user flow:** Re-targeting promotion can replace prior subject selections; desired user warning and immutable audit explain the destructive consequence before confirmation.
* **Scope / complexity:** `studentEnrollment.ts`, promotion UI/modal, schema/audit event; medium-high.
* **Ambiguity / class:** **C** — decide whether to preserve, restore, or merely record removed selections and what the user sees.
* **Modularity:** Promotion audit helper is possible; mutation/UI linkage gives medium relocation cost.
* **Tests / dependencies / risks:** Re-target fixture, audit content, confirmation browser test. Risk: silently losing education choices or exposing audit data.
* **Recommendation:** Defer pending data-retention product decision.

#### I2 — Graduation multi-session guard
* **Current → desired / user flow:** `graduateStudents` currently patches graduation metadata; desired rule prevents a later graduation overwriting official prior history.
* **Scope / complexity:** `studentEnrollment.ts` mutation, possible history table, UI errors; medium.
* **Ambiguity / class:** **C** — decide correction/reversal authority and whether historical mistaken graduations can be amended.
* **Modularity:** Guard is local if policy is “reject”; history correction raises relocation cost.
* **Tests / dependencies / risks:** Repeat/graduation-correction integration tests. Risk: overwriting credentials or preventing legitimate correction.
* **Recommendation:** Defer until registrar policy chooses immutable versus amendable history.

#### I3 — Unbounded `.collect()` in matrix builder
* **Current → desired / user flow:** The finding identifies 4–5 unbounded collections in `getClassStudentSubjectMatrix`; desired behavior remains complete but scales predictably for large rosters.
* **Scope / complexity:** Matrix query, schema indexes or denormalized reads, UI pagination; high.
* **Ambiguity / class:** **C** — decide maximum roster, pagination UX, and consistency/performance trade-off.
* **Modularity:** Query tuning is local in code but may require schema and UI contract changes; relocation cost medium-high.
* **Tests / dependencies / risks:** Large fixture/performance-oriented tests and index review per Convex guidance. Risk: partial matrix or transaction/query limits.
* **Recommendation:** Defer to a performance plan; do not replace collections blindly.

#### I4 — `toggleInvoiceOptionalLineItem` installment schedule
* **Current → desired / user flow:** Optional selection changes invoice total; desired installment amounts remain mathematically consistent after the toggle.
* **Scope / complexity:** `packages/convex/functions/billing.ts`, invoice schedule model, billing UI/print output; medium-high.
* **Ambiguity / class:** **C** — decide regeneration/proration, paid installment handling, rounding, and whether an issued schedule may change.
* **Modularity:** Schedule calculator can be isolated; financial-document history raises relocation cost.
* **Tests / dependencies / risks:** Rounding, paid/overdue schedule, optional toggle integration tests. Risk: incorrect amounts owed.
* **Recommendation:** Defer to billing owner; treat as financial behavior, not a polish patch.

#### I5 — `getBillingDashboard` filter tautology
* **Current → desired / user flow:** Verified `getBillingDashboard` returns false for every event without `invoiceId` because it checks membership using an empty ID. Desired dashboard deliberately includes/excludes invoice-less gateway events according to an explicit dashboard rule.
* **Scope / complexity:** `packages/convex/functions/billing.ts` and billing dashboard tests; low-medium.
* **Ambiguity / class:** **B** — reviewer/product owner must state whether webhook-test/unmatched events should appear globally or only for unfiltered views.
* **Modularity:** Local predicate and tests; relocation cost low.
* **Tests / dependencies / risks:** Filtered/unfiltered invoice event fixtures. Risk: surfacing irrelevant events or hiding payment diagnostics.
* **Recommendation:** **Select** after confirming intended visibility; change only the predicate and focused tests.

### Post-Review — AI Migration Completeness

#### A1 — 3 missing AI actions
* **Current → desired / user flow:** Current document-generation output types include student note, assignment, and CBT concepts, but the finding reports only lesson-plan/assessment actions are exposed. Desired selectors must map to durable actions consistently.
* **Scope / complexity:** AI actions, UI selectors, schemas/prompts, results persistence; high.
* **Ambiguity / class:** **D** — depends on M1’s action architecture and product expectations per artifact.
* **Modularity:** Per-action modules are possible; shared AI runtime gives high relocation cost.
* **Tests / dependencies / risks:** Action parity and selector integration tests. Risk: exposing a type that cannot safely generate/persist.
* **Recommendation:** Defer with M1.

#### A2 — AI SDK version
* **Current → desired / user flow:** Package version is recorded as v6 while newer major versions exist; desired upgrade must preserve generation behavior and schema APIs.
* **Scope / complexity:** `packages/ai`, Convex AI actions, teacher routes, lockfile; high due to a major dependency change.
* **Ambiguity / class:** **D** — upgrade reason, compatibility, and timing are not a bug fix.
* **Modularity:** Dependency surface is shared; relocation cost high.
* **Tests / dependencies / risks:** Full AI characterization/compile suite and provider smoke testing without exposing secrets. Risk: changed APIs, streaming, or output validation.
* **Recommendation:** Defer; document supported v6 reason or schedule a dedicated upgrade.

#### A3 — `consumeTeacherLessonPlanGenerationLimit` retry semantics
* **Current → desired / user flow:** Convex action retries can charge a failed/retried generation more than once; desired consumption is idempotent per request/generation key.
* **Scope / complexity:** Limit ledger/helper, action args/state, possibly schema; medium-high.
* **Ambiguity / class:** **C** — define idempotency key lifecycle, successful versus attempted consumption, and cleanup.
* **Modularity:** Ledger helper can be modular; all generators should eventually use it.
* **Tests / dependencies / risks:** Simulated retries/concurrent calls and expiration tests. Risk: teacher lockout or unmetered usage.
* **Recommendation:** Defer with quota/rate-limit design H8/S6.

### Post-Review — UX Polish

#### U1 — `SchoolSettingsPage.handleRemoveLogo` native confirmation
* **Current → desired / user flow:** Verified `apps/admin/app/admin/settings/page.tsx` invokes browser `confirm()` before deleting a crest. Desired branded confirmation must only mutate after affirmative confirmation and preserve loading/error behavior.
* **Scope / complexity:** That page and existing shared `ConfirmationModal` import/use pattern; low.
* **Ambiguity / class:** **B** — choose exact destructive copy and whether pending upload differs from saved logo; no new design system required.
* **Modularity:** Local component-state replacement; relocation cost low.
* **Tests / dependencies / risks:** Component/browser test or manual desktop/mobile confirmation, cancel, submit, and error paths. Risk: accidental logo removal if state wiring is wrong.
* **Recommendation:** **Select** using the existing modal primitive, not a new one.

#### U2 — `SchoolSuspendedLockScreen` hard-coded helpline
* **Current → desired / user flow:** Verified `packages/shared/src/components/SchoolSuspendedLockScreen.tsx` renders a hard-coded support email and direct helpline. Desired runtime-configurable contact or deliberate removal must be platform-owned.
* **Scope / complexity:** Shared component plus configuration source/build/runtime contract; medium.
* **Ambiguity / class:** **D** — identify authoritative support contact, deployment-safe configuration, fallback, and localization policy.
* **Modularity:** Config object is simple, but runtime availability across apps makes relocation cost medium.
* **Tests / dependencies / risks:** Missing-config rendering/browser checks. Risk: publishing wrong support route or introducing client config leakage.
* **Recommendation:** Defer; do not invent support contact configuration.

#### U3 — Hard-coded “Convex Dev — 100% Online” copy in platform admin page
* **Current → desired / user flow:** Verified `apps/platform/app/schools/page.tsx` displays a development-specific service label and percentage when no school is suspended. Desired state is neutral platform language without implying monitored availability.
* **Scope / complexity:** One presentation component; low.
* **Ambiguity / class:** **A** — remove the stale copy; do not replace it with unverified health claims.
* **Modularity:** Local text/UI branch; relocation cost negligible.
* **Tests / dependencies / risks:** Existing page test if available or browser check for active/suspended branch. Risk: none beyond an inaccurate replacement claim.
* **Recommendation:** **Select**; use neutral wording or omit the status value.

#### U4 — `ResetSchoolAdminPasswordModal` retained password state
* **Current → desired / user flow:** Verified password is cleared only after success; backdrop, X, and Cancel call raw `onClose`. Desired every close path clears password, visibility state if appropriate, and submitting state safely.
* **Scope / complexity:** `apps/platform/app/schools/ResetSchoolAdminPasswordModal.tsx`; low.
* **Ambiguity / class:** **B** — approve close behavior while request is in flight and visibility-reset choice.
* **Modularity:** Introduce one local close handler; relocation cost low.
* **Tests / dependencies / risks:** Component/browser tests for cancel, backdrop, X, success, reopen. Risk: retaining a sensitive password in client memory/UI.
* **Recommendation:** **Select**; route all allowed close events through a single state-clearing handler.

#### U5 — Dashboard “Upcoming Events” includes past events
* **Current → desired / user flow:** `listEvents` has no timestamp arg and dashboard takes the first two sorted events, so past events appear in the upcoming panel. Desired filter is from the current time, normally by event end date so an in-progress event remains visible.
* **Scope / complexity:** `packages/convex/functions/academic/events.ts`, dashboard query call, and tests; low-medium.
* **Ambiguity / class:** **B** — product owner/reviewer should choose `startDate >= now` versus `endDate >= now`, timezone/calendar semantics, and whether list page remains unfiltered.
* **Modularity:** Optional `fromTimestamp` query arg is local; relocation cost low.
* **Tests / dependencies / risks:** Seed past/in-progress/future events, assert dashboard behavior and no regression in full calendar listing. Risk: hiding all-day/in-progress events incorrectly.
* **Recommendation:** **Select** after agreeing the inclusive boundary; prefer a bounded dashboard-specific query contract rather than client-only filtering.

#### U6 — Dashboard `totalEnrolledStudents` double-count
* **Current → desired / user flow:** Verified dashboard reduces `activeClasses[].studentCount`, so cross-listed students can be counted multiple times. Desired metric counts distinct active students for the selected school/session definition.
* **Scope / complexity:** Dashboard query contract and likely a new/extended student aggregate query; medium.
* **Ambiguity / class:** **B** — decide active/archived/graduated/session/cross-list semantics and live count performance.
* **Modularity:** A dedicated aggregate can isolate the metric; relocation cost medium.
* **Tests / dependencies / risks:** Cross-listed, archived, future-promotion fixtures; index/scale review. Risk: a dashboard KPI that conflicts with roster totals.
* **Recommendation:** Defer until metric definition is approved; do not substitute a client-side dedupe of class data.

### Scope Creep (land separately)

#### SC1 — Navigation chrome (3 nav variants + preference switcher)
* **Current → desired / user flow:** The noted WorkspaceNavbar growth is outside the Done-list scope. Desired multiple variants/preferences changes shared navigation behavior rather than repairing an observed E2E defect.
* **Scope / complexity:** `packages/shared/src/components/WorkspaceNavbar.tsx`, workspace navigation definitions, all applications; high.
* **Ambiguity / class:** **D** — navigation information architecture and preference persistence require UX/product ownership.
* **Modularity:** Could be split into a separate branch/components; relocation cost high.
* **Tests / dependencies / risks:** Responsive/keyboard/browser suite across apps. Risk: global navigation regression and scope dilution.
* **Recommendation:** Defer to a separately scoped branch; do not combine with polish fixes.

#### SC2 — Future-spec docs added under `de88dbe`
* **Current → desired / user flow:** Future feature documents are not required to deliver the current completed E2E work. Desired disposition is an explicitly owned follow-up, not quiet inclusion in this branch.
* **Scope / complexity:** Documentation/history only; low technical complexity but high product-scope implication.
* **Ambiguity / class:** **D** — product owner decides retain, relocate, or revise documents.
* **Modularity:** Fully separable documentation change; relocation cost low.
* **Tests / dependencies / risks:** No code tests; reviewer verifies commit/file ownership. Risk: misleading roadmap or unrelated review noise.
* **Recommendation:** Defer to a follow-up documentation change.

## Selected implementation set and completion

All 14 selected backlog items were completed without authorizing data changes.

- [x] **T1 — Promotion roster isolation test**
- [x] **T2 — Historical report card form-teacher test**
- [x] **T3 — Class roster session-switching test**
- [x] **T4 — Backwards-promotion rejection test**; review exposed and fixed the equal-start-date guard (`<` → `<=`).
- [x] **T5 — Graduation mutation end-to-end test**
- [x] **T6 — `updateSessionDates` integration test**
- [x] **T7 — `sessionScopedFormTeacher` coverage expansion**
- [x] **T8 — `getParentEmailReview` test coverage**
- [x] **U3 — Platform development/uptime claim replaced with derived suspended-school facts**
- [x] **U1 — Persisted logo removal uses an accessible confirmation; unsaved replacement discard remains local**
- [x] **U4 — Reset-password state clears on every dismissal/target change; modal accessibility and viewport safety improved**
- [x] **U5 — Dashboard filters ongoing/future events and renders all-day events truthfully**
- [x] **I5 — Invoice-less gateway-event filtering corrected while preserving tenant and invoice visibility**
- [x] **S5 — `origin` retained as an optional ignored compatibility field and removed from the repository caller**

Related hardening removes raw gateway request bodies/payloads from the billing dashboard response.

### Deferred/rejected from this batch

All remaining 39 items are deferred. Larger grading colors, RBAC, bank-account settings, admission-number behavior, email conventions, local drafts, mobile progress, quotas, assets, medium-term architecture, security migrations, broad refactors, financial schedule behavior, AI migration/version work, and scope-creep notes remain outside this PR for the reasons documented above.

## Implementation order used

1. Added real Convex regression coverage and fixed only the equal-date behavior proved by review.
2. Implemented billing, event, and provisioning compatibility contracts with focused tests.
3. Implemented bounded UI fixes using established design patterns.
4. Ran a focused Antigravity UI review and audited every suggestion.
5. Ran targeted and broad checks, milestone reviews, final review, and coherent commits.

## Development database preparation

The repository already records a completed production-to-development refresh with a rollback backup.

* `.env.local` was checked by variable names and deployment classification only; it targets a **development** Convex deployment.
* Existing notes report production-like data in development, including Olive Blessed Crest Academy and Codex Academy.
* No export, import, restore, seed, migration, mutation, deployment, or production query was run.
* Production remained strictly read-only and no credential values were logged or committed.
* Olive Blessed Crest Academy was selected as the representative rich tenant, but authenticated visual testing was not performed because documented demo credentials did not match current development data. Avoiding a reset or shared-data edit was safer.

## Verification, review, and release record

* Focused B0 suite: **4 files, 11 tests passed**.
* Convex package suite: **22 files, 115 tests passed**.
* Admin package suite: **7 files, 32 tests passed**.
* Root typecheck: **16/16 tasks passed**.
* Production build: **6/6 applications passed**.
* Root test: changed-package tests pass; the aggregate parallel run remains red because pre-existing `foundationContracts.test.ts` exceeds its 5-second timeout under contention, while the standalone Convex run passes.
* Root lint: changed files/packages pass; the aggregate command remains red on unrelated pre-existing teacher conditional-hook errors and warnings.
* `git diff --check` passed throughout.
* Design, B0, combined B1/B2, and final integration reviews were completed. Every blocker was fixed; final verdict: **APPROVE**.

### UI verification and Antigravity

Admin and platform development servers started on `0.0.0.0` and returned HTTP 200 for sign-in pages. A read-only authenticated screenshot attempt used documented credentials without printing them or submitting mutations, but none matched current development data. Root Playwright was intentionally not run because its global setup destructively resets the demo tenant. No authenticated screenshots are claimed or committed.

Antigravity performed a bounded read-only review of five UI surfaces and made no direct code changes. Useful findings were implemented and audited: keyboard-accessible/reselectable logo input, disabled save-state controls, explicit focus indicators, reset-modal portal/scroll lock/autocomplete/helper/responsive layout, truthful suspended metric copy, and all-day event display. One low-priority detached-trigger focus fallback was not generalized because it required inventing a target outside the bounded contract.

### Git status

Branch: `feat/e2e-backlog-safe-improvements`

Implementation commits: `e77b786`, `a8e2c8b`, `9f02153`, `5ee74b2`, `3fae8a7`, and `f264041`. The final documentation commit and PR identifier are recorded in the HTML report and final handoff.

## Assessment validation record

- [x] **Assessment artifact created:** `00_Notes/e2e_backlog_implementation_assessment.md`
- [x] **All 53 backlog entries accounted for:** matrix and detailed sections above
- [x] **Classification baseline reconciled:** A=9, B=9, C=22, D=13
- [x] **Selected/deferred work recorded:** 14 selected, 39 deferred
- [x] **No schema migration, database write, production mutation, deployment, credential exposure, or sensitive screenshot**
- [x] **Final code review approved the implementation**
