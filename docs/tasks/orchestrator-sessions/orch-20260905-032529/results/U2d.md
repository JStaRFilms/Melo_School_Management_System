# U2d — Bank settings and immutable financial instructions

**Implemented local bank/document slice; E0 runtime acceptance pending.** No live Convex command, codegen/deployment, migration/backfill, credentials, providers, payment trigger, production operation, browser/server or commit. U2c remains explicitly partial for its missing counter-scope/group implementation; see its result rather than treating both packets as complete.

## APIs and authority

`api.functions.academic.bankAccounts`:

- `listBankAccounts({schoolId})` now fails closed on authentication/membership denial **before reading metadata**. Requires an effective finance reports, invoice issue or bank management capability. Returns bounded (100) summaries with masked numbers, bank/account labels, currency/default/status; no full number, IBAN, SWIFT or transfer-note leakage in summaries. No catch-and-return metadata fallback remains.
- `getBankAccount({schoolId,bankAccountId})` requires the separate `finance.bank_details.manage` capability and exact tenant ownership before returning full editing values.
- `addBankAccount({...fields,schoolId,isDefault,confirmation?})`, `editBankAccount({...fields,schoolId,bankAccountId,expectedUpdatedAt,confirmation})`, `setPrimaryBankAccount({schoolId,bankAccountId,confirmation?})`, `archiveBankAccount({schoolId,bankAccountId,replacementId?,confirmation})` all require bank management and exact `CONFIRM`. Optional validators on old API confirmation fields preserve generated call compatibility, **not** an authorization bypass; absence rejects. Edit uses optimistic revision, required bounded bank/name/number and uppercase three-letter currency. Duplicate active account add rejects. First active account becomes default. Setting default clears others; archived/suspended accounts cannot become default. Archiving a default with active alternatives requires explicit same-school active replacement; archiving the last active account leaves none. No account hard-delete API.
- Required fields: bank name, account name, account number, currency. Optional: label, branch, sort code, IBAN, SWIFT/BIC, transfer note. Existing schema values remain compatible through additive optional fields. No provider verification or fake step-up flow.
- All management writes emit permanent statutory audit events with **masked** before/after number summaries and tier1 leadership alerts through U1e's append-only writer. No raw bank metadata/payload is journaled. Authority retains U1a/RBAC's existing resolver semantics, including its separately documented Platform-support boundary; this packet does not manufacture new support evidence.

## Issuance/history contract

- Pure `foundation/bankInstructions.ts` supplies the shared schema/return validator and `invoicePaymentInstructions(invoice)`. Full instructions are returned only when balance is positive and status is issued/overdue/partially_paid. Paid, waived, draft and cancelled views return null.
- `createFeePlan` accepts an optional approved same-school active currency-matching bank account. `createInvoiceFromFeePlan` and actual `applyFeePlanToClassStudents` accept optional account selection. Precedence is explicit invoice selection → fee plan selection → active school default.
- `snapshotInvoicePaymentInstructionsHelper(ctx,invoiceId,bankAccountId?)` is called **inside `createInvoiceFromFeePlanRecord`'s issuance transaction**, including bulk issuance. It validates exact school/status/currency, snapshots full domestic/international fields and preserves any first snapshot. Fully waived/zero-balance invoices have no transfer instructions. A missing default means instructions unavailable, not fabricated data. An explicitly selected unavailable/archived/currency-mismatched account rejects the issuance transaction.
- The old internal `snapshotInvoicePaymentInstructions` maintenance endpoint is now **read-only compatibility** for snapshots: it cannot retrofit current accounts into a historical issued invoice lacking one. Draft/cancelled misuse still rejects. Only the issuance helper writes snapshots; no client follow-up mutation or historical repair operation was added.
- `getInvoicePaymentView` and `getInvoiceReceipt` now require finance reports capability rather than general school membership. Receipt always omits instructions, even for a partial-payment receipt. They are staff APIs; Portal uses its already linked-student-scoped billing query, not these staff readers.

## Invoice → actual document consumers

| Surface | Actual data path / output |
| --- | --- |
| Admin `/billing` Settings | Existing `SettingsPanel` mounts real `BankAccountsPanel`: masked list, authorized full edit, add/default/archive/replacement, international fields, confirmation, pending/empty/denied/loading/failed-save/conflict/discard. `billing/error.tsx` offers truthful unavailable/retry for query failure. |
| Fee-plan authoring | Actual `forms/FeePlanForm` mounts `BankAccountSelection`; `FeePlanDraft` and page submission preserve selection to `createFeePlan`. |
| Bulk invoice issuance | Actual `forms/BulkApplicationForm` mounts the same masked selector; draft/page/`applyFeePlanToClassStudents` carry the override into every issued invoice transaction. |
| Staff invoice payloads | `billing.invoiceDocToReturn` and `billingInvoiceValidator` carry authorized `paymentInstructions`; helper is strongly typed to `Doc<studentInvoices>`. Existing dashboard/detail wrappers preserve it. |
| Single invoice print/download | `PrintableFinanceModal` renders Shared `InvoicePaymentInstructions` with the exact invoice snapshot. Existing `window.print()` is the real Print / Save as PDF path; no new provider/link action executes merely to render instructions. |
| Statement print/download | Same modal renders each payable invoice's own instructions/reference. It never chooses today's default or one arbitrary bank for mixed issued history. Payment/receipt ledger rows carry no transfer block of their own. Settled invoice rows produce none. |
| Portal `/billing` unpaid views | Existing `portal.getBillingData` selected-student/family-authorized invoice mapping adds the snapshot through `portalBillingInvoiceValidator`; Portal types and `PortalWorkspaceContent` render the same Shared block. No general bank list or staff membership substitute is used. |
| Portal settled views | Same projection and shared renderer both omit instructions for paid/waived/cancelled/draft/nonpositive balance. Existing online payment controls are unchanged and were not activated. |
| Staff receipt reader/manual receipt flow | `getInvoiceReceipt` returns null instructions; existing Record Receipt form and payment rows do not render a bank block. No new receipt-print product was invented. |
| Reminders | Source search of actual billing backend/UI found no independent runnable reminder-generation/document pipeline. Existing invoice Print / Save as PDF is the available document-to-send path and now includes the snapshot. No dormant provider integration was activated or falsely claimed as an implemented reminder service. Future reminder composition must take this invoice projection, never fetch current bank settings. |
| Old issued invoice without snapshot | Shared renderer explicitly says instructions unavailable/contact school; no fallback to current account anywhere in the changed data/render paths. |

## Verification

Executed local checks:

- Convex `vitest run functions/academic/__tests__/admissionNumbers.integration.test.ts functions/academic/__tests__/bankAccounts.integration.test.ts functions/billing.integration.test.ts functions/academic/__tests__/transfers.integration.test.ts foundationContracts.test.ts`: **5 files / 25 PASS**.
- Bank suite: **3 PASS**, unauthorized metadata, mandatory confirmation, masked summary/full edit split, permanent masked audit and leadership alert, default/archive/replacement/no hard delete, international editing and stale revision.
- Billing suite: **3 PASS**, including real direct/bulk issuance, waived invoice suppression, explicit alternate selection, original snapshot after account edit/archive, legacy no-retrofit, paid/waived/receipt omission and unrelated Portal student denial. Existing fee-plan/dashboard regressions retained.
- Admin `vitest run __tests__/numbering-bank-settings.test.tsx`: **3 PASS**. Denied settings, numbering confirmation/version, bank confirmation, mutation values, retained failed edits.
- Shared `vitest run src/__tests__/invoice-payment-instructions.test.ts`: **2 PASS**. Full domestic/international snapshot output, missing historical fallback, settled/receipt omission.
- Convex, Admin, Portal and Shared typechecks: **all PASS**. Final rerun after all edits is reported in final handoff.
- Focused new/replaced-file ESLint: **PASS**, zero warnings. Additional changed legacy integration-file ESLint: **PASS, 0 errors / 12 pre-existing unused-import/next-image warnings**. `git diff --check`: **PASS** (existing Windows line-ending notices only).
- Existing locally installed transitive Prettier 3.8.1 formatted only new/replaced packet files; no dependency installation. The workspace executable was initially not linked, so its existing local binary was used.

Ordinary fixes: bank receipt tests initially used a legacy admin without the required finance capability; fixture now explicitly supplies canonical owner authority. Transfer's new U1a unauthenticated error expectation was aligned without allowing access. Shared JSX requires the repository's existing explicit React import convention. Student-enrollment test cold import moved to collection; no timeout was increased. All failed checks were rerun successfully.

## Self-review and remaining risks

Preserved all predecessor changes and original issued snapshots; removed auth-failure metadata fallback and historical maintenance backfill seam; centralized payable status checks across backend and consumers; avoided current-bank fetches in document renderers; used safe DOM text, not injected HTML; kept receipts distinct from invoices; removed no unrelated providers or financial calculations. Additive schema/functions are authored only, not deployed.

E0/U7: request synthetic/redacted desktop and 320px bank empty/denied/full edit/confirmation/stale/save-failure/default/archive, alternate fee-plan/bulk selection, two-bank historical statement, legacy missing snapshot, paid/waived Portal and unrelated-family denial. Capture keyboard focus, actual Print / Save as PDF, page breaks and grayscale. **No screenshot or print-fidelity claim is made.** Full-page dirty navigation/branch/account guards remain U3a/U3c; current forms retain in-memory failed saves but no offline/server-draft promise. Existing alternate accounts archived after fee-plan selection cause future issue to fail closed until an active alternate is selected; old invoices remain payable using their recorded snapshot.

## Files

Replaced `academic/bankAccounts.ts`; new pure `foundation/bankInstructions.ts`; additive schema metadata and optional fee-plan account; modified `billing.ts`, `billingShared.ts`, `portal.ts`, billing tests. Admin new `BankAccountsPanel`, `BankAccountSelection`, billing error boundary and combined DOM suite; modified SettingsPanel, FeePlanForm, BulkApplicationForm, page submission, types, PrintableFinanceModal. Shared new InvoicePaymentInstructions component/export/test. Portal billing type and existing content renderer updated without disturbing U2b grade changes. No generated API hand edit.
