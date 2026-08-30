# EduClearance Inter-School Transfer Network & Interop Specification

**Status:** Ready for Implementation / Backlog  
**Module:** Cross-School Verification, Debt Recovery & Transfer Clearances  
**Surface:** Standalone Application (`apps/educlearance` on `educlearance.meloschool.com`) + Embedded Melo Admin Interop  

## Problem Statement

When students transfer between private schools, receiving schools frequently inherit students with massive unpaid tuition arrears, undisclosed disciplinary suspensions, or falsified report cards from their previous schools. Simultaneously, former schools have zero leverage to recover unpaid school fees once a child moves. Existing clearance processes rely on easily forged paper letters or informal phone calls.

## Solution

EduClearance is an inter-school student transfer verification network. It operates as:
1. **A Standalone Product (`apps/educlearance` at `educlearance.meloschool.com`):** Any external school can register, search transfer applicants, initiate a clearance check, log issues, manage disputes, and top up their Paystack wallet.
2. **A Native Superpower for Melo School OS Users:** Full Melo subscribers receive automatic data synchronization—when enrolling a transfer student, 1 click verifies clearance against the national network; when a student leaves with unpaid fees, Melo OS automatically flags a clearance hold without manual duplicate entry.

---

## User Stories

1. As an admissions officer at School B, I want to search an incoming transfer student by name, date of birth, and previous school name, so that I can verify if they left their previous school in good financial and disciplinary standing.
2. As an admissions officer, I want to initiate a formal clearance request (costing a small wallet fee or bundled credit) that pings School A for verification.
3. As a bursar at School A, I want to receive clearance requests for former students and quickly confirm "Clear" or flag "Outstanding Balance: ₦180,000", attaching an invoice as evidence.
4. As a school bursar, I want to upload debt/disciplinary evidence into an encrypted case timeline so that disputes can be resolved transparently.
5. As a school administrator using Melo OS, I want to click "Check EduClearance" directly on the student onboarding form, so that I don't have to switch apps or re-type student details.
6. As a school administrator using Melo OS, when I mark a student as "Transferred Out" or "Withdrawn" with unpaid invoices, I want Melo OS to prompt me to place a clearance hold on EduClearance automatically.
7. As an external school not using Melo OS, I want to use EduClearance standalone, fund my wallet via Paystack, and handle transfer disputes independently.

---

## Implementation Decisions

### 1. Monorepo Architecture & Database Migration
* Port the Drizzle/Postgres tables from `2026-06-11_EduClearance` into the unified Convex backend in `packages/convex/schema.ts`:
  - `clearanceRequests` (requestingSchoolId, targetSchoolId, studentProfile, status: `pending` | `cleared` | `disputed` | `held`, feeAmountKobo)
  - `clearanceTimelineMessages` (caseId, senderSchoolId, message, attachmentStorageId, isOfficialNote)
  - `clearanceDisputes` (caseId, reason, resolvedAt, resolverAdminId)
  - `schoolWallets` & `walletTransactions` (balanceKobo, paystackReference, type: `topup` | `search_debit` | `fee_recovery_credit`)
  - `schoolClaims` (external unverified school claiming profile)

### 2. Standalone Frontend (`apps/educlearance`)
* Deployed as a dedicated Next.js app in the monorepo served at `educlearance.meloschool.com`.
* Utilizes the existing custom workflow components (`CaseTimelinePanel`, `ClearanceRequestForm`, `DisputeModal`, `WalletTopUpPanel`).
* Powered by `@school/auth` and `ConvexClientProvider`.

### 3. Melo Admin Embedded Interop
* **In Student Onboarding (`apps/admin/app/academic/students/onboarding`):**
  - Add an inline "EduClearance Verification" badge beside the "Previous School" input.
  - Returns instant status: `Verified Clear`, `Pending Response`, or `Active Financial Hold (₦X overdue)`.
* **In Student Withdrawal Flow:**
  - When marking a student as withdrawn with active invoice balances in `billing`, automatically suggest issuing an EduClearance hold.

---

## Testing Decisions

* **Tenant Isolation:** Ensure School A cannot read internal notes or student records of School B unless an active, authorized clearance request links them.
* **Wallet Transaction Atomicity:** Verify that initiating a clearance check atomically debits the school's wallet and creates the audit row without race conditions.
* **Melo Integration Seam:** Test that querying EduClearance status from `apps/admin` executes through authenticated Convex queries with zero external HTTP latency.

---

## Out of Scope

* Public consumer/parent-facing search portal (the network is strictly restricted to verified school administrators).
* Direct automated banking debt collection (EduClearance acts as a verified information and escrow settlement network).
