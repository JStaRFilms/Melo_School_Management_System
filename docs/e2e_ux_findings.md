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
- [ ] Automated regression test suite for core multi-tenant boundaries.
- [ ] Merge back feature worktrees (`_w/atomic-campaigns`, `_w/draft`, `_w/ui-refinement`) into main pipeline.
- [ ] Production snapshot reconciliation and selective cleanup after local sign-off.



