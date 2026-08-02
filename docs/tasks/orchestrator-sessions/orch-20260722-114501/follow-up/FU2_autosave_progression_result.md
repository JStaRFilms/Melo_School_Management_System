# FU2 autosave and progression result

## Changes

- Added a per-application serialized write queue for core, dynamic-answer, contact, document-bind, and submission writes. Each queued write takes its expected draft version from the preceding acknowledged result. Document-bind and submission preserve that application version rather than substituting their document/submission result versions.
- Added generation-aware dirty tracking and a deliberately scoped `localStorage` recovery record (`apply:draft-recovery:<school>:<reference>`). It stores editable core/contact/answer values plus draft/reconciliation metadata only; it excludes documents, upload data, auth/session data, payments, and submission snapshots.
- Added a true 700ms per-edit debounce and a stable 7-second retry ceiling while changes remain dirty. Each edit resets only the debounce; the ceiling is installed once and reads current dirty work through a ref, so continuous typing cannot postpone it. In-flight keys are shared so the same dirty value cannot queue duplicate writes. Exact values matching the locally acknowledged server baseline are suppressed.
- Added explicit, noninterruptive save states, visible conflict recovery/discard choices, named section-scoped validation errors, invalid-field focus, and `Save and continue` for every editable form section. Visible `conditional` fields are progression-required alongside `required` fields; only `optional` fields are unrequired. Client validation mirrors practical closed configured constraints (length, pattern, choices, numeric limits, and selection limits); deterministic answer failures are returned to and focus the exact field. Navigation flushes the departing section without advancing it.
- Added focused queue/conflict/progression tests and field error styling.

## Security and conflict decisions

The browser does not merge over a newer server version. On `DRAFT_VERSION_CONFLICT`, the queue pauses and the subscribed guardian-application query remains the source of the newer snapshot. Restoring a stale recovery record keeps the queue paused and does not start autosave; the user must separately select explicit retry after review, or discard it. Discard restores editable refs and UI state from the latest subscribed server baseline, clears recovery/errors, and resumes the queue at that current application version.

Existing Convex ownership, school isolation, edit-lock, submission-lock, and optimistic-version checks are unchanged. The FU1 idempotent backend contract is retained.

## Validation

- `pnpm --filter @school/apply exec eslint components/GuardianSurface.tsx lib/draftAutosave.ts tests/draftAutosave.test.ts` — passed.
- `pnpm --filter @school/apply typecheck` — passed.
- `pnpm --filter @school/apply test -- draftAutosave.test.ts` — passed: 2 files, 18 tests (the package runner includes the existing journey suite). The focused tests cover document/application version separation, per-edit debounce plus stable fake-timer ceiling behavior, configured named field validation, conditional requiredness, discard baseline restoration, and paused recovered conflict state.
- `pnpm --filter @school/convex exec vitest run admissionsDomain.test.ts` — passed: 29 tests.
- `pnpm --filter @school/convex typecheck` — passed.
- `git diff --check` — passed.

## Manual checks still needed

No browser automation was run. Manually verify a normal connected save, offline edit/reconnect, refresh with pending local changes, a second-tab version conflict, invalid Child/Guardian fields and focus behavior, neutral navigation without advancement, and one successful **Save and continue** per configurable section. Also verify document upload and final submission in the deployed development environment.

## Limitations

Transient-error classification is intentionally conservative (offline/network/fetch/temporary/timeout wording) and retries twice in the queue before the 7-second dirty retry cycle attempts again. Deterministic validation and locking errors are left for user correction; they are not retried automatically. Client validation is presentation feedback; the server remains authoritative.
