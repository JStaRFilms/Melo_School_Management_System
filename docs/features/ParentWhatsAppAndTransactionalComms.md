# Parent WhatsApp & Transactional Communications Engine

**Status:** Ready for Implementation / Backlog  
**Module:** Multi-Channel Parent Comms & Notifications  
**Surface:** Admin Comms Outbox, Background Workers, Meta WhatsApp Cloud API  

## Problem Statement

Schools struggle to communicate urgent, critical information to parents. Traditional SMS in Nigeria/West Africa is increasingly expensive, prone to carrier delivery drops, and cannot send rich media or PDF links. Email open rates among parents are notoriously low. However, parents check WhatsApp multiple times a day. Managing unofficial WhatsApp groups leads to privacy leaks, chaotic spam, and security risks.

## Solution

An automated, cost-effective transactional communication engine that delivers high-priority institutional alerts, invoices, gate arrival notifications, and printable report card links directly to parents on WhatsApp, backed by SMS and in-app fallback.

---

## User Stories

1. As a parent, I want to receive my child's term fee invoice directly as an interactive WhatsApp message with a 1-tap Paystack payment link, so that I can pay instantly without logging into a portal.
2. As a parent, I want to receive an instant WhatsApp notification when my child arrives at or departs from the school gate (Kiddy Tracker), with the exact time and date.
3. As a parent, I want to receive my child's end-of-term report card summary on WhatsApp alongside a secure download link for the PDF, so that I don't miss academic updates.
4. As a school bursar, I want to send payment receipt confirmations automatically over WhatsApp the moment an online fee transaction succeeds.
5. As a school administrator, I want to broadcast urgent school announcements (e.g. unexpected public holiday, emergency closure) to all parents filtered by class or whole school.
6. As a school administrator, I want to view a real-time outbox log showing message delivery status (Sent, Delivered, Read, Failed) with zero manual message drafting.

---

## Implementation Decisions

### 1. Cost & Delivery Architecture
* **Meta WhatsApp Cloud API (Primary):**
  - High reliability, verified institutional sender profile, zero phone-disconnection risk.
  - Utilizes pre-approved Meta Utility Templates (eligible for free monthly tier and minimal per-message utility costs).
* **Scheduled Background Outbox:**
  - All outbound messages are queued into an immutable `admissionsCommunicationOutbox` or `notificationOutbox` table.
  - Convex scheduled actions (`ctx.scheduler.runAfter`) process the queue with exponential backoff and retry.
* **Smart Anti-Spam Debouncing:**
  - Rapid sequential changes to student records or schedules are coalesced into a single digest message within a 5-minute window rather than spamming parents with multiple pings.

### 2. Message Templates
* `GATE_ARRIVAL_NOTIFICATION`: *"Good morning [Parent Name], [Student Name] has arrived at school at [Time] on [Date]."*
* `GATE_DEPARTURE_NOTIFICATION`: *"Hello [Parent Name], [Student Name] has departed from school at [Time]. Picked up by: [Guardian Name]."*
* `INVOICE_ISSUED`: *"Dear [Parent Name], your invoice for [Session] [Term] (₦[Amount]) is ready. Tap here to view and pay: [Link]"*
* `PAYMENT_RECEIPT`: *"Payment confirmed! ₦[Amount] received for [Student Name] ([Invoice Ref])."*

---

## Testing Decisions

* **Webhook & Delivery Status Sync:** Verify that incoming Meta delivery webhooks update message state (`sent` $\to$ `delivered` $\to$ `read`) in Convex.
* **Payload Truncation & Privacy:** Ensure phone numbers are normalized to E.164 format and no unauthorized student medical or grade records are leaked in plaintext.

---

## Out of Scope

* Open two-way conversational AI chat / support bots on WhatsApp in Phase 1 (focus is reliable 1-way transactional & broadcast notifications).
