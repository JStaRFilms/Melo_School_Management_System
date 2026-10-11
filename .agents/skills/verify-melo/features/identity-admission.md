# Identity and admission

## Current evidence limit

B2 has focused component tests and TypeScript checks. Browser verification is blocked because this worktree has no private `.env.qa.local`. No UI journey, reload, mobile or keyboard result below has browser evidence yet. Admin, Teacher and Portal are the only runner-attested apps. Apply guardian signup and Platform bootstrap/assign-admin need separately approved isolated fixtures and origins.

Use the worktree and backend attestation procedure from `verify-melo`. Do not borrow another checkout's profile or use normal development or production. B2 does not authorize deployments or real email/provider calls.

## Admin journeys

- Open Academic > Students and the standalone Students > Onboarding entry. Both must use the same admission form. Capture first/middle/compound surname, DOB, gender, house, residential address, emergency source and details, contact relationship and photo. Reopen the created profile and household, then compare every captured field. A combined display name alone does not prove round-trip preservation.
- Try none, existing and new contact modes. Search the authorized bounded directory, including an empty page and loading/error state. Select a stored contact and confirm identity remains read-only. For an exact-email match, choose the stored contact; mistyped names/phones must not become an edit. Check custom relationships and explicitly different contact addresses. Reusing a household must not replace its residential address.
- Restore an old family or student-first draft. Confirm emergency details remain visible as previously recorded values. Test cancel, failure and a lost admission response. Retry the reviewed request without changing its key or creating a separate family/student write. Do not submit a deliberately duplicated admission against an unattested backend.
- Reopen a promoted pupil. Clear and reselect current-session subjects without opening or saving identity. Confirm the UI reload shows the subject membership. A class-confirmation dialog does not prove this criterion.
- Edit only the pupil's name. No class-change dialog or reassignment intent should appear. Select a different effective class, cancel the confirmation and verify all edits remain. Confirm with the reviewed effective class/session. A stale assignment must prompt reload/review and must not silently retry.
- Open the family editor. Save contact identity separately from household label/address. Confirm household-wide address/primary-contact consequences. Existing-contact linking must not provision or reset. Unlink and unused-contact deletion must remain distinct; retained-reference blockers must be visible.
- Reopen portal credentials without clicking an operation. Check backend loading, not-provisioned, pending, provisioned and reconciliation/error states. Display the actual persisted ID. Passwords may appear only after the current successful operation and must disappear when the target changes or the panel closes. Provider-backed provisioning/reset journeys remain blocked until their isolated conditions are approved.
- Open Admin > Settings > Email domains. Verify backend edit authority, the namespaced default and verified owned/shared choices. Pending or unavailable choices must not be selectable. Confirm a change affects only new identities; cancel and stale-version rejection must not save. Do not confuse login suffixes with mailboxes or sender settings.

## Names and display

- On Teacher and Admin creation, enter `Mary Jane` as first name with an empty middle, and `De la Cruz` as surname. Blur and verify `Mary`, `Jane`, `De La Cruz`. With an explicit middle already present, retain both first-name words. Verify saved structured parts after reopening.
- Edit a full-name-only legacy teacher/contact/import row without guessed parts or blank first/last validation. Enter structured parts only deliberately. Import review exposes an explicit `Save row name` action; its saved name must still go through the existing row/plan review gates.
- Verify Teacher/Admin headers and the Portal header update from authorized stored identity after a school name edit, even if the auth-session name has not changed. While the stored name is loading, the old auth name must not reappear. Do not modify issued report snapshots.
- For Apply fixtures, reopen student/contact names, retain unrelated demographics and existing contact addresses, and exercise same/different residential address selection. Full-name-only contacts remain editable. Guardian account signup formats its auth display name from entered parts; the application contact stores structured parts separately.

Repeat affected journeys at mobile width and using keyboard-only input. Check validation, cancellation, loading/error and applicable role-denial paths. Retain reviewed screenshots and assertions only after the attested browser run. Mark provider and unsupported-origin paths blocked rather than calling them passed.
