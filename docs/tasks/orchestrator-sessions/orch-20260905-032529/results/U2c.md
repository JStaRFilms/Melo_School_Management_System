# U2c — Numbering and enrollment

**Status: local code scope complete for branch-owned counters and explicitly adopted group formats / E0.** No group-wide counter was invented: the current authorization contracts prove group format governance, but do not grant a shared sequence owner. No live Convex/CLI/codegen/deployment, migration, provider or production operation was performed. The scoped changes were committed locally.

## Delivered contract

- `/admin/settings/admission-numbering` manages the versioned branch format and legacy branch counter plus named branch-wide or normalized-level counters. Each counter has an explicit key, status (`active`, `paused`, archived), reset frequency, next sequence and configuration version. Default selection is explicit; archived counters remain unavailable for allocation.
- Policy, effective-format and selected-counter revisions are separate optimistic pins. Reviewed enrollment and import calls fail closed when any pin changes. Session/calendar/continuous resets use the active academic session and never promise gapless numbering.
- `createStudent` allocates and permanently claims only inside the successful enrollment transaction. Actor-scoped request replay returns the original student after a lost response. Failed transactions, previews and abandoned forms do not advance a counter.
- Manual enrollment and existing-student correction require `enrollment.admissions.override_number`, explicit confirmation and an 8–240 character reason. Optional counter advancement is an exact reviewed integer with policy/format/key/config pins. Supplied identifiers are never parsed and never advance a counter implicitly. Corrected-away identifiers retain permanent claims.
- The profile editor now exposes the correction contract instead of sending an unreviewed rename. It clearly separates “leave counter unchanged” from explicit advancement and refreshes its pin when the class level changes.
- Reviewed imports now resolve proposals by selected class level, persist policy/effective-format/counter pins per row, and plan independent level/branch counters together. Approval is read-only; final commit allocates or claims in the student transaction and rejects stale counter configuration. Historical supplied values remain unchanged unless a separately authorized reviewer explicitly chooses advancement.
- `admissionNumberSequences` models school-owned named/default/level sequences. Matching is normalized and one nonarchived sequence may own a level. Concurrency relies on Convex transaction conflicts plus permanent claims; collisions terminate rather than skip or recycle identifiers.
- Group owners may publish a versioned **format-only** default from an explicitly linked branch, and linked branches may explicitly inherit or override it subject to `allowBranchOverride`. Effective format resolution snapshots group ID/version and branch revision. All counters remain branch-owned and use the destination branch's school/campus code.

## Group boundary

A global/group-wide sequence is intentionally unavailable. Existing scoped settings APIs establish group ownership and linked-branch authority for versioned defaults, but no contract establishes a legal counter owner, allocation authority across branches, or recovery semantics for unlinking. Implementing one would violate the instruction not to infer group authority. A future group-counter feature must add that authorization contract explicitly; this is not substituted with a hidden shared counter.

## Reusable allocation seams

- `proposeAdmissionNumberHelper(ctx,{schoolId,level?,sequenceKey?,...pins})` is read-only.
- `allocateNextAdmissionNumberHelper(...)` recomputes and atomically claims/advances in the caller transaction.
- `commitManualAdmissionNumberHelper(...)` claims a supplied number and advances only when `advanceTo` is explicitly supplied.
- U6 already adopts both automatic and manual helpers. U4b reviewed imports now adopt these helpers for missing-only allocation and explicit manual claims.

## Verification and self-review

- Convex focused bundle: **3 files / 34 PASS** (`admissionNumbers` 11, reviewed import 11, transfers 12).
- Admin focused bundle: **2 files / 5 PASS** (numbering/settings and migration workbench).
- Convex, Shared, Admin and Portal TypeScript checks: PASS.
- Tests cover concurrent/retried allocation, transaction rollback, stale policy/format/counter pins, no reuse, named level isolation/status, branch default selection, format-only group inheritance with branch-owned counters, existing-student correction, and multi-counter import planning/stale commit.
- Self-review kept manual IDs opaque, kept group counters unavailable without authority, retained prior claims, and preserved compatibility for an in-progress legacy single-counter import plan.

## Remaining evidence / follow-up

- E0 only: U7 still owns authorized desktop/320px/keyboard/runtime evidence, including stale-save, denied/revoked authority, retry and print-adjacent flows.
- Schema/functions are authored locally only; rollout remains outside this packet.
- A true group-wide counter remains future contract work as described above, not an inferred implementation.
