# Confirmed Product Decisions

Updated: 2026-09-03

This is the durable decision ledger for the requirements interview. Confirmed decisions are normative unless the user revises them later. Direct decisions made in this interview take precedence over prior walkthroughs, brand strategy, mockups, example prices, or exploratory planning artifacts; those older materials are evidence only unless explicitly re-approved here.

## Interview Method
For each backlog feature: explain the existing product context, present concrete product choices with a recommendation, collect direct-chat answers, record the decision, then proceed to the next feature. After a reasonable frontier is complete, synthesize all approved work into dependency-aware implementation stages.

## Delivery and Quality Baseline
- Wait for PR #21 checks and merge before starting the new implementation program.
- Create a fresh branch from updated `master`.
- Repair the teacher conditional-hook lint errors first.
- Investigate the parallel-only `foundationContracts.test.ts` timeout before increasing its timeout. Prefer reducing unnecessary fixture/setup work; use a larger focused timeout only when the test is legitimately slow.

## H1 — Configurable Grade-Band Colors

### Confirmed behavior
- Existing standard grading defaults/preset must not be duplicated.
- Each grade band may have a school-configurable color with a polished default.
- Color is a restrained semantic grade indicator, not a page theme or large background treatment.
- Primary consumers are printed report cards/report previews and teacher views where student scores/grade letters appear, including exam-extras workflows.
- Inventory every real consumer before implementation and propagate the color consistently so persistence is not half-connected.
- Preserve the selected hue while mathematically deriving contrast-safe foreground/display shades when needed.
- Provide sensible accessible defaults. Unless revised later, use curated presets plus a custom picker/hex input.

### Constraints
- Printed output must remain legible in color and grayscale.
- Grade labels and numerical scores remain understandable without color.
- Historical-rendering behavior must be explicitly designed before migration.

## H2 — Granular Admin RBAC

### Role and title model
- Provide default templates: Proprietor, Principal, Academic Director, Exam Officer, Bursar, Registrar, and Staff Administrator.
- Multiple people may use the same base role.
- Users may combine multiple base-role templates.
- Each user may have a custom display title independent of backend authorization; e.g. backend Academic Director with title “Vice Principal — Academics.”
- Effective permissions are the union of selected role templates plus direct grants minus direct restrictions.
- A categorized checklist allows authorized managers to add/remove capabilities from templates and preview effective access.
- Existing admins migrate with current full access to prevent lockout.

### Enforcement
- Hide unauthorized modules from navigation.
- Direct URLs show a clear permission-denied state rather than a misleading 404/module-disabled page.
- Backend queries, mutations, actions, exports, and storage operations are the authoritative security boundary.
- Sensitive capabilities are separate from broad module access, including permission management, bank changes, exports, password resets, destructive operations, and final report publication.

### Authority hierarchy
- Proprietor is the school ownership authority with recovery and final delegation control.
- Principal is an operational leader and does not automatically receive ownership powers.
- Proprietor may grant `Manage Staff & Permissions` to a principal or another trusted person.
- Delegated managers cannot change their own permissions, the proprietor, Platform Super Admins, or users above their authority level.
- Delegated managers may grant only capabilities explicitly included in their proprietor-defined management ceiling.
- Possessing a capability does not automatically allow delegating it.
- Only the proprietor grants/revokes the permission-manager capability by default.
- Platform Super Admin performs strongly audited proprietor ownership recovery/transfer.

## F1 — Application-Wide Audit Log

### Event contract
Record meaningful actions with actor, timestamp, school/group/branch context, module, action, affected record, safe result, and redacted before/after summaries. Passwords, secrets, complete bank numbers, and raw sensitive payloads are never logged.

### Visibility
- Platform Super Admin sees platform actions and authorized support actions.
- Proprietor sees all audit events within their school group.
- Principal sees operational events within delegated audit scopes.
- Departmental admins see events within permitted modules.
- Ordinary staff see only explicitly relevant personal activity, if exposed.
- `View School Audit Log` is a separately delegable capability with module scopes.

### Behavior
- Dedicated audit page with search, date range, module, action type, actor, branch, and affected-record filters.
- Safe fields may show field-level before/after values; sensitive values are masked or summarized.
- Sensitive events trigger alerts: bank changes, permission/role changes, ownership changes, password resets, bulk exports, suspension/reactivation, and destructive bulk operations.
- Routine edits remain searchable without notification noise.
- Events are append-only; corrections create new events.
- Security, ownership, finance, permission, and certified academic-history events are retained indefinitely unless policy/law requires otherwise; ordinary operational events retain at least seven years.
- Authorized exports support CSV and printable PDF with identical visibility/redaction rules.

## H3 — School Bank Accounts and Financial Documents

### Account model
- Support multiple accounts with one default.
- Accounts may include label, account name, bank name, account number, currency, and optional branch, sort code, IBAN, SWIFT/BIC, and transfer instructions.
- Account name, bank, number, and currency are required.
- Fee plans/invoices default to the primary account but may select an approved alternative.
- Future group accounts may be shared with selected branches; branch accounts remain branch-local.

### Rendering and history
- Show transfer details on invoices, statements, payment reminders/downloads, and relevant unpaid parent-portal views.
- Receipts do not show transfer instructions by default because they document completed payment.
- Issued invoices snapshot their payment instructions; configuration changes affect drafts/new documents only.
- Use “verified” only with real provider verification; otherwise use Active or School-confirmed.
- Settings summaries mask numbers; authorized editing and parent transfer instructions show full values; logs always mask them.

### Security and lifecycle
- Proprietor manages bank details by default and may delegate `Manage Bank Details` to a bursar or principal.
- Changes require confirmation and immutable audit events with masked before/after values.
- Sensitive bank changes produce leadership alerts.
- Accounts used historically are archived, never hard-deleted.

## H4 — Sequential Admission Numbers

### Format and counters
- Use a guided, constrained token builder with live preview; tokens may include school, campus/branch, academic level, academic-session year, and padded sequence.
- `{YEAR}` means the academic session starting year.
- Support one default sequence plus optional named sequences by branch/campus and academic level.
- Sequence reset policy is configurable: continuous, academic-session, or calendar-year; continuous is the default.
- Setup asks for “Next number to issue” and previews the next resulting identifier.

### Allocation
- Allocate the final number atomically in the same backend transaction as enrollment approval.
- Opening/abandoning a form never consumes a number.
- Failed transactions do not consume a number.
- Successfully assigned numbers are never automatically reused after cancellation/archive.
- Perfect gaplessness is not promised; uniqueness, ordering, and auditability are required.

### Overrides, imports, and policy changes
- `Override Admission Number` is a separate permission.
- Manual override requires uniqueness validation, confirmation, reason, and audit event.
- Manual values advance the automatic sequence only through an explicit administrator choice.
- Imports preserve supplied historical identifiers, validate duplicates, generate only missing values, preview proposals, and never infer/advance the official counter without confirmation.
- Changing a format does not rename existing students; new students use the new policy version and effective date.

## F2 — School Groups and Multi-Branch Tenancy

### Core model
- Introduce a school group/organization above existing school tenants.
- Existing branches remain independently isolated tenants for students, classes, sessions, attendance, scores, invoices, staff assignments, and permissions.
- Link existing Olive Blessed Crest branch tenants under a group without merging or rewriting their records.
- Platform Super Admin initially creates groups and links existing schools. Proprietors may later create branches or request verified linking.

### Identity and membership
- One canonical person/auth identity may have explicit memberships in multiple branches.
- Proprietors switch branches without reauthentication.
- Principals/admins remain restricted to explicit branch memberships.
- One teacher may work across branches with separate memberships and assignments.
- Group and branch permissions use H2 RBAC and F1 audit rules.

### Shared configuration
Group-level defaults may cover branding, grading bands/colors, role templates, admission-number templates, report-card templates, notifications, and academic policies. Branches may override allowed settings. Group calendar templates permit branch date overrides.

### Operations
- Header branch switcher clearly shows active branch and respects unsaved-form protection.
- Proprietor receives aggregate enrollment, attendance, finance, staffing, and academic dashboards with safe branch drill-down.
- Admission counters may be group-wide, branch-wide, or branch-plus-level; per-branch is default.
- Bank accounts may be group-owned/shared or branch-owned.
- Proprietor sees group-wide audit history; principals see authorized branch history.

### Transfers
- Within-group student movement uses an audited transfer, not an in-place `schoolId` rewrite.
- Source branch retains immutable historical records; destination receives active enrollment context.
- Student history must remain continuous without leaking unrelated branch data.

### Staged implementation
1. Canonical identity and memberships
2. Group records and authorization helpers
3. Existing-tenant linking/migration rehearsal
4. Branch switcher
5. Group-aware RBAC and audit
6. Shared templates and branch overrides
7. Aggregate dashboards
8. Student/staff transfer workflows

## F3 — AI-Assisted Import Review Pipeline

- AI helps interpret messy spreadsheet structures and column meanings.
- Suggest mappings, normalization, branch/class placement, relationships, and probable duplicates.
- Use structured output, confidence scores, explanations, high-quality prompts, and representative examples.
- AI never writes/commits records directly.
- Uncertain rows require human review.
- Deterministic schema, permission, uniqueness, relationship, and tenant validation runs before commit.
- Commit accepted records in audited batches with rollback/reconciliation information.
- H4 numbering is integrated: preserve supplied historical numbers, propose identifiers only for missing values, and never mutate official counters without explicit reviewed confirmation.

## F4 — Future Melo-to-Melo Transfer Network

Design for future student movement from one independent Melo school/group to another, not only between branches of the same group.

Required principles:
- Guardian/student authorization appropriate to local law and age.
- Source-school release and destination-school acceptance workflow.
- Verified institution identities.
- Explicit selection of records to share.
- No automatic exposure of private financial, safeguarding, health, or disciplinary records.
- Cryptographically attributable, immutable transfer/audit history.
- Source school retains historical records; destination receives authorized portable records and creates its own enrollment.
- Conflicts, rejection, cancellation, expiry, and correction flows must be designed.
- Build on canonical identity, lifecycle history, audit, and branch/group foundations without blocking initial within-group transfers.

## H5 — Institutional Email Domains and Conventions

### Address policy
- Schools choose separate configurable staff and student address templates.
- Default to `firstname.lastname` under the school domain; do not force admission-number-based student addresses.
- Before approval, deterministically detect collisions across the applicable domain and propose alternatives such as a year or numeric suffix.
- Authorized administrators may manually edit the proposed local part, subject to syntax, reserved-name, uniqueness, provider, and audit validation.
- Name changes never silently break login or historical attribution; propose a new address and preserve the old address as an alias where supported.
- A source school retains control of its institutional address when a person transfers to an unrelated Melo school.

### Domains and branches
- Support verified school-owned domains and Melo-provided subdomain fallbacks.
- Custom domains require proof of control, normally DNS TXT verification.
- A school group may share one domain/mail system across branches or configure independent branch domains/subdomains and providers.
- Uniqueness is enforced across all branches sharing a domain; independent domains have independent namespaces.
- Users generally retain an address while moving between branches sharing the same domain.

### Mail capability states
Clearly distinguish:
1. Melo login identifier only — no inbox.
2. Verified externally managed mailbox.
3. Provider-managed mailbox provisioned/synchronized through Melo.

Never send mail to or describe a login-only identifier as a functioning inbox.

### Provider integrations
- Treat Google Workspace, Microsoft 365, and Zoho Mail as intended provider integrations, subject to API, licensing, security, and legal validation.
- Melo does not operate its own mail server.
- Integration is staged: domain/provider connection, delegated authorization, directory synchronization, dry-run proposal, human approval, provisioning, alias/suspension lifecycle, reconciliation, and audit.
- Provider failures must not corrupt Melo identity or membership state; operations need idempotency and reconciliation.
- Import AI may propose addresses but never provisions mailboxes directly.

### Roles, lifecycle, and privacy
- Proprietor controls domain policy by default and may delegate scoped IT/system administration.
- Registrar may approve student addresses and Staff Administrator may approve staff addresses within policy.
- Platform support/recovery is explicit and audited.
- Leaving suspends access, preserves attribution, optionally forwards for an approved period, then archives the address; old addresses are never silently reassigned.
- Student/minor naming choices require explicit privacy warnings and jurisdiction-aware policy.

## F5 — Global Legal, Privacy, and Child-Data Compliance Program

Create a dedicated, versioned legal/compliance engineering document before broad rollout of mailbox provisioning, AI-assisted imports, analytics, cross-school transfers, notifications, or other sensitive processing.

### Required deliverable
- Data inventory and classification: identity, contact, education, finance, attendance, health, safeguarding, disciplinary, biometric/media, authentication, audit, AI inputs/outputs, and provider metadata.
- Processing-purpose and lawful-basis matrix by role and jurisdiction.
- Controller/processor/subprocessor responsibilities for Melo, schools, providers, and transfer participants.
- Age/guardian-consent rules, school-authority rules, privacy notices, rights requests, retention/deletion, correction, portability, breach response, international transfers, and data-residency considerations.
- Feature-specific warnings and consent/approval gates.
- Jurisdiction matrix beginning with Nigeria and expanding to launch markets; use official/primary sources and dated citations.
- Initial research should cover, where applicable, Nigeria Data Protection Act/NDPC guidance and child-protection rules, GDPR/UK GDPR, COPPA/FERPA and relevant US state rules, and representative African/global frameworks such as POPIA, Kenya/Ghana data-protection law, PIPEDA, LGPD, India DPDP, and Australia’s Privacy Act.
- Separate legal requirements from optional best practices and unresolved counsel questions.
- Produce implementation controls, not only prose: data minimization, encryption, tenant isolation, redaction, audit, consent records, retention jobs, export/delete workflows, vendor due diligence, and incident procedures.

### Governance
- This document is engineering/compliance research, not a substitute for qualified legal advice.
- A qualified lawyer or privacy professional must review market-specific conclusions before launch.
- Laws and guidance must carry source URL, jurisdiction, effective/access date, applicability, and review date.
- Compliance changes are versioned and auditable; product behavior must map back to requirements in the legal matrix.

## H6 — Shared Unsaved-State and Draft Protection

### Shared application capability
- Build one shared, reusable dirty-state/navigation-guard and draft framework rather than bespoke implementations per page.
- All forms may use the navigation guard; recoverable drafts roll out first to long/high-value workflows: admissions/student enrollment, staff onboarding, fee plans, academic setup, report-card configuration, import review, and teacher planning.
- Forms register their draft schema, sensitivity class, tenant/branch context, version, retention policy, and supported recovery behavior.
- Short low-risk settings may use dirty-state warnings without persistent drafts.

### Navigation and recovery UX
- Protect browser reload/close, in-app navigation, sidebar actions, branch/account switching, and route changes.
- In-app choices: stay, discard, or save draft and leave where supported.
- Returning users see a timestamped Resume / Preview / Discard choice; a draft never silently replaces an intentionally blank form.
- Visible states distinguish Saving, Draft saved, Connection lost / recovery pending, Save failed, and Conflict detected.
- Provide both debounced autosave after roughly 1–2 seconds of inactivity and an explicit Save draft action.

### Storage and privacy
- Sensitive/high-value drafts use authenticated server-side storage.
- Low-risk local recovery may be explicitly approved per form.
- Never store passwords, payment secrets, auth tokens, or raw sensitive documents in localStorage.
- Raw files use private temporary storage with ownership, type/size/malware controls, expiry cleanup, no public URL, and discard cleanup.
- Draft content remains private to its creator by default. Deliberate handoff/sharing requires compatible permissions and audit; audit viewers do not automatically read draft contents.

### Conflicts, retention, and completion
- Use revision checks for multi-tab/device editing; never silently overwrite a newer revision.
- Offer load latest, keep/recover current, or compare when practical.
- Default retention: ordinary drafts 30 days; admissions/import and teacher-planning drafts 90 days or one term. Warn before expiry when practical.
- Successful submission marks the draft submitted and prevents stale autosave resurrection; editable payload is removed after the approved recovery/audit period.
- Audit meaningful lifecycle events only: create, share/transfer, conflict resolution, discard, and submit. Do not audit every autosave or duplicate field values.

### Honest connectivity boundary
- This is connection resilience and draft recovery, not a promise of full offline operation.
- Current Convex/auth behavior may sign users out when connectivity/session validation fails. The UI must never claim server persistence while disconnected.
- Preserve current in-memory edits and, only for approved low-risk fields/forms, a protected best-effort local recovery copy.
- After reauthentication, offer recovery/merge rather than silently submitting stale data.
- If reliable offline authentication and synchronization are not supported by the deployed stack, disable any “Work offline” claim. Test and document the actual behavior instead of presenting a nonfunctional feature.

## H7 — Shared Mobile Progress for Long Forms

- Build one reusable cross-application progress capability with form-configured modes, sections, labels, and completion rules.
- Long single-page forms use scroll progress; structured wizards use validated section-completion progress. Never mislabel scroll position as task completion.
- Mobile presentation is a compact sticky bar beneath the workspace header. Desktop uses a normal stepper only where useful.
- Structured sections may be tappable and identify complete, current, incomplete, error, and optional states; generic scroll bars are not interactive.
- A section counts as complete only when required validation passes, not when the user scrolls past it.
- Integrate H6 draft status subtly while keeping save status distinct from progress.
- Hide the indicator for short/simple forms or where an existing stepper already communicates the same information.
- Use semantic progress accessibility, throttled announcements, and reduced-motion support.
- Leaving or branch-switching delegates save/discard/stay behavior to H6.
- Initial rollout: student enrollment, bulk import review, staff onboarding, fee-plan creation, long academic setup, and teacher planning; inventory later candidates rather than applying globally without judgment.

## F6 — Shared School Design Tokens

### Confirmed direction
- Standardize the existing school theme configuration instead of adding an unrelated color system.
- Existing `primaryColor` and `accentColor` branding values become a documented shared token contract across school-facing applications.
- Centralize derivation of readable foregrounds, light tints, borders, focus rings, hover/pressed states, and other safe variants.
- Agents and developers reference semantic variables/utilities rather than manually selecting arbitrary brand-like Tailwind colors.
- The system remains modular but visually consistent across admin, teacher, portal, report cards, and appropriate public school surfaces.
- Add explicit repository guidance to `AGENTS.md` describing token usage, semantic status colors, accessibility, and prohibited arbitrary substitutions.
- H7 neutral progress should normally use the school accent token. Red, amber, and green are reserved for genuine error/warning/success meaning rather than decorative progress stages.
- H1 grade-band colors remain a separate domain-semantic palette. School brand tokens do not overwrite grade-specific colors.

### Confirmed implementation contract
- The administrator configures only two base values: Primary and Accent.
- Melo automatically derives typed semantic tokens for safe foregrounds, hover/pressed states, soft surfaces, borders, focus rings, selection, and neutral progress.
- Use perceptual color/contrast calculations and live previews. Block saving only when a safe representation cannot be generated.
- School-facing admin, teacher, portal, public-school, and printed-document surfaces consume the active branch theme. Platform governance remains Melo-branded except explicit tenant previews.
- Universal error, warning, success, and information colors keep stable meaning; branding does not redefine danger or validation.
- Group themes provide inheritable defaults with explicit branch overrides.
- Implement a shared typed theme model, derivation utilities, CSS-variable generator, provider, Tailwind integration, and settings preview without unnecessary wrapper components.
- TypeScript enforces token names and typed theme APIs. Because TypeScript cannot reject arbitrary Tailwind classes, add an informational changed-file lint/audit for new hard-coded brand-like colors and tighten it after legacy usage is classified.
- Do not mass-replace existing colors. Classify tenant branding, product identity, status, chart series, and domain-semantic colors, then migrate shells and touched features incrementally with a coverage inventory.
- Add explicit `AGENTS.md` rules: use semantic tokens; justify new hard-coded colors; preserve status semantics; verify contrast, print, and grayscale.

### Existing implementation evidence
- `schools.theme` currently stores `primaryColor` and `accentColor`.
- `WorkspaceNavbar` injects `--school-primary`, `--school-accent`, and several light/border variables.
- Admin Tailwind maps some school color utilities, while adoption across applications is incomplete.
- Report-card rendering consumes raw branding colors directly.
- Current agent guidance does not define the contract, and many components still choose fixed brand-like colors manually.

## H8 — AI, OCR, and Storage Usage Metering

### Entitlements and measurement
- Platform subscription plans own configurable allowances; do not hard-code commercial limits into feature code.
- Measure every meaningful cost dimension: requests/generations, input/output tokens, actual provider monetary cost, OCR/document pages, stored bytes, temporary artifacts, and batch jobs.
- Preserve raw technical measurements so future pricing may use included allowances, pay-as-you-go, prepaid pools, pages, requests, or another model without rebuilding metering.
- Aggregate safely by user, teacher, class/department where attributable, branch, school, group, plan, model/provider, feature, and billing cycle. Visibility follows RBAC and never exposes prompt/document content merely because totals are visible.
- Quota ledger stores IDs, purpose, model, units, cost, status, safe errors, and timestamps—not complete prompt/content payloads.

### Reservation and correctness
- Reserve estimated maximum usage before expensive work, settle actual usage afterward, and release unused reservation.
- Accepted operations finish rather than being cut off mid-generation.
- Provider/Melo failures do not consume customer allowance, though real provider cost remains visible internally.
- Retry uses one idempotency key and cannot charge twice.
- Group pools, branch allocations, central reserves, top-ups, and bounded manager-approved exceptions are supported.

### Customer experience
- Keep usage UI sleek and non-intrusive. Normal low-cost actions may show compact remaining allowance.
- Heavy actions open a clear confirmation summarizing estimated tokens/pages/cost or allowance consumption, remaining balance, and alternatives.
- Warnings default around 75%, 90%, base exhaustion, and grace exhaustion, configurable by plan.
- Hard-limit messages explain the exact shortfall and offer narrower page ranges, top-up, approval, upgrade, or cancellation.
- Customer UI uses understandable allowances and money; platform reporting retains granular token/provider economics.

### Documents and storage
- Default upload cap is 25 MB, configurable by plan.
- Client preflight shows size, page count, selected pages, allowance impact, and a non-intrusive recommendation before upload; backend remains authoritative.
- Offer trusted compression guidance/link when oversized, unless Melo’s own safe compression workflow is available.
- Plan page limits remain configurable rather than buried constants. Basic/Standard/Premium may carry increasing allowances and every tier may purchase extra credits.
- Large-document batching proposes chapters/ranges, shows total cost, requires confirmation, processes idempotently, and retries only failed batches.
- Track active, recoverable-trash, and temporary-processing storage separately; temporary artifacts expire and must not permanently double-charge usage.

### Commercial flexibility
- Included allowance normally does not roll over; purchased top-ups remain until used or a clearly disclosed expiry.
- Platform-approved model profiles map models to tasks; arbitrary model selection is not the default.
- Audit threshold crossings, blocks, top-ups, exceptions, entitlement changes, corrections, and abuse interventions without flooding the log with every successful call.

## F7 — Platform Monetization, Subscription, and Settlement

### Authoritative pricing anchor and supporting context
- The direct interview decision is authoritative: seed Core/Basic at **₦1,000 per active student per term plus a ₦30,000 setup fee**.
- Other prices or discounts found in walkthroughs, brand strategy, mockups, or exploratory documents are not approved defaults and must not drive implementation.
- `docs/strategy/PlatformPricingAndPackagingStrategy.md` and `docs/features/PerSchoolPaystackMerchantRouting.md` remain useful architecture context for separating SaaS billing from school collections and for school-owned Paystack routing, but they do not override this ledger.
- Platform Super Admin can configure currencies, volume bands, minimums, discounts, setup fees, negotiated overrides, and effective dates. Existing contracts retain versioned price snapshots; approved values are catalog data, never scattered code constants.

### Commercial structure
- Keep three visible charge classes separate: platform subscription, AI/OCR/storage top-ups, and any payment-processing/platform collection charge.
- Basic/Core, Standard, and Premium/Enterprise use simple per-active-student pricing with a minimum school charge. A billable-student snapshot excludes applicants, archived/duplicate records, graduates, and historical-only records; proration is explicit and issued invoices are immutable snapshots.
- Support termly and annual-upfront billing, optional monthly cadence where operationally justified, and contract-specific Enterprise schedules. Annual discounts remain configurable rather than fixed permanently at the historical 10%.
- Schools may opt into provider-authorized recurring debit. Melo never stores raw card details. Issue advance notices and invoices, audit attempts, use disclosed retry/grace rules, and avoid sudden loss of required historical records.
- Included AI/document allowances are plan entitlements. Basic/Standard/Premium can buy prepaid top-ups; Enterprise may use bounded postpaid billing with spending limits.

### School-fee collection and settlement
- Default/trust-first mode remains the historically promised school-owned Paystack merchant: parent funds settle directly under the school's merchant account and Melo bills SaaS separately.
- An optional Melo-routed Paystack subaccount/split mode may be offered only after provider, accounting, tax, legal, refund, and reconciliation requirements are validated. It must not involve an opaque Melo bank-account hold.
- Split-mode contracts may use a disclosed percentage, fixed successful-transaction fee, percentage plus capped fixed amount, or an included/no-extra-fee rule. Do not stack hidden charges.
- Show gross parent payment, provider fee, Melo fee, school net amount, refunds, disputes, chargebacks, and adjustments as separate ledger entries.
- Never promise universal next-day settlement. Display provider-derived settlement status/estimates and disclose weekends, verification, country, dispute, and risk dependencies.
- Marketing must describe the selected routing mode accurately; the unconditional “100% direct” claim applies only to direct school-merchant mode.

### Access and governance
- Platform Super Admin controls plan catalog, commercial rate cards, contract overrides, effective dates, top-up catalog, and settlement oversight.
- Proprietors choose approved contract cadence/routing and see group costs. Delegated finance managers may manage operations within RBAC limits; bursars reconcile school fees but cannot alter Melo pricing.
- Audit every contract, price, mandate, routing, fee, credit, exception, and settlement configuration change.

## H9 — School Assets and PDF Compression Foundation

### Asset domain and tenancy
- Create a private general school-asset library for policies, circulars, report templates, brochures, past papers, logos, and similar documents. Keep it separate from lesson-knowledge sources and their AI/approval lifecycle.
- Assets are branch-owned by default. Group sharing is explicit, permission-gated, and never inferred merely from common group membership.
- Support understandable kinds, metadata, filters, search, storage usage, upload progress, compression state, and lifecycle state.

### Authorization and audit
- Define distinct capabilities to view, upload, download, edit metadata, archive/trash, restore, permanently delete, and manage group-shared assets.
- Audit upload/finalization, sensitive download, visibility/share change, replacement, archive/trash, restoration, retention hold, and permanent deletion without exposing document contents in the audit log.
- No anonymous or public links in v1. Future external links must expire, be revocable, respect permissions, and support download auditing.

### Quotas and validation
- Keep 25 MB as the default per-file limit, configurable by plan and entitlement policy rather than a permanent feature constant.
- Storage allowance is controlled by H8/F7 entitlements: plan defaults, group pools and branch allocations, purchasable capacity, warning thresholds, and bounded audited exceptions. The prior 5 GiB proposal is a configurable baseline, not hard-coded commercial policy.
- Validate actual file signatures and authoritative storage metadata, not only browser MIME/name. Enforce type, size, ownership, tenancy, and quota again server-side.
- Quarantine uploads until required validation completes. Malware scanning is required before production access expands beyond tightly controlled administrators; failures remain isolated and recoverable.

### Archive, Trash, and retention
- Provide a visible, navigable Trash area analogous to the existing Archive area, with filtering, item inspection, restoration, and authorized permanent deletion.
- Normal deletion moves an asset to Trash. Default recoverability is 30 days, configurable under retention policy.
- Trashed bytes remain visible and count toward quota until purge; active, trash, and temporary-processing storage are reported separately.
- Retention/legal holds block purge. Permanent deletion requires explicit confirmation, capability checks, tenant checks, and an audit event.
- Expired-trash cleanup is idempotent and retryable; failed cleanup never makes the UI falsely claim that bytes were released.

### Compression safety
- Optimize only eligible ordinary PDFs; skip encrypted, digitally signed, malformed, unsupported, and form-sensitive documents when transformation could damage behavior or legal integrity.
- Validate the candidate output, including readability and page-count preservation, before replacement. Require meaningful savings (initial proposal: more than 10%).
- Keep the original temporarily for rollback, then purge it under an explicit cleanup policy after validation. Compression failures retain the original and may retry idempotently.
- Never advertise structural `pdf-lib` reserialization as guaranteed image compression. It may save little on scanned/image-heavy PDFs; offer safe compression guidance or a vetted external option when needed.
- Native binaries and unverified runtime dependencies remain out of v1 until a Convex runtime spike proves them safe and deployable.

## Requirements Frontier Complete
The approved interview frontier covers H1-H9 and supporting foundations F1-F7. Proceed to dependency-aware implementation-program synthesis; do not begin feature implementation until the synthesized program is reviewed and approved.
