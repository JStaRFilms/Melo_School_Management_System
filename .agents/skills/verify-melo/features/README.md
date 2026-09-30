# Melo verification map

Read this index before driving the app. These recipes cover the current synthetic Admin, Teacher, and Parent accounts. They are a starting map, not a claim that every Melo feature is tested.

## Preconditions and proof

- Use the intended worktree and the existing isolated deployment through `qa:doctor` and owned `qa:start` servers.
- Use the fixtures already named in each recipe. A missing fixture is a blocker rather than permission to reset the school.
- Start a separate browser context for each role; localhost cookies are not isolated by port alone.
- Use accessible names and inspect the current DOM when a control changes. Keep feature assertions tied to user-visible behavior rather than coordinates.
- Capture actions and end states. For writes, reload or reopen a second UI view to confirm persistence. Treat loading/error/empty and cancellation branches as real criteria, not decorative screenshots.
- Keep raw diagnostics, traces, and session data private. Publish only reviewed evidence with scope and revision metadata.

## Recipes

- [Template editor](template-editor.md): Admin starter preview, validation, inactive save, persistence, edit/discard, and mobile reopening.
- [Teacher roster](teacher-roster.md): dependent academic selectors, assigned pupils, reload context, and mobile rendering without score writes.
- [Parent learning](parent-learning.md): linked pupil, topic filtering, empty/clear state, detail navigation, and mobile list.
- [Workspace access](workspace-access.md): unsigned protected-route redirect and Teacher rejection from Admin editing. UI checks are not full endpoint authorization coverage.

Each recipe separates the built-in verified path from other entry points needing feature-specific checks. A command passing for one path does not verify the others. For a changed feature outside this map, author its acceptance steps using [exploration](../references/exploration.md), then extend the map.

## Not covered by this cohort

Student-only navigation, Platform superadmin, guardian admissions signup, public WWW/Sites published configuration, payment settlement, AI generation, new narrative issuance, and class-result release require their own fixtures/configuration and criteria. The runner currently attests only three app origins. The new upstream narrative/result/scoring code being deployed does not mean those complete workflows have browser proof.
