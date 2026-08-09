# AQ-3 Full Admissions Browser QA Runbook and Observation Log

**Session:** `orch-20260722-114501`  
**Branch:** `feature/admissions-atomic-campaigns`  
**Worktree:** `_w/atomic-campaigns`  
**Starting commit:** `2a36216`  
**Status:** In progress — browser results are user-owned and must not be inferred from automated checks

## Purpose

Test the complete admissions release candidate from one cumulative worktree. This branch contains the reviewed admissions integration baseline plus AQ-1 atomic campaign setup. Do not run Admin, Apply, or Convex from different worktrees during this pass.

## Safety and known boundaries

- Use the development Convex deployment and test records only.
- Do not deploy, alter production configuration, or use live Paystack credentials.
- Use localhost for Paystack checkout. Checkout through the Tailscale IP is a known unresolved development limitation.
- AQ-2 accountable paid-campaign approval UX is not implemented. Test free campaigns; record paid-campaign UX as **Blocked by AQ-2**, not as an AQ-3 regression.
- Do not merge this branch into integration or `master` during testing.
- Use a separate application for destructive or one-way journeys such as submission, decision, correction, and conversion.
- Preserve reviewer, decision, audit, submission, and conversion history.

## Launch from one worktree

Open four PowerShell terminals and use the same directory in each:

```powershell
cd C:\CreativeOS\01_Projects\Code\Personal_Stuff\2026-03-14_School_Management_System\_w\atomic-campaigns
```

### Terminal 1 — Convex development backend

```powershell
pnpm convex:dev
```

Wait for schema/functions synchronization before exercising the UI.

### Terminal 2 — Admin

```powershell
pnpm --filter @school/admin exec next dev --webpack --port 3002 --hostname 0.0.0.0
```

- Local: `http://localhost:3002/admissions`
- Tailscale: `http://100.84.230.66:3002/admissions`

### Terminal 3 — Apply

```powershell
pnpm --filter @school/apply exec next dev --webpack --port 3004 --hostname 0.0.0.0
```

- Local: `http://localhost:3004`
- Tailscale: `http://100.84.230.66:3004`

### Terminal 4 — Public Sites, when testing Apply links

```powershell
pnpm --filter @school/sites exec next dev --webpack --port 3005 --hostname 0.0.0.0
```

- Local: `http://localhost:3005`
- Tailscale: `http://100.84.230.66:3005`

The Tailscale IPv4 address was confirmed as `100.84.230.66` when this runbook was created. Re-run `tailscale ip -4` if connectivity changes. Binding to `0.0.0.0` may also expose these development servers to the local network, depending on Windows Firewall and network settings; it does not make them Tailscale-only.

## Before testing

Record:

- Browser/version:
- Viewport/device:
- Local or Tailscale URL:
- Admin account/role:
- Guardian account:
- School:
- Campaign/intake:
- Starting commit (`git rev-parse --short HEAD`):
- Convex synchronization successful: [ ]
- Browser console cleared: [ ]
- Network panel preserving logs: [ ]

Create fresh, clearly named test data. Suggested suffix: `QA-<date>-<journey>`.

## Recommended execution order

### Phase 1 — Admin campaign setup and AQ-1 atomic behavior

Use a new **free** campaign.

- [ ] **AQ1-01 Create draft:** Configure programme, intake, form fields, requirements, documents, declaration, dates, and free pricing. One save creates a complete visible draft.
- [ ] Refresh/reopen the draft. All configured values remain accurate; no duplicate programme, intake, product, form, declaration, field, or requirement is visible.
- [ ] **AQ1-02 Validation rejection:** Deliberately submit an invalid date, duplicate field key, or invalid conditional controller. The UI names the problem and no partial campaign appears.
- [ ] Correct the invalid input and save successfully without recreating unrelated records.
- [ ] **AQ1-03 Publish:** Publish the free campaign with an authorized operator. The Apply route becomes available and displays the intended current form/declaration.
- [ ] **AQ1-04 Published replacement:** Edit and publish a replacement. Previously submitted evidence remains unchanged. A paused or closed intake is not silently reopened.
- [ ] **AQ1-05 Retry:** In browser DevTools, switch network offline immediately before/during one save, then reconnect and retry. A retry does not create duplicates.
- [ ] Refresh after an unresolved save. The UI either safely replays the exact operation or presents the reconciliation-required state; it never silently submits altered data under the old operation.
- [ ] Complete the explicit reconciliation action. Authoritative state reloads, stale pending data is deliberately discarded, and a later save uses a fresh operation.
- [ ] **AQ1-06 Shared declaration guard:** If practical, use two active intakes in one programme and try to change the shared declaration from one intake. The system must fail closed rather than silently changing the other intake.

Look especially for: duplicate records, success messages when values were discarded, closed/paused campaigns reopening, endless retry loops, or a draft edit changing live guardian content before publication.

### Phase 2 — Guardian first-child application and legal names

Use a new guardian/application created against the new policy-version-2 form.

- [ ] Sign up/sign in and reach the correct school/intake.
- [ ] Applicant legal first, middle, and last names are requested and retained.
- [ ] Guardian first and last names are separate and retained.
- [ ] Missing required legal-name components block progression/submission with field-specific guidance.
- [ ] Editing one field shows `Saving…`, then a clear saved state after the debounce.
- [ ] Rapid edits and blur/section changes settle on the newest value; an older save never overwrites it.
- [ ] **Save and continue** saves the current section and advances only after success.
- [ ] Errors appear beside the relevant field/section and stale errors clear after correction.
- [ ] Refresh and sign-in resume show the latest saved values.
- [ ] Review/submit creates an immutable submission snapshot and changes the application into a submitted status view.

### Phase 3 — Offline recovery and explicit multi-tab conflict

Use a separate draft that can safely remain unsubmitted.

- [ ] Go offline, edit several fields, and observe `Offline — changes waiting to sync` or equivalent accurate wording.
- [ ] Refresh/restart while offline if practical. Local recovery remains associated only with the correct application.
- [ ] Reconnect. Pending edits flush once and the newest value persists.
- [ ] Open the same draft in two tabs. Save a change in Tab A, then a conflicting change from stale Tab B.
- [ ] Tab B does not silently overwrite Tab A. The conflict/recovery path is understandable and results in one deliberate final value.
- [ ] No duplicate writes, infinite retries, or cross-application local recovery occurs.

### Phase 4 — Private document lifecycle

Use a separate editable application and harmless test files.

- [ ] Upload each required document type; filename/type/status are clear.
- [ ] **View file** opens through the authenticated same-origin Apply/Admin route, not a raw Convex storage URL.
- [ ] Sensitive access requires fresh authentication when appropriate and fails closed for unauthorized users.
- [ ] Remove a draft-only upload after confirmation. It disappears from the normal list.
- [ ] Upload a replacement and confirm only the current document is offered for normal use.
- [ ] Submit the application. Previously submitted evidence remains locked and understandable.
- [ ] During an authorized correction, replace only an explicitly unlocked document/item. Prior submission evidence remains preserved.
- [ ] Admin document viewing remains audited and does not show a redundant fake-download action.

Look especially for: raw storage URLs, cross-guardian access, stale removed files in the normal list, deletion without confirmation, or prior submitted evidence disappearing.

### Phase 5 — Admin review, correction scope, assignment, and decision

- [ ] The queue shows privacy-safe summary data and the detail view shows authorized applicant information.
- [ ] Assign a reviewer. Refresh/reopen and confirm the assignment persists.
- [ ] Repeat the same assignment. It reuses the active assignment rather than creating a new duplicate row.
- [ ] Start review and inspect documents through the audited action.
- [ ] Request correction on named fields/documents only.
- [ ] Guardian sees unlocked items as editable; all other content remains readable, gray/disabled, and labelled **View only**.
- [ ] Guardian submits the correction. Admin sees the updated correction without mutating the original submission snapshot.
- [ ] Exercise waitlist/reject/accept only on dedicated applications. Consequential actions explain finality and require confirmation.
- [ ] Accepted state clearly distinguishes the admissions decision from **Create student and enrollment records**.

### Phase 6 — First-child and sibling conversion

Use dedicated accepted applications.

#### First child

- [ ] Convert a guardian with no existing parent/family records using create/create/create.
- [ ] Student, parent, family, and enrollment records are created once with correct provenance and all available legal-name components.
- [ ] Retry/reopen does not duplicate canonical records or conversion outbox work.

#### Sibling

- [ ] Submit and accept another child under the same guardian identity.
- [ ] Admin offers only same-school parent/family candidates tied to that guardian.
- [ ] Explicitly select the existing parent and existing family.
- [ ] Conversion creates the new student/enrollment without creating a second parent/family.
- [ ] An invalid parent/family pairing fails closed and does not partially convert.

Look especially for: automatic identity merging, fabricated middle names, duplicate parents/families/students, conversion marked complete before state is `succeeded`, or a retry creating another enrollment.

### Phase 7 — Legacy legal-name compatibility

Use an existing policy-version-1 draft/application with only first and last names.

- [ ] The legacy record remains readable and saveable under its original rules.
- [ ] It is not retroactively blocked for a missing middle name.
- [ ] Admin review, snapshots, and conversion do not fabricate or infer a middle name.
- [ ] New policy-version-2 forms still require the real middle name.

### Phase 8 — Tenant/security negative checks

Use only accounts and schools you are authorized to test.

- [ ] A guardian cannot view another guardian’s application or document by changing a URL/reference.
- [ ] Staff without the matching capability cannot publish, decide, view sensitive files, or convert merely because they are assigned as reviewer.
- [ ] Cross-school IDs, reviewer assignments, evidence, parent/family candidates, and documents fail closed.
- [ ] Sensitive document access older than five minutes requests fresh authentication rather than leaking a link.
- [ ] Queue-list data remains redacted until authorized detail access.

Stop immediately and record a **P0** if any cross-tenant or unauthorized data is visible.

### Phase 9 — Public link, responsive, visual, and accessibility pass

- [ ] Public Sites Apply link resolves to the intended canonical Apply route and current published intake.
- [ ] Published/unpublished/paused/closed availability is reflected accurately.
- [ ] Keyboard-only navigation reaches controls in a sensible order and focus remains visible.
- [ ] Validation moves focus to the first invalid field or a linked error summary.
- [ ] Check Admin and Apply at approximately 320px, tablet width, and desktop width.
- [ ] No clipped controls, horizontal page overflow, unreadable disabled content, inaccessible dialogs, or motion-dependent information.
- [ ] Check contrast and labels for save states, **View only**, statuses, destructive confirmations, and document actions.
- [ ] Inspect browser console and failed network requests at the end of every major journey.

## Observation recording rules

Use one entry per defect. Do not combine unrelated symptoms. Save screenshots under:

`docs/tasks/orchestrator-sessions/orch-20260722-114501/future/evidence/admissions-full-qa/`

Severity:

- **P0:** security/privacy breach, cross-tenant access, data loss, duplicate canonical conversion, destructive corruption, or release-stopping integrity failure.
- **P1:** primary journey blocked, persistent incorrect state, unrecoverable save/publish/review failure.
- **P2:** confusing but recoverable UX, visual/accessibility defect, poor wording, or non-blocking inconsistency.
- **Known/Blocked:** expected limitation such as AQ-2 paid approval UX or Tailscale Paystack checkout.

### Observation template

Copy this block for every observation:

```markdown
## OBS-### — Short title

- Severity: P0 / P1 / P2 / Known-Blocked
- Test case: e.g. AQ1-05 or Phase 4 document replacement
- Date/time:
- Browser/viewport:
- URL mode: localhost / Tailscale
- Role/account:
- School/campaign/application reference:
- Starting commit:
- Reproducibility: Always / Intermittent / Once

### Steps
1.
2.
3.

### Expected

### Actual

### Recovery attempted

### Evidence
- Screenshot/video:
- Console error:
- Failed network request/status:
- Convex function/error ID:

### Data-integrity check
- Were duplicate or partial records visible?
- Did a prior snapshot/audit record change?
- Did another tenant/user see anything?
```

## Observations

_No observations recorded yet._

## Test summary

- Passed scenarios:
- Failed scenarios:
- Blocked/known limitations:
- Not tested:
- P0 count:
- P1 count:
- P2 count:
- Recommended release decision: Not assessed
