# Template editor

An Admin can customize a school template and confirm its stored structure without replacing the active school default during QA.

## Sub-features

- `starter-preview`: inspect a starter before selecting it.
- `title-validation`: empty title disables commit.
- `inactive-save`: create a run-marked subject-only inactive template.
- `persistence`: reload and verify title, guidance, formatting, and inactive status.
- `discard`: cancel discard keeps the draft; confirmed discard restores the saved value.
- `edit-save`: a later edit survives reload.
- `mobile-reopen`: open the saved template on a narrow viewport.
- Other entry points requiring separate checks: catalog New Template from scratch, empty-school welcome, duplication, activation/conflict resolution, teacher template fallback, and generated-document validation. The built-in journey does not verify these.

## How to get to it (user POV)

- Admin navigation, Lesson Templates, at `/academic/knowledge/templates`.
- Choose Starter / Template Gallery, then Preview and Use Template.
- Saved catalog card, then Designer or Monitor.
- New Template and empty-state Browse templates are additional paths to verify when affected.

## Driving it with qa

Preconditions: the Admin app is owned by QA and the synthetic school already has its baseline active template.

Run `pnpm qa:feature`. The journey previews the starter, rejects an empty title, saves only an inactive subject-scoped copy with a unique QA marker, and reloads it. Expect the guidance and format to match the edited values. It exercises both choices of the discard dialog, saves an internal-description change, and reloads on mobile. Review saved-desktop, discard-restored, and saved-mobile screenshots and all 12 criteria before claiming this editor path passed.

For scratch, duplicate, or activation changes, add separate steps through `qa:explore`; keep source templates and defaults unchanged unless the specific synthetic test plan requires a narrowly scoped change. Confirm both the action and a fresh UI read of persisted state.

## Gotchas

- Active scope conflicts are different from inactive drafts; checking one does not test the other.
- The editor survives catalog filtering. Verify that search does not detach an unsaved draft when touching that behavior.
- A stale backend can reject guidance/format fields even when the page opens. Use the contract blocker and scoped maintenance procedure rather than weakening the assertion.
- A successful toast is not persistence proof. Test reload/reopen, and retain the QA marker for reviewed cleanup.
