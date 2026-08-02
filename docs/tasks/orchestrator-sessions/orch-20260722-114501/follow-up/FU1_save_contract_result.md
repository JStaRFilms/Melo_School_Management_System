# FU1 save-contract result

## Root cause confirmed

The current application surface launches `saveAnswerByPublicReference` from dynamic-field blur and `saveCoreByPublicReference` from **Save and continue** independently. Both capture the same reactive `draftVersion`; the first distinct mutation increments it and the other correctly receives `DRAFT_VERSION_CONFLICT`. The surface also rehydrates its local version from the reactive query while mutations are pending, so unchanged contact/answer saves can reuse an obsolete version.

The authority boundary remains the backend: every save verifies ownership, school isolation, editability, and `expectedVersion` before deciding whether it is a no-op. FU1 does not make conflicts last-write-wins.

## Changes

- `packages/convex/functions/admissions/applications.ts`
  - Exact replays of existing core, answer, or contact values now return the current `draftVersion` without changing rows, incrementing `draftVersion`, or emitting an audit event.
  - Exact comparison happens only after the authoritative expected-version and validation checks. A stale writer therefore still gets `DRAFT_VERSION_CONFLICT`, including when its submitted values match the latest stored values.
- `packages/convex/admissionsDomain.test.ts`
  - Adds regression coverage that saves a core draft and contact while an unrelated required future-section answer is absent; verifies exact core/contact/answer replays are version-stable; verifies a stale save remains rejected.

## Validation

- `pnpm --filter @school/convex exec vitest run admissionsDomain.test.ts`: passed — 1 file, 29 tests.
- `pnpm --filter @school/convex typecheck`: passed.
- `pnpm --filter @school/convex exec eslint functions/admissions/applications.ts admissionsDomain.test.ts`: passed.
- `pnpm --filter @school/convex test -- admissionsDomain.test.ts`: the package script forwarded arguments such that the full suite ran. Admissions tests passed, but four unrelated tests timed out at the existing 5s default (`foundationContracts`, `siteLifecycle`, `demoSeed.integration`, `lessonKnowledgeIngestionHelpers`). This does not affect the direct focused run above.

## Migration impact

None. No schema, generated artifact, or data migration change is required.

## FU2 client contract

FU2 must treat every application mutation as one serialized queue shared by core, answer, contact, upload-bind, and submission operations. It must:

1. Take the next `expectedVersion` only from the queue's acknowledged response, never a reactive query while a queued write is pending.
2. Omit unchanged fields before queueing. Exact replay is safe and returns the current version, but should not be routinely sent.
3. Advance the queue version from each successful numeric response, including an unchanged response.
4. On `DRAFT_VERSION_CONFLICT`, pause the queue, refetch `getGuardianApplication`, reconcile intentional dirty data, and require a deliberate retry; never silently overwrite.
5. Map only safe Convex error codes to section/field UI (`DRAFT_VERSION_CONFLICT`, `APPLICATION_INCOMPLETE`, `ANSWER_INVALID`, `ANSWER_NOT_APPLICABLE`, `CORE_FIELD_LOCKED`). Do not surface internal record details or submitted values.
6. Do not automatically retry deterministic validation/lock errors. Local recovery must contain only editable draft values and version/reconciliation metadata, never documents, tokens, payment data, or submitted snapshots.

## Remaining assumptions

- Core/profile and contact rows intentionally retain their existing section-local required inputs; submission remains the cross-section completeness boundary.
- FU2 owns UI serialization, dirty tracking, recovery, and named field presentation. FU1 intentionally does not modify `apps/apply`.
