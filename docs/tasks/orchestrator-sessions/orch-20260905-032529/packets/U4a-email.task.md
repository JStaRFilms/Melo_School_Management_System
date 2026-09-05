# U4a — Institutional email policy and review

## Objective / scope
Expose domain/address proposal, human approval and lifecycle with honest mailbox states. Provider provisioning/verification activation remains gated.

## Context / dependencies
U1d/U3a/U3b. Read H5, D01/D03 gates and institutionalEmail.ts. Available APIs: registerEmailDomain/getSchoolEmailDomains, proposeEmailAddresses, assignInstitutionalMailbox, getInstitutionalMailboxes, suspendOrArchiveMailbox. verifyDomain and applyProviderMailboxResult are internal evidence transitions, not client controls. Current capabilities staff.onboard/list.view/account.suspend need scoped registrar/staff policy checks.

## Ownership
InstitutionalEmail module, proposed `/admin/settings/email-domains`, student/TeacherCreationForm links after U3b; focused email/import tests. Schema/capability changes serialized. Do not modify auth identity from proposed address.

## Instructions
1. Build separate staff/student template settings, default firstname.lastname, domain/branch/shared-namespace context and privacy/minor warning. Domain control/provider licensing/delegation unavailable state is explicit.
2. Show deterministic proposals, collision alternatives/confidence/reason where supported, syntax/reserved-name/uniqueness validation and manual local-part review. Server revalidates at approval across all branches sharing a domain.
3. Display login-only/no inbox, externally evidenced mailbox and provider-provisioned mailbox distinctly. No send/provision/verify button may fabricate provider/DNS results. Preserve canonical identity and membership on provider failure/name change; approved alias/lifecycle metadata must not silently reassign old addresses.
4. Scope approval to appropriate staff/student administrative authority and add immutable safe audit. U3a protects policy/review state; no provider credentials in drafts/UI/logs.

## Definition of done / verification
Extend emailAndAiImport tests for cross-branch namespace, manual/reserved collisions, policy scope, login-only honesty, alias/name/lifecycle and retry/reconciliation state. UI has loading/empty/denied/duplicate/provider unavailable and confirmation states; tests/typecheck recorded. No live providers invoked.

## Artifacts
`results/U4a.md` API/state/permission contract, tests/self-review, privacy/provider gates and U7 screenshots; update matrix and hand U4b address proposal seam (AI never provisions). No production, migration, deploy, credential or unapproved CLI/PR actions.

## Execution notes
Local safe email workbench and scoped API hardening delivered; see `../results/U4a.md` and the H5 matrix row. Focused email/import 12 backend tests, 8 email DOM tests and 4 form-guard regressions pass; Convex/Admin typechecks and focused lint pass. Provider activation remains strictly gated; E0/U7 browser screenshots remain pending. Guarded in-memory review is not durable draft recovery; bounded discovery and provider operation-ledger/worker follow-up are explicitly recorded. No live provider, migration, deploy, production or commit action performed.
