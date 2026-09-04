# Expansion Implementation Program

**Status:** Genesis synthesis is approved; design documents were corrected and require independent milestone re-review. Their unresolved legal/provider/runtime/browser gates remain release gates, not completed evidence.
**Authority:** `product-decisions.md` is normative. Direct interview decisions override earlier feature documents; in particular, this program supersedes conflicting parts of the earlier School Assets proposal (no AV deferral, no original-immediate-delete, no hard-coded quotas).
**Start gate:** PR #21 has merged; create a fresh branch from updated `master`. No product build starts before approval of this program.

## Executive summary

Melo will evolve from a school-scoped membership and broad-admin model into an explicitly group-aware platform without weakening the existing branch boundary. The critical path is: quality baseline → canonical person/membership and group authorization → capability RBAC plus append-only audit → group linking/switching → immutable policy/document foundations → shared UI resilience/theme primitives → bounded product verticals → commercial/usage/assets → transfer foundations. Each stage is deployable only after additive schema expansion, development rehearsal, invariant verification, and a rollback/forward-fix decision.

The program deliberately does **not** merge branch records, make production writable, promise offline capability, deploy a mail server, implement independent Melo-to-Melo transfer, hard-code commercial limits/prices, or use unproven native PDF/AV runtime dependencies. The approved commercial anchor is a configurable **Core/Basic ₦1,000 per active student per term plus ₦30,000 setup**; it is seeded/versioned catalog data rather than feature code constants.

## Architecture evidence and target boundaries

| Evidence | Consequence in this program |
|---|---|
| `schools` has `theme.primaryColor/accentColor`; `WorkspaceNavbar` derives a few CSS variables; report cards use raw values. | F6 introduces a typed derived-token contract, preserving the two configured bases and incrementally moving consumers. H1 remains a separate grade-domain palette. |
| `users` is one school row per identity, with optional `authTokenIdentifier`; most academic auth still resolves `identity.subject` and broad admin. | F2/H2 first introduce canonical people and branch memberships; public function authorization derives identity server-side from `tokenIdentifier`, then active membership, never a caller-supplied user/school ID. |
| `gradingBands` is school-scoped and `saveGradingBands` deactivates/reinserts active rows. | H1 uses versioned grade-band policies/colors and render snapshots; it does not duplicate the standard preset or recolor historical issued records. |
| `importWorkspaces` has staged rows and local prefix/sequence counters; commit is batched/idempotent but uses an import-local number policy. | H4 replaces this with a shared admission-policy/allocation contract; F3 is a reviewed proposal pipeline, never an AI direct-write path. |
| Finance has school billing settings, per-school Paystack credentials, fee/invoice snapshots, and gateway records. | H3 adds bank-instruction snapshots; F7 adds entirely separate SaaS, usage/top-up, and collection/settlement ledgers. Existing school Paystack routing stays a collection concern. |
| Existing asset proposal assumes fixed 5 GiB, deferred AV, and immediate original deletion after pdf-lib compression. | H8/H9 require entitlement-derived limits, AV/quarantine before wider production access, active/trash/temp accounting, temporary original rollback, and a runtime spike before compression architecture is committed. |

### Non-negotiable invariants

1. **Branch isolation first.** Operational records retain branch `schoolId`; all lookup/mutation/export/storage authorization derives active membership and scopes indexes by the authorized branch. A group ID never grants branch access by itself.
2. **Delegation ceiling.** Effective permissions are `(template union + direct grants) − direct restrictions`; only the proprietor may grant/revoke permission management by default. A manager cannot edit self, proprietor, platform admins, or higher authority and may delegate only a proprietor-defined ceiling.
3. **Backend is the security boundary.** Navigation hiding is convenience only. Every query, mutation, action, HTTP/export/storage operation enforces capability, scope, tenant, lifecycle, and feature/entitlement checks.
4. **Append-only truth.** Audit, lifecycle, usage, financial, issued-document, ownership, and transfer history corrections append a correction/reversal event; they do not rewrite the original truth. Audit stores redacted summaries only.
5. **Snapshot immutability.** Issued invoices/receipts/statements, certified academic documents, rate-card contracts, and rendered grade/bank instructions retain policy/version/safe render inputs. Configuration affects drafts/new issuance only.
6. **Deterministic-before-AI.** AI output is a typed, confidence-scored proposal. Deterministic schema, tenant, relationship, permission, uniqueness, and admission-number validation runs before a human-authorized, idempotent commit.
7. **No false resilience claims.** H6 is server-backed recovery with explicitly bounded local recovery, not offline mode. UI never claims persistence while disconnected and offers recovery after reauthentication.
8. **Meter before cost.** Costly AI/OCR/document work reserves worst-case quota before provider execution, settles actual use exactly once by idempotency key, and releases unused reservation. Provider/Melo failures do not consume customer allowance.
9. **Asset safety.** Asset bytes have one authoritative owner/state, quarantine and server validation precede access, Trash is visible/navigable, purge respects hold/retention, and compression only replaces a validated candidate with retained rollback original.

## Target model and contracts

### Core identity, tenancy, authority, audit

| Domain | Additive records / key indexes | Contract |
|---|---|---|
| Identity/membership (F2) | `persons` keyed by canonical `authTokenIdentifier`; `branchMemberships(personId, schoolId)` unique; `schoolGroups`; `schoolGroupBranches(groupId, schoolId)` unique; `activeMembership` remains session/UI state, not authorization truth. | Resolve identity → memberships → selected branch only if it is a membership. Maintain temporary legacy `users` projection/bridge until every app and background producer is migrated and verified. |
| RBAC (H2) | `permissionCatalog`; `roleTemplates(group/branch scope)`; `roleTemplateCapabilities`; `membershipRoleAssignments`; `membershipDirectGrants/restrictions`; `delegationCeilings`; immutable `authorityChanges`. Index by membership/scope/capability. | `authorize(ctx, capability, resourceScope)` returns active membership and effective scoped permissions. Capability catalog includes sensitive actions as separate keys. Permission-preview is read-only and uses the same evaluator. |
| Audit (F1) | `auditEvents` with event ID, actor kind/id, group/branch context, module/action, target type/id, outcome, redacted summary, correlation/idempotency ID, retention class; `auditAlerts`/delivery state. Indexed by context/date/module/action/actor/target. | Producers call an internal typed writer in the same mutation where feasible; external action results settle through internal mutation. Append-only application API; only controlled retention process may purge eligible ordinary events. Query/export applies RBAC and redaction before data leaves backend. |
| Inheritance | `groupSettingsVersions`, `branchSettingOverrides`, `effectiveSettingVersion` projections where needed. | Resolve group default → explicit branch override → safe product fallback. Snapshot consumers store effective version/value. No implicit sharing solely because branches share a group. |

### Policy, document, workflow, commercial domains

| Slice | Additive records / behavior | Public/internal API boundary |
|---|---|---|
| H1/H4/H3 | Grade policy versions/bands with optional semantic color and derived print metadata; admission number policies/sequences/reservations/allocations; bank accounts + document payment-instruction snapshots. | Public admin commands express intent, derive actor/context server-side; internal allocation/snapshot helpers only. Number allocation and enrollment approval are one transaction. |
| H5 | Domain, namespace, address policy/version, address assignment/alias, provider connection, provisioning operation/reconciliation records. | Providers run only in internal actions; public UI invokes reviewed proposal/approval commands. Address state explicitly distinguishes login-only, external mailbox, provider-managed. |
| H6/H7/F6 | Server drafts/revisions/temporary-file references and expiration queue; shared client dirty-state registry; typed `SchoolThemeBase`, derived `SchoolThemeTokens`, CSS variable map. | Forms register metadata; server mutations verify creator/membership/revision. UI primitives are package-shared, not per-route implementations. |
| H8/F7/H9 | Entitlement/version and contract/rate-card/invoice ledgers; quota reservations/settlements; storage buckets/accounting; asset/version/hold/scan/compression/purge job records. | Provider/payment/AV/PDF calls are internal actions; all state settlement is internal mutation. Read models expose only safe balances/status, never prompts, file contents, secrets, bank numbers, or raw provider payloads. |
| F3/F4 | Import analysis/proposal, mapping/version, review decision, commit batch/reconciliation records; later `externalTransferCases`, record-selection grants, source release/destination acceptance and signed evidence. | Import commit is human-authorized mutation after deterministic validation. F4 is design-gated: no independent-school exchange endpoints in this release program. |

### Authorization and state flow

```text
JWT tokenIdentifier
  -> canonical person (legacy bridge during migration)
  -> explicit branch membership(s) -> selected active branch
  -> effective permissions + delegation ceiling
  -> capability/scope check in every backend entry point
  -> domain invariant + tenant/resource ownership check
  -> transactional command + append-only audit/snapshot/outbox

Group default -> allowed branch override -> effective version
                                    \-> issued/rendered record snapshot
```

## Dependency graph and design stage

```text
Q0 quality + safe dev refresh
  -> D1 legal/compliance + provider/runtime spikes
  -> B1 identity/membership migration -> B2 group link/switch
       -> B3 RBAC -> B4 audit (cross-cutting producer adoption)
       -> B5 inheritance/theme
  B3+B4 -> V1 bank accounts / V2 admission numbering / V3 graded policy
  B1+B3+B4+D1 -> V4 institutional identity/email
  B1+B3+B4+V2 -> V5 reviewed AI import
  B5 -> V6 drafts/progress/theme consumer rollout
  B3+B4+D1 -> V7 commercial catalog/contracts -> V8 usage meter -> V9 asset library
  B1+B2+B3+B4+student lifecycle -> L1 within-group transfer foundation
  L1+D1+legal approval -> L2 independent Melo-to-Melo design (later gated phase)
```

### Mandatory Design packets before their Build packets

- **D-01:** compliance engineering dossier, jurisdiction/source matrix, data map, controls traceability (F5).
- **D-02:** canonical identity, group/branch membership, RBAC capability taxonomy/delegation proof, audit/redaction taxonomy (F2/H2/F1).
- **D-03:** provider/runtime/legal spikes: Paystack split/recurring mandates, email providers/DNS/delegated authorization, AV/quarantine, pdf-lib/Convex runtime, transfer legal portability (H5/H9/F4/F7).
- **D-04:** cross-app UX flows for branch switching, permission denial, bank/account settings, policy builders, drafts/progress, theme settings, asset Archive/Trash, usage and commercial surfaces (H1–H9/F6/F7).
- **D-05:** migration rehearsal design and production-read-only snapshot-to-development procedure (all data-contract changes).

## Build stages, PR boundaries, reviews, and release gates

| Milestone / PR boundary | Scope and dependencies | Review and release gate |
|---|---|---|
| M0 / PR-A **Baseline** | After PR #21 merge: repair teacher conditional-hook lint blockers; profile and root-cause parallel-only `packages/convex/foundationContracts.test.ts` timeout by comparing focused vs parallel fixture/module/setup behavior. Do not raise timeout absent evidence; a focused increase is permitted only with documented legitimate work after simplification. Establish safe dev refresh prerequisite. | Changed-package lint/test/typecheck; parallel reproduction/root-cause report; no production mutation; clean diff. |
| M1 / PR-B **Identity and tenancy kernel** | D-01/D-02/D-05 corrected and independently re-reviewed; applicable gates accepted. Expand canonical persons, memberships, groups, links, indexes, compatibility reads and migration runner; read-only production snapshot → backed-up dev refresh rehearsal; backfill and verify. | Security review: cross-branch negative matrix, legacy/new identity login parity, group link count/referential integrity, rollback plan. |
| M2 / PR-C **RBAC and audit kernel** | M1. Capability catalog/templates/evaluator/delegation ceiling; permission-denied state and navigation projection; append-only audit writer/read/export/alerts foundation. Migrate existing admins to full baseline. | Privilege-escalation/lockout test matrix; endpoint inventory enforcement evidence; audit redaction and immutability review. |
| M3 / PR-D **Group operation and inheritance** | M1/M2. Branch switcher with unsaved-state integration seam, group defaults/branch overrides, group audit scope and safe aggregate read models. Link Olive branches without merging/rekeying records. | Branch switch/unsaved guard; aggregate excludes unauthorized branches; no record `schoolId` rewrite; migration reconciliation. |
| M4 / PR-E **Academic and finance policy verticals** | M2/M3. H1 grade colors/versioned rendering; H4 counter policy/allocation/import handoff; H3 bank accounts/instruction snapshot and leadership alerts. | Print/grayscale/accessibility; concurrent allocation/import replay; issued invoice immutability; masked bank audit/export. |
| M5 / PR-F **Shared experience and branding** | M2/M3, D-04. F6 token system and touched-shell rollout/hard-coded-color audit; H6 draft service/navigation guard; H7 progress rollout. | Typed token/contrast/print checks; dirty/reload/branch switch/conflict/recovery tests; mobile a11y/reduced-motion review; no offline claim. |
| M6 / PR-G **Email and import pipeline** | M1/M2/M4, D-01/D-03. H5 policy/namespace/provider dry-run/reconciliation; F3 structured AI proposals and deterministic reviewed commits. | Provider sandbox/spike signoff; collision/alias/transfer behavior; AI never commits; batch idempotency and reconciliation evidence. |
| M7 / PR-H **Commercial, metering, assets** | M2/M3, D-01/D-03. F7 catalog/contracts and separate ledgers, H8 reservations/settlements/storage accounting, H9 private asset library/visible Trash/retention/compression. | Pricing seed/version review; retry/no-double-charge proof; storage accounting reconciliation; AV/quarantine and PDF candidate rollback tests; provider/runtime spike decision. |
| M8 / PR-I **Within-group transfer foundations** | M1–M4 and lifecycle compatibility. Audited transfer case preserves source history and creates destination enrollment context. | Cross-branch privacy tests; source/destination immutable history; no in-place `schoolId` change. |
| M9 / later gated initiative | F4 Melo-to-Melo network only after M8 plus D-01/D-03 and qualified legal approval. | Separate architecture approval for consent, verified institution identity, portable-record selection, cryptographic evidence, disputes/expiry/correction. |

PRs are milestone-sized; task packets inside one milestone may be independently implemented but land behind one integration review, not one PR per tiny task. No milestone merges with a failing security/migration gate.

## Schema/API/migration slices

All slices use **expand → compatibility read/write → bounded idempotent backfill → invariant report → enforcement → later contract**. Add indexes before indexed queries; batch migrations with durable progress/cursor and idempotency; never use a monolithic rewrite.

1. **Canonical identity / groups / memberships:** optional canonical links and bridge projections; unique identity-membership invariants; backfill from current users; retain `authId` fallback only until parity is proven. Existing branch data remains intact and branch-owned.
2. **RBAC/audit:** additive capability and event tables; default role templates; full-access migration for existing admins; route/function inventory progressively enforces. Audit events are immutable and redacted from inception.
3. **Settings/policies:** group defaults and branch override records alongside current school settings; effective policy version snapshots added to new issued documents only, followed by a historical rendering decision/rehearsal for H1.
4. **Finance/admission:** bank account rows archive rather than delete; issue-time payment-instruction snapshot. Admission format versions + sequence rows are expanded alongside import counters, imported data is reconciled, then all approval/import paths use one allocator.
5. **Mail/import/drafts:** proposals/operations/drafts start optional and creator-private; temporary raw files are private and expiring. No sensitive field is placed in localStorage.
6. **Commercial/usage/assets:** catalog/contract/invoice and quota/asset records are separate. Existing storage references are inventoried before any counter initialization; assets begin in quarantine and use explicit storage state transitions.

## Security, privacy, and operations

- Consult `tmp/demo_school_credentials.md` only for authorized verification and never copy values into artifacts, logs, screenshots, commits, fixtures, or prompts.
- Production access is read-only. Before any development replacement from a production snapshot, back up development with established Convex tooling, verify every app/function target is development, record deployment identifiers/checksums/counts without PII, and do not run a production mutation/deploy. Exports, secrets, PII, and sensitive screenshots stay outside git.
- Secrets, raw bank numbers, passwords, tokens, raw prompts/documents, and raw gateway payloads never appear in audit/read models. Encrypt provider secrets; use internal-only access; log masked/fingerprinted safe summaries.
- Actions cannot use `ctx.db`; actions call small internal query/mutation contracts. Every Convex function has validators; public versus internal registration is intentional. Bounded/indexed/paginated queries are required.
- Sensitive features cannot launch beyond controlled administrators until F5 controls and applicable spikes are accepted. Legal document conclusions require qualified market-specific review before launch.

## Rollout, rollback, observability

**Rollout:** deploy additive schema/code to development; execute rehearsal against restored development snapshot; compare counts/checksums/invariants; enable per tenant/group behind entitlement/feature gates; canary one authorized test group; observe; then widen. User-visible migrations include clear state and retry/reconciliation paths.

**Rollback:** before enforcement, disable feature gate and use compatibility readers; stop job scheduling; preserve append-only evidence and issued snapshots. Never roll back by deleting audit/ledger/asset history. For bad transformed data, use a forward corrective event/migration. Restore development only from its verified backup. For storage/compression, retain the original until candidate validation and explicit cleanup policy; failed purge reports failure and keeps charged bytes.

**Observability:** migration progress/failure/dead-letter counts; identity parity mismatches; authorization denials and ceiling rejections; audit writer failures; sequence contention/collisions; provider operation/reconciliation status; quota reservation/settlement/release imbalance; asset state/scan/compression/purge metrics; document snapshot render failures. Metrics contain IDs/counts/status, not content.

## Exact feature coverage and non-goals

| Decision area | Delivery milestone(s) |
|---|---|
| H1 configurable grade-band colors | D-04, M4 |
| H2 granular RBAC/delegation | D-02, M2, enforcement adoption across M3–M8 |
| H3 bank accounts/document snapshots | D-04, M4 |
| H4 sequential admission numbers | D-04/D-05, M4/M6 |
| H5 institutional email | D-01/D-03/D-04, M6 |
| H6 draft/unsaved protection | D-04, M5 |
| H7 mobile progress | D-04, M5 |
| H8 AI/OCR/storage metering | D-01/D-03, M7 |
| H9 assets/PDF/Trash | D-03/D-04, M7 |
| F1 audit | D-02, M2 then all producer milestones |
| F2 groups/multi-branch | D-02/D-05, M1/M3/M8 |
| F3 AI import | D-01/D-04, M6 |
| F4 Melo transfers | D-01/D-03, M9 later gated |
| F5 legal/privacy program | D-01, gate for M6–M9 sensitive launch |
| F6 design tokens | D-04, M5 |
| F7 monetization/settlement | D-03/D-04, M7 |

**Non-goals for this program release:** full offline authentication/sync; public asset links; Melo-operated email; arbitrary model selection; opaque Melo money holding; blanket permanent deletion; a perfect gapless admission sequence; native-binary PDF processing; implementation of independent-school transfers.

## Approval and build handoff

**Builder reads first:** `product-decisions.md`, this program, `migration-verification-matrix.md`, `task-packets.md`, then the relevant source evidence named in each packet. Start only when user approves this synthesis, PR #21 is merged, fresh branch is confirmed, and M0 baseline conditions pass.

**Validation gates remaining:** legal counsel review for market conclusions; provider/runtime spike results; pricing/catalog owner review; issuer/history decision for pre-existing grade renders; operational choice for Paystack split/recurring mandate; AV provider selection; actual migration rehearsal metrics. These are validation gates, not missing user decisions.
