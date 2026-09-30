# C6 master merge reconciliation

Eight conflict files resolved. The merge remains open for the parent to finish.

- Portal graded cards and history require an exact frozen student inclusion, matching issued card and released class publication. Unreleased certification and live scores stay private. Excluded and late entrants retain the score-free `no_eligible_record` state.
- The reporting mode is selected before reading a graded payload. An unissued narrative period cannot inherit a graded card, even when frozen graded evidence exists. Issued narrative snapshots supply narrative history and remain tied to the historical class after promotion. Drafts and unissued graded periods do not enter family history. Cross-school and cross-family checks remain in the authorized selector.
- Selected-branch Admin queries keep `schoolId` and the branch mismatch/loading guards. Narrative preview and class printing dispatch without starting graded queries. Demo reset and tenant purge include both sets of tables. Client `now` remains optional and event reads remain indexed and bounded.
- The graded `issuedReportCards.by_class_and_session_and_term` index is ordinary because the graded release path already queries it. Its #90 staged-schema deployment and backfill must complete before this activation is deployed. The separate `by_classId_and_sessionId` index remains staged and is not queried. No deployment was run. The #92 capacity helper and tests were left intact.

Checks after fixes:
- `pnpm --filter @school/convex typecheck`: pass.
- `pnpm --filter @school/convex test`: 91 files, 701 tests pass.
- `pnpm --filter @school/admin typecheck`: pass.
- `pnpm --filter @school/admin test`: 66 files, 306 tests pass.
- `pnpm --filter @school/portal typecheck`: pass.
- `pnpm --filter @school/portal test`: 4 files, 13 tests pass.
- `git diff --check`: pass. `node scripts/audit-theme-colors.mjs`: informational output reviewed. Amber and rose in the touched Admin page are warning/error semantics; emerald in Portal is status, grade swatches follow grade policy, slate is product neutral. The Portal school theme defaults are product neutrals, not tenant branding; issued narrative print retains white paper and readable ink.

Joint tests exercise unpublished and certified-unreleased graded cards, released frozen cards, narrative mode over an existing graded release, issued narrative after promotion with private numeric evidence, history, and the existing cross-family/school denial cases. Existing narrative entry and numeric-write tests pass in the full Convex suite. No broader review, merge commit, push, or deployment was performed.
