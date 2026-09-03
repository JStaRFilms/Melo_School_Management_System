# Task D03: Provider, runtime, and settlement spikes (H5/H9/F7/F4)

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-design` workflow before starting this task.
### Prime Agent Context
Prime the task with `docs/tasks/orchestrator-sessions/orch-20260903-143249/product-decisions.md` (H5, H9, F7, F4), `task-packets.md` (D-03), and existing billing/assets documents.
### Optional Skill / Context Overlays
| Skill | Why |
| --- | --- |
| `security-audit` | Provider isolation, token management, malware scanning |
| `convex` | Runtime boundaries, action vs query/mutation, Node environment |

## Objective
Replace uncertain provider, runtime, accounting, and legal assumptions with reversible decisions.

## Scope
- Paystack split vs subaccount vs direct merchant; recurring mandates; settlement/refund ledger
- Google/Microsoft/Zoho email integration via DNS/OAuth; mailbox states (login vs external vs provisioned); no mail server operated by Melo
- Antivirus & quarantine architecture for assets
- PDF manipulation in Convex Node runtime; pdf-lib vs native binaries exclusion
- Independent transfer cryptographic feasibility (F4)

## Context
Parent session: orch-20260903-143249  
Task title: Provider, runtime, and settlement spikes  
Author: Integration Architect & Systems Reliability Engineer  

## Definition Of Done
- Melo operates no mail server explicit
- Direct merchant distinct from split mode; settlement timing realistic
- Native binaries excluded from Convex Node runtime
- Quarantine/scan gates before asset access
- Costs, limits, retry models, and irreversible decision gate lists documented

## Expected Artifacts
- docs/features/D03_ProviderRuntimeAndSettlementSpikes.md

## Dependencies
- D-01 compliance constraints (Complete)

## Constraints
- Read-only/sandbox experiments only; zero live secrets or financial mutations

## Completion Status
- **Status**: Completed (2026-09-03)
- **Artifact Written**: `docs/features/D03_ProviderRuntimeAndSettlementSpikes.md` (Version 1.0.0)
- **Verification**: Complete authoritative technical specification detailing:
  1. Five non-negotiable operational constraints (Zero mail server; direct merchant vs split separation; no universal next-day promises; native C/C++ binary exclusion; quarantine-first asset gate).
  2. Spike 1 (Paystack): Mode A (Direct School Merchant) vs Mode B (Split/Subaccount) architectures; tokenized recurring mandates under CBN regulations; zero-PAN storage boundary; NIBSS interbank clearing realities and settlement schedule matrix; double-entry internal ledger schema (`ledgerAccounts`, `ledgerJournalEntries`, `ledgerLines`); Nigerian VAT (7.5%) and WHT treatment.
  3. Spike 2 (Institutional Email): Google Workspace, Microsoft 365, and Zoho Directory API integrations; three-state mailbox capability model (`login_only`, `external_verified`, `provider_provisioned`); DNS TXT challenge verification; dry-run mapping proposal pattern; 4-stage collision resolution; minor naming privacy safeguards and directory suppression; user departure protocol and permanent email re-allocation freeze; asynchronous outbox pattern for failure isolation.
  4. Spike 3 (Antivirus & Quarantine): Threat model; ClamAV vs AWS GuardDuty S3 Malware Protection vs Multi-engine API evaluation (rejection of public VirusTotal for NDPA minor privacy compliance); quarantine state machine (`uploading` -> `quarantined` -> `scanning` -> `clean` / `infected`); 14-day forensic quarantine hold; server-side magic-byte inspection (`file-type`).
  5. Spike 4 (PDF Compression in Convex Node Runtime): Convex Node action environment constraints; strict exclusion of Ghostscript, QPDF, Poppler, and native C/C++ toolkits; pure-JS `pdf-lib` real-world capabilities and bitmap limitations (<5% savings on scanned docs); safe optimization candidate rules; pre/post verification gate (page count preservation, 10% minimum savings, 14-day rollback preservation).
  6. Spike 5 (Melo-to-Melo Inter-School Transfer Feasibility - F4): Phase 2 architecture; asymmetric Ed25519 PKI signing; Portable Academic Record Schema (PARS) aligned with W3C Verifiable Credentials; two-phase commit protocol; strict privacy boundary permanently barring financial debt and safeguarding notes; Phase 1 Build non-goal and hard legal gate.
  7. Irreversible decision gates and vendor due-diligence checklist covering Paystack, Google, Microsoft, Zoho, and AWS GuardDuty.
