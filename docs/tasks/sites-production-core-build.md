# Production school-site build tasks

Status: user approved schema and approval rules with "Approve and proceed". Worktree `/Users/toji/Documents/johnsax/sites-production-core`, branch `feature/sites-production-core`, integrated base `dd88f551`. Dependencies installed with frozen lockfile and scripts disabled. No environment files copied. Use synchronous agents and one active writer. The original worktree is not an artifact destination.

## Prime context for every task

Read `AGENTS.md`, `docs/tasks/sites-production-core-plan.md`, `docs/tasks/sites-production-core-schema-proposal.md`, `docs/features/AdmissionsAndSiteFoundationContract.md`, `docs/features/SchoolContentAndAdmissionsSettingsUX.md` and the applicable Convex guidelines before backend edits. Read `/Users/toji/.pi/agent/skills/unslop/SKILL.md` for text. Actual installed APIs and foundation validators take precedence over illustrative architecture interfaces. Model routing is global only.

No merge to master, deployment, remote seed/migration, live provider mutation, actual DNS change, private-photo copy or real fact approval. No commits or push by implementer subagents; the parent owns staged-diff inspection and PR creation. Do not ask for secrets in chat. Production fails closed without configuration. Provider tests use mocks. Only synthetic people/content in tests.

## Task 1: Publication, evidence, assets and shared manifests

Role: coder, Sol High. State: completed locally and wired to the domain gate. Focused tests and shared/Convex typechecks pass. API details and limitations: `docs/tasks/sites-production-core-backend-handoff.md`. Dependencies: approved plan/schema, installed dependencies.

Objective: implement the persisted publication and approval boundary and freeze actual production types for subsequent domain/core/UI tasks.

Scope: pure `packages/shared/src/site-manifests.ts` and public site contracts/export/tests; approved optional schema additions; `packages/convex/functions/sites` publication/evidence/assets/profile helpers and tests; required local generated API reconciliation; dedicated website byte-upload/asset HTTP registrations in `packages/convex/http.ts` if that is the actual route file. Small compatible foundation link refactor only when needed for trusted server time. Do not edit apps presentation or domain provider code in this slice.

Requirements: explicit same-school school-wide capability gates, platform-only profile provisioning, bounded semantic manifest validation, primary/accent only, digest-bound identity and sensitive fact evidence from independently authorized privacy.approve reviewer, optimistic draft save, authenticated expiry-safe preview with safe asset placeholders, immutable atomic publication and revert-by-clone. Approvals are independent from publication, evidence is append-only with revocation, reviewer cannot substitute authority for real evidence. Reject unknown renderers/versions/fields, executable content/HTML/scripts/CSS/module paths/page-builder config. Share pure exact manifests across backend/renderer without React imports. Add an explicitly selected code-owned synthetic managed renderer for test setup, never OBHIS fallback.

Website byte upload must store server-received validated bytes and register provenance internally, never accept a preexisting storage ID from clients. Recheck authorization atomically at registration; clean up orphaned new bytes on failure. Rights/child classification/consent evidence is school- and checksum-bound. Public projection and public byte delivery recheck expiry, revocation and current publication and host. Never disclose internal storage URLs/IDs, draft values or rights references publicly. Use server-time actions/mutations and internal queries with a trusted time argument; no caller-supplied clock or query wall clock. Public asset endpoint emits bytes, never reusable upstream location. Subsequent domains task will complete the active-host/readiness gate; do not leave a permissive placeholder that exposes bytes before it.

Expected artifacts: implemented shared types/manifests and backend operations, synthetic convex-test coverage, `docs/tasks/sites-production-core-backend-handoff.md` listing precise API names and contracts, results and limitations.

Definition of done: focused tests and shared/Convex typechecks pass, or baseline failures are identified with evidence; assets and public loading fail closed until domain infrastructure is wired; additive compatibility preserved. No fake functionality or "verified" client flags. Reconcile types offline only. If installed Convex does not support proposed typed env declarations, use the installed supported configuration pattern with strict central validation and document the compatibility choice instead of upgrading the framework or casting away type errors.

Verification: tenant/grant isolation; evidence digest/class/school/expiry; invalid content; immutable revision and conflict/revert; privacy/child uploads and expired evidence; no public drafts/private IDs/URLs. Parent will inspect changes before later tasks.

## Task 2: Domains and Vercel integration

Role: coder, Sol High. State: completed locally with mocked provider and controlled TLS verification. Trusted Sites ingress and marker are wired; live provider readiness remains unverified. API and limits: `docs/tasks/sites-production-core-domain-handoff.md`. Dependencies: task 1 shared/backend contract.

Objective: implement real domain ownership/provider/routing/TLS checks and fail-closed activation using the approved additive fields.

Scope: `packages/convex/functions/sites` domain actions/mutations/helpers/tests, provider-only Node helpers, platform operations and approved runtime config declarations if supported. Small public loader/asset gate completion in existing task 1 functions. Public Vercel API extract `/tmp/sites-production-vercel-api.json` or fresh unauthenticated official API docs; no live account calls.

Requirements: normalized hostname uniqueness and reserved-host checks; independent expiring TXT school ownership challenge; stale-generation/race-safe commits; current configured Vercel project/production domain and routing status; real SNI/trust-chain/hostname/expiry TLS handshake and deployment marker probe with pinned public DNS addresses, bounded bytes/time and no redirects; independent provider and ownership proof. Reject private/reserved IPs and DNS rebinding. Generate DNS records from actual provider recommendations; no fixed invented apex IP. Separate explicit operator provider attachment/verification from read-only checking. No provider delete/move/certificate issuance or registrar updates. Platform operator authorization is server-derived and rechecked before observations commit.

Activation transaction validates publication/manifests/evidence/assets and one active canonical host, with same-school alias pointers. Canonical HTTPS redirects retain safe paths/query; publication and activation remain separate. Rotation/suspension/retirement invalidate observations, pages/SEO/bytes immediately. Active-domain rechecks must support keeping observations current without implicitly returning an active site to ready state; scheduled maintenance has bounded work and failures deny stale serving. Challenge expiry must have an intentional lifecycle and no silent permanent domain unavailability. Apply short freshness window consistently and document periodic read-only revalidation, so a legitimately activated domain is not abandoned after fifteen minutes. No public fake time arguments.

Expected artifacts: mocked provider/DNS/TLS tests and contract handoff `docs/tasks/sites-production-core-domain-handoff.md`; operator states and exact config requirements.

Definition of done: focused domain/backend tests and typecheck pass; unsafe states unavailable; configured mocks prove the full request/verify/check/activate/suspend path. Missing live project/secret denies, rather than claiming runtime readiness. If deployed Convex networking cannot support trusted TLS probing, identify a secure actual runtime within this project and wire it without speculative external services.

Verification: global collision, exact project/env/routing, stale checks and rotated token, TLS/probe/SSRF denial, canonical uniqueness, aliases, active maintenance, suspended/retired hosts and cross-school requests.

## Task 3: Shared Sites request/rendering core

Role: coder, Sol Medium. State: completed locally; tests, typecheck, lint and production build pass. Dependencies: tasks 1 and 2.

Objective: move production request handling from static demo data to validated published content and a compile-time renderer registry.

Scope: `apps/sites/core/**`, thin app routes/proxy, managed synthetic renderer, explicit allowlisted legacy adapter, asset proxy, health probe, SEO/theme and tests/scripts/package config required to run them. No OBHIS visual implementation or edits to its unavailable worktree.

Requirements: production context distinct from PrivateReviewContext; exact key/version registry with no fallback; readonly validated DTO props only; renderers have no persistence/tenant/admissions URL logic; real Host not arbitrary forwarded headers; HTTPS canonical and safe path/query redirects; `/apply` uses existing ApplicationLinkV1 href only when available; portal absent unless approved configuration; published manifest metadata/robots/sitemap/JSON-LD and noindex/no-store denied states. Host-domain backend action must not admit preview host or arbitrary dev override in production. Missing profiles remain unavailable; explicit known demo allowlist excludes fabricated OBHIS. No private review fixtures/photos enter production bundle/output. Asset bytes recheck fresh current-publication/host/rights and never redirect to storage. Deployment health marker works before site activation without exposing content.

Expected artifacts: working shared core + synthetic renderer, focused site tests/build/typecheck, `docs/tasks/sites-production-core-frontend-handoff.md` listing exact public context and registry contract for OBHIS.

Definition of done: tests for spoofed headers, schema mismatch, no profile, denied domains/content/assets, alias paths/query, admissions consistency, SEO and legacy pass; relevant build/typecheck/lint and theme audit recorded.

## Task 4: Management workflow and documentation

Role: coder, Sol Medium. State: completed locally, including a fresh headless Chromium bridge to the actual in-process Convex functions. Admin build passes with a synthetic public Convex URL used for compilation only. Deployed runtime remains unverified. Results: `docs/tasks/sites-production-core-correction-results.md`, operations: `docs/tasks/sites-production-core-operations.md`. Dependencies: tasks 1, 2, 3 handoffs.

Objective: operator and school users can complete synthetic managed-site setup, drafting, independent approval, authenticated preview, publication/revert and domain onboarding through scoped existing UI patterns.

Scope: site-specific admin settings subroutes/components and platform school-site/domain view, targeted capability projections, synthetic UI tests/headless workflow. Update architecture/feature docs, environment instructions, operator guide, rollout/merge plan and exact renderer integration contract. No unrelated redesign, generic JSON/page builder, admissions workflow edit or real content approval.

Requirements: typed manifest-owned field editor, conflict preservation, explicit evidence reference/expiry and candidate confirmation, safe asset upload/review, immutable history, authorized preview watermark/noindex and no canonical, domain request with accurate TXT/routing instructions, explicit operator readiness checks/activation/suspension/retirement. Provider mutation controls require clear separate confirmation and live-operation config safety; viewing status never mutates provider. Do not expose applicant data or signed storage URLs. Accessible labelled controls and server authorization.

Expected artifacts: targeted tests, operator/hosting guide, architecture update, implementation readiness report and merge/adapter guide. OBHIS key/version/field mapping remains explicitly unverified until its safe branch transfer; do not claim launch or runtime readiness.

Definition of done: focused UI tests and relevant admin/platform lint/typecheck/build; fresh headless browser exercises safe synthetic workflow on a confirmed local configured test setup if available. User remote backend is not an acceptable test target. Report any local setup limitations accurately.

## Task 5: Consolidated review, correction and PR

Roles: two read-only reviewers, Sol High. Dependencies: implementation tasks.

Review lanes: backend authorization/evidence/assets/domain/provider security; frontend host/links/SEO/legacy/management/OBHIS boundaries. One consolidated round, one scoped correction pass, final verification. Verify confirmed blockers against code; defer optional cleanup without creating issues/docs unless separately approved. Parent stages exact owned paths, inspects staged diff, commits without amending pushed history, then pushes authorized branch and opens PR, requests `@codex review` and monitors actual head checks and all review channels. Stop before merge. Separate code/review/preview/runtime/release readiness. No deployment/migration authorization implied by PR authorization.
