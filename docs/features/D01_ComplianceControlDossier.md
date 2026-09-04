# Melo Compliance Control Dossier (D-01 / F5)

**Status:** corrected engineering dossier; not legal advice or legal approval.
**Version / review date:** 1.1.0 / 2026-09-03. **Next engineering review:** 2026-12-03 or before a material processing, provider, market, or schema change.
**Scope:** Nigeria-first school platform; secondary-market research only. This document is a release gate for sensitive processing, not a conclusion that Melo, a school, or a provider has a particular legal role or lawful basis.

## 1. Reading rules and coverage method

Labels keep claims reviewable:

- **[L—research lead]** names an official legal source and its possible relevance; counsel must confirm current text, applicability, and interpretation.
- **[BP]** is an engineering/privacy best practice, not asserted law.
- **[CQ]** is a counsel, controller, provider, or operational question; it blocks the stated processing until resolved.
- **[E]** is implementation or operational evidence required before release.

### Inventory coverage method

The authoritative technical inventory is every `defineTable` in `packages/convex/schema.ts`, every Convex file-storage reference, and every external data egress/ingress route. For each release, the data owner must export that schema list and reconcile **every table and every storage reference** to a row in the classification register below (or add a row); inspect its fields, indexes, readers/writers, retention job, exports, and provider flows; then record the result in the non-Git compliance register. The grouped rows are representative shorthand, not a claim that a group is a single dataset. New table, storage, notification, analytics, or provider paths require classification before merge.

## 2. Data classification and representative register

Classes: `public` (approved publication only), `internal`, `personal`, `child_confidential`, `highly_sensitive` (health/SEN/safeguarding/identity or other special-category candidate), and `financial_security` (bank, payment, credential, or security data). Where a row contains more than one class, enforce the strictest applicable class at field and file level.

| Schema / flow coverage (representative tables) | Subjects / data categories | Class | Target controls [BP] | Evidence / owner |
|---|---|---|---|---|
| Identity, tenancy, authorization: `persons`, `users`, `families`, `familyMembers`, `branchMemberships`, roles/grants/restrictions, `platformAdmins` | names, contacts, login identifiers, family links, roles | personal / child_confidential | tenant-scoped server authorization; no secrets in audit/export; least privilege | [E] reader/writer map, access-negative tests, auth owner |
| Admissions and public application: `admissions*`, applicant profiles, answers, documents, declarations, contacts, payment events, communication outbox, site profiles/domains/assets | applicant/guardian identity, application answers/files, admissions decisions, payment metadata, public content | personal / child_confidential / highly_sensitive / financial_security / public | field minimization; private files; staged review; public/site boundary | [CQ] admissions notice, child/guardian authority; [E] access/retention map |
| School operations and academic history: `students`, `classes`, `subjects`, sessions/terms, assignments, assessment/report-card tables, attendance values, transfers, graduations | child identity, enrollment, results, attendance, teacher comments, transfer history | child_confidential; highly_sensitive if a field contains health/safeguarding data | school scope; restricted exports; correction history; no cross-branch disclosure | [E] table/field owner and DSAR/retention handling |
| Staff, leadership, bank and collections: leadership/audit tables, `schoolBillingSettings`, bank accounts, invoices, payment attempts/payments/allocations/gateway events/provider secrets | staff identity, bank instructions, invoice/payment metadata, provider secrets | personal / financial_security | masked UI/audit fields; separate secret access; immutable issued snapshots/compensating corrections | [CQ] controller/finance/tax treatment; [E] secret and reconciliation review |
| Learning, AI/OCR and imports: `knowledge*`, curriculum/instruction/assessment tables, `aiRunLogs`, `importWorkspaces`, staged records, `aiImport*` | source documents, OCR text, prompts/outputs, teacher content, staged learner data, model metadata | internal plus source class; child_confidential/highly_sensitive where source contains it | minimize/redact provider payload; AI proposes, human validates/commits; no raw content in usage/audit unless approved | [CQ] provider terms/transfer basis; [E] egress map and redaction tests |
| Assets, forms, storage and lifecycle: `schoolAssets`, quarantine/hold logs, site assets, knowledge materials, documents, `formDrafts`, temporary uploads, `_storage` | files, photos, PDFs, drafts, file metadata and hashes | source class; highly_sensitive where content is; internal metadata | private-by-default; quarantine before expanded access; retention/hold/delete controls | [E] storage-reference inventory, scan and purge tests |
| Audit, security, migration, rates and metering: `auditEvents`, alerts, content/site/admissions audit, migration runs/state, rate limits, subscriptions, mandates, settlements, quotas/usage | actor/event metadata, security and migration evidence, commercial/usage metadata | internal / financial_security; source class if payload is retained | append/correct rather than silently overwrite; redact secrets/content; tenant-safe aggregates | [E] audit payload review and ledger reconciliation |
| Notifications and analytics/telemetry: admissions outbox, portal-derived notification responses, audit alerts, `usageEvents`, `aiRunLogs`, rate-limit counters, product logs and any future analytics SDK | recipients, delivery state, event/usage and device/account metadata; potentially linked identifiers | personal / internal; source class if event carries content | purpose-limited event schema; no message bodies, secrets, prompt/document content, or special-category data in analytics; role-scoped notification visibility | [CQ] notification lawful basis/opt-outs and analytics provider/retention; [E] event schema + vendor egress review |

**Storage rule:** storage objects inherit the source record’s strictest class; a storage ID is not a public URL or permission grant. **Analytics rule:** aggregate reporting must use minimum necessary, de-identified or pseudonymized measures where feasible; analytics is not a secondary use authorization.

## 3. Purpose, candidate lawful-basis, and role matrix

The lawful-basis column is deliberately a counsel worksheet, not a selection. “School” may be controller, joint controller, or processor for a particular activity; “Melo” may be processor, independent controller, or another role. Agreements and counsel determine the actual allocation.

| Processing purpose | Data / subjects | Candidate basis or condition for counsel [CQ] | Likely decision-maker / role question | Product boundary and evidence |
|---|---|---|---|---|
| Admission, enrollment, education delivery, assessment and attendance | applicants, guardians, students, staff | contract/pre-contract, legal/public task, legitimate interest, consent and child/special-category conditions as applicable | Which school entity decides purpose/means; Melo instruction boundary | minimization, school scope, notices, retention schedule [E] |
| Safeguarding, health, SEN, identity documents and media | students/guardians | applicable special-category/child condition; safeguarding duty; separate media choice | who may access, disclose, correct, and respond to an incident | restricted workflow; no routine analytics/AI use; counsel-approved process [CQ] |
| School-fee collection, SaaS billing, bank/payment administration | guardians, school finance staff | contract/legal obligation/legitimate interest and finance rules as applicable | school collection controller vs Melo SaaS controller; provider role | separate ledgers; masked secrets; provider/finance/counsel evidence [E/CQ] |
| Institutional mailbox/directory operations and notifications | staff/students/guardians | education/employment/contract/legitimate interest/consent as applicable; child naming/notice condition | school/provider/Melo responsibility and recipient authority | `login_only` is not an inbox; dry run, opt-out/required-message policy, provider proof [E/CQ] |
| AI/OCR/import assistance | staff, students, applicants whose data is in a source file | controller-approved instruction, transfer/special-category condition, provider terms | whether provider receives personal data; model training/retention restriction | human review before commit; minimum payload; egress and retention evidence [E/CQ] |
| Security, fraud prevention, audit, retention, rights and incident response | all actors | legal obligation, legitimate interest, vital interest or other applicable condition | incident/DSAR controller responsibility and regulator/customer notice ownership | redaction, immutable evidence, holds, incident playbook and verified deadlines [E/CQ] |
| Product analytics, service health and metering | users/schools; not message/file content | legitimate interest, consent, or other market-specific condition | controller, cookie/device rules, opt-out and vendor role | aggregate/minimized events, retention and analytics vendor review [E/CQ] |
| Future independent-school record transfer | student, guardian, source/destination schools | portability, consent, legal/public-task or other jurisdiction-specific condition | source/destination roles, authority and dispute/correction responsibilities | later-gated; selected records only; no automatic sensitive/finance/safeguarding transfer [CQ] |

### Controller / processor / subprocessor decision matrix

| Processing boundary | Provisional engineering posture | Required decision/evidence before use |
|---|---|---|
| School tenant ↔ Melo core platform | school instructions and platform operations must be documented; no final role allocation asserted | executed customer terms/DPA, access/support boundary, deletion/return process, counsel confirmation |
| Melo ↔ Convex/storage/hosting | candidate subprocessor flow | actual deployment region, contract/DPA, security controls, transfer mechanism, subprocessor list |
| School/Melo ↔ payment provider | payment provider is a separate candidate service; direct-school merchant and optional split mode are distinct | merchant terms, data flow, finance reconciliation, tax/regulatory/counsel decisions |
| School/Melo ↔ directory/notification/AI/AV provider | provider-specific processor/independent-service role is unknown until selection | least-privilege scopes, contract/DPA, training/retention, residency/transfer, sandbox and deletion evidence |
| Source ↔ destination school (future F4) | independently controlled institutions; no automatic sharing assumption | legal basis, guardian/authority model, verified institution process, security and dispute terms |

## 4. Jurisdiction source and applicability register

**Source access date** records when this dossier recorded the link; it is not verification of the current text. **Review date** is a separate planned re-check. Each market row is a research lead only; counsel must add the actual applicable national/state/provincial education, employment, consumer, and sector rules before launch.

| Market / source | Official source URL | Potential applicability | Source access date | Next source review | Classification |
|---|---|---|---|---|---|
| Nigeria — Nigeria Data Protection Act 2023 / NDPC guidance | `https://ndpc.gov.ng/Files/Nigeria_Data_Protection_Act_2023.pdf`; `https://ndpc.gov.ng/guidelines` | Nigeria-first privacy program, subject rights, controller/processor and transfer questions | 2026-09-03 | 2026-12-03 and before launch | [L—research lead] |
| Nigeria — Child’s Rights Act / state enactments | `https://www.refworld.org/docid/47036d562.html` | child/guardian and state-law research; replace secondary link with applicable official source | 2026-09-03 | before child-data launch | [CQ: source and applicability] |
| UK — DPA 2018 / UK GDPR / Children’s Code | `https://www.legislation.gov.uk/ukpga/2018/12/contents`; `https://ico.org.uk/for-organisations/childrens-code-hub/` | prospective UK market; children, DPIA, transfer and notice questions | 2026-09-03 | before UK design or launch | [L—research lead] |
| EU — GDPR / member-state law | `https://eur-lex.europa.eu/eli/reg/2016/679/oj` | prospective EU market; member state determines important details | 2026-09-03 | before EU design or launch | [L—research lead] |
| US — FERPA / COPPA and state law | `https://studentprivacy.ed.gov/ferpa`; `https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa` | prospective US school/age/state-specific use | 2026-09-03 | before US design or launch | [L—research lead] |
| Canada — PIPEDA / provincial and education law | `https://laws-lois.justice.gc.ca/eng/acts/P-8.6/`; `https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/` | prospective Canadian market; counsel must determine PIPEDA versus substantially similar provincial private-sector law and applicable provincial education/public-sector rules | 2026-09-03 | before Canadian design, provider selection, or launch | [CQ: Canadian counsel applicability and school-sector role gate] |
| Brazil — Lei Geral de Proteção de Dados Pessoais (LGPD) | `https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm`; `https://www.gov.br/anpd/pt-br` | prospective Brazilian market; child/adolescent, controller/operator, international-transfer, and ANPD requirements require local review | 2026-09-03 | before Brazilian design, provider selection, or launch | [CQ: Brazilian counsel applicability and ANPD/provider gate] |
| India — Digital Personal Data Protection Act, 2023 (DPDP Act) | `https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf`; `https://www.meity.gov.in/data-protection-framework` | prospective Indian market; commencement, rules, child processing, school role, and cross-border/provider treatment require current local review | 2026-09-03 | before Indian design, provider selection, or launch | [CQ: Indian counsel applicability, commencement, and provider gate] |
| Australia — Privacy Act 1988 / Australian Privacy Principles | `https://www.legislation.gov.au/C2004A03712/latest/text`; `https://www.oaic.gov.au/privacy/australian-privacy-principles` | prospective Australian market; coverage threshold/exemptions, state or territory education/privacy law, children, and overseas disclosures require local review | 2026-09-03 | before Australian design, provider selection, or launch | [CQ: Australian counsel applicability and state/territory education-law gate] |
| South Africa — POPIA | `https://inforegulator.org.za/popia/` | prospective market | 2026-09-03 | before launch | [L—research lead] |
| Kenya — Data Protection Act | `https://www.odpc.go.ke/data-protection-act/` | prospective market | 2026-09-03 | before launch | [L—research lead] |
| Ghana — Data Protection Act | `https://www.dataprotection.org.gh/` | prospective market | 2026-09-03 | before launch | [L—research lead] |

## 5. Traceability and release gates

| Feature / flow | D-01 control traceability | Pre-release evidence |
|---|---|---|
| H5 institutional email and notifications | inventory: identity/directory/notification row; mailbox state truthfulness; minor naming and recipient authority are [CQ] | provider sandbox/DPA/scopes, dry-run/retry evidence, notice/required-message and opt-out decision |
| F3 AI import | AI/import row; data minimization; AI cannot commit operational records directly | provider terms/retention/transfer review, egress map, human review + deterministic validation tests |
| H8 AI/OCR/storage metering and analytics | AI/metering and analytics rows; no content in metering/analytics; aggregate visibility | event schema/redaction review, tenant isolation, retention and analytics-provider decision |
| H9 assets, quarantine, PDF, Trash | storage/assets row; private/quarantine/hold lifecycle | AV and runtime evidence, file-access test, retention/purge approval |
| F7 commercial/settlement | finance row; direct collection differs from Melo subscription/split mode | provider/finance/legal evidence, reconciliation and truthful copy review |
| F1/H2 audit and RBAC | audit/security and identity rows; redacted, scoped evidence | writer/reader inventory, negative authorization and redaction tests |
| F4 future independent transfer | transfer row; selected records only and no automatic financial, safeguarding, health, or internal-behavior disclosure | separate legal/security/product approval; institution and signing due diligence |

### Minimum launch gates

- [ ] [E] Complete the schema/storage/egress coverage reconciliation and assign owners.
- [ ] [CQ] Obtain jurisdiction- and school-specific counsel decisions for child/special-category processing, role allocation, notices, rights, retention, incidents, and transfers.
- [ ] [E] Execute applicable provider/subprocessor due diligence and record contracts, scopes, residency/transfer, retention/training, and deletion evidence.
- [ ] [E] Verify authorization, redaction, retention/hold, export/rights, notification, and analytics controls in the deployed target.
- [ ] [CQ] Do not launch a new market (including Canada, Brazil, India, or Australia) or F4 transfer network on this dossier alone; the named market’s counsel and provider gates must be closed first.

## 6. Sign-off

**Engineering:** corrected design; independent legal, provider, and implementation review pending.
**Counsel:** pending.
**Non-goals:** this dossier does not select a legal basis, provider, retention duration, encryption algorithm, hosting region, transfer mechanism, or regulatory registration outcome.
