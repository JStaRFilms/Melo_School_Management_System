# FU2 autosave and progression result

## Changes

- Added a per-application serialized write queue for core, dynamic-answer, contact, document-bind, and submission writes. Each queued write takes its expected draft version from the preceding acknowledged result, has bounded transient retries, and pauses rather than retrying an optimistic-concurrency conflict.
- Added generation-aware dirty tracking and a deliberately scoped `localStorage` recovery record (`apply:draft-recovery:<school>:<reference>`). It stores editable core/contact/answer values plus draft/reconciliation metadata only; it excludes documents, upload data, auth/session data, payments, and submission snapshots.
- Added 700ms debounce and a 7-second retry ceiling while changes remain dirty. In-flight keys are shared so the same dirty value cannot queue duplicate writes. Exact values matching the locally acknowledged server baseline are suppressed.
- Added explicit, noninterruptive save states, visible conflict recovery/discard choices, named section-scoped validation errors, invalid-field focus, and `Save and continue` for every editable form section. Navigation flushes the departing section without advancing it.
- Added focused queue/conflict/progression tests and field error styling.

## Security and conflict decisions

The browser does not merge over a newer server version. On `DRAFT_VERSION_CONFLICT`, the queue pauses and the subscribed guardian-application query remains the source of the newer snapshot. The user must deliberately retry pending edits after review, or discard them. A recovery record whose base version is stale is not applied automatically; the user must explicitly restore it for review before retrying.

Existing Convex ownership, school isolation, edit-lock, submission-lock, and optimistic-version checks are unchanged. The FU1 idempotent backend contract is retained.

## Validation

- `pnpm --filter @school/apply exec eslint components/GuardianSurface.tsx lib/draftAutosave.ts tests/draftAutosave.test.ts` — passed.
- `pnpm --filter @school/apply typecheck` — passed.
- `pnpm --filter @school/apply test -- draftAutosave.test.ts` — passed: 2 files, 13 tests (the package runner includes the existing journey suite).
- `pnpm --filter @school/convex exec vitest run admissionsDomain.test.ts` — passed: 29 tests.
- `pnpm --filter @school/convex typecheck` — passed.
- `git diff --check` — passed.

## Manual checks still needed

No browser automation was run. Manually verify a normal connected save, offline edit/reconnect, refresh with pending local changes, a second-tab version conflict, invalid Child/Guardian fields and focus behavior, neutral navigation without advancement, and one successful **Save and continue** per configurable section. Also verify document upload and final submission in the deployed development environment.

## Limitations

Transient-error classification is intentionally conservative (offline/network/fetch/temporary/timeout wording) and retries twice in the queue before the 7-second dirty retry cycle attempts again. Deterministic validation and locking errors are left for user correction; they are not retried automatically.
