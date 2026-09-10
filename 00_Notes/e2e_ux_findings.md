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
  - [x] `apps/admin` (Academics, Rosters, Grading, Settings, Staff, Imports, Billing)
  - [ ] `apps/teacher` (Grading entry, Report card extras, Class rosters)
  - [ ] `apps/portal` (Parent views, Student cards, Historical report cards)
  - [x] `apps/platform` (Super Admin tenant oversight, Cloud metrics, School Groups, Audit Explorer)
  - [ ] `apps/sites` / `apps/www` (Public admission forms, Landing pages)

---

## ✅ Done (Completed Implementations & Fixes)

### 1. Foundation, Branding, Security & Auth Architecture
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
  - Centralized institution settings: Name, Motto/Tagline, Brand Color Palette picker with curated presets, Official Contact info (Email, Phone, Campus Address).
  - Protected read-only tenant slug badge.
- [x] **Secure School Crest Logo Uploads (`schoolBranding.ts`, `assetStorageBoundary.ts`, `/admin/settings`)**
  - Added `generateSchoolCrestUploadUrl` and `saveSchoolCrestUpload` mutations in `schoolBranding.ts` with strict image MIME validation (`image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`) and 1MB size caps.
  - Hardened `assetStorageBoundary.ts` to enforce tenant isolation and allowed shared group/HQ crest logos to load seamlessly on linked branch campuses during workspace startup.
  - Integrated file upload picker and real-time logo preview directly into `/admin/settings`.
- [x] **Unified Settings Sub-Navigation Tabs (`SettingsNavigationTabs.tsx`, `/admin/settings/*`)**
  - Replaced raw underlined HTML anchor links dumped under the settings header with a clean, branded pill tab bar (`SettingsNavigationTabs`).
  - Integrated across all 4 settings sub-routes:
    - *School Profile & Branding* (`/admin/settings`)
    - *Institutional Email* (`/admin/settings/email-domains`)
    - *Group Defaults* (`/admin/settings/group-defaults`)
    - *Admission Numbering* (`/admin/settings/admission-numbering`)
  - Added null-safe pathname handling for SSR and test environments.
- [x] **Route Protection & Alignment for Disabled Tier Modules**
  - Added layout guards and synchronized `workspace-route-access.ts` and `workspace-navigation.ts` across `admin`, `teacher`, and `portal` apps (`/billing`, `/academic/knowledge/*`, `/enrollment/*`).
  - Displays user-friendly "Module Inactive" screen instead of runtime errors when visiting disabled features.

### 2. Enrollment, Image Uploads & Secure Student Photo Pipeline
- [x] **Secure Student Photo Upload Backend (`studentEnrollment.ts`, `storageSafety.ts`)**
  - Implemented `generateStudentPhotoUploadUrl` and `saveStudentPhoto` mutations with multi-tenant storage isolation.
  - Enforced strict 1MB file size limits and image MIME-type validation (`image/jpeg`, `image/png`, `image/webp`).
  - Replaced direct, insecure image writes with controlled pre-signed upload URLs and storage ID verification.
- [x] **Admin Student Photo Upload & Cropping Integration (`StudentCreationForm.tsx`, `StudentProfileEditor.tsx`, `StudentPhotoPanel.tsx`)**
  - Integrated student photo upload actions across student creation forms, profile editing drawers, and student photo panels.
  - Cleaned up image cropping modal interface to align with the Melo Slate/Indigo design system.
  - Maintained graceful fallback to student initials when no photo is uploaded.
- [x] **Student Onboarding Viewport Clipping & Scroll Clearance (`StudentFirstOnboardingForm.tsx`, `onboarding/page.tsx`)**
  - Fixed viewport clipping where the multi-step navigation stepper and bottom action buttons were cut off behind browser viewports.
  - Added bounded container layout with `flex-1 min-h-0 overflow-y-auto` and generous `pb-16` clearance.

### 3. Session-Oriented Promotions, Class Transfers & Enrollment Rosters
- [x] **Intra-Session Promotion Guard & Deep-Link Navigation**
  - Blocked promotion of students within the same session.
  - Added intelligent warning prompting admins to select a new session when initiating rollover.
  - If no upcoming session exists, provides a 1-click deep-link directly to `/academic/sessions`.
  - Added session date validation preventing backward promotions to earlier sessions.
- [x] **Promotion Staging & Class Roster Architecture**
  - Added `studentSessionPromotions` table (`schoolId`, `studentId`, `sourceSessionId`, `targetSessionId`, `sourceClassId`, `targetClassId`, `status`, `promotedAt`, `promotedBy`).
  - Staged promotions ensure promoted students don't prematurely collide with existing rosters in the target class before the new session begins.
  - Resolved session-scoped student counts and active class rosters per session.
- [x] **Promotion Banner UX & Mobile Drawer Polish**
  - Default-collapsed promotion rollover card with smooth expand/collapse.
  - Replaced text "Close" with standardized `X` icon matching design patterns across the application.
  - Added smooth slide-up animation and sheet interactions for mobile student additions and promotion drawers.
- [x] **Rich Promotion Confirmation Modal (`PromotionConfirmationModal.tsx`)**
  - Replaced native browser `window.confirm(...)` dialogue with a custom, branded confirmation modal.
  - Displays transfer routing badge (From: Class/Session &rarr; To: Class/Session), subject enrollment mode explanation, and amber overwrite warning banner for students already staged.
  - Replaced `window.confirm` with portaled `ConfirmationModal` across student cancel promotion, student archiving, family unlinking, and class aggregation removals.
- [x] **Student Identity Roster Matrix & Promotion Badge Redesign (`SubjectSelectionDesktopTable.tsx`, `SubjectSelectionMobileEditor.tsx`)**
  - Expanded sticky Student Identity column from cramped 240px to 340px, eliminating name truncation and overflow.
  - Relocated "All" and "Clear" subject selection controls into compact top-right inline action pills.
  - Replaced tall 4-line wrapping promotion block with a sleek, single-line emerald badge (`Promoted → Primary 5 (26/27)`) with an integrated `(X)` cancel action button.
  - Reduced row vertical height by ~50%, improving data density and visual balance.
  - Integrated student photo avatars (`photoUrl`) with initials fallback across desktop, mobile editor cards, and bottom sheets.
- [x] **Inter-Class Roster Transfers (`studentEnrollment.ts: moveStudentClass`)**
  - Built `moveStudentClass` mutation allowing administrators to seamlessly transfer enrolled students between class rosters within an active session.
  - Updates class placement, verifies academic session boundaries, and recalibrates subject selections cleanly.
- [x] **Archived Student Account Desynchronization Fix (`studentEnrollment.ts`)**
  - Resolved desync where archived user accounts (`users.isArchived = true`) retained unarchived student records (`students.isArchived = false`), triggering crashes when clicking roster rows or initiating promotions.
  - Hardened `getClassStudentSubjectMatrix`, `getStudentsByClass`, and `loadStudentFamilyProfile` to strictly filter out students whose user account is missing or archived.
  - Added `reconcileArchivedStudents` mutation to synchronize `isArchived = true` onto orphan student records and purge stale promotion staging rows.

### 4. Academic Class Management & Subject Blueprint Builder
- [x] **Class Blueprint Builder Layout Overhaul (`/academic/classes`)**
  - Converted `ClassCreationForm` and `ClassEditForm` to full-height flex column layouts with a pinned bottom "Save Class Blueprint" action bar.
  - Added instant real-time subject search filter in the subject offerings selector.
  - Added "Select All" and "Clear" quick actions with live selection counters.
- [x] **Session-Scoped Form Teacher Assignments & History Preservation**
  - Added `classSessionFormTeachers` table (`schoolId`, `classId`, `sessionId`, `formTeacherId`, `createdAt`, `updatedAt`, `updatedBy`) with 4 composite indexes.
  - `createClass` and `updateClass` persist form teachers scoped to the targeted academic session while synchronizing `classes.formTeacherId` on the active session for backwards compatibility.
  - Historical report cards accurately display the teacher who led the class during that academic year.
- [x] **Safe Teacher Archiving Guardrails**
  - `listTeacherArchiveBlockers` in `archiveGuardrails.ts` now inspects only form teacher and subject assignments in the **currently active session**.
  - Teachers who concluded previous sessions and have no active duties can now be safely archived without blocking validation errors.
- [x] **Class Section / Academic Level (Nursery, Primary, Secondary) Modifiability (`ClassEditForm.tsx`)**
  - Added Section / Academic Level selector in the Class Edit blueprint drawer (`/academic/classes`), allowing administrators to correct class level assignments directly without needing to recreate the class.
- [x] **Natural Alphanumeric & Alphabetical Class Sorting across Backend & Frontend**
  - Updated `listClasses`, `getAllClasses`, `getTeacherAssignableClasses`, and class roster views to sort by resolved class display name using natural numeric collation (`{ numeric: true, sensitivity: "base" }`) so classes always list in logical order (e.g. *Grade 1, Grade 2... Grade 10, Grade 11*).
- [x] **Student Roster Visibility for Classes with Zero Subjects Configured**
  - Enrolled students remain visible in both desktop and mobile roster views with full names, avatars, and admission numbers even when no subjects have yet been configured for the class.
- [x] **Global Phone & Email Input Sanitation and Strict Validation**
  - Built `cleanPhoneInput`, `isValidPhoneNumber`, `cleanEmailInput`, and `isValidEmailAddress` in `@school/shared`.
  - Added real-time character filtering on all phone input fields (`type="tel"`), preventing letters, `@`, or email domains from ever being typed or pasted into phone fields.
- [x] **Stateful URL Query Synchronization & Deep Linking on `/academic/students`**
  - Selecting a Class (`?classId=...`), Academic Session (`?sessionId=...`), Student Record (`?studentId=...`), or Sheet Tab (`?tab=...`) automatically updates the browser URL for seamless bookmarking and sharing.

### 5. Academic Sessions, Dynamic Term Partitioning & Bounded Generation
- [x] **Dynamic Academic Session Term Partitioning & Bounded Calendar Generation**
  - Built `calculateDynamicTermSchedule` and `suggestTermDateRange` in `@school/shared` to automatically partition any session into 3 balanced terms separated by realistic 2-3 week holiday breaks.
  - Added atomic `autoGenerateTerms` directly to `createSession` backend mutation in `academicSetup.ts`, eliminating sequential client-side network roundtrips.
  - Added term date clamping in `academicSetup.ts` so generated term dates are strictly bounded within the session start/end limits.
- [x] **Academic Session Creation Timezone Normalization (`SessionCreationModal.tsx`, `TermCreationModal.tsx`)**
  - Standardized all session and term start/end inputs on `Date.UTC(year, month - 1, day, 12, 0, 0)` and UTC-based date formatting.
  - Eliminated timezone drift bugs where local noon timestamps ahead of UTC (e.g., WAT / UTC+1) caused term end bounds to exceed session end bounds by 1 hour on Convex Cloud, triggering false calendar template errors.
- [x] **Full-Screen Modal Backdrop Portals & Viewport Scroll Locking**
  - Portaled modal dialogs to `document.body` with `z-[9999]`, SSR mount guards, and scroll locking, spanning the full 100vw x 100vh viewport over sticky navbars and sidebars.
- [x] **Responsive Bottom Sheet for Session & Term Creation**
  - Replaced invalid Tailwind CSS utility `p-4.5` with generous `px-6 py-4 sm:py-5` padding.
  - Refactored `SessionCreationModal` and `TermCreationModal` into responsive bottom sheets: animated slide-up drawer on mobile/tablet viewports with grab handle, rounded-t-[2.5rem], and centered dialog on desktop.
- [x] **Student Graduation Workflow & Official Attestation Letter (`studentGraduation.ts`)**
  - Added atomic `graduateStudents` backend mutation marking student statuses as `"graduated"` with graduation session metadata.
  - Built `GraduationConfirmationModal` for batch graduation and `AttestationLetterModal` for institutional letters of completion with school letterhead.

### 6. Billing Ledger, Deposit Bank Accounts & Universal Fee Plans
- [x] **Billing Viewport Clipping Resolution & Full-Bleed Height Fix (`/billing/layout.tsx`, `/billing/page.tsx`, `FeePlanForm.tsx`)**
  - Wrapped billing layout in `h-full w-full flex flex-col min-h-0` and hid redundant navigation as `sr-only`.
  - Replaced `lg:h-[calc(100vh-56px)]` on the billing main container with `h-full min-h-0 w-full overflow-hidden flex flex-col` with `shrink-0` desktop management sidebar.
  - Added `min-h-0 pb-10` to the scrollable container in `FeePlanForm.tsx` and tightened the pinned footer, ensuring the "Create Fee Plan" CTA and all fee inputs remain fully visible without clipping on smaller desktop viewports.
- [x] **Modernized Deposit Bank Account Selection (`BankAccountSelection.tsx`)**
  - Redesigned deposit account selector with `Landmark` icon, modern rounded-xl styling, and active account filtering (`activeAccounts`).
  - Added informative contextual copy: clearly explains whether invoices deposit into the chosen bank account or fallback to the school's primary settlement account.
- [x] **Universal "All Classes" Fee Plan Enablement (`billing.ts`, `FeePlanForm.tsx`)**
  - Removed artificial validation check in `createFeePlan` that previously threw an error when `billingMode === "class_default"` had `targetClassIds: []`.
  - Added informative blue indicator pill in `FeePlanForm.tsx` when "All Classes (Universal Template)" is selected: *"Universal Template: This fee plan can be billed to students in any class across the school."*
- [x] **Manual Payment Receipt Reference Generator Overhaul (`BillingSidebar.tsx`, `useBillingActions.ts`)**
  - Replaced disconnected header link containing AI sparkles with an integrated inside-input button: `[ # Generate ]` utilizing `Hash` icon and neutral slate styling (`bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700`).
  - Fixed `runAction` error toast handling in `useBillingActions.ts` so errors no longer use `successTitle` (which previously produced misleading red toasts titled *"Fee Plan Created"* on failure).
- [x] **Currency Amount Input Truncation & Zero Clipping Fix (`FeePlanForm.tsx`)**
  - Expanded line item amount input width to 160px (`w-40`), ensuring 5-7 digit values and trailing zeros never overflow.
  - Disabled native WebKit spin buttons and added smart number typing normalization preventing awkward leading zeros.
- [x] **Optional Line Item Toggles & Paystack Integration**
  - Added `isOptional` field to `feePlans.lineItems` and `isOptional` + `isSelected` to `studentInvoices.lineItems`.
  - Allowed line items to be toggled as optional add-ons (e.g. screen uniforms, bus services) with `toggleInvoiceOptionalLineItem` mutation.
  - Redesigned executive invoices and statements of account in `PrintableFinanceModal.tsx` with high-contrast KPI cards, running balances, and Paystack checkout QR codes.

### 7. Document Extraction, OCR Pipeline & Knowledge Library Ingestion
- [x] **Admin Knowledge Material Upload in Knowledge Library (`/academic/knowledge/library/page.tsx`)**
  - Added dedicated `Upload` button in the Knowledge Library header, gated on `assets.upload` and `academic.planning.use` / `academic.curriculum.manage` capabilities.
  - Integrated `KnowledgeMaterialUploadForm` within an `AdminSheet`, allowing administrators to directly ingest curriculum guides, scheme of work PDFs, and reference textbooks.
  - Connected upload action to `saveKnowledgeMaterialUpload` with binary array buffer streaming and toast notifications.
- [x] **Eliminated Low-Density PDF False Failure Trap (`lessonKnowledgePdfExtraction.ts`)**
  - Fixed false-rejection bug where documents with sparse native text (< 20 words / diagrams / worksheet titles) were aborted as `insufficient_text`.
  - Routed low-density extractions directly to `status: "ocr_needed"`, enabling provider OCR to process scanned or illustrated school files.
- [x] **OpenRouter Model Migration to `openai/gpt-5.6-luna` (`lessonKnowledgeOcrActions.ts`)**
  - Replaced brittle free tier default with cost-effective `openai/gpt-5.6-luna`.
  - Increased OCR timeout to 120s (`120_000`ms) and implemented educational layout system prompt enforcing Markdown tables, bracketed diagram captions, and LaTeX formulas.
- [x] **Dead Browser-OCR Code Deletion**
  - Deleted legacy client-side canvas renderer `browserPdfOcr.ts` and dead backend action `lessonKnowledgeBrowserOcrActions.ts`.

### 8. Staff Roles, Parent-Staff Identity, Admin Parity & Teacher Controls
- [x] **Restored Teacher Password Reset & Archiving for School Admins (`TeacherEditForm.tsx`, `academic/teachers/page.tsx`)**
  - Restored teacher password reset and archiving actions for school administrators, eliminating the previous restriction where only platform super admins could perform resets.
  - Added comprehensive test coverage in `teacher-password-reset.test.tsx`.
- [x] **Administrative Leadership Role Parity (`workspace-access.ts: hasAdminRoleParity`)**
  - Built `hasAdminRoleParity` helper checking both `user.role === "admin"` and `user.isSchoolAdmin === true`.
  - Applied across `/admin/dashboard`, `/admin/audit`, `/admin/group`, `/admin/permissions`, `/admin/settings`, and teacher management views so school admins and designated principals share unified administrative authority.
- [x] **Legacy Admin Authority Preservation (`rbac.ts`)**
  - Ensured legacy school admins maintain full administrative privileges across all capabilities, preventing authorization lockouts during RBAC policy rollout.
- [x] **Staff-as-Parent & Family Link Identity Unification**
  - Allowed teachers and administrators to be linked into Family Link as parents/guardians without colliding on active accounts, while preventing enrolled students from being linked as parent contacts.
  - Refactored `StudentFamilyPanel.tsx`: flattened card hierarchy, scaled typography down to responsive sizes (`h-9 text-xs font-medium`), and added `Staff: <role>` badges.
- [x] **Administrator Archiving & Demotion to Teacher**
  - Added `restoreSchoolAdmin` and `demoteAdminToTeacher` mutations in `adminLeadership.ts` with sub-admin re-parenting to Lead Admin.
  - Added Administrator filter tab and restore actions to `/academic/archived-records` and the `/admin` Users Directory.

### 9. Grading Bands Policy, Report Card Resumption Sync & Navigation
- [x] **Differentiated Academic Grade Band Color Scale & Positive Standing for Grade C (`grade-policy.ts`, `GradeColorControl.tsx`)**
  - Replaced murky brown/rust tones that caused parent panic with a crisp educational palette:
    - **Grade A (75–100, Excellent):** Emerald Green (`#065f46`, 7.7:1 AAA contrast).
    - **Grade B (65–74, Very Good):** Royal Blue (`#1e40af`, 8.7:1 AAA contrast).
    - **Grade C (50–64, Good):** Vivid Purple / Violet (`#6d28d9`, 7.1:1 AAA contrast) — elevated to clear positive standing.
    - **Grade D (45–49, Fair Pass):** Warm Amber / Ochre (`#b45309`, 5.0:1 AA contrast) — caution tone.
    - **Grade E (40–44, Pass) & Grade F (0–39, Fail):** Crimson Red (`#991b1b`, 8.3:1 AAA contrast) — shared risk tier.
  - Deduplicated palette swatches in `GradeColorControl.tsx` to render a clean 5-color selector without duplicate DOM keys.
- [x] **Grading Bands Validation, Default Preset & Auto-Arrange (`/assessments/setup/grading-bands`)**
  - Added duplicate grade label and score range overlap checks with targeted border highlighting in `BandTable.tsx`.
  - Added 1-click **"Load Standard Scale"** preset (`A: 75–100`, `B: 65–74`, `C: 50–64`, `D: 40–49`, `F: 0–39`) and **"Auto-Arrange"** button sorting ascending (`0 → 100`).
  - Added responsive mobile tier cards (`md:hidden`) and in-flow `BandValidationBanner` rendered above tiers.
- [x] **Report Cards Self-Contained Launcher & Sidebar Navigation (`/assessments/report-cards`)**
  - Added `ReportCardLauncher.tsx` providing session, term, class, student search, and batch print selectors.
  - Added pinned top header (`shrink-0 z-20`) with dedicated 2-axis in-canvas zoom (`[ - ] [ Fit ] [ + ]`), drag panning, and mobile pinch-to-zoom.
- [x] **Strict Next-Term Resumption Auto-Lookup & Calendar Event Sync**
  - Automatically looks up adjacent next term's start date and synchronizes report card resumption edits back to `academicTerms.startDate`.
  - Automatically posts a 2-week resumption notice to `schoolEvents` before term conclusion.

### 10. Platform Super Admin Unified Navigation, School Groups & Multi-Branch Staff Assignment
- [x] **Multi-Branch Staff Assignment Engine (`GroupBranchAccessManager.tsx`, `groups.ts`)**
  - Built `GroupBranchAccessManager` enabling school group proprietors and HQ admins to grant existing staff access to sibling branch campuses without creating second logins.
  - Supports role assignment (`admin`, `staff`, `teacher`), permission templates (`roleTemplateId`), display titles (e.g. *Ruga Branch Administrator*), and slug confirmation.
  - Added revocation controls with guardrails preventing accidental revocation of proprietors or a staff member's sole active campus.
  - Extended schema to support the `"staff"` membership role.
- [x] **Unified Platform Navigation System (`PlatformLayoutClient.tsx`)**
  - Universal top navigation bar across `/schools`, `/groups`, and `/audit` with segmented tab bar, user pill, Change Password modal trigger, and Sign Out action.
- [x] **School Groups Mental Model Clarification & Two-Column Workbench (`apps/platform/app/groups/page.tsx`)**
  - Two-column workbench: Left column directory of groups with slug badges; Right column showing HQ campus highlight, linked branches, and `+ Link Another Branch` drawer.
  - Eliminated defensive AI jargon and automated slug verification on submission.
- [x] **Audit Explorer Modernization & De-Slopping (`AuditExplorerView.tsx`)**
  - Upgraded audit explorer with clean status pills (emerald for success, rose for denials), humanized relative timestamps, collapsible payload details, and export controls.

### 11. Admin & Staff Workspace Header Optimization & Branch Switcher Slop Removal
- [x] **Zero Vertical Screen Waste & Dedicated Header Slot (`WorkspaceNavbar.tsx`)**
  - Completely eliminated the full-width white banner strip previously rendered below the top navigation across admin and teacher pages.
  - Relocated the branch selector directly into the top header bar (`h-16`) alongside the user profile dropdown.
- [x] **Developer Slop Removal & Multi-Campus Control (`BranchSwitcher.tsx`)**
  - Removed hardcoded developer text regarding scoped domain adapters and unready routes.
  - Intelligent rendering: returns `null` when a school organization has only 1 branch or when switching is not enabled, giving 100% of vertical screen space back to actual dashboards.
  - Displays compact `[ 🏫 Campus ▾ ]` select pill when multiple active campuses exist.

### 12. Admission Numbering Policy, Token Formatting & Monotonic Sequence Guardrails
- [x] **Admission Numbering Modern Configuration Center (`/admin/settings/admission-numbering`)**
  - Overhauled raw developer form into a premium card-based layout matching the Melo Slate/Indigo design system.
  - Real-time "Live Identifier Preview" card showcasing dynamic tokens (`{SCHOOL}`, `{CAMPUS}`, `{LEVEL}`, `{YEAR}`, `{SEQ:4}`) with sample previews.
  - Cursor-position token insertion: clicking a token splices it at the exact cursor caret position rather than appending to the end of the input.
- [x] **Monotonic Sequence Guardrails & Backward-Step Prevention**
  - Added proactive `min={minSequenceAllowed}` on the "Next sequence" input with live warnings (`Cannot be lower than #X`) and 1-click reset shortcuts.
  - Disables save actions when moving sequence backwards, preventing duplicate ID collisions before form submission.
- [x] **Convex Error Sanitization & Unified Sonner Toast Routing**
  - Sanitized internal Convex mutation errors (`getUserFacingErrorMessage`), mapping monotonic sequence constraints, session counter drift, and concurrency conflicts into plain-English notifications.
  - Routed notifications through unified `appToast` with interactive recovery actions (`Reset to #X`, `Reload`), replacing page-displacing in-page error banners while preserving `sr-only` live regions.
- [x] **Intentional Starting Number Confirmation Requirement**
  - Replaced 1-click auto-fill with an intentional manual typing requirement: admins must type the starting sequence number into the confirmation input, with instant emerald confirmation styling upon matching.

### 13. Data Migration & Bulk Student Import Engine (Roster Review, Deduplication & Counter Sync)
- [x] **Independent Vertical Scroll Container on Migration Workbench (`DataMigrationWorkbench.tsx`)**
  - Refactored `DataMigrationWorkbench.tsx` into a 3-tier layout: Pinned Header (`shrink-0`), Scrollable Body (`flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-24`), and Pinned Action Bar (`shrink-0`).
  - Resolved scrolling lock caused by `WorkspaceNavbar` fullBleed container bounds, unlocking smooth navigation across rosters with dozens of students.
- [x] **Automated Catalog Class Matching (`resolveStagedClassesBatch`, `migrationWorkspace.ts`)**
  - Added `resolveStagedClassesBatch` backend mutation: automatically fuzzy-matches raw spreadsheet class names (e.g. "Primary 1A", "JSS1", "Grade 2") against active school catalog classes using `findUniqueMigrationClass`.
- [x] **Sequence Counter Recommendations & Seed Advancement (`applyWorkspaceCounterRecommendations`)**
  - Added `getWorkspaceCounterRecommendations` query and `applyWorkspaceCounterRecommendations` mutation: analyzes imported student admission numbers (e.g. `OBCA/2026/085`) and calculates the highest sequence used.
  - Provides a 1-click action to advance the school's sequence counter seed, preventing future admission number collisions.
- [x] **Bulk Roster Review & Batch Class Assignment Tools (`DataMigrationWorkbench.tsx`, `RosterReviewTab.tsx`)**
  - Added multi-row selection checkboxes, batch class assignment (`assignStudentClassBatch`), batch approvals, and batch rejections.
  - Filter tabs (`All`, `Pending`, `Approved`, `Flagged`) and real-time search across staged import records.
- [x] **Student Clash Review & Deduplication Engine (`deduplicationEngine.ts`, `ClashResolutionModal.tsx`)**
  - Enhanced deduplication engine to detect admission number collisions, existing user email matches, and fuzzy name matches.
  - Built `ClashResolutionModal` giving admins clear resolution options: link to existing account, override and create new, or update identifiers.
- [x] **Transactional Student & Family Account Creation (`migrationMerge.ts: createStudentsFromReviewedRoster`)**
  - Implemented `createStudentsFromReviewedRoster` mutation: transactionally creates `students` documents, Better Auth user accounts, and parent `familyLinks` from approved staged rows.
- [x] **Workspace Discard & Deletion (`migrationWorkspace.ts: deleteMigrationWorkspace`)**
  - Added safe workspace deletion mutation allowing administrators to discard abandoned or incorrect import runs cleanly.

### 14. Academic Grading Band Color Scale & Positive Standing for Grade C
- [x] **Differentiated Hue Architecture for Grade Bands**
  - Standardized distinct color hierarchy across `grade-policy.ts` and `themeDerivation.ts`:
    - Grade A: Emerald Green (`#065f46`, distinction)
    - Grade B: Royal Blue (`#1e40af`, high achievement)
    - Grade C: Vivid Purple / Violet (`#6d28d9`, positive credit standing)
    - Grade D: Warm Amber (`#b45309`, borderline pass caution)
    - Grade E & F: Crimson Red (`#991b1b`, shared risk/failure)
  - Successfully elevated Grade C out of danger/warning hues on report cards and parent portals.

### 15. Report Add-ons & Bundle Designer Multi-Preset Workbench
- [x] **Multi-Preset Sections & Section-Level Preset Selection (`InteractiveSheetEditor.tsx`, `BundleEditor.tsx`, `utils.ts`)**
  - Enhanced the report add-on bundle designer to support adding multiple preset sections into a single bundle without overwriting existing sections.
  - Added section-level preset selection (`createSectionDraftsFromPreset`) allowing admins to mix and match traits:
    - *Affective & Behavioral Traits*
    - *Psychomotor & Practical Skills*
    - *Teacher Remarks & Term Summary* (narrative teacher/principal remarks and dynamic next term resumption date)
    - *Attendance & Physical Measurements*
- [x] **Floating Action Dock in Editor (`EditorActionBar.tsx`)**
  - Replaced full-width bottom banner with a sleek, floating action dock (`fixed bottom-6 right-6 z-50` backdrop-blur pill).
  - Displays live "Unsaved changes" ping or "All saved" checkmark, Discard, and Save actions.
  - Replaced aggressive AI sparkles across curriculum and bundle designer components with clean native icons.

### 16. Developer Experience, Process Port Hygiene & Auth Query Initialization Guardrails
- [x] **Port Hygiene Utility & Prestart Hook (`scripts/kill-ports.mjs`)**
  - Created `scripts/kill-ports.mjs` and wired into `prestart` hook in `package.json`.
  - Automatically terminates lingering Node/Next.js processes on ports 3000–3006 before booting apps, eliminating `EADDRINUSE` port collision errors.
- [x] **Convex Auth Query Gating (`apps/admin/lib/AuthProvider.tsx`)**
  - Gated workspace and school metadata queries on Convex authentication state (`useConvexAuth().isAuthenticated`).
  - Eliminates startup race conditions where unauthenticated queries fired before JWTs were established, preventing sporadic initial load flashes and authorization failures.

### 17. Form Draft Ergonomics, Modernized Recovery Modals & Viewport Polish
- [x] **Streamlined Teacher Creation Form Header & Draft Controls (`TeacherCreationForm.tsx`)**
  - Eliminated swollen, oversized draft status pills and header text crowding.
  - Added `variant="compact"` to `PersistentFormDraftControls` for unobtrusive inline status indicators.
- [x] **Modernized Draft Recovery Modal Hierarchy (`DraftRecoveryModal.tsx`)**
  - Redesigned `DraftRecoveryModal`: clear visual hierarchy, plain copy, humanized relative timestamps, and zero button text wrapping.
  - Prevented modal content clipping on small and medium screens with proper flex bounds and custom scrollbars.
- [x] **Session Modal Draft Box De-sloppification (`SessionCreationModal.tsx`)**
  - Removed bulky draft notice boxes and paragraph disclaimers from the modal body, replacing them with compact footer status indicators.

---

## 💥 The Damage: Downstream Blast Radius & Verification Checkpoints

*Whenever core schemas and shared workflows are modified, downstream modules may be affected. Use this checklist during subsequent testing passes:*

### 1. Academic Classes & Blueprint Changes
- [ ] **Class Roster Views (`/academic/classes`):**
  - Switching between different academic sessions in the dropdown must re-fetch and render the correct session-specific form teacher for each class.
  - Modifying a class form teacher while viewing an older or future session must only mutate `classSessionFormTeachers` for that session, leaving the active session's live pointer intact.
- [ ] **Curriculum & Subject Assignments (`/academic/subjects`, `/academic/classes`):**
  - Assigning subject teachers within a class blueprint must persist cleanly without interfering with the session form teacher mapping.

### 2. Student Promotions, Enrollment & Multi-Branch Transfers
- [ ] **Student Directory (`/students`):**
  - Verify student count badges per class accurately reflect students placed in that class for the selected session.
  - Promoting a cohort from JSS 1 to JSS 2 for 2026/2027 must NOT alter the current 2025/2026 JSS 1 class list while the 2025/2026 session is still active.
- [ ] **Class Roster Transfers (`moveStudentClass`):**
  - Verify moving a student from Primary 1A to Primary 1B preserves the student's historical attendance and updates active subject selections.
- [ ] **Student Photo Uploads:**
  - Verify student photos render across admin roster, teacher grading sheet, and parent portal student badges.

### 3. Report Cards & Transcripts (Historical Integrity)
- [ ] **Report Card Generation (`/assessments/report-cards`):**
  - Open a 2024/2025 report card for a student: verify the footer displays the 2024/2025 Form Teacher's name.
  - Open a 2025/2026 report card for the same student: verify it displays the 2025/2026 Form Teacher's name.
  - Verify that soft-archiving a departed teacher still renders their human-readable name on historical report card PDF prints without crashing or displaying "Unassigned".
- [ ] **Multi-Preset Report Add-ons:**
  - Verify that bundles with multiple sections (Affective + Psychomotor + Remarks) render cleanly on printed A4 report cards without overlapping margins.

### 4. Staff Management & Teacher Archiving
- [ ] **Teacher Archiving Modal (`/staff` / `/admin/teachers`):**
  - Attempting to archive a teacher who is an active form teacher in the *current active session* must display the blocking warning listing the exact class name.
  - Attempting to archive a teacher who *only* taught in past sessions must succeed immediately with zero blockers.
- [ ] **Teacher Password Reset:**
  - Verify school admins can trigger password resets for teachers directly from the teacher edit drawer.

### 5. Multi-Branch Operations & Group Access
- [ ] **Group Branch Access Manager (`/admin/group`, `/platform/groups`):**
  - Assigning a teacher or admin to a secondary branch campus must grant immediate login access to that branch without duplicating user credentials.
  - Revoking access must take effect immediately on the next request while preserving their home branch credentials.

### 6. Billing & Communications Downstream
- [ ] **Deposit Bank Accounts on Invoices & Statements (`/billing`):**
  - Verify selected deposit bank accounts render verified bank name, account number, and settlement instructions on parent invoices and printable statements.
- [ ] **Receipt Generation:**
  - Verify manual `# Generate` receipt button produces distinct formatted identifiers (`REC-YYMMDD-XXXXX`).

### 7. Academic Timeline & Dynamic Term Scheduling
- [ ] **Session & Term Creation (`/academic/sessions`):**
  - Create a new academic session with arbitrary custom start/end dates in UTC+1 timezone: verify that terms are created atomically without throwing date range bounds errors.

---

## 🚀 Roadmap & Backlog

### Completed in Recent Passes
- [x] **Pre-Populated Default Grading Bands & Custom Color Coding per Grade Tier (`/assessments/setup/grading-bands`)** — Completed in Section 9 & 14 (`d89a037`). Standard scale presets, auto-arrange, and distinct AAA contrast palette (Grade C violet standing).
- [x] **Sequential Auto-Incrementing Admission Numbers & Starting Counter Seed (`/admin/settings/admission-numbering`)** — Completed in Section 12 (`bd817cd`, `1abf8fa`, `7f9bb47`, `cfb8095`). Live preview card, cursor token insert, monotonic guardrails, intentional typing confirmation, and import counter recommendations.
- [x] **School Bank Account Details for Invoices & Statements (`/billing`)** — Completed in Section 6 (`a17da8e`). Bank account selection per fee plan with fallback to school settlement default.
- [x] **Form Unsaved State Guard & Draft Protection** — Completed in Section 17 (`b098f9f`, `f900a9f`, `262968f`). Modernized `DraftRecoveryModal`, inline compact draft pills, and `useDirtyForm` departure protection.
- [x] **Intelligent School Bulk Data Import & Deduplication Engine (`/students/import`)** — Completed in Section 13 (`067e952`, `8e88e82`, `5d0b3aa`, `e5b0ecc`, `4707719`, `cfb8095`). Bulk roster tools, clash review modal, automated class fuzzy matching, sequence recommendations, and transactional student creation.
- [x] **Multi-Branch Staff Assignment (School Groups & Campus Networks)** — Completed in Section 10 (`cc3b7a4`). Cross-branch staff assignment without duplicate logins, role templates, and revocation guardrails.
- [x] **Direct Knowledge Material Ingestion in Admin (`/academic/knowledge/library`)** — Completed in Section 7 (`d922f82`). Upload button and sheet for school-wide curriculum guides and textbooks.

### High Priority / Next Up
- [ ] **Granular Admin Role-Based Access Control (RBAC) & Scoped Staff Permissions**
  - **Context & Need:** Departmental staff roles (Bursar/Accountant, Academic Director/Dean of Studies, Registrar/Admissions Officer, Exam Officer) should only view and manage modules relevant to their job functions.
  - **Proposed Role Scopes & Capability Matrix:**
    - **Finance & Bursary (`bursar`):** Restricted strictly to Billing, Invoices, Fee Plans, Statements of Account, Payment Receipts, and Bank Settings.
    - **Academic Affairs (`academic_dean` / `exam_officer`):** Sessions & Terms, Class Blueprints, Subject Catalogs, Exam Setup, Grading Bands, and Report Card generation.
    - **Admissions & Student Affairs (`registrar`):** Student Roster, Admissions, Enrollment Onboarding, and Attestation letters.
    - **School Super Admin / Proprietor (`super_admin`):** Full unrestricted administrative privileges.
  - **Implementation Strategy:**
    - Add `adminRole` or `permissions: string[]` field on admin users / memberships.
    - Add layout-level and route-level authorization guards on sidebar navigation items and page endpoints.
    - Enforce backend assertion helpers (`assertSchoolAdminPermission(ctx, "finance" | "academics" | "admissions")`).
- [ ] **Institutional Email Domain & Standardized Staff/Student Email Convention**
  - School domain configuration in Settings (e.g. `@meridiancrest.edu.ng`).
  - Standardized email address generation: `firstname.lastname@schoolsdomain.com` with collision resolution.
- [ ] **Mobile Scroll Progress Bar for Long Forms**
  - Fixed top progress indicator on mobile viewports during multi-step student enrollment and wizard forms.
- [ ] **AI & Document Ingestion Usage Limits, Storage Quotas & Over-Usage Buffers**
  - **Context & Need:** Protect platform margins and prevent runaway costs from high-frequency generation, excessive OCR, and large file uploads.
  - **Tier-1 Simple Metering (Phase 1 - Immediate & Clean):**
    - Prompt / Message Quota: Track AI generations per school per billing cycle.
    - Graceful Buffer: 10–20% soft buffer with warning banners in UI.
    - Pre-Upload PDF Page Counter & Smart Guidance Banner.
    - Document Ingestion & OCR Limits: 15–25 MB cap per PDF, page count cap, tenant storage quota.
  - **Tier-2 Advanced Token, Compute & Automated Document Batching (Phase 2):**
    - Auto-Split & Ingest in Batches for textbooks/syllabi.
    - Granular per-token tracking recorded into a `schoolAiUsage` ledger.
- [ ] **School Assets & PDF Compression Foundation** → see [docs/features/SchoolAssetsAndPdfCompression.md](../docs/features/SchoolAssetsAndPdfCompression.md)
  - Per-school private document store (`schoolAssets` table) for non-lesson-knowledge PDFs: policy docs, report templates, past papers, circulars, logos.
  - Per-school 5 GiB quota, 25 MB per-file cap, MIME allowlist (`application/pdf`, `image/png`, `image/jpeg`).
  - Server-side pure-Node PDF compression in a Convex Node action using `pdf-lib`.

### Architecture & Medium-Term Enhancements
- [ ] **Centralize Product Modules and Per-School Entitlements** → see [docs/features/ProductWideModuleEntitlements.md](../docs/features/ProductWideModuleEntitlements.md)
  - Implement each optional feature once across the shared Melo product, then enable it through tenant configuration.
  - Establish one non-React module registry as the source for platform controls, route-impact descriptions, navigation visibility, direct-route guards, and default entitlement behavior.
- [ ] **Migrate All AI Generation from Vercel to Convex — Reliability & Offline Resilience**
  - Move every OpenRouter AI generation currently in Vercel to Convex actions (`openai/gpt-5.6-luna`).
  - Unify env to single `SCHOOL_AI_*` set in Convex Dashboard.
  - Replace teacher `fetch('/api/.../generate')` calls with `useAction` + reactive `useQuery`.
- [ ] **Multi-Arm Class Architecture & Grade-Level Hierarchy (Supporting Multiple Arms per Grade)**
  - Model a first-class **Grade → Arms/Streams** hierarchy (e.g. `grades` representing cohort level, `classArms` representing classrooms/registers).
  - Allow shared grade-level defaults (curricula, grading policies, fee plans) to be configured once at the Grade tier and inherited by arms.
- [ ] **Multi-Parent Household & Guardian Linking Architecture**
  - Support up to 2 legal parents plus an optional primary Guardian.
  - Relationship and residential address inheritance toggles.
  - Sibling auto-linking under unified `householdId` when contact details match.
- [ ] **Comprehensive Student Lifecycle, Enrollment History & Timeline Audit Logs**
  - Interactive vertical timeline widget on student admin & parent profiles (Admission → Progressions → Leaves/Transfers → Graduation).
- [ ] **Comprehensive Staff Onboarding & HR Profiles**
  - Honorific titles, staff codes, employment dates, role progression logs, formal exit recording.
- [ ] **Smart Transactional & Batched Notification Engine**
  - Immediate security/auth alerts, debounced digest outbox for operational edits.

---

## 🔍 Post-Review Follow-Ups (from 4-agent code review, Aug 2026)

> These items were identified during the multi-agent code review of `audit/e2e-ux-polish` but are not inline code bugs — they require new tests, refactoring, or architectural decisions.

### Testing Gaps (Priority)
- [ ] **Promotion roster isolation test** — Spec claims "promoted students don't pollute active session roster" but no `convex-test` integration test verifies `getBaselineRoster`/`getClassRoster` after a `studentPromotions` insert.
- [ ] **Historical report card form-teacher test** — `reportCards.ts` queries `classSessionFormTeachers` by past session, but no test pins this behavior. Critical for transcript integrity.
- [ ] **Class roster session-switching test** — No test exercises `listClasses({sessionId: futureSessionId})` and asserts `formTeacherName` differs from active session.
- [ ] **Backwards-promotion rejection test** — Error message `"Cannot promote students backwards"` exists only in production code. Add `convex-test` for both rejection paths.
- [ ] **Graduation mutation end-to-end test** — `studentGraduation.test.ts` asserts a format string but doesn't exercise the real `graduateStudents` mutation.
- [ ] **`updateSessionDates` integration test** — Current test reimplements the handler instead of calling the real mutation.
- [ ] **`sessionScopedFormTeacher` coverage expansion** — Only 1 of 5 branches covered. Add tests for `classSubjects`, `teacherAssignments`, `subjects`, and `activeSession === null` fallback.
- [ ] **`getParentEmailReview` test coverage** — Add unit tests for malformed input and valid `+tag` addresses.

### Security & Auth Hardening
- [ ] **`auth.ts` email fallback tenant isolation** — The email fallback at `auth.ts:29` has no `schoolId` scoping. A user matching another school's email can cross-tenant. Long-term: drop the fallback or constrain to stable mapping.
- [ ] **`auth.ts` use `identity.tokenIdentifier`** — Convex guideline prefers `tokenIdentifier` over `subject`. Current code uses `subject`. Evaluate migration path.
- [ ] **Platform audit log middleware** — `resetSchoolAdminPassword` and `setSchoolStatus` write zero audit events. Add `recordPlatformAuditEvent` helper and wire into all platform mutations.
- [ ] **`setSchoolStatus` session invalidation** — Suspending a school doesn't call `deleteSessions` for the school's users. Cached JWTs remain valid for read-only paths.
- [ ] **`provisionSchoolAdmin` origin validation** — Accepts plaintext `origin` arg forwarded to Better Auth. Validate against server-side allowlist.
- [ ] **AI generation rate limiting** — Migration from Vercel removed throttling. Add per-teacher daily token-cost budget and `maxDuration` to `generateObject`.
- [ ] **`school.features.*` backend enforcement** — Feature flags are cosmetic (UI-only). Add `assertSchoolFeatureEnabled()` helper to billing/curriculum/knowledge mutations.
- [ ] **Platform password reset: rate limit + confirmation** — Add `consumePlatformAdminResetLimit`, require confirmation string, and write audit event.

### Refactoring
- [ ] **Split `documentGeneration.ts`** — 1,898 lines hosting validators, schema-repair, retry/backoff, prompts, mapping, normalization, Markdown rendering, AI logging, and 2 actions. Split into `documentGeneration/{prompts,repair,actions/{lessonPlan,assessment}}.ts`.
- [ ] **Split `WorkspaceNavbar.tsx`** — 1,145 lines. Extract mobile drawer, desktop tabs, profile dropdown, and favicon/title effects into separate components.
- [ ] **Extract shared modal primitive** — 10+ modals lack focus trap, ESC handler, and `aria-modal`. Create one `<Modal>` component (Radix Dialog or hand-rolled) and replace all implementations.
- [ ] **`callGenerateObject` type safety** — The `schema: unknown` → cast indirection works but obscures types. Consider one helper per output type so each call site is statically typed.

### Data Integrity
- [ ] **Promotion re-target audit trail** — Re-promoting a student to a different target class silently deletes prior `studentSubjectSelections` with no audit-log write or UI warning.
- [ ] **Graduation multi-session guard** — A student can be graduated under multiple sessions. The `patch` overwrites prior `graduationDate`. Consider rejecting when any graduation row exists.
- [ ] **Unbounded `.collect()` in matrix builder** — `getClassStudentSubjectMatrix` runs 4-5 unbounded `.collect()` calls. Paginate or denormalize for scale.
- [ ] **`toggleInvoiceOptionalLineItem` installment schedule** — Changing the total does not regenerate the installment schedule. Per-installment `amount` becomes stale.
- [ ] **`getBillingDashboard` filter tautology** — `if (!event.invoiceId)` then checks `visibleInvoiceIds.has(String(event.invoiceId ?? ""))` — always false. Webhook-test events are dropped.

### AI Migration Completeness
- [ ] **3 missing AI actions** — Spec asks for `student_note`, `assignment`, `cbt_draft` actions. Only `lessonPlan` and `assessment` exist. UI selectors still expose all 5 types.
- [ ] **AI SDK version** — `ai@^6.0.168` is pinned; current is `ai@7.x`. Upgrade or document reason for v6 pin.
- [ ] **`consumeTeacherLessonPlanGenerationLimit` retry semantics** — Not idempotent under Convex's automatic 3× action retries. A flaky network can lock a teacher out for the full rate-limit window.

### UX Polish
- [ ] **`SchoolSettingsPage.handleRemoveLogo`** uses native `confirm()` — inconsistent with the rest of the app. Use `ConfirmationModal`.
- [ ] **`SchoolSuspendedLockScreen`** shows hard-coded phone `+234 (800) 6356-724`. Wire to runtime config or remove.
- [ ] **Hard-coded "Convex Dev — 100% Online"** copy in platform admin page. Remove dev leftover.
- [ ] **`ResetSchoolAdminPasswordModal`** retains `newPassword` state after close. Clear on `onClose`.
- [ ] **Dashboard "Upcoming Events"** shows past events — `listEvents` has no `fromTimestamp` filter.
- [ ] **Dashboard `totalEnrolledStudents`** double-counts cross-listed students. Use `students` table count.

### Scope Creep (land separately)
- [ ] Navigation chrome (3 nav variants + preference switcher, WorkspaceNavbar +841 lines) — not in spec Done list. Land in a separate branch.
- [ ] Future-spec docs (`StudentLifecycleAndEnrollmentHistory.md`, `EduClearanceTransferNetwork.md`, `KiddyTrackerAndGateOperations.md`, `ParentWhatsAppAndTransactionalComms.md`) added under `de88dbe`. Move to follow-up.
