# Demo School Migration Rehearsal Daybook

**Document status:** rehearsal guide for the **existing development demo school** · documentation only · 2026-09-06

> **Current gate:** authenticated rehearsal is **BLOCKED**. The latest U7 preflight found no `$HOME/.melo-ops/approved-development-targets.json` and no shell `CONVEX_DEPLOYMENT`. Do not start Convex-backed apps, sign in, seed, deploy, import, export, migrate, or run the root Playwright suite until an authorized operator records a value-silent exact match to the approved development target. Static Sites evidence exists; it does not clear this gate.

This daybook turns D-05 and the current U1–U7 implementation record into a supervised, chronological rehearsal. It is not an authorization ticket, a migration utility, or an invitation to import production data. Never choose or self-approve a target. Never substitute an internally consistent URL for an approved target.

## 1. Read this first: the two tracks

### Track A — UI-led adoption of the existing demo school

Use the existing demo school and its current students, teachers, classes, invoices, results, and history. Through current UI routes, rehearse group/branch linking, explicit membership, RBAC, settings, academic workflows, transfers, and persona verification. Create only unmistakable, reversible QA records. **Do not create a replacement “real” school, merge tenants, rewrite operational `schoolId` values, seed, or import a production export.**

Track A may begin only after the target and credential gates pass. It does not require Track B to be executed if the existing approved development data is already fit for UI testing.

### Track B — operator-gated schema, backfill, or data rehearsal

This is a separate dual-custody operation for a Data Migration Architect and Security Systems Operator. It requires an approved development allowlist, an authorization ticket, a verified external pre-refresh development backup, an independently authorized read-only snapshot handoff, reviewed commands, and complete zero-delta reconciliation. The guide includes control points but grants no authority.

**DO NOT RUN Track B commands until every prerequisite is signed.** Production stays read-only. This guide contains no production-targeting export command. A tester must never supply, select, or self-approve a production target or snapshot.

### Stop/go rule

A **GO** advances one gate only. Any ambiguity is **STOP**, not “proceed with caution.” Stop on target ambiguity, missing backup proof, any count/byte/reference delta, cross-branch exposure, unresolved identity conflict, unauthorized privilege, secret/PII capture, or unstable retry behavior.

## 2. Control desk: people, safety, and evidence

### Required handoffs

- [ ] **School rehearsal lead** owns Track A schedule and reversible QA labels.
- [ ] **Platform operator** may create/link a group only with Platform authorization and an approved exact school list.
- [ ] **Data Migration Architect** owns Track B batch/reconciliation criteria.
- [ ] **Security Systems Operator** independently checks target proof and has abort authority.
- [ ] **Domain reviewers** sign academic, finance, identity/RBAC, and privacy outcomes.
- [ ] **Evidence custodian** stores only redacted, non-sensitive evidence and the checklist manifest.

Dual custody is mandatory for Track B. The school admin, teacher, registrar, bursar, parent/student, and visitor personas should use separate private browser contexts so sessions do not overwrite one another.

### Credential and evidence rules

- Read demo credentials only from `tmp/demo_school_credentials.md` after authorization. Never echo, paste, screenshot, commit, or place them in this HTML checklist or browser storage.
- Do not record IDs embedded in private URLs, auth headers, cookies, provider payloads, complete bank numbers, student PII, private files, snapshot paths, deploy values, or command logs.
- Use neutral evidence references such as `A-G05-03-redacted.png`; retain sensitive originals only in approved external storage.
- HTML progress stores only checkbox IDs in this browser’s `localStorage`. Notes, names, IDs, values, credentials, and evidence are not stored by the page.
- Root `pnpm test:e2e` is not approved for this exercise: its current global setup can seed Convex, start broad servers, and retain traces/videos.

### Disposable QA labels

Use a run code that contains no person data: `QA-MIG-YYYYMMDD-R1`. Suggested names: `QA-MIG-… Class`, `QA-MIG-… Subject`, `QA-MIG-… Student`, `QA-MIG-… Fee Plan`, and `QA-MIG-… Transfer`. Never rename or repurpose an existing student/teacher to make a test easier. Archive reversible QA records; do not hard-delete financial or historical records.

## 3. Preflight pass/fail sheet

Mark every row **Pass**, **Fail**, **Blocked**, or **N/A with reason** in the external evidence ledger. Blank is not Pass.

- [ ] Authorization ticket names the rehearsal, operators, development-only scope, time window, and exact permitted actions.
- [ ] Current branch/commit and reviewed document versions are recorded without modifying unrelated work.
- [ ] External allowlist exists and the D-05 value-silent check exactly matches root, shell, Admin, Teacher, Portal, Platform, and www.
- [ ] `apps/sites` remains a no-Convex static publication seam; Apply has no current runtime and is not represented by another app.
- [ ] No checked target carries `prod:`, `production:`, or a known production identifier.
- [ ] Credential file exists; body remains private and is not copied to evidence.
- [ ] Intended ports are free or occupied only by processes explicitly owned by this rehearsal.
- [ ] Evidence directory is encrypted/access-controlled and outside the repository when it may contain sensitive material.
- [ ] Browser plan disables traces, videos, network payload capture, and persistent authenticated state unless separately approved.
- [ ] QA run code and cleanup owner are assigned.
- [ ] Starting counts and configuration are recorded before mutation.
- [ ] Track B only: pre-refresh development backup has nonzero/greater-than-10KB size, SHA-256, readable ZIP validation, and independent restore confidence.
- [ ] Track B only: source snapshot handoff authorization and checksum evidence exist outside Git.
- [ ] Track B only: reviewed reconciler can enumerate every application table including empty tables, storage count/bytes, and all references.

**Gate 0 decision:** GO only if every applicable item passes. Otherwise record BLOCKED and stop.

## 4. Local access board

After Gate 0 passes, start only the apps needed for the bounded session. These repository-supported development scripts bind the Convex-backed apps to `0.0.0.0`:

```bash
pnpm --filter @school/www dev
pnpm --filter @school/teacher dev
pnpm --filter @school/admin dev
pnpm --filter @school/portal dev
pnpm --filter @school/platform dev
pnpm --filter @school/sites exec next dev --webpack --port 3005 -H 0.0.0.0
```

Do not run these commands as part of reading this guide. Convex-backed apps remain gated by approved target proof. Sites is static and hostname-routed, but its separate use still needs the rehearsal owner’s scope approval.

At runtime, fetch the current address; never reuse an address copied from an old report:

```bash
tailscale ip -4
```

| App | Local URL | Tailscale URL pattern | Sign-in / note |
|---|---|---|---|
| Public www | `http://localhost:3000` | `http://<current-tailscale-ip>:3000` | Public product site; no school login route claimed |
| Teacher | `http://localhost:3001` | `http://<current-tailscale-ip>:3001` | `/sign-in` |
| Admin | `http://localhost:3002` | `http://<current-tailscale-ip>:3002` | `/sign-in` |
| Portal | `http://localhost:3003` | `http://<current-tailscale-ip>:3003` | `/sign-in` |
| School Sites | `http://localhost:3005` | `http://<current-tailscale-ip>:3005` | Hostname-routed static publication; raw IP may return unknown-host 404 |
| Platform | `http://localhost:3006` | `http://<current-tailscale-ip>:3006` | `/sign-in` |

Binding to `0.0.0.0` is **not Tailscale-only** and may expose the service to the LAN depending on Windows Firewall and network settings. Do not use Funnel, router port forwarding, or a public tunnel. If remote access fails, confirm Tailscale is connected, the listener is on `0.0.0.0`, and Windows Firewall allows the selected port. For Sites, a remote client may also need an approved local DNS/hosts mapping for the published hostname.

## 5. Starting baseline: preserve before you adopt

Persona handoff: **rehearsal lead → school admin + evidence custodian**.

- [ ] Record existing demo school display name, active session, active term, branches, and group status.
- [ ] Record counts for active/archived students, teachers, classes, subjects, fee plans, invoices, report cards, assets, and transfers where current UI exposes them.
- [ ] Record current main teacher assignments and one existing student’s authorized report/billing visibility using redacted labels.
- [ ] Record current grading bands, exam weights, numbering policy/version/next-number display, bank-account count/default label, theme bases, and group-default origins.
- [ ] Record current role assignments, direct grants/restrictions, management ceilings, and audit filters without copying sensitive detail.
- [ ] Track B only: record complete source and destination table/storage aggregates in the external manifest—not in this page.

**Preservation rule:** later counts may increase because of QA records, but existing student/teacher IDs, branch ownership, historical scores, issued reports, invoices, and source transfer history must not be rewritten or disappear.

## 6. Gate 1 — Platform group and branch linking

Persona handoff: **Platform operator → proprietor/group reviewer → branch admin**.

Current routes: Platform `http://localhost:3006/groups` and `/schools`; Admin `http://localhost:3002/admin/group`.

- [ ] Review `/schools`; confirm **Assign Admin** and **Migration** are distinct actions.
- [ ] In `/groups`, select only the approved existing demo school branches. Do not create a substitute school to avoid review.
- [ ] Select an explicitly reviewed canonical proprietor/HQ owner; never infer ownership from title, email, or legacy role.
- [ ] Confirm the target slug/name and branch list before create/link.
- [ ] Verify linking does not merge tenants or rewrite `students`, `classes`, `studentInvoices`, scores, attendance, or existing `schoolId` values.
- [ ] Open Admin `/admin/group`; verify group/branch metadata and bounded overview states. Treat unavailable/null metrics as unavailable, never zero.
- [ ] Test duplicate link, inactive group, unauthorized Platform identity, and stale confirmation paths.

**STOP** if the exact linkage list or owner is not authorized, a branch is already linked incompatibly, or any operational row appears rekeyed. Current implementation has bounded group views and explicit overflow states; it is not proof of unlimited aggregate readiness.

## 7. Gate 2 — Canonical identity and membership

Persona handoff: **identity reviewer → branch proprietor → app persona owners**.

- [ ] Confirm each test persona resolves by exact canonical token identity where present; never match or merge identity by email, name, or display title.
- [ ] Confirm explicit active branch memberships exist for the exact branches needed; group linkage alone is not branch access.
- [ ] Verify suspended/reconciliation-required people, archived memberships, inactive schools, missing links, and token mismatches fail closed.
- [ ] Verify a principal/admin remains branch-bound unless an additional explicit membership exists.
- [ ] For the existing main teacher, compare branch membership with actual class/subject assignment; membership does not create teaching assignment.
- [ ] If a branch switcher is shown, verify active branch is unambiguous and unsaved work invokes Stay / discard / supported save-draft behavior.
- [ ] Confirm unsupported routes remain default-branch-only rather than pretending to switch globally.

Track B identity note: only MX-01/MX-02 has an implemented durable runner (`functions/academic/identityMigration:backfillCanonicalIdentityBatch`). It self-schedules while `in_progress`, has no pause/cancel state, clamps batches to 1–150, resumes from persisted state, and records conflicts separately. Do not invent or issue an invocation command in this guide. An authorized scheduling/deployment owner must contain queued work before claiming it stopped.

## 8. Gate 3 — RBAC, direct denial, and audit

Persona handoff: **proprietor → delegated manager → restricted tester → audit reviewer**.

Current routes: Admin `/admin/permissions`, `/admin/audit`; Platform `/audit`.

- [ ] Verify seven template choices are visible where configured: Proprietor, Principal, Academic Director, Exam Officer, Bursar, Registrar, Staff Administrator.
- [ ] Verify custom display title is separate from authority; combining templates uses union + grants − restrictions.
- [ ] Preview effective permissions before save and verify a delegated manager cannot edit self, proprietor, Platform admin, peers/superiors, or exceed the proprietor-defined ceiling.
- [ ] Confirm sensitive powers remain separate: permissions, bank details, exports, password reset, destructive actions, final report publication, and number override.
- [ ] As restricted persona, paste direct Admin URLs for settings, billing, bank accounts, manual adjustments, permissions, and audit. Expect clear denial/sign-in, no data flash, and backend rejection—not only hidden navigation.
- [ ] Try a safe foreign-branch ID/URL. Expect no cross-branch content.
- [ ] In audit, filter by branch/module/action/date/actor where authorized; verify append-only safe summaries, masked finance data, and scope-equivalent CSV/print preparation.
- [ ] Verify sensitive actions create addressed alerts where implemented; routine edits should remain searchable without notification noise.

Known boundary: source and synthetic tests passed for enumerated U1 authorization slices, but authorized schema rollout, historic `groupId` backfill, full producer inventory, browser print/export fidelity, and legacy-admin parity evidence remain gated. A Platform identity has no blanket tenant operational bypass.

## 9. Gate 4 — Academic structure, existing people, and numbering

Persona handoff: **academic admin → registrar → staff administrator → teacher**.

Use the realistic order below. Inspect before creating anything.

1. `/academic/sessions`: preserve the active session/terms; create only a future QA session if authorized. Test invalid/overlapping dates.
2. `/academic/classes`: record existing count, create `QA-MIG-… Class`, edit/reload, then archive at cleanup.
3. `/academic/subjects`: create at most one QA subject and reversible class association; test duplicate handling.
4. `/academic/teachers`: locate the existing main teacher and preserve existing identity; make only reversible assignment changes. A title/assignment must not grant admin authority.
5. `/admin/settings/admission-numbering`: review token format, policy version, branch/level sequence, reset rule, and **Next number to issue** preview.
6. `/academic/students/onboarding`: create one disposable student only after validation checks and class/session review.
7. `/academic/students`: verify all pre-existing students remain, search works, and the QA student is distinguishable.

- [ ] Opening/abandoning a form does not consume a number.
- [ ] Failed or duplicate submit creates no student and consumes no number.
- [ ] Successful allocation is unique; gaps may occur and must be auditable—perfect gaplessness is not promised.
- [ ] Manual override requires separate capability, uniqueness check, confirmation, reason, and an explicit choice before advancing a counter.
- [ ] Changing format affects new allocations only; existing admission numbers remain unchanged.
- [ ] Existing teachers/students, classes, assignments, and archived records remain available and branch-scoped.

Import route: `/students/import` (with `/academic/students/import` alias). Use only a tiny de-identified QA fixture with one valid, one duplicate, and one malformed row. Current reviewed importer is creator-private and deterministic; source file upload and AI/provider interpretation are unavailable. Preserve supplied historical identifiers, propose only missing numbers, require human review, and retry the same commit intent to prove idempotency. Never upload a production export.

## 10. Gate 5 — Grades, results, and print truth

Persona handoff: **exam officer → assigned teacher → guardian/student reviewer**.

- [ ] `/assessments/setup/grading-bands`: record the existing six-band policy; verify no gaps/overlaps, one standard preset, accessible label plus color, and explicit inherited/override source.
- [ ] `/assessments/setup/exam-recording`: reject totals below/above 100%; save only a valid QA configuration.
- [ ] Admin `/assessments/results/entry`: enter distinctive reversible QA scores in the exact class/subject/session/term.
- [ ] Teacher `/assessments/exams/entry`: verify only assigned classes/subjects and valid score ranges; compare saved result with Admin.
- [ ] `/assessments/report-card-extras` and manual adjustments: use a reversible remark; require attribution/reason for manual changes.
- [ ] `/assessments/report-cards`: verify grade labels and scores remain understandable without color.
- [ ] Check print preview, Save as PDF if authorized, grayscale, page breaks, and 200% zoom. Do not claim physical/PDF evidence unless actually captured.
- [ ] Verify issued report snapshots remain stable after later grade-policy or score edits; do not backfill/reissue history automatically.
- [ ] Portal `/results` and `/report-cards`: compare the authorized selected student only.

Brand colors must not replace grade/status semantics. Printed surfaces retain white paper and readable monochrome behavior.

## 11. Gate 6 — Billing, bank accounts, and document snapshots

Persona handoff: **proprietor/delegated bursar → school admin → guardian/student reviewer**.

Current routes: Admin `/billing`, `/billing/bank-accounts`, `/billing/subscription`, `/billing/settlements`, `/billing/usage`; Portal `/billing`.

- [ ] Review existing fee plans/invoices without changing real financial records or triggering Paystack.
- [ ] Create only an isolated QA fee plan if reversible; assign to the QA student/class and inspect the resulting invoice.
- [ ] Review multiple bank-account support, masked summaries, one default, confirmation, archive-not-delete, and separate bank-management capability.
- [ ] Use no real bank details. If a QA bank change is authorized, verify immutable masked audit and leadership alert.
- [ ] Verify issued invoice payment instructions are snapshotted: a later bank-setting change affects drafts/new documents only.
- [ ] Verify invoices/statements/unpaid Portal instructions may show approved transfer details; receipts/settled items omit unpaid transfer instructions by default.
- [ ] Portal billing shows only the explicitly selected linked student; changing a `studentId` must not expose another student.
- [ ] Subscription, usage/top-up, and school-fee/collection surfaces remain visually and semantically separate.
- [ ] Settlement rows show only recorded provider evidence; missing legs are not invented as zero and no universal next-day settlement promise appears.

Do not call a school-confirmed bank account provider-verified. An issued-unpaid subscription invoice, legacy mandate state, or catalog label does not activate an entitlement or prove payment.

## 12. Gate 7 — Drafts, theme, and group defaults

Persona handoff: **form owner → branch/group settings owner → accessibility reviewer**.

- [ ] On student onboarding, teacher onboarding, fee/session setup, report settings, email review, import, and planning where integrated: verify timestamped Preview / Resume / Discard.
- [ ] Verify Saving, Draft saved, connection/recovery pending, Save failed, and Conflict are truthful and distinct from form progress.
- [ ] Test reload, Back, sidebar, sign-out, account/branch switch, two-tab revision conflict, retry, and reauthentication recovery without claiming offline operation.
- [ ] Confirm passwords, tokens, provider evidence, raw files, bank secrets, and prohibited sensitive payloads never enter localStorage or draft/audit payloads.
- [ ] On 320px, verify validated section progress is not mislabeled scroll completion; short forms do not gain redundant progress.
- [ ] `/admin/settings`: edit only QA-safe Primary/Accent bases, verify derived readable focus/hover/pressed/surface states, then restore baseline.
- [ ] `/admin/group` and `/admin/settings/group-defaults`: verify source/version/inherit/override/reset for implemented branding, grading, roles, admission format, report defaults, Portal in-app notifications, exam policy, and relative calendar templates.
- [ ] Verify changing Admin theme does **not** claim to synchronize Sites. Sites uses an explicitly published static configuration seam.

## 13. Gate 8 — Email, import, commercial, usage, and assets

Persona handoff: **school policy owner → provider/compliance gatekeeper → Platform commercial owner → asset reviewer**.

### Institutional email

At `/admin/settings/email-domains`, rehearse policy and dry-run review only with synthetic names. Keep the three states exact:

1. `login_only` — identifier metadata, **no inbox**;
2. externally managed mailbox with recorded evidence;
3. provider-provisioned mailbox with recorded evidence.

- [ ] Domain registration is intent, not DNS verification.
- [ ] AI/import may propose an address but cannot provision a mailbox.
- [ ] Collision/manual review is deterministic and human-approved.
- [ ] No send, forwarding, provider alias activation, or external suspend is implied.
- [ ] Google Workspace, Microsoft 365, and Zoho remain gated by domain control, provider API/licensing/delegation, data residency, privacy/counsel, sandbox, idempotency, and reconciliation.

### Commercial and usage

Platform `/commercial` and Admin `/billing/subscription`/`usage` are local configured workflows, not payment activation.

- [ ] Only the approved configurable seed anchor is represented: Core/Basic ₦1,000 per active student per term + ₦30,000 setup; no invented Standard/Premium price.
- [ ] Rate/contract/invoice snapshots are versioned and immutable; school fee, SaaS, usage/top-up, and collection ledgers do not mix.
- [ ] Heavy-operation preflight shows configured estimate/shortfall and confirmation; current dispatch intentionally ends provider-unavailable with `chargedUnits: 0`.
- [ ] Retry uses one idempotency intent and does not double reserve/charge.
- [ ] No merchant verification, recurring debit, split settlement, actual provider-cost ingestion, or customer purchase is claimed.

### Assets

Use `/admin/assets`, `/admin/assets/archive`, and `/admin/assets/trash` to inspect existing safe metadata only.

- [ ] Library remains separate from lesson knowledge and branch-owned unless an explicit same-group grant exists.
- [ ] Archive, Trash, restore, legal hold, exact-confirmed purge, and active/trash/temp accounting are distinct.
- [ ] Trashed bytes remain charged until confirmed deletion; cleanup failure must not claim released bytes.
- [ ] Upload/finalization, download delivery, AV clearance, and PDF promotion are currently server-disabled/gated. Do not upload a file or label an asset clean.
- [ ] Historical recorded scan evidence is not live clearance; no anonymous/public asset links exist.
- [ ] PDF optimization does not promise image compression; signed/encrypted/form-sensitive/unsupported files must remain unchanged.

## 14. Gate 9 — Within-group transfer and continuity

Persona handoff: **source registrar → destination registrar → direct-student Portal reviewer → audit reviewer**.

Current route: Admin `/academic/students/transfers` plus student profile history.

- [ ] Choose only the disposable QA student and an approved destination branch in the same active group.
- [ ] Record explicit guardian consent method/evidence reference and source release; do not copy health, safeguarding, discipline, finance, address, phone, or guardian dossier data.
- [ ] Source authority proposes class/session names only; destination registrar selects actual destination class and active session.
- [ ] Acceptance uses current destination numbering preview/policy; manual override follows the separate governed path.
- [ ] Retry the identical intent after a simulated/lost response; expect one transfer, one destination enrollment, one number claim, and no duplicate audit transition.
- [ ] Verify source student `schoolId`, admission number, attendance, scores, invoices, and report history remain unchanged; source enrollment becomes transferred-out only on completed acceptance.
- [ ] Verify destination receives a separate active enrollment and explicit canonical person/user/membership linkage—never email matching.
- [ ] Portal direct-student selector labels destination **Current** and source **History**; each context shows only that branch’s authorized data.
- [ ] Revoke/suspend destination membership and verify that context disappears while independently authorized source history remains.
- [ ] Exercise reject/cancel, stale policy/class/session, absent consent, inactive group, denied persona, concurrent retry, and missing-numbering states.

Known gate: existing completed transfers are not auto-repaired; parent continuity requires an explicitly reviewed destination family/member relationship. M9/F4 independent-school transfer is intentionally deferred and must not be inferred from this within-group flow.

## 15. Gate 10 — Cross-app, denial, retry, and responsive verification

Persona handoff: **Admin → Teacher → Portal → Sites visitor → evidence custodian**.

- [ ] Admin dashboard identifies the correct school and survives refresh/new tab without scope drift.
- [ ] Teacher sees only assigned classes/subjects; out-of-range scores and unassigned classes are denied server-side.
- [ ] Teacher planning `/planning`, `/planning/lesson-plans`, `/planning/library`, `/planning/question-bank`, `/planning/videos` has truthful empty/loading/error/draft states; avoid paid actions.
- [ ] Portal `/results`, `/report-cards`, `/billing`, `/notifications`, `/learning/topics`, and a topic detail enforce selected-student/family scope.
- [ ] Sites home/contact/visit uses only published public data. Unknown/inactive/missing routes may return real 404; latest evidence observed visually blank custom 404 bodies in development—record, do not replace with a mock.
- [ ] Test direct denied URLs, copied foreign IDs, sign-out then Back, expired/revoked session, lost-response retry, duplicate submit, and stale revisions.
- [ ] Test 320px, 390px, 768px, desktop, 200% zoom, keyboard-only traversal, visible focus, logical heading/order, labelled fields, modal focus return, and reduced motion.
- [ ] Print the checklist and real report/finance surfaces where authorized; verify grayscale, clipping, repeated headers, page breaks, and sensitive-data redaction.
- [ ] Capture only redacted evidence. A screenshot of a UI is not proof of provider operation, schema rollout, settlement, mailbox delivery, AV clearance, or production readiness.

## 16. Track B operator ledger — DO NOT RUN until prerequisites

This section is a controlled reminder, not an execution authorization. Every command that reaches Convex requires the D-05 value-silent target check immediately before use, an approved development target, dual custody, and a private log outside Git.

### B1. Target and script review

- [ ] Review root `convex:dev`, `convex:deploy`, `convex:codegen`, `demo:seed`, `judge:seed`, all app scripts, setup scripts, `verify-convex-setup.ts`, `convex.json`, and new scripts for reach/mutation semantics.
- [ ] Remember `scripts/verify-convex-setup.ts` can invoke codegen; its name does not make it read-only.
- [ ] Record only pass/fail and reviewed allowlist version. Do not print or hash environment contents.

### B2. Backup and refresh commands

**DO NOT RUN — operator-gated.** These D-05 commands are repository/tool supported but dangerous because they export or replace deployment data. Variables must be prepared privately outside the repository.

```bash
# DO NOT RUN until the approved development target, ticket, dual custody,
# secure external path, and private log are verified.
npx convex export --include-file-storage --path "$DEV_BACKUP_ZIP" >"$PRIVATE_LOG" 2>&1
sha256sum "$DEV_BACKUP_ZIP" > "${DEV_BACKUP_ZIP}.sha256"
unzip -t "$DEV_BACKUP_ZIP"

# DO NOT RUN until a separately authorized read-only snapshot handoff,
# repeated development-target proof, and verified dev backup all pass.
npx convex import --replace-all "$PROD_SNAPSHOT_ZIP" >"$PRIVATE_LOG" 2>&1
```

There is deliberately no production export command here. The handoff happens through a separate authorized read-only process. Never store archives, credentials, logs, PII, or target values in Git.

### B3. Schema and implemented migration boundary

**DO NOT RUN — operator-gated:** `pnpm convex:dev`, `pnpm convex:codegen`, `pnpm convex:deploy`, `pnpm demo:seed`, and `pnpm judge:seed`. They reach or mutate the selected deployment. Setup scripts can initialize/connect/push configuration. No seed is part of adopting the existing demo school.

Only the MX-01/MX-02 canonical identity/membership batch runner is implemented as a durable self-scheduling migration runner. MX-03 through MX-15 in D-05 are proposed rehearsal contracts or independently implemented product surfaces—not one universal runner and not authorization to backfill. Do not claim `paused`, `scheduled`, or cancellation states that do not exist.

### B4. Reconciliation acceptance

- [ ] Every source application table, including zero-count tables, appears in the restored set with exact count delta `0`; no missing/extra tables.
- [ ] File-storage object count delta `0` and byte delta `0`.
- [ ] Every manifest/domain storage reference resolves; unresolved count `0`.
- [ ] Every student school resolves; every invoice’s student belongs to the same school; class/enrollment school references agree.
- [ ] Canonical users/persons/memberships are complete or explicitly blocked by reviewed reconciliation issues; no email matching.
- [ ] Existing demo students, teachers, classes, scores, invoices, issued reports, and school IDs remain unchanged except approved additive links/QA operations.
- [ ] Authenticated demo smoke succeeds with no unexplained 403/500 and no tenant leakage.
- [ ] Retry/idempotency and cumulative migration run state are reconciled.

D-05 currently records only an aggregate 3,956 documents with zero table-count differences and 60 storage files from an earlier refresh; full per-table, paired storage-count, storage-byte, reference, tenant/auth, and browser evidence remains pending. Do not promote those aggregates into a current Pass.

## 17. Stop, rollback, and cleanup

### Immediate stop triggers

- Target ambiguity or any production marker/reference.
- Missing/invalid backup or source handoff proof.
- Any nonzero table/storage/reference delta.
- Cross-tenant visibility, unauthorized privilege, or unresolved canonical identity conflict.
- Repeated auth failure, batch timeout/OCC failure over the approved threshold, missing-index warning, or unstable self-scheduled run.
- Secret, PII, bank detail, private file, or credential captured in logs/evidence.

### Track A rollback/cleanup

- [ ] Stop new UI changes; preserve error state and redacted evidence.
- [ ] Restore QA-safe settings to the recorded baseline.
- [ ] Archive clearly labelled QA classes, subjects, students, plans, and assets where lifecycle controls permit.
- [ ] Use transfer cancel/reject before completion when appropriate; completed transfers require an audited forward correction, not history deletion.
- [ ] Never delete issued invoices, report history, audit events, number claims, or existing school records to “clean up.”
- [ ] Sign out every persona and close private contexts.
- [ ] List cleanup requiring an authorized operator; do not silently perform it.

### Track B rollback

**DO NOT RUN — operator-gated.** After repeating exact development allowlist proof, D-05 restores the verified pre-refresh development backup with:

```bash
# DO NOT RUN until rollback is authorized and development target proof is repeated.
npx convex import --replace-all "$DEV_BACKUP_ZIP" >"$PRIVATE_LOG" 2>&1
```

Then repeat the complete reconciliation before declaring baseline restored. Production has no rollback action because it was never mutated. If the identity runner is active, an authorized scheduling/function-rollout owner must contain and account for queued/executing work; Ctrl+C alone is not proof of pause.

## 18. Evidence manifest and sign-off

### Evidence ledger fields

For every gate, record externally:

- gate/check ID, UTC timestamp, persona, app and non-sensitive route;
- expected vs actual result and Pass/Fail/Blocked/N/A;
- QA label, not real person/student details;
- redacted evidence filename and SHA-256 where policy permits;
- authorized operator/reviewer and follow-up owner;
- target-proof version, never target values;
- for Track B: ticket, reviewed command/version, batch/run ID reference, complete count/storage/reference result, rollback result;
- explicit limitations: no provider, no production, no runtime, no print, or no browser proof where applicable.

### Final sign-off sheet

- [ ] Track A school-process owner: existing records preserved; QA cleanup assigned.
- [ ] Identity/RBAC reviewer: canonical linkage, branch scope, denial, and ceiling checks passed.
- [ ] Academic reviewer: sessions/classes/subjects/teachers/numbering/grades/report history passed.
- [ ] Finance reviewer: bank/document snapshots and charge-class separation passed without live payment.
- [ ] Privacy/security reviewer: no cross-branch leak, secrets, PII, or unsupported provider claim.
- [ ] Accessibility reviewer: mobile, keyboard, reduced-motion, zoom, and print checks completed or explicitly blocked.
- [ ] Track B Data Migration Architect and Security Systems Operator: zero-delta reconciliation and rollback evidence signed, if Track B actually ran.
- [ ] Known gates are copied forward; no Blocked item is relabelled Pass.

**Outcome:** `GO for next approved development gate`, `CONDITIONAL / follow-up required`, or `STOP / rollback`. This is never a production launch approval.

## 19. Known gates and truthful limits

- Latest authenticated U7 acceptance is blocked by absent external development allowlist and unset shell deployment. Static Sites alone has runtime evidence.
- Apply app/runtime is absent. Do not invent an Apply URL or substitute another app.
- Additive schema/index/function rollout and generated API refresh remain operator-gated.
- Group branch switching is available only on a closed Admin route allowlist; unsupported Admin and all Teacher routes remain default-only.
- Existing demo admin parity, historic audit group backfill, browser print/export fidelity, and complete audit producer coverage need approved runtime evidence.
- Institutional email is policy/login-only metadata unless external evidence says otherwise. No current provider outbox, send, alias activation, or mailbox lifecycle execution is enabled.
- Import has deterministic reviewed commit logic, but source-file upload/AI provider interpretation is unavailable; AI never writes directly.
- Heavy AI/OCR dispatch remains intentionally provider-unavailable and zero-charge; no provider settlement or actual-cost ingestion is proven.
- Asset upload/finalization/download/AV/PDF promotion are server-disabled or gated. No asset may be called clean without approved scanner evidence.
- Sites is statically published and not synchronized from Admin. Latest development evidence found real 404 responses whose custom body appeared visually blank.
- Commercial workflow does not prove payment, merchant verification, recurring debit, split settlement, tax/legal approval, or next-day settlement.
- Existing completed transfers and parent destination links are not auto-repaired. M9/F4 independent-school transfers remain intentionally deferred.
- D-05’s prior 3,956-document/60-file aggregates lack the complete current evidence needed for acceptance.

## 20. Source-of-truth map

This guide was reconciled against:

- `AGENTS.md` and tenant theme constraints;
- `docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md` in full;
- `docs/tasks/orchestrator-sessions/orch-20260903-143249/product-decisions.md`;
- `docs/tasks/orchestrator-sessions/orch-20260903-143249/requirements-coverage-matrix.md`;
- `docs/testing/REALISTIC_SCHOOL_SETUP_TEST_BOOK.md`;
- current U1–U7 `ui-coverage-matrix.md`, U7 preflight/U7a result, and relevant U1–U6 results;
- root and app `package.json` scripts and actual route files under `apps/*/app`.

When implementation changes, re-inventory routes/scripts and update this daybook. D-05 remains authoritative for operator safety; product decisions remain normative for behavior; actual source/routes decide what is currently available.