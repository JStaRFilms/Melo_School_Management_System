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

## Delivery Record

- **Historical artifact:** The initial D-task document was delivered on 2026-09-03.
- **Current authority:** The corrected feature document and master plan govern review status.
- **Evidence boundary:** This delivery record does not establish legal, provider, runtime, browser/accessibility, migration/restore, security, or release validation.

## Correction status (2026-09-03)

This completion record is superseded for review purposes by the corrected D-01–D-05 feature bundle. The artifact remains delivered, but independent milestone re-review is pending. It does not evidence legal approval, provider/runtime validation, browser/accessibility validation, migration/restore proof, or release authorization.
