# U3d — Shared two-base school theme adoption

## Objective / scope
Standardize existing Primary/Accent branding in touched shells/forms/print/public Sites without a mass color redesign. Grade and universal status colors remain separate.

## Context / dependencies
U1b/U1f, and U2b print changes finished. Read F6/H1 and actual themeDerivation/SchoolThemeProvider, WorkspaceNavbar, schoolBranding.ts, Admin settings, Tailwind configs and Sites site.ts/site-ui.tsx. Shared provider has no app consumer; Navbar injects older variables; Sites has independent static theme/hostname model and no Convex dependency.

## Ownership
U3d files in plan, relevant theme tests, AGENTS guidance and informational changed-file color audit. Navbar theme edit serialized after U1b. Shared print changes coordinated after U2b. Do not make Platform tenant-themed outside explicit previews.

## Instructions
1. Reuse central typed derivation and safe foreground/hover/pressed/tint/border/focus/selection/progress tokens. Validate actual contrast mathematically, not heuristic assertions; Primary/Accent are the only admin inputs.
2. Use U1f effective group defaults/explicit branch override origin and safe preview/reset. Update schoolBranding read/write authorization and selected branch context; block save only if no safe representation is derivable.
3. Migrate school-facing shells and touched UI incrementally. Inventory brand/status/grade/chart/product colors; replace only tenant branding. Add Tailwind mappings and AGENTS rules; changed-file audit informational, not global legacy churn.
4. Share derivation with Sites published public configuration without introducing private school API access. Static hostname data is not live Admin synchronization: provide an explicit reviewed published-theme seam if available, otherwise record runtime sync as gated. Never silently claim an Admin change propagated to static Sites.
5. Print keeps white paper/legibility and U2a grade/history contract.

## Definition of done / verification
Theme tests cover light/dark/custom bases and all foreground/surface pairs; validate branch switching updates token context, group override reset, stable status/grade colors, 320px/keyboard/focus and grayscale print. Record app/shared typechecks and changed-file audit results; Sites has no existing test script.

## Artifacts
`results/U3d.md`: token/consumer/color-classification and public-source coverage, exact gates, tests/self-review, U7 screenshots. Update matrix. No live providers, production, migrations, deployment, credentials or unapproved CLI/PR operations.
