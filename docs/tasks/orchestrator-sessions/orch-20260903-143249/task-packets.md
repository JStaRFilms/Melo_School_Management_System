# Dependency-Aware Task Packets

**Program state:** Do not start Build packets until the user approves Genesis synthesis, PR #21 merges, and work begins from a fresh updated-`master` branch. Every packet follows repository and Convex guidance, emits no secrets/PII/exports, and uses production read-only access only.

## Shared packet rules

- **Workflow:** Design packets produce reviewed decisions/artifacts; Build packets implement only their stated slice after dependencies pass. A milestone integration review replaces per-task PR churn.
- **Prime context for every packet:** `AGENTS.md`; `packages/convex/_generated/ai/guidelines.md`; `product-decisions.md`; `implementation-program.md`; `migration-verification-matrix.md`; this packet; relevant source files named below. Read Convex migration/file-storage skill guidance for affected Build packets.
- **Convex:** validators on every function; internal functions for sensitive helpers; identity derived from `tokenIdentifier`; index/bound queries; actions never use `ctx.db`; migrations are idempotent/batched.
- **Evidence:** tests include positive and negative authorization paths where relevant, migration/reconciliation evidence where relevant, and browser/print/a11y evidence where UI changes. Authorized credential verification may consult `tmp/demo_school_credentials.md` without reproducing values.

## Design packets

### D-01 — Compliance control dossier (F5)
- **Objective:** Produce the versioned engineering/compliance basis required before broad sensitive-processing rollout.
- **Scope:** Data inventory/classification; purpose/lawful-basis and controller/processor/subprocessor matrices; guardian/age/rights/retention/breach/international-transfer controls; Nigeria-first jurisdiction matrix plus required launch-market research using dated primary sources; implementation-control traceability for H5, F3, H8, H9, F4, notifications and analytics.
- **Dependencies:** Approved program.
- **Role/workflow:** Compliance researcher + security architect → legal/privacy reviewer checkpoint; research, not legal advice.
- **Prime context:** `product-decisions.md` F5; admissions data-class contracts; school billing/provider docs; asset/import/transfer packets.
- **Expected artifacts:** Versioned legal/compliance engineering document; cited jurisdiction/source register; controls-to-product matrix; explicit counsel questions and feature gates.
- **Definition of done:** Separates legal requirements, best practice, and unresolved counsel questions; source URL/jurisdiction/effective-access/review dates present; no claim of legal approval; implementation gates are actionable.
- **Validation:** Citation completeness review; privacy/security review; trace every sensitive program feature to a control or documented gate.
- **Review checkpoint:** Qualified lawyer/privacy professional must approve market-specific conclusions before the corresponding launch.

### D-02 — Identity, group, RBAC, and audit architecture (F2/H2/F1)
- **Objective:** Freeze the data/API/authority design that can evolve current school users without cross-branch leakage or lockout.
- **Scope:** Canonical person/membership/group/link model; legacy bridge; active branch selection; capability catalog/default templates; union/grant/restriction evaluator; proprietor recovery/delegation ceiling; audit event/redaction/retention/alert/export contract; endpoint enforcement inventory.
- **Dependencies:** D-01 data-classification constraints.
- **Role/workflow:** Security architect → data/Convex reviewer → product owner approval.
- **Prime context:** `academic/auth.ts`, `migrationAuth.ts`, schema users/schools/leadership, ADR-003/004, existing leadership and branding docs, F1/F2/H2 ledger.
- **Expected artifacts:** ERD; state/authority diagrams; typed permission/event vocabulary; compatibility and enforcement sequencing; complete producer/endpoint inventory; threat model and negative-test matrix.
- **Definition of done:** Explicitly solves multiple memberships, title-vs-authorization, owner recovery, platform support, branch/group scope, direct URL denied behavior, and redaction; contains no invented roles or delegation powers.
- **Validation:** Tabletop privilege-escalation/lockout scenarios; review inventory against public Convex functions/storage/export routes.
- **Review checkpoint:** Security signoff required before B-02/B-03.

### D-03 — Provider, runtime, and settlement spikes (H5/H9/F7/F4)
- **Objective:** Replace uncertain provider/runtime/legal assumptions with reversible decisions before irreversible architecture.
- **Scope:** Paystack split/subaccount, recurring mandate, fees/refunds/settlement/tax/reconciliation; Google/Microsoft/Zoho DNS/delegated auth/lifecycle; AV/quarantine vendor/control and data handling; pdf-lib/Convex Node runtime candidate validation and native-binary exclusion; independent-transfer portable-record and cryptographic-evidence feasibility.
- **Dependencies:** D-01; relevant provider sandbox access authorized separately.
- **Role/workflow:** Integration architect + security/compliance reviewer + finance owner; sandbox/read-only experiments only.
- **Prime context:** ADR-005, Paystack routing, pricing strategy, current billing provider modules, SchoolAssets document, F4/F7/H5/H9 ledger.
- **Expected artifacts:** Spike reports with evidence, costs/limits, failure/retry/idempotency model, recommended/declined option, data-flow diagram, vendor due-diligence checklist, irreversible-decision gate list.
- **Definition of done:** Explicitly states that Melo operates no mail server, direct merchant differs from split mode, no universal settlement promise, native binaries are out absent proof, and unscanned assets cannot expand beyond controlled admins.
- **Validation:** Provider sandbox contract tests or documented access blocker; architecture/security/finance review.
- **Review checkpoint:** Product, finance, security and counsel gate each relevant build launch.

### D-04 — Cross-application interaction and visual contract (H1/H3/H4/H6/H7/F6/H8/H9/F7)
- **Objective:** Design reusable user flows and UI states before vertical builds.
- **Scope:** Permission denied/nav hiding; branch switch and unsaved state; grade builder/color and printed/grayscale report; bank settings/invoice instructions; admission builder; draft/progress; theme settings/token preview; address proposals; usage confirmations; asset library/Archive/visible navigable Trash/compression states; pricing/settlement transparency.
- **Dependencies:** D-02; D-03 for provider-dependent surfaces.
- **Role/workflow:** Product designer → accessibility/print reviewer → builder handoff.
- **Prime context:** current grading/billing/settings/import pages; `WorkspaceNavbar`; `ReportCardSheet`; existing Archive surfaces; H1–H9/F6/F7 ledger.
- **Expected artifacts:** Annotated flows, responsive states, component contract inventory, content/error state table, a11y and print/grayscale annotations, consumer inventory for grade colors/theme tokens.
- **Definition of done:** Progress semantics distinguish scroll from validated completion; draft status distinct from progress; no offline promise; theme colors do not replace status/grade colors; Trash is first-class navigation comparable to Archive.
- **Validation:** Keyboard/screen-reader/reduced-motion and 320px/mobile review; print preview review; design-system consistency review.
- **Review checkpoint:** Design approval before B-05/B-06/B-07/B-08/B-09.

### D-05 — Migration rehearsal and data refresh runbook (all contracts)
- **Objective:** Turn matrix controls into operator-ready, non-destructive rehearsal evidence.
- **Scope:** Read-only production snapshot to backed-up development refresh; manifests/count reconciliation; migration order/cursors/checks; rollback and forward-fix decision tree; credential/screenshot handling; safe app target verification.
- **Dependencies:** D-02; current deployed tooling access policy.
- **Role/workflow:** Data migration architect + authorized operator → security reviewer.
- **Prime context:** migration matrix; prior Olive split record; `branchSplitV2`; `migration*` functions; Convex migration guidance.
- **Expected artifacts:** Runbook with approvals and stop conditions, non-secret manifest template, per-MX rehearsal checklist, restore drill record template.
- **Definition of done:** Contains no production mutation command or secret; requires development backup validation before replacement and app target verification; covers expand/backfill/verify/enforce/contract separately.
- **Validation:** Tabletop restore and target-misconfiguration abort scenario; independent operator review.
- **Review checkpoint:** Signoff before B-01 and all data backfills.

## Build packets

### B-01 — Quality baseline and environment gate
- **Objective:** Clear known blockers without masking root cause, and establish safe rehearsal readiness.
- **Scope:** Fix teacher conditional-hook lint errors; investigate `packages/convex/foundationContracts.test.ts` parallel-only timeout by profiling fixture/module/setup contention; execute only the approved development refresh preparation/rehearsal process from D-05.
- **Dependencies:** PR #21 merged; fresh branch; D-05 approved for any refresh activity.
- **Role/workflow:** Builder + test engineer; one baseline PR (M0).
- **Prime context:** root/package scripts; teacher lint output; `foundationContracts.test.ts`; prior assessment verification record; D-05.
- **Expected artifacts:** Focused lint correction; root-cause report and minimized test setup or evidence-backed focused timeout rationale; target/backup/rehearsal evidence if refresh is authorized.
- **Definition of done:** No conditional-hook lint blocker remains; no timeout increase without root-cause work; focused and parallel behavior documented; production untouched; no exports/secrets/PII committed.
- **Validation:** Changed-package lint/test/typecheck, focused + parallel timeout reproduction, `git diff --check`.
- **Review checkpoint:** M0 integration review blocks every subsequent Build packet.

### B-02 — Canonical identity and group membership kernel (F2)
- **Objective:** Add canonical identity, explicit memberships, school groups/links, and compatibility resolvers without rekeying branch data.
- **Scope:** MX-01/MX-02 schema/indexes/internal resolver/migration runner/read models; existing-tenant link migration rehearsal; no switcher/RBAC UI yet.
- **Dependencies:** B-01, D-02, D-05.
- **Role/workflow:** Convex/data builder → migration/security review; M1 PR.
- **Prime context:** schema users/schools, `academic/auth.ts`, `migrationAuth.ts`, `branchSplitV2`, ADR-004, MX-01/02.
- **Expected artifacts:** Additive schema/functions, compatibility contract, durable migration telemetry, development rehearsal report.
- **Definition of done:** A person may hold explicit memberships in multiple branches; current users retain access; existing records retain `schoolId`; group link never creates implicit access.
- **Validation:** Convex integration tests legacy/new auth, multi-branch teacher, no-membership denial, cross-branch record denial; manifest/count reconciliation.
- **Review checkpoint:** M1 security and migration review.

### B-03 — Capability RBAC and append-only audit kernel (H2/F1)
- **Objective:** Replace broad administrative authority with capabilities/delegation ceiling and establish safe audit foundation.
- **Scope:** MX-03/MX-04; templates, direct grants/restrictions, evaluator/preview, permission denied projection, audit writer/query/filter/export/alerts; migrate admins to full baseline; first protected endpoint tranche.
- **Dependencies:** B-02, D-02.
- **Role/workflow:** Security-focused Convex builder + UI builder → security review; M2 PR.
- **Prime context:** `academic/auth.ts`, leadership modules, platform auth, workspace navigation, existing audit-like tables, H2/F1 ledger.
- **Expected artifacts:** Capability/event contracts, enforcement inventory update, migration/backfill report, safe admin/audit surfaces.
- **Definition of done:** Backend, not navigation, enforces; manager ceiling/proprietor recovery rules hold; audit is append-only/redacted/scoped; sensitive alerts work without routine noise.
- **Validation:** Capability negative matrix covering exports, bank, reset, destructive, publish, permission management; append-only/redaction/export equivalence tests.
- **Review checkpoint:** M2 security review; no later vertical merges until its protected endpoints are covered.

### B-04 — Group switcher, inheritance, and safe aggregates (F2)
- **Objective:** Make approved group memberships usable while retaining branch isolation.
- **Scope:** MX-02/MX-05 group/branch settings resolution, active branch switcher, unsaved-state integration seam, safe group dashboard projections and audit scope; link approved Olive branches without data merge.
- **Dependencies:** B-02, B-03, D-04.
- **Role/workflow:** Full-stack builder → tenancy/UI review; M3 PR.
- **Prime context:** workspace/navbar and branding flows; group design; `schools.theme`; F2 ledger; MX-02/05.
- **Expected artifacts:** Switcher and branch context contract, group/branch setting readers, aggregate read models, link rehearsal evidence.
- **Definition of done:** Switching requires explicit membership, protects dirty form seams, shows active branch, excludes unauthorized branch totals, and changes no operational record ownership.
- **Validation:** Browser branch-switch/direct URL cases; tenant-negative backend tests; aggregate authorization and migration reconciliation tests.
- **Review checkpoint:** M3 integration review.

### B-05 — Grade policy, admission numbering, and bank-instruction verticals (H1/H4/H3)
- **Objective:** Deliver bounded academic/finance policy features on RBAC/audit/group foundations.
- **Scope:** MX-06/07/08: color policy/version and all inventoried consumers; admission format/version/counter allocator/import handoff; bank account lifecycle and issued-document payment snapshots.
- **Dependencies:** B-03/B-04, D-04, D-05.
- **Role/workflow:** Domain builder + Convex builder + design/print reviewer; M4 PR.
- **Prime context:** grading bands/report cards/exam extras; enrollment/import merge/autosave; billing/printable finance modules; H1/H3/H4 ledger.
- **Expected artifacts:** Policy builders, atomic allocator, account settings, snapshot renderers, migration/reconciliation report and consumer inventory.
- **Definition of done:** Existing standard grade preset remains singular; historic behavior is documented and rendered safely; allocation is atomic/audited and imports do not implicitly advance official counters; bank numbers masked except authorized instruction view; issued docs immutable.
- **Validation:** Concurrent allocation/retry/import/override tests; authorization/audit tests; report/invoice print plus grayscale/a11y review.
- **Review checkpoint:** M4 finance/academic integrity review.

### B-06 — Shared tokens, drafts, and mobile progress (F6/H6/H7)
- **Objective:** Create reusable UI foundations and apply them only to approved initial forms/shells.
- **Scope:** MX-05/MX-10: typed theme derivation/CSS/Tailwind/AGENTS guidance/hard-coded-color changed-file audit; server draft/revision/temp-file lifecycle/navigation guard; mobile progress in enrollment, bulk import, staff onboarding, fee plans, long academic setup, teacher planning.
- **Dependencies:** B-03/B-04, D-04.
- **Role/workflow:** Shared UI builder + frontend builder → accessibility/privacy review; M5 PR.
- **Prime context:** `WorkspaceNavbar`, report card, school branding, target forms; H6/H7/F6 ledger.
- **Expected artifacts:** Typed token API/provider, lint/audit rule and inventory, shared dirty/draft/progress components, target-form integration, retention jobs.
- **Definition of done:** Only primary/accent are configured; safe tokens derived; no mass legacy rewrite; drafts respect sensitivity/revision/retention; UI distinguishes saving/recovery/failed/conflict; no “Work offline” assertion; progress semantics accurate.
- **Validation:** Contrast/print/grayscale/token type checks; router/reload/sidebar/branch/multitab conflict tests; mobile keyboard/screen-reader/reduced-motion checks.
- **Review checkpoint:** M5 UX/accessibility/privacy review.

### B-07 — Institutional domains and reviewed AI import (H5/F3)
- **Objective:** Add provider-safe identity addressing and AI-assisted import review without permitting AI direct commits.
- **Scope:** MX-09/MX-11: policies/namespaces/address lifecycle/provider operations, dry-run/approval/reconcile; structured AI analysis/mapping/confidence/review and deterministic batch commit with H4 integration.
- **Dependencies:** B-02/B-03/B-05, D-01/D-03/D-04.
- **Role/workflow:** Integration/Convex builder + product UI builder → provider/privacy/security review; M6 PR.
- **Prime context:** Better Auth/provisioning helpers, migration workspace/merge, H5/F3 ledger, provider spike outcome.
- **Expected artifacts:** Provider adapter contracts/operation ledger, address proposal flows, typed AI proposal schema/reviewer UI, reconciliation reports.
- **Definition of done:** Mail capability states are truthful; provider failure is isolated/idempotent; aliases/suspension rules are honored; uncertain import rows block commit; deterministic validation and audited reviewed batch precede every write.
- **Validation:** Collision/namespace/transfer/provider failure/retry tests; adversarial import/low confidence/duplicate/counter confirmation/replay tests.
- **Review checkpoint:** M6 provider/privacy and data-integrity review.

### B-08 — Commercial catalog, usage metering, and asset lifecycle (F7/H8/H9)
- **Objective:** Build separated commercial/usage/asset foundations under verified provider/runtime assumptions.
- **Scope:** MX-12/13/14: versioned plan/rate/contract invoice and settlement ledgers; entitlement/reservation/settlement/storage accounting; private asset library with upload quarantine/AV, visible Archive/Trash, retention/holds/purge, PDF candidate validation/compression only if spike passes.
- **Dependencies:** B-03/B-04, D-01/D-03/D-04.
- **Role/workflow:** Finance/integration/Convex builder + UI builder → finance/security/compliance review; M7 PR.
- **Prime context:** pricing and Paystack docs, billing modules, storage/knowledge patterns, SchoolAssets doc, H8/H9/F7 ledger.
- **Expected artifacts:** Catalog seed/migration documentation, ledgers/read models, metering adapters, asset service/UI including navigable Trash, runtime/AV decision record, reconciliation dashboard.
- **Definition of done:** Core/Basic approved anchor is catalog configuration not code constant; direct vs split settlement truthful and separate; no double charging; temp/trash/active storage distinct; assets private/scanned/tenant-gated; failed compression/purge retains safe truthful state.
- **Validation:** Financial snapshot/reconciliation/RBAC tests; concurrent idempotency/provider failure tests; signature/quarantine/hold/Trash/restore/purge/compression malformed/signed/form PDF tests; no-public-link test.
- **Review checkpoint:** M7 finance, storage-security, and legal/provider release gate.

### B-09 — Within-group transfer foundation (F2/F4 prerequisite)
- **Objective:** Implement audited within-group movement without changing source ownership/history.
- **Scope:** MX-15 transfer-case state machine, authorized source/destination acceptance, destination enrollment context, safe continuous history projection; explicitly excludes independent Melo-to-Melo transfer.
- **Dependencies:** B-02/B-03/B-04, lifecycle compatibility, D-01/D-03 controls.
- **Role/workflow:** Domain/security builder → privacy/tenancy review; M8 PR.
- **Prime context:** student lifecycle/enrollment modules, F2/F4 ledger, MX-15.
- **Expected artifacts:** Transfer state contract/UI, audit events, reconciliation path, privacy map, migration-free pilot plan.
- **Definition of done:** No `schoolId` in-place rewrite; source retains immutable records; destination has only authorized active context; cancellation/correction remain auditable; unrelated branch data stays inaccessible.
- **Validation:** Cross-branch authorization/visibility, partial/retry/cancel/correction, report/finance history tests; browser acceptance for authorized parties.
- **Review checkpoint:** M8 privacy and tenancy review.

### L-01 — Independent Melo-to-Melo transfer network (F4 later-gated)
- **Objective:** Prepare a separate future initiative; do not implement in current release.
- **Scope:** After B-09, design/approval/build plan for verified independent institutions, guardian/student authorization, source release/destination acceptance, selected portable record sharing, immutable cryptographic attribution, expiry/rejection/dispute/correction.
- **Dependencies:** B-09, corrected D-01/D-03 plus qualified jurisdictional legal, provider, and security approval, separate product approval.
- **Role/workflow:** Architect + counsel + security/integration team; future gated program.
- **Prime context:** F4 ledger, D-01/D-03 outcomes, B-09 evidence.
- **Expected artifacts:** Separate approved architecture/migration/operational packet; no current product code.
- **Definition of done:** Explicitly excludes automatic finance/safeguarding/health/discipline sharing and does not weaken source/destination isolation.
- **Validation:** Legal/security threat model and inter-institutional sandbox proof defined in the future program.
- **Review checkpoint:** New Genesis approval required before implementation.
