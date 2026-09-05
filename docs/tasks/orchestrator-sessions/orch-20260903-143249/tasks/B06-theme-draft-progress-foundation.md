# Task B-06 / M5: Shared Theme Tokens, Draft Recovery, and Mobile Progress Foundation (F6/H6/H7)

## Objective
Establish the cross-application visual and UX primitives across all school-facing apps (theme derivation, draft persistence & recovery, and compact mobile progress indicators).

## Scope
- **Shared School Theme Derivation (F6 / MX-05)**:
  - Strict 2-input theme model (`primaryColor` and `accentColor`).
  - Algorithm generating CSS custom properties (`--school-primary`, `--school-primary-hover`, `--school-primary-surface`, `--school-primary-contrast`, `--school-accent`, `--school-accent-surface`, `--school-accent-contrast`, focus rings).
  - Mathematical contrast validator ensuring WCAG 2.2 AA ($4.5:1$ for body text, $3:1$ for large text).
  - Absolute rule: School theme colors NEVER overwrite semantic status tokens (red/amber/green) or H1 grade-band colors.
  - Theme injector component `<SchoolThemeProvider />` in `@school/ui` or `@school/shared`.
- **Shared Dirty-State Guard & Draft Recovery Service (H6 / MX-10)**:
  - Backend schema: `formDrafts` table in `packages/convex/schema.ts` (`schoolId`, `userId`, `formKey`, `entityId`, `payload`, `status: active|committed|discarded`, `updatedAt`).
  - Convex functions in `packages/convex/functions/academic/drafts.ts`: `saveDraft`, `getDraft`, `discardDraft`.
  - Frontend Hook: `useFormDraft({ formKey, entityId, isDirty, currentData, onRestore })`:
    - Autosave debounce (1.5s).
    - Status reporting: `saving`, `saved`, `Connection lost • Recovery pending`, `save_failed`, `conflict`.
    - Truth in connectivity: Zero false offline claims; explicitly flags `Connection lost • Recovery pending`.
  - Recovery UI: `<DraftRecoveryModal />` presenting "Resume Draft", "Preview Draft", "Discard Draft". A draft NEVER silently overwrites a fresh blank form.
- **Shared Compact Mobile Progress Bar (H7)**:
  - Component `<MobileProgressIndicator />` in `@school/shared` or `@school/ui`:
    - Compact sticky bar ($<768\text{px}$, height $\le 32\text{px}$).
    - Mode A: Scroll percentage for long pages (`Page X%`).
    - Mode B: Validated section completion for multi-step wizards (e.g. `Step 3 of 5`). Steps mark complete ONLY when validation rules pass, not when scrolled past.
    - Integration with H6 save status pill.
- **Tests**:
  - Theme derivation math & contrast validation tests.
  - Draft persistence and recovery tests (active draft retrieved, discard works, no overwrite of fresh state).
  - Mobile progress calculation tests (scroll vs section validation).

## Definition of Done
- Theme derived strictly from 2 inputs with WCAG 2.2 AA contrast verified.
- Semantic colors remain sovereign and protected.
- Drafts persist and recover via modal dialog without silent overwrites.
- Truthful connectivity messages displayed.
- Compact mobile progress indicator distinguishes scroll depth from section validation.

## Dependencies
- B-03 and B-04 complete.
- D-04 visual contract frozen.
