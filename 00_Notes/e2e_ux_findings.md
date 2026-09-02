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
- [x] **Rich Promotion Confirmation Modal (`PromotionConfirmationModal.tsx`)**
  - Replaced native browser `window.confirm(...)` dialogue with a custom, branded confirmation modal.
  - Displays transfer routing badge (From: Class/Session &rarr; To: Class/Session), subject enrollment mode explanation, and amber overwrite warning banner for students already staged.
  - Added safety reassurance badge and loading spinner during promotion execution.
  - Replaced `window.confirm` with portaled `ConfirmationModal` across student cancel promotion, student archiving, family unlinking, and class aggregation removals.
- [x] **Student Identity Roster Matrix & Promotion Badge Redesign (`SubjectSelectionDesktopTable.tsx`, `SubjectSelectionMobileEditor.tsx`)**
  - Expanded sticky Student Identity column from cramped 240px to 340px, eliminating name truncation and overflow.
  - Relocated "All" and "Clear" subject selection controls into compact top-right inline action pills.
  - Replaced tall 4-line wrapping promotion block with a sleek, single-line emerald badge (`Promoted → Primary 5 (26/27)`) with an integrated `(X)` cancel action button.
  - Reduced row vertical height by ~50%, improving data density and visual balance.

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
- [x] **Class Section / Academic Level (Nursery, Primary, Secondary) Modifiability (`ClassEditForm.tsx`, `page.tsx`)**
  - Added Section / Academic Level selector in the Class Edit blueprint drawer (`/academic/classes`), allowing administrators to correct class level assignments directly without needing to recreate the class.
  - Linked `level` updates through the existing Convex `updateClass` mutation with full cache revalidation.
- [x] **Natural Alphanumeric & Alphabetical Class Sorting across Backend & Frontend**
  - Updated `listClasses`, `getAllClasses`, `getTeacherAssignableClasses`, and class roster views to sort by resolved class display name using natural numeric collation (`{ numeric: true, sensitivity: "base" }`) so classes always list in logical order (e.g. *Grade 1, Grade 2... Grade 10, Grade 11*, *JSS 1... JSS 3*, *Primary 1... Primary 6*) regardless of creation order.
- [x] **Student Roster Visibility for Classes with Zero Subjects Configured (`SubjectSelectionMatrix.tsx`, `SubjectSelectionDesktopTable.tsx`, `SubjectSelectionMobileEditor.tsx`)**
  - Previously, if a class had students enrolled but 0 subjects configured in the curriculum, the entire student roster table was replaced by a single empty-state banner, causing newly admitted students to disappear from view.
  - Now, enrolled students are always visible in both desktop and mobile roster views with full names, avatars, admission numbers, and quick profile actions, accompanied by a direct action link to configure class subjects.
- [x] **Global Phone & Email Input Sanitation and Strict Validation (`@school/shared`, `studentEnrollment.ts`, Form Fields)**
  - Built `cleanPhoneInput`, `isValidPhoneNumber`, `cleanEmailInput`, and `isValidEmailAddress` in `@school/shared`.
  - Added real-time character filtering on all phone input fields (`type="tel"`, `inputMode="tel"`) across the application, preventing letters, `@`, or email domains from ever being typed or pasted into phone fields.
  - Added strict backend validation in Convex mutations (`normalizeOptionalPhone`), rejecting invalid strings or email payloads with clear error messages.
- [x] **Stateful URL Query Synchronization & Deep Linking on `/academic/students` (`apps/admin/app/academic/students/page.tsx`)**
  - Integrated `useSearchParams` and shallow URL history replacement so that selecting a Class (`?classId=...`), Academic Session (`?sessionId=...`), Student Record (`?studentId=...`), or Sheet Tab (`?tab=...`) automatically updates the browser URL.
  - Refreshing the browser or sharing/bookmarking the URL preserves the exact class context, active session, and currently inspected student drawer without resetting to defaults.

### 5. Academic Sessions, Dynamic Term Partitioning & Modal Overlay Polish
- [x] **Full-Screen Modal Backdrop Portals & Viewport Scroll Locking**
  - Portaled modal dialogs to `document.body` with `z-[9999]`, SSR mount guards, and `document.body` scroll locking.
  - Fixes backdrop darkening and blur being trapped in `<main>`, now spanning the full 100vw x 100vh viewport over sticky navbar and desktop sidebar.
  - Applied across `SessionCreationModal`, `TermCreationModal`, `ConfirmationModal`, `AdminSheet`, `ConfirmDialog`, `MobileSheet`, `PrintableFinanceModal`, and `CurriculumApprovalDialog`.
- [x] **Dynamic Academic Session Term Partitioning & Bounded Calendar Generation**
  - Eliminated hardcoded calendar dates (which previously caused validation errors when session start/end dates were customized).
  - Built `calculateDynamicTermSchedule` and `suggestTermDateRange` in `@school/shared` to automatically partition any session into 3 balanced terms separated by realistic 2-3 week holiday breaks.
  - Added atomic `autoGenerateTerms` directly to `createSession` backend mutation in `academicSetup.ts`, eliminating sequential client-side network roundtrips and ensuring all 3 terms are created transactionally.
  - Enhanced `TermCreationModal` to prepopulate smart start/end dates based on session boundaries and term sequence presets.
- [x] **Session Date Modification & Dynamic Term Recalibration (`updateSession` in `academicSetup.ts`)**
  - Resolved session start/end date editing constraints so extending or modifying an academic session dynamically checks and recalibrates child term dates.
- [x] **Student Graduation Workflow & Official Attestation Letter (`studentGraduation.ts`, `GraduationConfirmationModal.tsx`, `AttestationLetterModal.tsx`)**
  - Added atomic `graduateStudents` backend mutation marking student statuses as `"graduated"` with graduation session metadata and exit timestamps.
  - Built `GraduationConfirmationModal` allowing batch graduation of terminal classes (e.g. SS 3, Primary 6).
  - Built `AttestationLetterModal` providing official institutional letters of completion/attestation with school letterhead, student biographical details, attendance dates, and print styles.
- [x] **Promotion Roster Isolation Per Academic Session (`SubjectSelectionMatrix.tsx`, `page.tsx`)**
  - Ensured students promoted to an upcoming session remain isolated in the future session's roster without polluting active class lists for the ongoing term.

### 6. Billing Ledger & Fee Plan Currency UX
- [x] **Currency Amount Input Truncation & Zero Clipping Fix (`FeePlanForm.tsx`, `BillingSidebar.tsx`)**
  - Expanded line item amount input width from cramped 112px (`w-28`) to 160px (`w-40`), ensuring 5-7 digit values and trailing zeros never overflow or get clipped.
  - Disabled native browser WebKit spin buttons (`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none`) which previously crowded and occluded the right-aligned digits.
  - Added smart number typing normalization preventing awkward leading zeros (e.g. `068000`).
  - Added real-time live total calculation card (`Total Plan Value: ₦XX,XXX.XX`) dynamically reflecting line item additions and modifications.
  - Enhanced Financial Arsenal desktop navigation with clear active state badges and highlight rings.
- [x] **Fee Plan Creation Argument Validation & Optional Line Item Toggles (`FeePlanForm.tsx`, `billing.ts`, `schema.ts`)**
  - Fixed runtime `ArgumentValidationError` where extra `order` property and root `installmentEnabled` were submitted instead of nested `installmentPolicy`.
  - Added `isOptional` field to `feePlans.lineItems` and `isOptional` + `isSelected` to `studentInvoices.lineItems`.
  - Allowed line items in `FeePlanForm.tsx` to be toggled as **`✨ Optional Add-on (Payer Can Toggle)`** vs **`🔒 Mandatory Fee`**, letting parents choose non-compulsory fees (e.g. screen uniforms, bus services).
  - Updated `computeBillingSubtotal` and `computeBillingInvoiceTotal` to compute subtotal from mandatory items plus selected optional items.
  - Added `toggleInvoiceOptionalLineItem` mutation allowing payers and admins to opt in/out of optional items before invoice settlement.
  - Added multi-class target bundling with quick group presets (`+ All Junior`, `+ All Senior`, `+ All Primary`) and universal template modes.
- [x] **Fee Plan Form Pinning & Background Leakage Prevention (`FeePlanForm.tsx`, `BillingSidebar.tsx`)**
  - Divided fee plan drawer into a scrollable input container and a solid pinned non-scrolling footer.
  - Anchored both the Real-Time Breakdown Card and the "Create Fee Plan" CTA in the solid footer, preventing form fields from sliding underneath the button.
- [x] **Fee Plan "Details" Modal Inspector (`FeePlanList.tsx`, `page.tsx`)**
  - Implemented interactive modal when clicking "Details" on fee plan cards.
  - Displays target class badges, installment policy rules, categorized itemized line items, and a one-click **"Bulk Invoice with this Plan"** trigger.
- [x] **Manual Payment Receipt Reference Generator (`BillingSidebar.tsx`)**
  - Added an **"⚡ Auto-Generate"** helper button generating formatted identifiers (`REC-YYMMDD-XXXXX`) for cash payments or when no bank teller/session ID is provided.
- [x] **Executive Institutional Invoice & Statement of Account Redesign (`PrintableFinanceModal.tsx`)**
  - Restyled both modals into formal institutional bursary documents with school letterheads.
  - Added structured 4-column student metadata, high-contrast KPI cards (Total Billed, Paid to Date, Balance Due), itemized fee table with opt-out strike-through styling, and a **Running Balance** ledger column for Statements of Account.
  - Retained embedded Paystack QR code and 1-click checkout link generation.

### 7. Document Extraction & OCR Pipeline Overhaul (Luna Migration & Image PDF Reliability)
- [x] **Eliminated Low-Density PDF False Failure Trap (`lessonKnowledgePdfExtraction.ts`)**
  - Fixed false-rejection bug where documents with sparse native text (< 20 words / diagrams / worksheet titles) were immediately aborted with `status: "failed"` under `insufficient_text`.
  - Routed low-density native extractions directly to `status: "ocr_needed"` (`fallbackReason: "scanned_or_problematic"`), enabling provider OCR to process scanned, illustrated, or image-heavy school files.
- [x] **OpenRouter Model Migration to `openai/gpt-5.6-luna` (`lessonKnowledgeOcrActions.ts`)**
  - Replaced brittle `google/gemma-4-31b-it:free` default with high-performance, cost-effective `openai/gpt-5.6-luna` ($0.20/1M input, $1.20/1M output).
  - Increased OCR timeout from 60s to 120s (`120_000`ms) to support multi-page extractions reliably.
  - Implemented high-fidelity educational layout system prompt enforcing Markdown tables (`| Col 1 | Col 2 |`), visual bracketed captions (`[Diagram: ...]`), LaTeX formulas, and pure JSON output.
- [x] **Dead Browser-OCR Code Deletion**
  - Deleted legacy client-side canvas renderer `apps/teacher/features/planning-library/utils/browserPdfOcr.ts`.
  - Deleted dead backend action `packages/convex/functions/academic/lessonKnowledgeBrowserOcrActions.ts` and pruned `requestKnowledgeMaterialBrowserOcrImageUploadUrls` and `startKnowledgeMaterialBrowserOcrRetryInternal` from `lessonKnowledgeIngestion.ts`.

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

### 7. Academic Timeline & Dynamic Term Scheduling
- [ ] **Session & Term Creation (`/academic/sessions`):**
  - Create a new academic session with arbitrary custom start/end dates (e.g. October 1 to June 30) with auto-create terms enabled: verify that 3 non-overlapping terms are created atomically without throwing date range bounds errors.
  - Adding a manual term to an existing session: verify that start/end date inputs are automatically prepopulated with recommended dates corresponding to the selected term preset.

---

## 🚀 Roadmap & Backlog

### High Priority / Next Up
- [ ] **Granular Admin Role-Based Access Control (RBAC) & Scoped Staff Permissions**
  - **Context & Need:** Currently, all school administrator accounts receive full universal access across the entire admin workspace. Schools need to designate departmental staff roles (e.g., Bursar/Accountant, Academic Director/Dean of Studies, Registrar/Admissions Officer, Exam Officer) who should only view and manage modules relevant to their job functions rather than giving all admins access to everything.
  - **Proposed Role Scopes & Capability Matrix:**
    - **Finance & Bursary (`bursar`):** Access restricted strictly to Billing, Invoices, Fee Plans, Statements of Account, Payment Receipts, and Bank Settings. Cannot view/edit exam configurations, student grades, or teacher assignments.
    - **Academic Affairs (`academic_dean` / `exam_officer`):** Access to Sessions & Terms, Class Blueprints, Subject Catalogs, Exam Setup, Grading Bands, and Report Card generation. Restricted from billing ledgers, revenue analytics, and school banking settings.
    - **Admissions & Student Affairs (`registrar`):** Access to Student Roster, Admissions, Enrollment Onboarding, and Attestation letters. Restricted from fee configuration and grading band policies.
    - **School Super Admin / Proprietor (`super_admin`):** Full, unrestricted administrative privileges across all institutional modules, staff permissions, and workspace settings.
  - **Implementation Strategy:**
    - Add `adminRole` or `permissions: string[]` field on admin users / memberships.
    - Add layout-level and route-level authorization guards on sidebar navigation items and page endpoints.
    - Enforce backend mutation/query assertion helpers (`assertSchoolAdminPermission(ctx, "finance" | "academics" | "admissions")`).
- [ ] **School Bank Account Details for Invoices & Statements (Billing Settings / Defect Later)**
  - Add configurable school bank account profile fields (Account Name, Bank Name, Account Number/IBAN, Sort Code/Branch) in Billing Settings (alongside the Paystack gateway configuration) or General Settings.
  - Automatically attach and render configured school bank account details on generated and printed student billing invoices and statements of account so parents remitting via direct bank transfer see verified school account numbers.
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
- [ ] **AI & Document Ingestion Usage Limits, Storage Quotas & Over-Usage Buffers**
  - **Context & Need:** Protect platform margins and prevent runaway costs from high-frequency generation, excessive OCR, and large file uploads. Schools on the Basic/Standard plan must have clear baseline quotas with a graceful buffer before hard caps kick in, plus an option to purchase top-up credits or upgrade tiers.
  - **Tier-1 Simple Metering (Phase 1 - Immediate & Clean):**
    - **Prompt / Message Quota:** Track AI generations per school per billing cycle (e.g. 500 lesson plan / quiz / assessment prompts per month on Basic).
    - **Graceful Buffer:** Allow a 10–20% soft buffer (e.g. +50 extra prompts) with warning banners in the UI (*"You have used 95% of your monthly AI quota. Add credits to avoid service interruption"*) rather than jarring sudden cutoffs mid-lesson planning.
    - **Pre-Upload PDF Page Counter & Smart Guidance Banner:**
      - The moment a teacher selects a PDF in the file picker, inspect the page count client-side before upload begins.
      - If the page count is high (> 20 pages), display an educational recommendation banner: *"This PDF contains [X] pages. We recommend using the 'Pages to Index' field below (e.g. `1-10, 25-30`) to focus on the specific chapter you need and conserve your monthly quota."*
    - **Document Ingestion & OCR Limits:**
      - File size cap: 15–25 MB per PDF upload.
      - Page count cap: Maximum pages processed per document (e.g., 20–30 pages per document on Basic) and monthly OCR page allowance (e.g., 150 OCR pages/month).
      - Storage Quota: Simple tenant-level disk allowance (e.g. 2 GB included on Basic).
  - **Tier-2 Advanced Token, Compute & Automated Document Batching (Phase 2):**
    - **Automated Multi-Batch Document Processing:**
      - For large textbooks or syllabi, offer a 1-click *"Auto-Split & Ingest in Batches"* workflow that splits the PDF into manageable chapters (e.g., Ch 1: 1–20, Ch 2: 21–40).
      - Display an explicit cost/quota confirmation modal before kickoff (*"Processing this 80-page document in 4 batches will consume 80 pages from your monthly quota. Remaining quota: 70 pages."*).
    - **Granular Token Metering:**
      - Transition to granular per-token tracking (`usage.total_tokens` from OpenRouter responses) recorded into a `schoolAiUsage` ledger.
      - Custom rate cards per tenant for high-volume enterprise chains with automatic credit-drawdown.
- [ ] **School Assets & PDF Compression Foundation** → see [docs/features/SchoolAssetsAndPdfCompression.md](../docs/features/SchoolAssetsAndPdfCompression.md)
  - Per-school private document store (`schoolAssets` table) for non-lesson-knowledge PDFs: policy docs, report templates, past papers, circulars, logos. Complements (does not replace) the existing lesson-knowledge storage in `LessonKnowledgeHub_v1.md` / `v2`.
  - Per-school 5 GiB quota, 25 MB per-file cap, MIME allowlist (`application/pdf`, `image/png`, `image/jpeg`).
  - Server-side pure-Node PDF compression in a Convex Node action using `pdf-lib` (metadata strip, font dedup, object-stream recompression). Replaces the stored copy only if savings exceed 10%. Idempotent + cron-retryable.
  - `SchoolAssetsPanel` admin UI with usage bar, kind filter, per-row delete. No public/parent downloads in v1.
  - Out of scope: Ghostscript / native binary compression, `sharp` image re-encoding (verify Convex Node runtime first), AV scanning, versioned assets.

### Architecture & Medium-Term Enhancements
- [ ] **Migrate All AI Generation from Vercel to Convex — Reliability & Offline Resilience**
  - **Goal:** Move every OpenRouter AI generation currently in Vercel (`apps/teacher/app/api/planning/lesson-plans/generate/route.ts`, `apps/teacher/app/api/ai/question-bank/generate/route.ts` via `packages/ai/src/models.ts`) to **Convex actions** (like `packages/convex/functions/academic/curriculumGeneration.ts` via `packages/ai/src/runtime.ts`).
  - **Why:** Vercel routes are tied to the HTTP request lifecycle — if the user closes the tab, network drops, or Vercel hits its timeout (10–300s), generation is aborted and tokens are wasted. Convex actions survive client disconnect, run up to ~10 min, retry automatically, and persist results directly to `ctx.db` for the client to pick up via `useQuery` on reconnect.
  - **Scope:** (1) Create Convex actions for `lesson_plan`, `student_note`, `assignment`, `question_bank_draft`, `cbt_draft` (use `openai/gpt-5.6-luna` for all). (2) Port `createDocumentModel`/`resolveDocumentModelId` + `OPENROUTER_HTTP_REFERER`/`X-Title` header handling from `models.ts:84-93` into `runtime.ts` (currently Convex ignores those headers). (3) Unify env to single `SCHOOL_AI_*` set in **Convex Dashboard** (`npx convex env set`) instead of split Vercel + Convex. (4) Replace teacher `fetch('/api/.../generate')` calls with `useAction` + reactive `useQuery` polling. (5) Keep streaming if needed via Convex action + `useQuery` incremental updates or accept non-streaming reliable completion.
  - **Acceptance:** All 6 models (`SCHOOL_AI_LESSON_PLAN_MODEL`, `SCHOOL_AI_STUDENT_NOTE_MODEL`, `SCHOOL_AI_ASSIGNMENT_MODEL`, `SCHOOL_AI_QUESTION_BANK_MODEL`, `SCHOOL_AI_CBT_MODEL`, `SCHOOL_AI_CURRICULUM_MODEL`) set to `openai/gpt-5.6-luna` in **one place (Convex)**; generation completes even if client disconnects mid-request; no `apps/teacher/app/api/**/generate` routes remain for AI.
- [ ] **Multi-Arm Class Architecture & Grade-Level Hierarchy (Supporting Multiple Arms per Grade)**
  - **Context & Need:** Many schools have multiple arms or streams per grade (e.g., *Grade 10 Cedar, Grade 10 Elm*, or *SS 1A, SS 1B, SS 1C*). Currently, the infrastructure models each arm as an individual distinct class record (`classes` table with `gradeName` + `classLabel`), which expects 1 class record per arm.
  - **Future Architecture & Scope:**
    - Model a first-class **Grade $\to$ Arms/Streams** hierarchy (e.g. `grades` representing the cohort level, and `classArms` or child `classes` representing individual classrooms/registers).
    - Allow shared grade-level defaults (curriculum subject catalogs, grading policies, fee plans, assessment profiles) to be configured once at the Grade tier and automatically inherited by all constituent arms.
    - Support cross-arm student rebalancing, joint subject timetable scheduling, grade-wide unified result ranking, and arm-specific vs grade-wide analytics.
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
- [ ] **`callGenerateObject` type safety** — The `schema: unknown` → cast indirection works but obscures types. Consider one helper per output type so each call site is statically typed, especially after AI SDK v7 upgrade.

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
