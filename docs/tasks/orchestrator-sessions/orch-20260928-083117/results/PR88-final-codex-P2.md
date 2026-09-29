# PR #88 final Codex P2

Confirmed inline 4138588338. The prior event query took 64 upcoming rows before removing archived ones. A live event in position 65 or later could disappear from Portal notifications.

The Portal workspace now iterates the existing `schoolEvents.by_school_and_start` range in start-date order, stopping at three non-archived events or 512 examined rows. It only runs this read when the client supplies `now` and event notices are enabled. Cached clients without `now` still get the same academic response without time-based event notices. No query reads the server clock. The graded release gate, selected result, history and FR-023 worktree remain untouched.

The new integration test places 75 archived future events before a live one, plus another school's event. The live school's event appears; the archived and foreign ones do not. Existing tests still cover 270 past events and no-`now` clients.

Verification: Convex typecheck passed; full Convex suite 652 tests in 85 files passed. Portal typecheck and UI suite 8 tests in 2 files passed. Targeted backend ESLint and `git diff --check` passed. The theme audit was informational. It reported existing fallback product-neutral colours in `portal.ts` and direct colours in separately edited Admin files; this fix introduces no colours or UI changes.

The 512-row ceiling keeps workspace transactions bounded. If a school has 512 or more archived future events before its next live event, that event may remain hidden; a future archive-aware index or paginated event endpoint is needed for that volume. No commit, push, merge or deployment.
