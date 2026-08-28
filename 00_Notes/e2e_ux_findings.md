# E2E & UX Audit Tracking Log

This document tracks all observations, issues, UX refinements, completed changes, downstream blast radius checkpoints, and backlog items during the end-to-end testing and system polish session.

---

## 🎯 Current Status & Active Focus

- [x] **Step 1: Convex Prod-to-Dev Sync & Verification**
  - [x] Read-only export from Production database (`tmp/prod_export.zip`).
  - [x] Import/Restore data into Dev deployment (`dev:scrupulous-chinchilla-25`, wiped and fully synced).
  - [x] Verified remaining active tenants in Dev (`Olive Blessed Crest Academy`, `Codex Academy`).
- [x] **Step 2: Old Demo School Removal**
  - [x] Deleted `Preston Academy` and `Demo Academy` along with 1,964 associated child records in Dev.
- [ ] **Step 3: New Demo School Creation & Manual UI Walkthrough**
  - [ ] Walk through school registration and setup flow via UI.
  - [ ] Populate clean test data directly through user interfaces.
- [ ] **Step 4: Systematic App-by-App UX Testing & Polish**
  - [ ] `apps/admin` (Academics, Rosters, Grading, Settings, Staff)
  - [ ] `apps/teacher` (Grading entry, Report card extras, Class rosters)
  - [ ] `apps/portal` (Parent views, Student cards, Historical report cards)
  - [ ] `apps/platform` (Super Admin tenant oversight, Cloud metrics)
  - [ ] `apps/sites` / `apps/www` (Public admission forms, Landing pages)

---

## ✅ Done (Completed Implementations & Fixes)

### 1. Foundation, Branding & Security
- [x] **Branch Setup & Unified Branded Spinner (`MeloLoader`)**
  - Created branch `audit/e2e-ux-polish` from `master`.
  - Built `@school/shared/components/MeloLoader.tsx` with smooth SVG animations.
  - Integrated across all app layout guards and loading fallbacks (`admin`, `teacher`, `portal`, `platform`).
- [x] **Production-to-Dev Database Mirroring & Backup**
  - Exported production snapshot (`tmp/prod_export.zip`, 7,391 docs + 133 files).
  - Restored into local Dev Convex deployment (`dev:scrupulous-chinchilla-25`).
- [x] **Dynamic School Tab Titles & Favicon Sync**
  - Synchronized browser tab titles (`Admin · [School Name]`) and reactive favicon swap to school crest logo on sign-in.
- [x] **Universal "Change Password" Modal & Security UI**
  - Built reusable `ChangePasswordModal` in `@school/shared` powered by Better Auth.
  - Added into Platform Super Admin top bar and user profile dropdowns across `admin`, `teacher`, and `portal`.
- [x] **Admin Default Landing Route Fix**
  - Replaced legacy redirect to `/assessments/setup/exam-recording` with `/admin/dashboard`.
- [x] **Super Admin Password Reset for School Admins**
  - Added `resetSchoolAdminPassword` backend mutation and `ResetSchoolAdminPasswordModal` in Platform Super Admin (`:3006/schools`).
- [x] **Super Admin Workspace UI Overhaul (`:3006/schools`)**
  - Dense KPI summary strip (*Total Schools, Live Tenants, Pending Setup, Cloud Engine*).
  - Real-time search, status filter tabs, glowing pulse indicators, and copyable slug badges.
- [x] **Dedicated School Profile & Institution Settings (`/admin/settings`)**
  - Centralized institution settings: Name, Motto/Tagline, Crest Logo uploader, Brand Color Palette picker with curated presets, Official Contact info (Email, Phone, Campus Address).
  - Protected read-only tenant slug badge.
- [x] **Route Protection for Disabled Tier Modules**
  - Added layout guards on `/billing` and `/academic/knowledge/*` with user-friendly "Module Inactive" screen.

### 2. Enrollment, Image Uploads & Photo Cropping
- [x] **Photo Upload Validation & File Size Guard**
  - Fixed client-side error threshold check so valid photos under 1MB are accepted without false-positive error triggers.
  - Enforced strict 1MB file size limits and image mime-type validation.
- [x] **Image Cropping UX Refinement**
  - Cleaned up image cropping modal interface to align with the design system.

### 3. Session-Oriented Promotions & Class Roster Resolution
- [x] **Intra-Session Promotion Guard & Deep-Link Navigation**
  - Blocked promotion of students within the same session.
  - Added intelligent warning prompting admins to select a new session when initiating rollover.
  - If no upcoming session exists, provides a 1-click deep-link directly to `/academic/sessions` (fixed legacy link that mistakenly went to `/academic/subjects`).
  - Added session date validation preventing backward promotions to earlier sessions.
- [x] **Promotion Staging & Class Roster Architecture**
  - Added `studentSessionPromotions` table (`schoolId`, `studentId`, `sourceSessionId`, `targetSessionId`, `sourceClassId`, `targetClassId`, `status`, `promotedAt`, `promotedBy`).
  - Staged promotions ensure promoted students don't prematurely collide with existing rosters in the target class before the new session begins.
  - Resolved session-scoped student counts and active class rosters per session.
- [x] **Promotion Banner UX & Mobile Drawer Polish**
  - Default-collapsed promotion rollover card with smooth expand/collapse.
  - Replaced text "Close" with standardized `X` icon matching design patterns across the application.
  - Added smooth slide-up animation and sheet interactions for mobile student additions and promotion drawers.

### 4. Academic Class Management & Subject Blueprint Builder
- [x] **Class Blueprint Builder Layout Overhaul (`/academic/classes`)**
  - Converted `ClassCreationForm` and `ClassEditForm` to full-height flex column layouts with a pinned bottom "Save Class Blueprint" action bar.
  - Added instant real-time subject search filter in the subject offerings selector.
  - Added "Select All" and "Clear" quick actions with live selection counters.
- [x] **Session-Scoped Form Teacher Assignments & History Preservation**
  - Added `classSessionFormTeachers` table (`schoolId`, `classId`, `sessionId`, `formTeacherId`, `createdAt`, `updatedAt`, `updatedBy`) with 4 composite indexes.
  - `createClass` and `updateClass` persist form teachers scoped to the targeted academic session while synchronizing `classes.formTeacherId` on the active session for backwards compatibility.
  - `listClasses` query accepts an optional `sessionId` filter and dynamically resolves session form teachers.
  - Added session selector dropdown in `/academic/classes` header and session context badges in creation/edit forms.
- [x] **Historical Report Card Form Teacher Attribution**
  - `buildStudentReportCard` in `reportCards.ts` resolves form teacher from `classSessionFormTeachers` for the exact session of the report card.
  - Historical report cards accurately display the teacher who led the class during that academic year, even if the teacher was later reassigned or soft-archived.
- [x] **Safe Teacher Archiving Guardrails**
  - `listTeacherArchiveBlockers` in `archiveGuardrails.ts` now inspects only form teacher and subject assignments in the **currently active session**.
  - Teachers who concluded previous sessions and have no active duties can now be safely archived without triggering blocking validation errors.

---

## 💥 The Damage: Downstream Blast Radius & Verification Checkpoints

*Whenever core schemas and shared workflows are modified, downstream modules may be affected. Use this checklist during subsequent testing passes:*

### 1. Academic Classes & Blueprint Changes
- [ ] **Class Roster Views (`/academic/classes`):**
  - Switching between different academic sessions in the dropdown must re-fetch and render the correct session-specific form teacher for each class.
  - Modifying a class form teacher while viewing an older or future session must only mutate `classSessionFormTeachers` for that session, leaving the active session's live pointer intact.
- [ ] **Curriculum & Subject Assignments (`/academic/subjects`, `/academic/classes`):**
  - Assigning subject teachers within a class blueprint must persist cleanly without interfering with the session form teacher mapping.

### 2. Student Promotions & Enrollment Rosters
- [ ] **Student Directory (`/students`):**
  - Verify student count badges per class accurately reflect students placed in that class for the selected session.
  - Promoting a cohort from JSS 1 to JSS 2 for 2026/2027 must NOT alter the current 2025/2026 JSS 1 class list while the 2025/2026 session is still active.
- [ ] **Student Detail & Profile Sheet (`/students/[id]`):**
  - Verify student class name and session progression status render correctly on individual profiles.

### 3. Report Cards & Transcripts (Historical Integrity)
- [ ] **Report Card Generation (`/assessments/report-cards`):**
  - Open a 2024/2025 report card for a student: verify the footer displays the 2024/2025 Form Teacher's name.
  - Open a 2025/2026 report card for the same student: verify it displays the 2025/2026 Form Teacher's name.
  - Verify that soft-archiving a departed teacher still renders their human-readable name on historical report card PDF prints without crashing or displaying "Unassigned".

### 4. Staff Management & Teacher Archiving
- [ ] **Teacher Archiving Modal (`/staff` / `/admin/teachers`):**
  - Attempting to archive a teacher who is an active form teacher in the *current active session* must display the blocking warning listing the exact class name.
  - Attempting to archive a teacher who *only* taught in past sessions must succeed immediately with zero blockers.

### 5. Teacher Workspace Authorization
- [ ] **Teacher Portal Extras (`apps/teacher`):**
  - Verify `getTeacherExtrasAuthorization` grants comment/affective domain entry access to teachers who are form teachers in the active session.

### 6. Billing & Communications Downstream
- [ ] **Receipts & Invoices Header (`/billing`):**
  - Verify school motto, official contact phone/email, and physical campus address from Settings render on billing statements and PDF payment receipts.
- [ ] **Parent & Student Portals (`:3003`):**
  - Verify that custom school palette, crest favicon, and school tagline render in portal headers.

---

## 🚀 Roadmap & Backlog

### High Priority / Next Up
- [ ] **Sequential Auto-Incrementing Admission Numbers & Starting Counter Seed**
  - Configurable format pattern in School Settings (e.g. `SCH/{YEAR}/{SEQ:4}` $\to$ `SCH/2026/0042` or `NUR-{SEQ:4}`).
  - Admin defines *"Last Used Admission Number"* / *"Starting Seed Number"* (e.g. `516`) so onboarding schools migrate without ID gaps.
  - Auto-assign next sequential number upon enrollment approval.
- [ ] **Institutional Email Domain & Standardized Staff/Student Email Convention**
  - School domain configuration in Settings (e.g. `@meridiancrest.edu.ng`).
  - Standardized email address generation: `firstname.lastname@schoolsdomain.com` with collision resolution.
- [ ] **Form Unsaved State Guard & Draft Protection**
  - Confirmation prompt before navigating away when an enrollment or setup form has unsaved edits.
  - Local draft backup in `localStorage` for form resilience against accidental reloads.
- [ ] **Mobile Scroll Progress Bar for Long Forms**
  - Fixed top progress indicator on mobile viewports during multi-step student enrollment and wizard forms.

### Architecture & Medium-Term Enhancements
- [ ] **Multi-Parent Household & Guardian Linking Architecture**
  - Support up to 2 legal parents (`Parent 1`, `Parent 2`) plus an optional primary `Guardian`.
  - Relationship and residential address inheritance toggles.
  - Sibling auto-linking under unified `householdId` when contact details match.
- [ ] **Comprehensive Student Lifecycle, Enrollment History & Timeline Audit Logs**
  - Interactive vertical timeline widget on student admin & parent profiles (Admission $\to$ Class Progressions $\to$ Leaves/Transfers $\to$ Graduation).
  - Official Certificate & Attestation Transcript export certifying exact dates of attendance.
- [ ] **Comprehensive Staff Onboarding & HR Profiles**
  - Honorific titles (`Mr.`, `Mrs.`, `Dr.`, `Engr.`), staff codes, employment dates, and role progression logs.
  - Formal exit recording (`resigned`, `retired`, `transferred`) and document uploads (contracts, clearance certificates).
- [ ] **Multi-Tenant Campus & School Switcher (Proprietor Portal)**
  - 1-click campus switching in navbar for multi-branch school owners without re-authentication.
- [ ] **Intelligent School Bulk Data Import & Full Export Engine**
  - Full structured tenant exports (Excel/CSV).
  - AI-assisted import parsing with fuzzy name matching, grade placement confidence, and interactive deduplication review workbench.
- [ ] **Smart Transactional & Batched Notification Engine**
  - Immediate security/auth alerts.
  - Debounced digest outbox for rapid operational edits to avoid guardian email fatigue.
