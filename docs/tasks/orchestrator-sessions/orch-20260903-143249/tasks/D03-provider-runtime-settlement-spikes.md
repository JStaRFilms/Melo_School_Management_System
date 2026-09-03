# Task D-03: Provider, Runtime, and Settlement Spikes (H5/H9/F7/F4)

## Objective
Replace uncertain provider, runtime, accounting, and legal assumptions with reversible, evidence-backed engineering decisions before committing to irreversible architecture.

## Scope
- Paystack split accounts vs subaccounts vs direct school merchant mode: recurring mandates, authorization codes, fee schedules, refund handling, settlement timing, tax/withholding, dispute ledgers, and reconciliation.
- Institutional email provider integration: Google Workspace, Microsoft 365, and Zoho Mail via DNS TXT verification, OAuth/service account delegated authorization, directory sync, mailbox lifecycle (login-only vs external vs provisioned), suspension/alias rules, failure isolation, and idempotency. Melo operates no mail server.
- Antivirus & quarantine architectures for school assets: cloud-native scanning vs streaming ICAP/ClamAV/VirusTotal vs serverless evaluation; quarantine workflows and data-handling safety.
- PDF manipulation in Convex Node runtime: validation of `pdf-lib` in Convex Node environment, font embedding, structural reserialization vs true image compression, memory/execution limits, and strict exclusion of unproven native C/C++ binaries.
- Independent Melo-to-Melo transfer feasibility (F4): portable record schema, cryptographic signing/attribution (asymmetric ed25519/ECDSA), tamper evidence, source release/destination acceptance protocol, dispute/expiry/revocation flows.

## Definition of Done
- Explicitly documents that Melo operates no mail server.
- Separates direct merchant from split mode and eliminates universal next-day settlement promises.
- Rejects unproven native binaries in Convex runtime without sandbox proof.
- Details quarantine and scan gates before assets expand beyond controlled admins.
- Costs, limits, retry models, and irreversible decision gate lists documented.

## Expected Artifacts
- `docs/features/D03_ProviderRuntimeAndSettlementSpikes.md`
- Task completion record

## Dependencies
- D-01 compliance constraints

## Constraints
- Read-only / sandbox experiments only; no live secrets, live payment triggers, or external production calls.
