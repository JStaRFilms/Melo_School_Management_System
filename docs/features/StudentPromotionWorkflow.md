# Student Promotion Workflow

## Goal
Allow school admins to stage and execute student promotions across academic sessions without colliding student rosters or modifying historical academic and billing records.

## Problem Solved
Previously, modifying a student's class pointer immediately shifted them across all queries, causing collisions when viewing an older session's roster or preparing the next session's roster. The system now decouples annual promotions into a **Session-Oriented Promotion Architecture**.

## Architecture & Data Flow

### 1. Staging & Persistence (`studentPromotions`)
- End-of-session promotions (available during Term 3 / cumulative annual mode) write a record to `studentPromotions` with `(studentId, fromClassId, fromSessionId, toClassId, toSessionId)`.
- Re-promoting students updates their existing promotion entry and cleans up previous staged subject selections.
- Staged promotions can be cancelled/undone via `cancelStudentPromotion`.

### 2. Backwards Session Lockdown
- Promotions to previous sessions or within the same session are strictly blocked.
- The UI disables past sessions in the destination dropdown and displays an alert banner if no upcoming session has been created.
- The backend enforces `toSession.startDate > fromSession.startDate`.

### 3. Dynamic Session Roster Resolution
Class membership for a session `(classId, sessionId)` is computed dynamically:
1. Active session baseline students (`students.classId === classId && session.isActive`).
2. Students promoted into `(classId, sessionId)` (`studentPromotions.toClassId === classId && studentPromotions.toSessionId === sessionId`).
3. Students with existing `studentSubjectSelections` or `assessmentRecords` for `(classId, sessionId)`.

### 4. Source Session Badging
- In the source session, students remain in their source class and receive a visual badge:
  `Promoted → [Target Class] ([Target Session])` with an optional Undo action.
- Admins can filter by "Select Unpromoted" to quickly batch-promote remaining students.
- Re-promoting an already-promoted student triggers a confirmation modal warning that their target class assignment will be overwritten.

### 5. Historical Isolation
- Historical records (`assessmentRecords`, `studentSubjectSelections`, `studentInvoices`) remain strictly tied to their historical session and class.
- Archived students are filtered from promotion lists.

## Safety Rules
- Promotion and cancellation mutations require school admin privileges.
- Backwards promotions and same-(class,session) promotions are prohibited.
- Promotions process at most 100 students per batch.
- Subject selection modes allow rolling over all target class subjects, matching previous subjects, or none.
