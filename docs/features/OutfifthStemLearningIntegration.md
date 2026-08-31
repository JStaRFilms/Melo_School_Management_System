# Outfifth STEM & Digital Skills Partner Integration Specification

**Status:** Proposal / Partner Alignment  
**Module:** Third-Party Learning Integration & Federated Student Access  
**Surface:** Melo Student/Parent Portal, Melo Admin Add-on Manager, Outfifth Web & Desktop App  
**Target Partner:** Outfifth Education (`edu.outfifth.com`)

---

## 1. Executive Summary & Problem Statement

Schools struggle to deliver modern digital skills (Programming, 3D Modeling, Data Analysis, Digital Design, AI) due to a lack of specialized in-house tools. While Outfifth Education provides specialized curriculum and interactive learning environments, schools face friction when managing disjointed software platforms:
1. **Access Code Chaos:** Teachers have to manually generate, distribute, and track individual paper access codes for students.
2. **Disconnected Gradebooks:** Student progress and grades achieved in external STEM labs are isolated from the school's official report cards.
3. **Double Billing & Administrative Overhead:** School administrators resist managing separate procurement, invoices, and logins for independent learning tools.

---

## 2. Solution: The Connected Learning Ecosystem

Melo acts as the **School Operating System (IdP & SIS)**, and Outfifth functions as the **Specialized STEM Lab**. 

Rather than bloating the Melo monorepo with third-party learning engines, Melo and Outfifth connect through a **lightweight, headless API and webhook handshake**:
* **Automated Code Provisioning:** Melo provisions and stores unique student access codes automatically upon enrollment.
* **1-Click Frictionless Launch:** Students launch Outfifth directly from their Melo portal with pre-authenticated access (via URL parameter or desktop deep-link).
* **Unified Report Card Sync:** Outfifth pushes module completion and grades back to Melo so STEM skills appear on the official end-of-term report card.
* **Co-Branded Commercial Packaging:** Bundled pricing model (e.g., ₦5,000 per student) with automated revenue splits.

---

## 3. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             MELO SCHOOL OS                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Admin Portal: Enable Outfifth & Auto-Provision Licenses           │  │
│  │ Student/Parent Portal: "Launch STEM Lab" Tile + Embedded Grades   │  │
│  │ Report Card Engine: Includes Outfifth Skill Evaluation            │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    │ Convex Backend                     │
└────────────────────────────────────┼────────────────────────────────────┘
             1. Provision Roster     │
             POST /schools/provision │ 2. One-Click Launch
             (Receives Access Codes) │    ?code=XYZ / outfifth://auth?code=XYZ
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           OUTFIFTH EDUCATION                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Web Application (`edu.outfifth.com`) & Desktop App Runtime         │  │
│  │ Student Coding / 3D / AI Lab Environment                          │  │
│  │ Assessment Engine & Grade Calculation                             │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    │ 3. Webhook Grade Sync              │
│                                    │    POST /api/v1/integrations/grades│
└────────────────────────────────────┴────────────────────────────────────┘
```

---

## 4. Technical Specifications

### A. Dynamic Access Code Provisioning (Melo ➔ Outfifth)
When a school administrator activates Outfifth or enrolls a new student cohort in Melo Admin:
1. Melo calls Outfifth’s licensing API:
   ```http
   POST https://api.outfifth.com/v1/schools/provision
   Authorization: Bearer <OUT_FIFTH_API_KEY>
   Content-Type: application/json

   {
     "schoolId": "melo_sch_98234",
     "schoolName": "Future Pass Secondary School",
     "students": [
       { "meloStudentId": "std_101", "name": "Kemi Ade", "gradeLevel": "SS2" },
       { "meloStudentId": "std_102", "name": "Chidi Eze", "gradeLevel": "SS2" }
     ]
   }
   ```
2. Outfifth returns generated access codes:
   ```json
   {
     "success": true,
     "allocations": [
       { "meloStudentId": "std_101", "accessCode": "OF-8921-KEM" },
       { "meloStudentId": "std_102", "accessCode": "OF-8922-CHI" }
     ]
   }
   ```
3. Melo saves `accessCode` to the student's record in Convex.

---

### B. Frictionless 1-Click Launch (Student Portal ➔ Outfifth)
Students do not need to memorize or type access codes manually.
* **Web Launch:** Clicking **"Launch Outfifth"** navigates to:  
  `https://edu.outfifth.com/signin?code=OF-8921-KEM`  
  *(Outfifth's web client reads the `code` query parameter and automatically authenticates the student).*
* **Desktop App Launch:** Melo triggers a desktop deep link:  
  `outfifth://auth?code=OF-8921-KEM`

---

### C. Grade & Progress Webhook Sync (Outfifth ➔ Melo)
When a student completes a module, lab assignment, or term assessment on Outfifth:
1. Outfifth sends a webhook event to Melo:
   ```http
   POST https://<melo-deployment>.convex.site/api/v1/integrations/outfifth/grades
   Authorization: Bearer <MELO_WEBHOOK_SECRET>
   Content-Type: application/json

   {
     "schoolId": "melo_sch_98234",
     "meloStudentId": "std_101",
     "courseTitle": "Introductory Python & Logic",
     "moduleTitle": "Functions and Data Structures",
     "progressPercentage": 100,
     "score": 92.5,
     "maxScore": 100,
     "term": "First Term 2026/2027",
     "completedAt": 1788219400000
   }
   ```
2. Melo records this in `studentPartnerGrades` and attaches it to the student's unified academic profile.

---

## 5. Convex Database Schema Additions

Additions to `packages/convex/schema.ts`:

```ts
// 1. Partner Configuration per School
partnerIntegrations: defineTable({
  schoolId: v.id("schools"),
  partner: v.literal("outfifth"),
  enabled: v.boolean(),
  apiKey: v.optional(v.string()),
  licensedStudentCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_schoolId_partner", ["schoolId", "partner"]),

// 2. Student Access Code Mapping
studentPartnerAccess: defineTable({
  schoolId: v.id("schools"),
  studentId: v.id("students"),
  partner: v.literal("outfifth"),
  accessCode: v.string(),
  lastLaunchedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_studentId_partner", ["studentId", "partner"])
  .index("by_schoolId_accessCode", ["schoolId", "accessCode"]),

// 3. Synced STEM Assessment Records
studentPartnerGrades: defineTable({
  schoolId: v.id("schools"),
  studentId: v.id("students"),
  partner: v.literal("outfifth"),
  courseTitle: v.string(),
  moduleTitle: v.optional(v.string()),
  progressPercentage: v.number(),
  score: v.number(),
  maxScore: v.number(),
  termId: v.optional(v.id("academicTerms")),
  syncedAt: v.number(),
})
  .index("by_student_term", ["studentId", "termId"])
  .index("by_schoolId", ["schoolId"]),
```

---

## 6. Commercial & Revenue Model

* **Target Price per Student:** ₦5,000 / term (or per academic year depending on agreement).
* **Revenue Allocation Models:**
  1. **Outfifth-Sourced Schools (Outfifth sales team onboards the school):**
     * ₦4,000 ➔ Outfifth (Content, Desktop app, Curriculum).
     * ₦1,000 ➔ Melo (Back-office OS, Student records, Portal access).
  2. **Melo-Sourced Schools (Melo sells Outfifth as an optional STEM add-on):**
     * Melo bills the school via Paystack invoice.
     * Automated wholesale revenue split remitted to Outfifth’s bank account.
* **Onboarding Activation for Outfifth-Direct Schools:**
  * When Outfifth onboards a school, Outfifth generates an activation invite:
    `https://meloschool.com/activate?partner=outfifth&licenseKey=...`
  * The school completes onboarding on Melo with the Outfifth integration pre-activated.

---

## 7. Meeting Alignment Checklist (For 10:00 PM Meeting)

- [ ] **Architecture Approval:** Confirm headless integration (API + Webhooks) rather than code porting.
- [ ] **Access Code Auto-Login:** Confirm Outfifth team will support `https://edu.outfifth.com/signin?code=XYZ` and desktop deep link `outfifth://auth?code=XYZ`.
- [ ] **API Endpoint Delivery:** Agree on timeline for Outfifth’s `POST /schools/provision` endpoint.
- [ ] **Gradebook Sync Scope:** Confirm Outfifth will emit grade webhooks after student assessments.
- [ ] **Billing Settlement:** Agree on Paystack split-payment configuration and payout schedules.
- [ ] **Support SLA:** Melo handles core portal/login queries; Outfifth handles STEM content/course queries.

---

## 8. Out of Scope

* Importing Outfifth’s proprietary code-editor / interactive learning canvas into Melo’s frontend repository.
* Melo hosting or rendering heavy 3D rendering / video streaming infrastructure.
* Manual redistribution of paper access codes.
