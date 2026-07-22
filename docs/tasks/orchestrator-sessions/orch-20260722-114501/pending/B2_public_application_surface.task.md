# B2 — Public guardian application surface

**Stage:** Build | **Role:** Coder | **Depends on:** B1, D1 | **Worktree:** `feature/admissions-platform`

## Objective
Create the dedicated, tenant-aware public admissions UI defined by G1/D1, independent of whether a school’s marketing website is managed by this platform.

## Scope
Public guardian authentication, slot/payment journey, draft form, uploads, declaration, submit/status UX, and end-to-end coverage; no staff operations or admissions domain redesign.

## Ownership
`apps/apply/**` (new), app-local components/tests, and admissions-facing shared UI only when explicitly assigned.

## Implement
- Canonical tenant/application route resolution and safe invalid/disabled school handling.
- Guardian sign-up/sign-in/contact verification, slot dashboard, payment handoff/return, resumable child draft, conditional form fields, private document upload, declaration capture, submission confirmation, and application status/messages.
- Mobile-first accessibility, clear required/optional/sensitive labeling, autosave feedback, session recovery, and truthful pending/failed payment states.
- The public URL must work when linked from `apps/sites` or a wholly external website; it must not require site-domain cookies.

## Guardrails / tests
Do not surface staff-only data, put document IDs in public URLs, or imply acceptance. Add component/E2E coverage for payment return, draft resume, one-slot-one-submission, upload failure/retry, and keyboard/mobile flows.

## Done when
The interface consumes B1 APIs only, all UX states in D1 are represented, and the link contract can be demonstrated from two distinct hostnames.
