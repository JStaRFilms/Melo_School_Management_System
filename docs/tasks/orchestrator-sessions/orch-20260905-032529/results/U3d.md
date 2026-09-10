# U3d — Shared two-base school theme adoption

**Status: local implementation complete; runtime/public publication evidence remains gated (E0).** No live Convex command, deployment, migration, provider, production access, server, or commit was used.

## Delivered token and consumer contract

- `@school/shared/theme` now strictly accepts opaque `#RGB`/`#RRGGBB` bases, normalizes them, and mathematically derives Primary/Accent hover, pressed, surface, border, foreground, focus, selection, and progress tokens. Mid-tone state foregrounds fall back to black only when neither prescribed white nor slate foreground reaches WCAG AA; this is a contrast safety measure, not a third admin input.
- The theme test covers default/light/dark/custom bases and checks every opaque background/foreground state pair with the actual WCAG contrast calculation. Invalid/alpha/trailing input is rejected for saving and safely falls back for rendering.
- `WorkspaceNavbar` now derives its shell context from the shared module rather than injecting its older partial variable set. Its tenant-filled avatar/brand and active navigation foregrounds use derived contrast tokens. Admin, Teacher, and Portal Tailwind configs expose the semantic brand mappings.
- Admin School Settings has a two-base live preview, visible safe/invalid state, keyboard-visible focus ring, and normalizes `#RGB` to saveable six-digit values. Save is blocked only when either input has no safe opaque representation. The existing current-branding query remains the U1f effective-origin consumer; no separate client branch context was invented.
- `ReportCardSheet` derives the same valid primary/accent representation for its existing school branding and uses the derived primary foreground on branded print headers. White paper, U2b grade policy colours, and monochrome/forced-colour rules remain intact.
- Sites now depends on the shared derivation and its static `SchoolTheme` has only published `primary` and `accent` inputs; old `secondary` template values/usages were removed. Static hostname config is still the explicit public publication seam, with **no Convex dependency and no Admin-to-Sites runtime sync claim**.

## Color classification / constrained audit

Tenant branding was changed only in the shared shell, settings preview, print header, Tailwind mappings, and public Sites theme seam. Existing green/amber/rose/grade colours were retained as status or grade semantics; slate/white print and neutral layout values were retained. `node scripts/audit-theme-colors.mjs` completed as an informational changed-file inventory and reported direct literals for classification only; it made no changes and intentionally did not trigger mass replacement. It also exposed concurrent packet files in the shared worktree, which were not edited by this packet.

`AGENTS.md` records the two-base, status/grade separation, static Sites publication, print, and audit rules. The audit helper is `scripts/audit-theme-colors.mjs`.

## Verification

Passed:

- `pnpm --filter @school/shared exec vitest run src/theme/__tests__/themeDerivation.test.ts` — 1 file, 8 tests.
- `pnpm --filter @school/shared exec vitest run src/__tests__/report-card-sheet.test.ts` — 1 file, 3 tests.
- `pnpm --filter @school/admin exec vitest run __tests__/workspace-shell.test.tsx` — 1 file, 7 tests.
- `pnpm --filter @school/shared typecheck`
- `pnpm --filter @school/admin typecheck`
- `pnpm --filter @school/sites typecheck`
- `pnpm --filter @school/teacher typecheck`
- `pnpm --filter @school/portal typecheck`
- Focused ESLint for changed Shared/Admin/Sites source — passed.
- `node scripts/audit-theme-colors.mjs` — completed informationally.
- `git diff --check` — passed after removing two introduced whitespace errors (repository emits existing Windows line-ending notices).

No Sites test script exists. No browser or print runtime was available, so 320px, keyboard traversal, selected-branch runtime updates, grayscale physical print, and U7 screenshots remain E0/U7 work.

## Public-source and acceptance gates

- The currently rendered Sites source is explicitly static hostname data. A reviewed published-theme synchronization source does not exist in this repository; Admin branding saves must **not** be described as propagated to Sites. Runtime synchronization is gated on a separately reviewed public publication contract.
- U1f group default/explicit override/reset origin is server-resolved by `schoolBranding.getCurrentSchoolBranding`; the shells consume that effective response. U1f's existing owner/branch settings editor displays the effective origin/version/reset semantics.
- Platform remains untouched and Melo-branded. No status token, grade band, schema, generated API, authorization, historical issued-report, or private Sites API change was made.

## U7 evidence request

Capture synthetic/redacted desktop and 320px Admin Settings previews for light/dark/custom/invalid inputs, keyboard focus, save retry, and a group branch override/reset. Capture Admin/Teacher/Portal shell branch changes and report-card print/Save-as-PDF in colour and grayscale. Capture static Sites only as published host data and label it as static, not an Admin synchronization result.
