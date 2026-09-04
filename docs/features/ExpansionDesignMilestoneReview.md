# Expansion Design Milestone Review: D-01 through D-05

**Session:** `orch-20260903-143249`  
**Review Scope:** Comprehensive cross-bundle systems audit of design artifacts **D-01 through D-05** against Genesis decisions, repository invariants, Convex guidelines, and the normative implementation program.  
**Original review date:** 2026-09-03
**Correction status:** prior approval superseded; corrected bundle awaits independent milestone re-review.

---

## 1. Milestone Review Header & Verdict

> **Correction record (2026-09-03):** The findings below are the superseded original review, retained only for traceability. They are not current evidence of implementation, legal approval, provider/runtime validation, browser/accessibility validation, or release authorization. D-01 through D-05 now carry explicit evidence gates; a new independent review must assess the corrected artifacts.

### 1.1 Executive Summary
The Design Phase for the Melo School Management System expansion program has produced five core architectural artifacts:
1. `docs/features/D01_ComplianceControlDossier.md` (F5 Legal, Privacy & Child Data Program)
2. `docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md` (F2 Tenancy, H2 Capability RBAC, F1 Append-Only Audit)
3. `docs/features/D03_ProviderRuntimeAndSettlementSpikes.md` (F7 Monetization, H5 Institutional Email, H9 AV/PDF Spikes, F4 Transfers)
4. `docs/features/D04_CrossApplicationInteractionAndVisualContract.md` (H1–H9, F6, F7 Interaction, Mobile & Visual Tokens)
5. `docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md` (Universal Batch Protocol, MX-01 to MX-15 Rehearsal Runbooks)

Each document has been audited against the repository's normative anchors: `product-decisions.md`, `implementation-program.md`, `task-packets.md`, `migration-verification-matrix.md`, `packages/convex/_generated/ai/guidelines.md`, and the preceding milestone standard `DesignMilestoneReview.md`.

### 1.2 Authoritative Verdict

> [!IMPORTANT]
> **CORRECTED DESIGN VERDICT: INDEPENDENT RE-REVIEW PENDING**
>
> The prior build-handoff approval is superseded. The corrected D-01–D-05 documents distinguish target controls from evidence and retain legal, provider, runtime, AV, browser/accessibility, migration/restore, and operational gates.
>
> **Design/Build approval is blocked** until the applicable legal/counsel, provider, and browser/accessibility gates have independent evidence and reviewer sign-off. M0–M8 commits are recorded in the session, but neither their existence nor this correction implies release, provider activation, legal approval, browser validation, or a new build authorization.

---

## 2. Superseded Original Review Matrix (not current acceptance evidence)

The review evaluates each architectural domain against its specification evidence, repository invariants, and downstream builder requirements.

| # | Gate / Domain | Evidence Reviewed | Result | Required Disposition for Builders |
|---|---|---|---|---|
| 1 | **D-01 Compliance Dossier & Jurisdiction Register (F5)** | D-01 §§1–10: 6 canonical data tiers; role-based lawful basis matrix (NDPA Art. 25, GDPR Art. 6/9); Controller/Processor boundaries; 18-year legal majority rules; opt-in media consent; DSAR & non-erasable statutory overrides; dated jurisdiction register (Nigeria NDPA 2023, GAID 2024, CRA 2003, UK GDPR, FERPA/COPPA, POPIA); 10 open counsel questions. | **Superseded assessment — re-review required** | Builders must enforce data classification tags (`admissionsDataClassValidator`). Formal launch into production remains gated by external Nigerian legal counsel review (Gate 1). |
| 2 | **F2 Canonical Identity & Multi-Branch Tenancy** | D-02 §2: `persons` keyed by `authTokenIdentifier`; explicit `branchMemberships(personId, schoolId)`; `schoolGroups` & `schoolGroupBranches`; legacy `users` bridge projection; `resolveActiveMembership` deriving identity server-side with zero client trust. | **Superseded assessment — re-review required** | M1 (PR-B) must implement `persons` and `branchMemberships` as additive records. `schoolId` on existing operational tables (`students`, `classes`, `studentInvoices`) must NEVER be rekeyed or merged. |
| 3 | **H2 Capability RBAC & Delegation Ceilings** | D-02 §3: Cosmetic display titles decoupled from authorization; 7 standard base role templates; closed 47-capability catalog across 8 domains; mathematical evaluator: `(Union Templates + Grants) - Restrictions`; 6 rules of delegated authority (anti-self-edit, no superior edit, proprietor delegation ceiling). | **Superseded assessment — re-review required** | M2 (PR-C) must deploy the backend evaluator in observe mode before enforcement. Public Convex endpoints must validate capabilities server-side; navigation hiding is UX convenience only. |
| 4 | **F1 Append-Only Audit Log & Sanitization Pipeline** | D-02 §4: `auditEvents` & `auditAlerts` schema; pre-write sanitization pipeline (passwords/bearer tokens -> `[REDACTED_SECRET]`, bank account numbers masked to `***-****-1234`, NIN masked); 3-tier alerting (Tier 1 Critical immediate leadership alert, Tier 2 Warn, Tier 3 Info); 7-year vs. permanent statutory retention. | **Superseded assessment — re-review required** | M2 (PR-C) must land the central internal audit writer. No update or delete mutations shall ever be registered on `auditEvents`. Every sensitive mutation must emit an audit event. |
| 5 | **H5 Institutional Email & Directory Provisioning** | D-03 §3: Invariant C1 (Melo operates zero mail servers); Google Admin SDK, Microsoft Graph, Zoho Directory integration seams; 3-state mailbox model (`login_only`, `external_verified`, `provider_provisioned`); DNS TXT challenge; dry-run proposal pattern; 4-stage collision resolution; minor naming privacy; departure re-allocation freeze; async outbox worker. | **Superseded assessment — re-review required** | M6 (PR-G) must enforce the dry-run proposal step before provisioning API calls. Never dispatch emails to `login_only` identities. Once assigned, institutional addresses are permanently frozen. |
| 6 | **F7 / H3 Payment Routing & Ledgering** | Historical design material; the corrected D-03 treats routing, settlement timing, mandates, tax, liability, and provider capability as evidence gates. | **Superseded assessment — re-review required** | Any future payment feature requires provider, finance, legal, and reconciliation evidence; no fixed settlement schedule or tax treatment is approved here. |
| 7 | **H9 Asset Library, AV Quarantine & First-Class Navigable Trash** | D-03 §4 & D-04 §12: Invariant C5 (Quarantine-First); AV provider/control selection pending; no GuardDuty or ClamAV integration is evidenced; public VirusTotal strictly prohibited; quarantine state machine (`quarantined`, `scanning`, `clean`, `infected` with 14-day forensic hold); 25 MB file limit; magic-byte validation (`file-type`); navigable Trash (`/admin/assets/trash`) with 30-day auto-purge and `retentionHolds` lock. | **Superseded assessment — re-review required** | M7 (PR-H) must quarantine uploads by default. Unscanned assets must return 403 Forbidden to general users. Trash must support item inspection, restore, and retention hold locking. |
| 8 | **H9 PDF Runtime & Pure-JS Compression vs Native Binary Exclusion** | D-03 §5 & D-04 §12.4: Invariant C4 (strict exclusion of Ghostscript, QPDF, Poppler, Libvips from Convex Node actions); pure-JS `pdf-lib` evaluation; structural reserialization limits disclosed (no bitmap downsampling, <5% savings on scans); candidate pre-checks (skip encrypted, signed, form-sensitive); pre/post verification gate (exact page count preserved, savings > 10%, 14-day rollback copy in `rollbackStorageId`). | **Superseded assessment — re-review required** | M7 (PR-H) must reject candidate PDF compression if page count changes or savings < 10%. Original files must be retained for 14 days before purge. |
| 9 | **F4 Melo-to-Melo Transfer Network Feasibility (Phase 2 Gated)** | D-03 §6: Non-goal for Phase 1; gated for Phase 2 (M9) pending counsel review; Ed25519 cryptographic PKI; W3C Verifiable Credentials PARS JSON-LD schema; two-phase commit transfer handshake; absolute privacy boundary (permanent exclusion of family debts, safeguarding records, and internal behavioral notes). | **Superseded assessment — re-review required** | B-09 / M8 must implement ONLY within-group branch transfers. Independent Melo-to-Melo transfer endpoints are strictly barred from Phase 1 build PRs. |
| 10 | **H1 Grade-Band Color Persistence & Laser Print Legibility** | D-04 §4: Builder UI (`/admin/assessments/setup/grading-bands`); immutable standard preset preserved; secondary semantic cue rule; 4.5:1 text contrast floor against white; monochrome `@media print` contract (`#000000` text, borders, no pale grey halftones); consumer inventory across 6 components. | **Superseded assessment — re-review required** | M4 (PR-E) must ensure grade letters/scores remain fully understandable without color. Issued historical report cards must resolve their recorded policy version. |
| 11 | **H4 Atomic Sequential Admission Number Allocator & Token Builder** | D-04 §6: Token builder (`{SCHOOL}`, `{CAMPUS}`, `{LEVEL}`, `{YEAR}`, `{SEQ:n}`); live dynamic preview; zero premature allocation on draft/abandon; atomic allocation inside `studentEnrollment:approveStudent` mutation; manual override with audit reason & counter advance prompt; import reconciliation modal. | **Superseded assessment — re-review required** | M4 (PR-E) must allocate numbers atomically during enrollment approval. Imports must preserve supplied numbers and never advance official counters without explicit confirmation. |
| 12 | **H6 Shared Dirty-State Guard & Draft Recovery (Truth in Connectivity)** | D-04 §7: Invariant I4 (Zero false offline claims); 4 departure triggers (tab close, router transition, navbar click, branch switch); status micro-pill (`saving`, `saved`, `connection_lost`, `save_failed`, `conflict`); `<DraftRecoveryModal />` on form return (no silent overwrite); multi-tab revision conflict resolution. | **Superseded assessment — re-review required** | M5 (PR-F) must display "Connection lost • Recovery pending" when disconnected. Server-backed drafts for high-value flows; never store sensitive documents or secrets in localStorage. |
| 13 | **H7 Shared Mobile Progress Indicator (Scroll vs Validated Step Distinction)** | D-04 §8: Invariant I2 (Strict progress semantics); compact sticky sub-header bar (<768px, 32px height); Mode A (scroll depth orientation) vs. Mode B (validated section completion); Mode B transitions to Complete ONLY when required validation passes; rollout across 6 workflows. | **Superseded assessment — re-review required** | M5 (PR-F) must strictly prevent scrolling from marking a section complete. Neutral progress must use the school accent token; red/amber/green are reserved for genuine validation status. |
| 14 | **F6 Shared School Design Tokens (2-Input Derivation, Semantic Protection)** | D-04 §9: Invariant I5 (Semantic color sovereignty); 2-input configuration (`primaryColor`, `accentColor`); mathematical derivation of 8 contrast-safe CSS custom properties; `AGENTS.md` repository rule banning arbitrary Tailwind brand classes; status colors (success, error, warning, info) and H1 grade colors remain sovereign. | **Superseded assessment — re-review required** | M5 (PR-F) must implement `deriveSchoolTheme` and distribute CSS variables. Do not mass-replace existing code; migrate touched shells incrementally with changed-file audit. |
| 15 | **D-05 Safe Development Refresh Runbook & Pre-Flight Target Checks** | D-05 §§1–2 & 5: Invariant 1 (Production is Read-Only); Invariant 3 (Mandatory pre-refresh dev backup); Phase 2 PowerShell pre-flight script verifying shell `CONVEX_DEPLOYMENT`, `.env.local`, app configs, and CLI status; external backup directory (`$HOME/.melo-ops/backups/`); post-refresh count reconciliation; demo credential safety; Phase 7 emergency dev rollback. | **Superseded assessment — re-review required** | Builders executing M0 rehearsal must follow D-05 verbatim. Any CLI targeting production with write permissions triggers an immediate SEV-1 abort. |
| 16 | **MX-01 through MX-15 Additive Migration Rehearsal Contracts** | D-05 §3 documents the implemented MX-01 identity runner separately: it clamps batches to 1–150, persists one cumulative run cursor/count state, and self-schedules while in progress. The remaining MX contracts are proposed; all retain the staged expand -> compatibility -> backfill -> verify -> enforce -> contract sequence and 6-part retirement gate. | **Superseded assessment — re-review required** | An independent reviewer must confirm the implemented-runner and containment limitations in D-05 §3.1. Legacy fields must remain supported via compatibility readers until all 6 retirement criteria are satisfied. |

---

## 3. Required Evidence Before Release or Follow-up

The session’s M0–M8 commits do not close these gates. Before release, provider activation, or a related follow-up, independent review must confirm the applicable implementation and evidence for: development target/backup/restore procedures; tenant and authorization testing; migration reconciliation; print/browser/accessibility behavior; provider sandbox and contract terms; payment settlement, finance, tax, and legal treatment; AV control selection; and independent-transfer legal/security approval. No item in this section is a claim that the evidence has been obtained.

## 4. Deferred or Externally Gated Items

The following items remain future phases or external dependencies. They do not constitute approval for build, release, or provider activation.

1. **Independent Melo-to-Melo Inter-School Transfer Network (F4 / M9)**:
   - Architecture and cryptographic PKI specifications are complete in D-03 §6.
   - Implementation is deferred to Phase 2 (M9) pending market maturation, verified institutional directory onboarding, and formal cross-school legal agreements.
2. **Live Third-Party Mailbox Provisioning**:
   - Directory integration adapters will be tested against provider sandboxes during B-07.
   - Live synchronization of real `@school.edu.ng` Google Workspace / Microsoft 365 domains is deferred until individual school customer licensing and service accounts are configured.
3. **Secondary Market Legal Opinions**:
   - Detailed statutory registers for the UK, US, South Africa, Kenya, and Ghana are established in D-01 §7.
   - Formal written legal clearance from local counsel in those secondary jurisdictions is deferred until commercial expansion into each specific territory.
4. **Local Infrastructure Deployment of ClamAV Sidecar**:
   - No production AV provider/control is selected. A private scanning integration and its development/test adapter require separate evidence before M7/release.

---

## 5. Superseded Assumptions and Historical Target Controls

The following are historical target controls, not frozen or verified contracts. Their implementation and evidence gates remain subject to independent re-review:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            TEN RESOLVED ARCHITECTURAL CONTRACTS                                  │
├────┬─────────────────────────────┬──────────────────────────────────────────────────────────────┤
│ #  │ Architectural Domain        │ Historical Target Control                                   │
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 1  │ Commercial Pricing Anchor   │ Seeded at ₦1,000 per active student per term + ₦30,000 setup │
│    │                             │ fee as catalog configuration data, not hardcoded constants.  │
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 2  │ Mail Infrastructure         │ Melo operates ZERO mail servers. Institutional email is      │
│    │                             │ managed via REST Directory APIs (Google, Microsoft, Zoho).   │
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 3  │ Node Action PDF Runtime     │ Native binaries (Ghostscript/QPDF) are STRICTLY EXCLUDED.    │
│    │                             │ Pure-JS `pdf-lib` used with 10% savings threshold & rollback.│
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 4  │ Asset Lifecycle & Deletion  │ School Assets Trash is a first-class, navigable workspace    │
│    │                             │ area (`/admin/assets/trash`) with 30-day auto-purge & holds. │
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 5  │ Authorization Denials       │ Direct URL access to restricted modules renders an           │
│    │                             │ authoritative 403 Forbidden screen, NEVER a misleading 404.  │
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 6  │ Production Operations       │ Production is STRICTLY READ-ONLY. Zero production mutations   │
│    │                             │ or live backfills authorized during program execution.       │
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 7  │ Connectivity & Resilience   │ Zero false offline claims. Network severance renders         │
│    │                             │ "Connection lost • Recovery pending" with in-memory hold.    │
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 8  │ Brand Theme Derivation      │ Schools configure strictly 2 base colors (Primary, Accent).  │
│    │                             │ Semantic status colors (error, success) are sovereign.       │
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 9  │ Admission Number Allocation │ Numbers are allocated atomically inside enrollment approval  │
│    │                             │ transactions. Drafts/abandoned forms consume zero numbers.   │
├────┼─────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 10 │ Financial Immutability      │ Issued invoices snapshot bank details at issuance. Modifying │
│    │                             │ bank accounts affects drafts/new invoices only.              │
└────┴─────────────────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 6. Remaining Provider, Legal, and Runtime Gates

Before features launch into commercial production or expand beyond internal staging environments, the following external gates must be satisfied:

1. **Nigerian Legal Counsel Formal Opinion**:
   - External data protection counsel must review D-01 and sign off on questions Q1 through Q7 (minor onboarding consent, NDPC registration threshold, CAMA invoice retention, and cross-border adequacy).
2. **Paystack Production Split Merchant Verification**:
   - Execution of Paystack merchant underwriting for Melo platform split settlement (Mode B), including AML/CFT compliance verification.
3. **Google Workspace & Microsoft Entra Partner Registration**:
   - Verification of Melo multi-tenant OAuth applications in Google Cloud Console and Microsoft Entra ID for Domain-Wide Delegation.
4. **Private AV Control Selection and Evidence**:
   - Select and prove a private scanner/control, including byte path, access gate, retention, and failure behavior; no AWS or GuardDuty integration is implied.
5. **Enterprise AI API Zero Data Retention (ZDR) Execution**:
   - Verification that production API agreements with Anthropic, OpenAI, or Google Vertex contractually enforce zero data logging and zero model training on customer prompts.

---

## 7. Current Lifecycle and Next Review

Design remediation is under independent milestone re-review. The session records commits for M0–M8, but neither their existence nor this documentation correction implies release, provider activation, legal approval, or a new build authorization. A reviewer must assess the corrected D-01–D-05 bundle and the outstanding legal, provider, runtime, browser/accessibility, migration/restore, security, and operational evidence gates before any such decision.
