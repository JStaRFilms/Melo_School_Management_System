# E2E & UX Audit Tracking Log

This document tracks all observations, issues, UX refinements, and their resolution statuses during the end-to-end testing session.

---

## 🎯 Things to Do Now

- [x] **Step 1: Convex Prod-to-Dev Sync & Verification**
  - [x] Perform read-only export from Production database (`tmp/prod_export.zip`).
  - [x] Import/Restore data into Dev deployment (`dev:scrupulous-chinchilla-25`, wiped and fully synced).
  - [x] List all schools in the Dev database for user review.
- [x] **Step 2: Old Demo School Removal**
  - [x] Deleted `Preston Academy` (`preston-academy`) and `Demo Academy` (`demo-school`) along with 1,964 associated child records in the Dev database.
  - [x] Verified remaining active tenants in Dev (`Olive Blessed Crest Academy`, `Codex Academy`).
- [ ] **Step 3: New Demo School Creation & Manual UI Walkthrough**
  - [ ] Walk through school registration and setup flow via UI.
  - [ ] Populate clean test data directly through user interfaces.
- [ ] **Step 4: Systematic App-by-App UX Testing & Polish**
  - [ ] `apps/admin`
  - [ ] `apps/teacher`
  - [ ] `apps/portal`
  - [ ] `apps/platform`
  - [ ] `apps/sites` / `apps/www`

---

## ✅ Done

- [x] **Branch Setup & Unified Branded Spinner (`MeloLoader`)**
  - *What was done*:
    - Created branch `audit/e2e-ux-polish` originating from `master`.
    - Ported and unified `MeloLoader` component in `packages/shared/src/components/MeloLoader.tsx`.
    - Integrated `MeloLoader` across all app layout guards and loading fallbacks (`admin`, `teacher`, `portal`, `platform`).
- [x] **Production-to-Dev Database Mirroring & Backup**
  - *What was done*:
    - Generated a production snapshot export (`tmp/prod_export.zip`, 7,391 documents + 133 storage files).
    - Cleared and restored all production tables and storage files into the isolated local Dev Convex deployment (`dev:scrupulous-chinchilla-25`).
    - Verified all 4 existing schools and their tenant memberships.
- [x] **Obsolete Dev Schools Clean Cascade Deletion**
  - *What was done*:
    - Purged `Preston Academy` (empty stub) and `Demo Academy` (and 1,963 associated tenant records: users, students, classes, subjects, assessments, billing records).
    - Confirmed remaining Dev database holds clean copies of `Olive Blessed Crest Academy` and `Codex Academy`.
- [x] **Dynamic School Tab Titles & Favicon Sync**
  - *What was done*:
    - Replaced all legacy and placeholder metadata titles across apps (`Melo Admin`, `Melo Teacher`, `Melo Portal`, `Melo Platform Admin`).
    - Added reactive synchronization in `WorkspaceNavbar` to update the document title (`Admin · Olive Blessed Crest Academy`) and swap the browser tab favicon to the active school's crest logo dynamically upon sign-in.
- [x] **Universal "Change Password" Modal & Security UI**
  - *What was done*:
    - Built a reusable, accessible `ChangePasswordModal` in `@school/shared` powered by Better Auth.
    - Integrated "Change Password" buttons directly into Platform Super Admin top bar and into the user profile dropdown across `admin`, `teacher`, and `portal` workspaces.
- [x] **Admin Sign-In Default Landing Route Fix**
  - *What was done*:
    - Fixed legacy hardcoded default redirect from `/assessments/setup/exam-recording` to the main `/admin/dashboard` in `apps/admin/app/page.tsx` and `apps/admin/app/sign-in/page.tsx`.
- [x] **Super Admin Password Reset for School Admins**
  - *What was done*:
    - Added `resetSchoolAdminPassword` backend action and `ResetSchoolAdminPasswordModal` in Platform Super Admin (`http://localhost:3006/schools`).
    - Allows Super Admin to instantly reset the password for any school admin with automatic session invalidation.
- [x] **Super Admin Workspace UI Overhaul (`http://localhost:3006/schools`)**
  - *What was done*:
    - Replaced the plain table view with a dense, minimalist KPI summary strip (*Total Schools, Live Active Tenants, Pending Admin Setup, Convex Cloud Engine status*).
    - Added instant real-time search (by school name, slug, or admin email) and tab filters (*All, Active, Pending*).
    - Fixed slug typography with crisp slate badges, added glowing pulse dots to active status badges, and standardized action buttons.
- [x] **Dedicated School Profile & Branding Settings (`/admin/settings`)**
  - *What was done*:
    - Created a comprehensive institution settings page at `/admin/settings` (linked under Administration).
    - Allows school admins to update Official School Name, School Motto / Tagline, Crest / Logo image (with Convex storage uploads and live preview), Brand Color Palette (Primary & Accent color pickers + curated preset palettes), and Official Contact Details (Email, Phone, Campus Address).
    - Tenant slug is displayed as an immutable, protected read-only badge with 1-click copy.
    - Retired the obsolete, nested logo uploader from Report Cards Extras and pointed it to Settings.
- [x] **Route Protection & Friendly Fallbacks for Disabled Modules**
  - *What was done*:
    - Added layout guards on `/billing` and `/academic/knowledge/*`.
    - If a school admin accesses a URL for a module disabled on their school's tier, they are shown a friendly "Module Inactive" screen explaining that the feature is turned off on their plan with a 1-click "Return to Dashboard" button.

---

## 🔍 Downstream Impact Verification Checkpoints (For Later Flow Testing)
- [ ] **Receipts & Invoices Header (`/billing`):** Verify that school motto, official contact phone/email, and physical campus address render on billing statements and PDF payment receipts.
- [ ] **Report Card Transcripts (`/assessments/report-cards`):** Verify that updated crest logo, school motto sub-banner, brand primary color bar, and school address footer appear on printable term report sheets.
- [ ] **Parent & Student Portals (`:3003`):** Verify that school custom palette, crest favicon, and school tagline render in portal headers.

---

## 🚀 Future / Backlog

- [ ] **Intelligent School Bulk Data Import & Full Export Engine**
  - **Full School Data Export (Internal/Admin Only):**
    - Platform capability to generate complete, structured Excel/CSV snapshot exports of an entire school tenant (academics, rosters, guardians, billing, assessments).
    - Kept internal / non-public to standard school users.
  - **Standardized Import Template & AI Assistance:**
    - Provide schools with a structured CSV/Excel template that can be populated using AI or exported from legacy school software.
    - Robust parsing tolerant of optional/blank columns without crashing.
  - **Intelligent Audit, Deduplication & Conflict Resolution Pipeline:**
    - **Fuzzy Name Matching:** Detect duplicate or existing students across name variations and inverted name orders (e.g. `First Last` vs `Last First`).
    - **Class & Grade Placement:** Automatically map and suggest correct class/grade assignments with confidence indicators.
    - **Guardian/Parent Deduplication:** Match parents by normalized phone numbers, emails, and family surname links.
    - **Time-Drift & Stale Backup Detection:** Warn if incoming import sheet contains older timestamps or conflicts with existing records updated on the platform since the export date.
  - **Interactive UI Reconciliation Screen:**
    - Visual side-by-side review workbench where school administrators inspect proposed records, resolve fuzzy conflicts, override assignments, and approve the final merge before writing to the database.
- [ ] **Smart Transactional & Batched Staff/Guardian Notification Engine**
  - **Immediate High-Priority Events:**
    - New Admin / Teacher onboarding invitation with secure one-time activation link.
    - Password reset and security/auth alerts (sent immediately with zero delay).
  - **Debounced / Digest Outbox for Operational Edits (Anti-Spam):**
    - When an administrator modifies a teacher/student (e.g. changing 3 classes, updating subjects, tweaking contact details in quick succession), events are buffered in a `notificationOutbox` table.
    - Uses Convex scheduled jobs (`ctx.scheduler.runAfter(5 * 60, ...)` / 5-10 min debounce window) to coalesce multiple rapid changes into a single consolidated digest email (*"3 updates were made to your teaching schedule"*).
  - **Explicit "Send Invitations" Control:**
    - Provide admins with an intentional "Send Welcome Emails / Send Invitations" action button so bulk roster setups don't trigger emails until the administrator is ready.
- [ ] **Demo School Tenant Migration from Dev to Production:**
  - Once the new Demo School is created, configured, and verified locally in Dev, run a scoped tenant migration to export all its child tables and replicate it onto Production as the official showcase school.
- [ ] **Multi-Tenant Campus & School Switcher Architecture (Proprietor / Multi-School Portal)**
  - **Overview:**
    - Allows network proprietors, directors, or multi-branch staff to log in with a single email/account while maintaining strict tenant isolation across distinct school branches (e.g. `Olive Blessed Crest Academy (Fedrah, Abuja)` and `Olive Blessed Crest Academy (Ruga, Nasarawa)`).
  - **Backend Layer:**
    - Transition single-school auth resolution in `functions/academic/auth.ts` (`getAuthenticatedSchoolMembership`) from `.unique()` queries to multi-membership resolution (matching `functions/foundation/auth.ts` / `resolveActiveSchoolMembershipsV1`).
    - Add `functions/auth:getMySchoolMemberships` to return all active school memberships for the authenticated identity.
    - Support optional/explicit `schoolId` parameter on tenant-scoped queries and mutations with active membership verification.
  - **Frontend Layer:**
    - Implement `ActiveSchoolProvider` React context in `apps/admin` (and optionally `apps/teacher`/`apps/portal`) to track `activeSchoolId` backed by `localStorage` persistence.
    - Implement `CampusSwitcher` dropdown in the `AdminHeader` / `WorkspaceNavbar` allowing 1-click switching between campuses without requiring re-authentication.
    - Gracefully render static school badge if user belongs to only 1 school; render interactive dropdown if user has memberships in $\ge 2$ schools.
  - **Data Integrity:**
    - Preserves independent billing configurations, separate Paystack subaccounts, distinct grading bands, separate term calendars, and isolated student rolls per branch.
- [ ] **Interactive New User Onboarding & Interface Setup Tour**
  - **Overview & Walkthrough Flow:**
    - Provide a guided onboarding wizard for newly registered school administrators and teachers that introduces the full platform architecture.
    - Walkthrough steps:
      1. *Institution Profile & Brand Palette* (School Name, Motto, Crest Upload, Theme Colors).
      2. *Academic Structure Checklist* (Creating Active Academic Session, Terms, Classes, and Subjects).
      3. *Grading & Assessment Framework* (Setting up Grade Scales, Exam Profiles, and Report Add-ons).
      4. *Roster Population Options* (Single addition vs. Bulk Excel/CSV upload).
      5. *Workspace Navigation Preference Selection* (Allows the admin to choose between **Straight Grouped List [Default]**, **Collapsible Accordions**, or **Top Domain Switcher**).
  - **Interactive Orientation Checklist:**
    - Persistent dismissible "Setup Progress" widget on the Admin Dashboard showing completed vs. pending institution setup milestones with direct deep links.
- [ ] **Comprehensive Staff Onboarding & Structured Faculty Profiles Module**
  - **Overview:**
    - As institutions grow, expand the basic teacher directory into a structured Faculty & Staff HR module supporting detailed personal information, professional credentials, and self-service onboarding.
  - **Structured Faculty Identity:**
    - **Honorific / Title:** `Mr.`, `Mrs.`, `Ms.`, `Dr.`, `Prof.`, `Engr.`, `Pastor`, `Imam`.
    - **Name Fields:** `firstName`, `middleName` (optional), `lastName`.
    - **Demographics:** `gender` (`male`, `female`, `other`), `dateOfBirth` (optional), `phone`, `emergencyContact`.
  - **Professional & Employment Metadata:**
    - **Staff Identifier:** System or school-assigned `staffCode` / `employeeId`.
    - **Department & Designation:** Primary department (e.g. *Humanities*, *Sciences*, *Vocational*), administrative title (e.g. *Vice Principal*, *HOD Science*, *Form Tutor*).
    - **Credentials & Documentation:** Highest degree obtained, certifications, resume/CV storage files.
  - **Full Staff Onboarding Workflow (Dedicated Module):**
    - Guided self-service onboarding link sent via email upon provisioning.
    - Document collection (National ID / Passport, degree certificates).
    - Contract acknowledgment and staff code of conduct sign-off before activating portal privileges.
- [ ] **Comprehensive Student Lifecycle, Enrollment History & Timeline Audit Logs**
  - **Overview:**
    - Provide an immutable chronological audit trail and timeline history for every student, tracking their complete journey at the institution from initial admission to graduation or exit.
  - **Key Lifecycle Events & State Tracking:**
    - **Admission & Initial Enrollment:** Date admitted, entry academic session & term, initial grade/class placement, official admission number.
    - **Session Promotions & Class Progressions:** Historical record of every grade and class attended (e.g. Nursery 2 $\to$ Primary 1 $\to$ Primary 2) with session completion milestones and form teacher assignments.
    - **Withdrawals, Leaves of Absence & Transfers Out:** Date of departure, departure term/session, reason for leaving (relocation, medical leave, school transfer), exit status (`withdrawn`, `transferred_out`, `temporary_leave`).
    - **Re-Admissions & Resumptions:** Re-enrollment date, returning session/term, re-entry grade placement, re-activation approval notes.
    - **Graduation & Alumni Transition:** Official graduation date, graduating class (e.g. SSS 3 / Year 12), diploma/certificate issuance status, transition to alumni directory.
  - **UI & Transcript Generation:**
    - **Visual Lifecycle Journey:** Interactive vertical timeline widget on the student's admin & parent profile displaying all enrollment transitions with status badges.
    - **Official Certificate & Transcript Export:** Automated generation of Letters of Attestation and Official Transcripts accurately certifying dates of attendance (*"Attended [School Name] from September 2024 to July 2027..."*).
- [ ] **First-Time Faculty Sign-In & Mandatory Password Reset**
  - Upon receiving the onboarding invitation with temporary credentials, faculty/staff must be presented with a mandatory "Create Your Password" step before entering the workspace.
- [ ] **Configurable School House System (Settings & Student Links)**
  - Institution-level settings to define school houses with color identifiers (e.g. Green `#16a34a`, Purple `#9333ea`) and custom names (e.g. *"Tododo House"*, *"Emerald House"*).
  - Student onboarding and profile editors use a structured dropdown populated from active school houses instead of manual arbitrary text.
- [ ] **Date Validation: Future Date Restriction for Student Records**
  - Set strict HTML5/form constraints (`max={today}`) so administrators cannot input future dates for Date of Birth (`dob`) or historical enrollment dates.
- [ ] **Multi-Parent Household & Guardian Linking Architecture (Backend & Schema Migration)**
  - **Comprehensive Household Support:**
    - Support up to 2 legal parents (`Parent 1`, `Parent 2`) plus an optional primary `Guardian`.
    - Distinct first name, last name, phone, email, and occupation/relationship fields.
  - **Smart Relationship & Address Inheritance:**
    - 1-click toggle: *"Primary Guardian is Parent 1 / Parent 2"* auto-syncing contact details.
    - Residential address sync: option to inherit parent household address or provide separate guardian residence.
  - **Household Deduplication:**
    - Link siblings under a unified `householdId` when parent phone numbers/emails match, streamlining family billing and notifications.
- [ ] **Configurable Institutional Email Domain & Outbound Mail Infrastructure**
  - **Custom Email Domain Integration & Address Convention:**
    - Settings interface in School Settings allowing administrators to configure the institution's official email domain (e.g. `@meridiancrest.edu.ng`, `@schoolname.org`).
    - Standardized naming convention: `firstname.lastname@schoolsdomain.com` (e.g. `kenechukwu.okafor@meridiancrest.edu.ng`) with duplicate collision handling (e.g. `firstname.lastname2@...` or middle initial).
  - **SMTP & Transactional Mail Provider:**
    - Outbound email routing with custom DKIM, SPF, and MX verification (Google Workspace, Zoho Mail, Resend).
- [ ] **Sequential Auto-Incrementing Admission Numbers & Starting Sequence Seed**
  - **Customizable Sequence Template:**
    - Configurable format pattern in School / Enrollment Settings (e.g. `SCH/{YEAR}/{SEQ:4}` $\to$ `SCH/2026/0042` or `NUR-{SEQ:4}` $\to$ `NUR-0517`).
  - **Starting Counter Seed (Migration Friendly):**
    - Administrator can define the *"Last Used Admission Number"* or *"Starting Seed Number"* (e.g. `516`), allowing onboarding schools to migrate seamlessly without ID gaps or duplicate collisions.
  - **Admissions Pipeline Synchronization:**
    - Accepted applications from the public admission form automatically receive the next sequential ID upon approval/enrollment.
- [ ] **Form Unsaved State Guard & Draft Protection**
  - Prompt / confirm warning before navigating away when an enrollment or creation form is dirty with unsaved entries.
  - Optional local draft persistence in `localStorage`/IndexedDB so transient tab closures or accidental reloads never lose in-progress enrollment inputs.
- [ ] Automated regression test suite for core multi-tenant boundaries.
- [ ] Merge back feature worktrees (`_w/atomic-campaigns`, `_w/draft`, `_w/ui-refinement`) into main pipeline.
- [ ] Production snapshot reconciliation and selective cleanup after local sign-off.



