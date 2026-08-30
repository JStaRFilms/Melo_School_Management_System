# Student Lifecycle, Enrollment History & State Machine Specification

**Status:** Ready for Implementation / Backlog  
**Module:** Student Records & Historical Timelines  
**Surface:** Admin Student Profile, Admissions Conversion, Archive Workbench  

## Problem Statement

Students frequently change status during their academic career: they enroll, transfer out to another city, take leaves of absence, return years later, or graduate. Existing simple CRUD systems overwrite the student's current status or delete them, causing permanent data loss, corrupted historical report cards, broken billing audits, and inability to certify past attendance accurately.

## Solution

An immutable, event-sourced Student Lifecycle state machine and historical timeline table. Every transition in a student's institutional journey is recorded as an append-only event, strictly governed by allowable state transitions.

---

## State Transition Machine

```
                  ┌───────────────┐
                  │   ADMITTED    │
                  └───────┬───────┘
          ┌───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
    │ WITHDRAWN │   │ SUSPENDED │   │TRANSFERRED│   │ GRADUATED │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │               │
          ▼               ▼               ▼               ▼
     [Re-Enroll]     [Re-instate]    [Re-Enroll]     [TERMINAL]
          │               │               │         (Permanent)
          └───────────────┴───────────────┘
                          │
                          ▼
                  (Returns to ADMITTED)
```

### Transition Invariants
1. **Admitted / Active:** Can transition to `Withdrawn`, `Suspended`, `Transferred Out`, or `Graduated`. Cannot re-transition to `Admitted`.
2. **Suspended:** Can transition back to `Admitted / Reinstated`, or to `Withdrawn` / `Expelled`.
3. **Withdrawn / Transferred Out:** Can only transition to `Re-enrolled` (creating a new enrollment period record while preserving past academic and fee archives).
4. **Graduated:** Terminal state. The student is permanently sealed as an alumnus. Future courses or programs require an explicit new record.

---

## Implementation Decisions

### 1. Convex Schema
```typescript
// packages/convex/schema.ts
studentEnrollmentEvents: defineTable({
  schoolId: v.id("schools"),
  studentId: v.id("students"),
  academicSessionId: v.id("academicSessions"),
  classId: v.id("classes"),
  eventType: v.union(
    v.literal("admitted"),
    v.literal("promoted"),
    v.literal("withdrawn"),
    v.literal("suspended"),
    v.literal("transferred_out"),
    v.literal("re_enrolled"),
    v.literal("graduated")
  ),
  effectiveDate: v.string(), // ISO string YYYY-MM-DD
  reason: v.optional(v.string()),
  notes: v.optional(v.string()),
  supportingDocumentStorageId: v.optional(v.id("_storage")),
  actorUserId: v.id("users"),
  createdAt: v.number(),
})
  .index("by_student", ["studentId", "createdAt"])
  .index("by_school_and_type", ["schoolId", "eventType"]);
```

### 2. UI Experience
* **Student Profile Timeline Widget:** A vertical chronological visual timeline on the student profile displaying each event milestone, class level at that time, and reason for withdrawal or transfer.
* **1-Click Actions:** Context-sensitive action buttons in the Admin Student Workbench:
  - For Active students: `Withdraw Student`, `Transfer Out`, `Suspend`, `Graduate`.
  - For Withdrawn/Transferred students: `Re-Enroll Student` (opens class placement modal).
* **Official Attestation & Transcript Generation:** Automated generation of certified attendance letters (*"This certifies that [Student Name] was enrolled at our institution from [Admission Date] until [Withdrawal Date]..."*).

---

## Testing Decisions

* **State Machine Invariant Enforcement:** Backend mutations must reject invalid transitions (e.g. attempting to re-enroll a student who is already active, or attempting to withdraw a student who graduated).
* **Historical Report Card Preservation:** Verify that changing a student's lifecycle status does not break past term report cards or billing records.

---

## Out of Scope

* Automated inter-university credit transfer articulation systems (K-12 focus).
