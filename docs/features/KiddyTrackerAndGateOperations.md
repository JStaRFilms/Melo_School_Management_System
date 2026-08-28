# Kiddy Tracker & Gate Operations Specification

**Status:** Ready for Implementation / Backlog  
**Module:** Daily Operations & Child Safety  
**Surface:** Standalone Gate Kiosk (`apps/kiosk` or `/gate-kiosk`) & Admin Dashboard Hub  

## Problem Statement

Schools struggle with slow, chaotic, and unverified student arrivals and departures at the school gate. Parents worry about whether their young children arrived safely at school or were picked up by unauthorized individuals. Paper sign-in sheets at the reception or gate are slow, error-prone, unsearchable, and do not notify parents in real time.

## Solution

A high-speed, cost-effective physical gate tracking module ("Kiddy Tracker") that enables gate staff or front-desk receptionists to scan student QR badges (printed on existing student ID cards or lanyards) in under 200ms using any smartphone camera or cheap USB/Bluetooth barcode scanner. 

Upon scanning:
1. **Arrival (Morning):** Instantly registers the timestamp, displays student confirmation, and triggers a background WhatsApp/SMS arrival notification to parents.
2. **Departure (Afternoon):** Instantly registers departure, displays authorized guardian pickup photos to prevent child abduction/unauthorized handoffs, and sends departure alerts.
3. **Emergency / Manual Lookup:** Allows security guards or admins to search by student name or roll number if the badge was forgotten.

---

## User Stories

1. As a gate security officer, I want to scan a student's lanyard QR code in under a second on my smartphone or front-desk scanner, so that entry lines move fast in the morning.
2. As a gate security officer, I want the screen to display the student's name, photo, and class upon scanning, so that I can visually verify they are using their own badge.
3. As a parent, I want to receive an immediate WhatsApp notification when my child passes through the school gate in the morning, so that I have peace of mind that they arrived safely.
4. As a gate security officer during afternoon dismissal, I want to see the authorized guardian/driver photos on the screen when scanning the student out, so that I do not release a young child to an unauthorized stranger.
5. As a school administrator, I want to see a live real-time stream of today's attendance and gate scans on my dashboard, so that I know exactly how many students are currently on campus.
6. As a parent, I want to receive a notification when my child is checked out of the premises, including the timestamp and pickup guardian identifier.
7. As a front-desk receptionist, I want to perform a quick manual search by name or admission number when a student loses or forgets their physical badge, so that their attendance can still be logged accurately.
8. As a school proprietor, I want gate tracking to work reliably even with low hardware costs (zero specialized biometric terminals required), so that technology overhead remains minimal.

---

## Implementation Decisions

### 1. Hardware & Scanner Strategy
* **Low-Cost QR Badges:** QR codes encode a signed/hashed student identifier (`melo:gate:{schoolSlug}:{studentId}:{checksum}`). Badges can be printed on existing student ID cards, plastic cards, or cardstock lanyards.
* **Dual Operating Surface:**
  - **Mobile Browser Mode:** Uses `html5-qrcode` / browser camera API on any budget Android phone or tablet at the gate.
  - **Hardware Scanner Mode:** Listens to raw `keydown` events from standard 2D USB/Bluetooth barcode scanners plugged into a reception laptop.

### 2. Convex Data Schema
```typescript
// packages/convex/schema.ts
gateScans: defineTable({
  schoolId: v.id("schools"),
  studentId: v.id("students"),
  academicSessionId: v.id("academicSessions"),
  type: v.union(v.literal("check_in"), v.literal("check_out")),
  scannedAt: v.number(),
  scannedByUserId: v.id("users"),
  scannerLocation: v.optional(v.string()), // e.g. "Main Gate", "Reception"
  method: v.union(v.literal("qr_scan"), v.literal("manual_override"), v.literal("nfc_rfid")),
  guardianVerifiedId: v.optional(v.id("families")),
  notes: v.optional(v.string()),
})
  .index("by_school_and_date", ["schoolId", "scannedAt"])
  .index("by_student_and_date", ["studentId", "scannedAt"]),
```

### 3. Verification & Anti-Fraud UI
* When scanning a student during departure hours, the Kiosk UI displays:
  - Student Photo, Name, and Form Class.
  - Authorized Pickup Contacts (Father, Mother, Registered Driver/Nanny) with headshots and phone numbers.
  - 1-tap "Authorize Release" button.

### 4. Background Notification Trigger
* Scans create a durable event in `admissionsCommunicationOutbox` or dedicated `notificationOutbox`.
* The background job immediately dispatches a Meta WhatsApp Cloud API utility template or SMS.

---

## Testing Decisions

* **Scan Ingestion Performance:** Unit test Convex mutation latency when handling bursts of 50 scans per minute.
* **Idempotency & Double-Scan Prevention:** Verify that scanning the same badge twice within 30 seconds does not generate duplicate check-in events or spam parent phones.
* **Offline / Flaky Network Handling:** Test client-side queueing on the kiosk frontend when gate Wi-Fi/4G drops intermittently.

---

## Out of Scope

* Biometric fingerprint or facial recognition hardware integrations in Phase 1 (focus is cheap QR and barcode hardware).
* Automated turnstile/electric gate motor control relays.
