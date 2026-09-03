# Task D05: Migration rehearsal and data refresh runbook (all contracts)

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-design` workflow before starting this task.
### Prime Agent Context
Prime the task with `docs/tasks/orchestrator-sessions/orch-20260903-143249/migration-verification-matrix.md`, `product-decisions.md`, `task-packets.md` (D-05), `packages/convex/functions/academic/branchSplitV2.ts`, and Convex guidelines.
### Optional Skill / Context Overlays
| Skill | Why |
| --- | --- |
| `convex` | Migration patterns, batching, cursor handling |
| `security-audit` | Non-destructive operator procedures, credential safety |

## Objective
Turn migration matrix controls into an operator-ready, non-destructive rehearsal runbook.

## Scope
- Read-only production snapshot export protocol using established Convex tooling
- Development backup and verification before replacement
- Non-secret manifest & count reconciliation
- Target verification for apps, scripts, and Convex environment
- MX-01 through MX-15 sequencing, cursors, idempotency, and progress tracking
- Rollback and forward-fix decision trees
- Rehearsal drill record template

## Context
Parent session: orch-20260903-143249
Task title: Migration rehearsal and data refresh runbook
Author: Data Migration Architect & Security Systems Operator

## Definition Of Done
- Contains zero production mutation commands or secrets
- Requires verified development backup before replacement
- Covers expand, backfill, verify, enforce, contract stages
- Clear stop conditions and rollback protocol

## Expected Artifacts
- docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md

## Dependencies
- D-02 architecture, migration verification matrix

## Constraints
- Production remains strictly read-only
- No PII, secrets, or snapshots committed to git

## Completion Status
- **Status**: Completed (2026-09-03)
- **Artifact Written**: [D05_MigrationRehearsalAndDataRefreshRunbook.md](file:///c:/CreativeOS/01_Projects/Code/Personal_Stuff/2026-03-14_School_Management_System/docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md) (Version 1.0.0, 1000 lines)
- **Verification Summary**:
  - **Operational Safety Charter & Governing Policy**: Formalized 4 non-negotiable safety invariants: (1) Production is strictly read-only with zero mutation commands, ad-hoc queries, or credentials committed; (2) Development database refresh is performed exclusively for migration rehearsal and validation; (3) Verified, restorable development backup is mandatory prior to any development database replacement; (4) Absolute exclusion of database snapshots, exports, PII, and credentials from git repositories, requiring secure external staging (`~/.melo-ops/backups/`).
  - **Safe Development Refresh Runbook (7 Operational Phases)**:
    - *Phase 1 (Authorization)*: Verification of PR #21 merge baseline, fresh branch, authorized change ticket, and off-repo storage setup.
    - *Phase 2 (Target Verification)*: Detailed, scripted pre-flight checks (PowerShell & Bash) validating shell `CONVEX_DEPLOYMENT`, root `.env.local`, all 7 application configurations (`apps/admin`, `teacher`, `portal`, `platform`, `apply`, `sites`, `www`), and active Convex CLI status; immediate abort if any production identifier is matched.
    - *Phase 3 (Dev Backup & Verification)*: Automated export of current development database to timestamped external archive, SHA-256 checksum calculation, size assertion (>10KB), zip structure validation, and manifest logging.
    - *Phase 4 (Production Read-Only Snapshot Extraction)*: Read-only export execution via scoped deploy key, external staging outside workspace, checksumming, and strict logging redaction.
    - *Phase 5 (Development Ingestion Rehearsal)*: Second pre-flight target verification followed by `npx convex import --replace` into confirmed development target.
    - *Phase 6 (Post-Refresh Reconciliation & Integrity Audit)*: Table count reconciliation across `schools`, `users`, `students`, `classes`, `studentInvoices`, `feePlans`, and `academicSessions`; Convex `_storage` asset count reconciliation; automated tenant isolation referential scan; localized demo school authentication smoke test using `tmp/demo_school_credentials.md` without credential logging.
    - *Phase 7 (Abort & Rollback Protocol)*: Immediate abort triggers and scripted restoration of Phase 3 pre-refresh development backup; production verified zero-touch.
  - **Universal Batch Runner Contract**: Defined architecture for durable cursor-based pagination, bounded batch sizes (100–250 documents), idempotency key checks, zero table locking under Convex OCC, automated retry with scheduling (`ctx.scheduler.runAfter(0, ...)`), and durable execution tracking schema (`migrationRuns`).
  - **Complete Specifications for MX-01 through MX-15**:
    - *MX-01 (Canonical Identity Bridge)*: `persons` schema expansion, dual-read `resolveActiveIdentity`, cursor backfill from `users`, 100% actor parity verification, feature-flag fallback.
    - *MX-02 (Explicit Branch Memberships & Groups)*: `schoolGroups`, `schoolGroupBranches`, `branchMemberships`, non-rekeying of tenant records, membership parity verification.
    - *MX-03 (RBAC Capabilities & Admin Baseline)*: 47 typed capabilities, 7 base templates, delegation ceilings, non-lockout baseline migration, negative security verification (`SEC-NEG-01` to `SEC-NEG-05`).
    - *MX-04 (Append-Only Audit Events & Redaction)*: Pre-write masking for bank accounts (`***-****-1234`) and tokens, 3-tier alerting architecture, 7-year/permanent retention.
    - *MX-05 (Theming & Inheritance)*: Typed tokens, mathematical contrast derivation (WCAG AA), grayscale readability verification.
    - *MX-06 (Grade Band Policy)*: Semantic indicator palette, versioned policy snapshots for historical report card integrity.
    - *MX-07 (Bank Accounts & Snapshots)*: Multi-account management, immutable invoice payment instruction snapshots, masked audit logs, Tier 1 alerts.
    - *MX-08 (Admission Number Policy & Allocator)*: Atomic sequence allocation within enrollment transactions, audit-governed manual override.
    - *MX-09 (Institutional Email Operations)*: Domain DNS verification, three-state mailbox model (`login_only`, `external_verified`, `provider_provisioned`), departure deactivation without loss of attribution.
    - *MX-10 (Form Drafts & Recovery Lifecycle)*: Authenticated server-side drafts for high-value workflows, revision conflict detection, automated 24h/30d temporary cleanup.
    - *MX-11 (AI Import Review Pipeline)*: Staged proposal review, deterministic pre-commit validation, zero write capabilities for AI models.
    - *MX-12 (Commercial Catalog & Ledgers)*: Double-entry accounting (`ledgerAccounts`, `ledgerJournalEntries`, `ledgerLines`), SaaS vs school collection separation, immutable price snapshots.
    - *MX-13 (Quota Metering & Storage Accounting)*: Reservation, settlement, and release lifecycle; active vs trash vs temp byte separation; idempotency enforcement.
    - *MX-14 (Asset Library, Quarantine, Trash & Compression)*: Private library, upload quarantine state machine, visible 30-day Trash, pure-JS PDF candidate validation (>10% savings, page preservation).
    - *MX-15 (Within-Group Transfers)*: State machine for intra-group movement, zero in-place `schoolId` rewrite, immutable source history retention.
    - *Contract Retirement Gate*: 6-factor retirement criteria (100% migration, 0 fallback reads over 14-30 day observation window, decoupled frontend apps, tested rollback, dual sign-off, dedicated PR).
  - **4 Operator Manifest & Rehearsal Evidence Templates**:
    1. Template 1: Environment Target Proof Manifest
    2. Template 2: Table & Storage Count Reconciliation Manifest
    3. Template 3: Migration Execution Drill Log
    4. Template 4: Rollback Drill Record
  - **Operator Stop Conditions & Incident Decision Tree**:
    - Severity matrix categorizing SEV-1 (Target Ambiguity, Referential Mismatch >0.1%), SEV-2 (Auth Failure, Lock Contention/Timeout), and SEV-3 (Missing Index, Storage Discrepancy).
    - Mermaid incident escalation flowchart.
    - Step-by-step anomaly resolution protocols for all 6 failure modes.
