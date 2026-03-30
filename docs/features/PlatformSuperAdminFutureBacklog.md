# Platform Super Admin Future Backlog

## Goal

Capture the next platform-level capabilities that should come after school provisioning so the multi-school SaaS roadmap stays visible.

This is not an implementation task by itself. It is a memory aid and prioritization note for later orchestration.

---

## Alignment Snapshot

### What The Current Platform Surface Already Covers

The current `apps/platform` implementation is aligned to the narrow provisioning slice, not the full long-term platform vision.

Implemented now:

- platform-admin sign-in
- school list
- create school
- assign first school admin
- pending vs active status visibility
- first platform-admin bootstrap

This means the current platform work is aligned with:

- `FR-001` tenant-aware school setup
- the platform portion of `FR-002` role-based authentication and routing
- the platform-owner portion of `FR-003` school administration onboarding

### What Is Intentionally Not In The Current Platform Surface Yet

The platform app does **not** yet implement:

- platform billing
- school subscription plans
- school suspension/reactivation
- school detail operations beyond first admin assignment
- school-admin replacement/recovery
- support-mode access
- custom domain management
- cross-school metrics
- platform audit history

That gap is expected right now. It is not a regression; it is simply the next slice.

---

## Current Boundary Check

The present architecture is correctly separated like this:

- `apps/platform`
  - create and activate school tenants
  - assign first school admins
- `apps/admin`
  - run one school’s operations
  - manage teachers, students, classes, subjects, results, fees
- `apps/teacher`
  - teacher workflow only

This is the correct direction.

What should **not** be pulled into the platform app right now:

- class setup
- student management
- subject management
- report-card operations
- school fee invoicing

Those belong to the school-admin app, not the platform app.

---

## Missing But Coherent Next Platform Slices

If you want the platform side to feel more “complete,” the missing pieces are not random polish items. They cluster into a few coherent modules:

1. school lifecycle
2. school-admin recovery
3. platform billing/subscriptions
4. support and auditability
5. white-label/domain controls
6. cross-school visibility

That is the correct way to think about the next work, instead of scattering small disconnected tweaks.

---

## What Exists Already

Current platform-super-admin capabilities:

- create schools
- assign first school admins
- view school list and status
- bootstrap the first platform admin

Everything below is still future scope.

---

## High-Priority Follow-Ons

### 1. School Lifecycle Management

Add explicit platform controls for:

- suspend school
- reactivate school
- archive school
- mark school as trial, active, overdue, or disabled

Why this matters:

- provisioning alone is not enough once real schools are live
- billing and access control will need lifecycle states
- platform support needs a safe way to disable a tenant without deleting data

Suggested data additions:

- `schools.status` expanded beyond `pending | active`
- optional `suspendedAt`
- optional `suspensionReason`
- optional `disabledAt`

---

### 2. Platform Billing and Subscription Control

Add platform-owned billing controls for each school:

- plan name
- subscription status
- billing cycle
- trial start/end
- renewal date
- payment status
- invoice history for the school itself

Why this matters:

- this is the real business layer of the SaaS
- platform billing is different from school fee billing
- schools need to pay for use of the product, while parents pay fees inside each school

Important boundary:

- `platform billing` = what the school pays you
- `school billing` = what parents/students pay the school

These should stay separate in both data model and UI.

---

### 3. School Plan Entitlements

Add plan-based feature control per school:

- max students
- max admins
- max teachers
- enabled modules
- branding/custom domain access
- report-card/billing/portal feature flags

Why this matters:

- plan limits will eventually drive pricing tiers
- this lets you launch lean and expand without separate codebases

Suggested shape:

- `schoolSubscriptions`
- or `schoolPlans`
- plus entitlement checks at function level for gated features

---

### 4. Platform Audit Trail

Track important platform actions:

- school created
- school admin assigned
- school suspended/reactivated
- plan changed
- support access granted
- domain changed

Why this matters:

- once multiple schools exist, you need accountability
- platform operations become high-risk very quickly

Suggested table:

- `platformAuditLogs`

Core fields:

- actor auth id
- actor email
- action type
- target school id
- metadata
- createdAt

---

### 5. Support Access and Safe Debugging

Add explicit support tooling for the platform owner:

- read-only support mode
- temporary support-session access
- audit log for support access
- no silent impersonation

Why this matters:

- you will eventually need to help schools without becoming their permanent admin
- this is safer than sharing a single all-powerful day-to-day account

Recommended rule:

- support access should be time-boxed and audited

---

## Medium-Priority Follow-Ons

### 6. School Admin Recovery and Reassignment

Add flows for:

- replace school admin
- add a second school admin
- recover access when an admin leaves
- resend or reset onboarding credentials

Why this matters:

- real schools have staff turnover
- first-admin provisioning is not enough long term

---

### 7. Custom Domains and White-Label Controls

Add platform tools to manage:

- public website custom domain
- portal/admin domain mapping later
- DNS verification state
- SSL readiness
- default theme/branding pack
- authenticated workspace branding packs for `admin`, `teacher`, and `portal` after school context is resolved

Why this matters:

- white-label is part of the product promise
- platform admin needs visibility into domain status across schools
- branded authenticated surfaces should come from the resolved school context, not require school-specific role URLs

---

### 7A. Cross-School Parent Context and Portal Selection

Add support for the worst-case parent identity model:

- one parent account linked to children in multiple schools
- one portal sign-in that can return more than one valid school/student context
- a post-login chooser such as "Which child do you want to manage?"
- clear school name, child name, and role labels on each choice card
- a remembered last-used context with an easy switcher inside the portal

Why this matters:

- this is the edge case most likely to break naive school-from-email routing
- parents think in terms of children first, not tenant IDs or school codes
- the product can keep canonical role subdomains while still handling multi-school households cleanly

Recommended architecture note:

- keep `admin.meloschool.com`, `teacher.meloschool.com`, and `portal.meloschool.com` as the canonical authenticated hosts
- keep school slug/domain mapping primarily for public sites and school discovery
- for authenticated apps, resolve school branding and data scope from the selected membership context after sign-in

---

### 8. Cross-School Metrics Dashboard

Add platform-level overview metrics:

- number of active schools
- number of active students
- number of active teachers
- subscription health
- schools with setup incomplete
- schools with recent result activity

Why this matters:

- helps you manage growth
- gives a health view without opening individual schools

---

### 9. Onboarding Progress Tracking

Track how far each school has progressed:

- school created
- school admin assigned
- teachers added
- classes created
- students added
- subjects configured
- first result entered

Why this matters:

- useful for customer success and onboarding
- helps you know who needs support

---

## Lower-Priority but Useful Later

### 10. Communication Tools

Potential platform actions:

- send onboarding emails to school admins
- send renewal reminders
- notify schools of downtime or maintenance

---

### 11. Data Export and Tenant Offboarding

Future flows:

- export a school's data
- deactivate tenant safely
- archive tenant without deleting records

---

### 12. Platform Settings

Central platform controls such as:

- global defaults for new schools
- default grading setup templates
- default branding/template pack
- maintenance banners

---

## Recommended Build Order

When you return to platform work later, a sensible order is:

1. school admin recovery and reassignment
2. school lifecycle states
3. platform billing and subscription control
4. plan entitlements
5. platform audit trail
6. support access tooling
7. custom domains
8. cross-school parent context + portal chooser
9. cross-school metrics

---

## Recommended Next Task Shapes

To keep future implementation coherent, these would be sensible follow-up task units:

### Platform Lifecycle Management

- suspend/reactivate school
- expanded school status model
- school detail page with lifecycle controls

### Platform Billing Foundation

- school subscription records
- trial/active/overdue status
- plan assignment and renewal metadata

### School Admin Recovery

- replace school admin
- add second school admin
- reset or resend onboarding access

### Platform Audit and Support

- platform audit logs
- support access requests
- read-only support mode

### White-Label Operations

- domain management
- branding defaults
- tenant setup health

These should become separate orchestration tasks later, not one giant “platform improvements” task.

---

## Guardrails

As the platform surface grows, keep these boundaries strict:

- platform admin should not become the normal school operator
- school data operations should stay in school apps
- platform billing should stay separate from school fee billing
- support access should be explicit and auditable
- tenant deletion should be rare and heavily protected

---

## Definition Of Done For This Note

- the major future platform concerns are written down
- billing-related follow-ons are separated from school billing
- lifecycle, support, and audit needs are not forgotten
- later orchestration can turn these into tasks without reinventing the roadmap
