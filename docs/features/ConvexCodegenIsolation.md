# Convex Codegen Isolation

## Goal

Make Convex code generation succeed consistently by isolating Convex server imports from React-bearing exports in `@school/shared`.

## Why This Fix Exists

Convex functions currently import from the root `@school/shared` barrel. That barrel also exports `WorkspaceNavbar`, which pulls in React and `react/jsx-runtime`.

Convex codegen bundles server code only. When it follows the shared root barrel into a React `.tsx` file, generation fails because the Convex backend bundle should not depend on React UI modules.

## Regression Guardrails

This fix must not:

- break any existing admin or teacher app imports from `@school/shared`
- remove or rename the existing shared UI exports used by web apps
- change academic behavior, schema, or runtime data flow
- require React to become a Convex backend dependency

## Components

### Shared Package

- keep the root barrel available for app-facing imports
- expose server-safe utility entry points that do not re-export React components
- ensure naming, error, grading, and workspace-navigation helpers remain accessible without touching UI code

### Convex Package

- switch Convex functions away from the root `@school/shared` import surface
- import only the specific server-safe modules needed for backend logic
- keep typecheck and codegen compatible with the existing workspace layout

### Documentation

- record the root cause and the implemented import-boundary rule
- note that Convex must only consume server-safe shared entry points going forward

## Client vs Server Split

### Client

- admin and teacher apps may continue importing from the shared root barrel for UI-facing concerns
- React components remain in the shared package for web surfaces

### Server

- Convex functions must import only server-safe modules and must never depend on the root barrel if that barrel exports React components

## Data Flow

### Current Broken Flow

1. A Convex function imports from `@school/shared`.
2. The shared root barrel re-exports both utilities and `WorkspaceNavbar`.
3. Convex codegen walks the barrel graph into `WorkspaceNavbar.tsx`.
4. The Convex bundle hits `react` and `react/jsx-runtime`.
5. Code generation fails.

### Intended Fixed Flow

1. A Convex function imports only server-safe shared modules such as:
   - `@school/shared/name-format`
   - `@school/shared/errors`
   - `@school/shared/exam-recording`
   - `@school/shared/workspace-navigation`
2. Convex codegen resolves only utility modules.
3. No React component enters the backend bundle graph.
4. Code generation completes successfully.

## Database Schema

No schema changes are required for this fix.

## Implementation Plan

1. Add or confirm server-safe shared entry points for the utility modules Convex uses.
2. Update every Convex import that currently points at the shared root barrel.
3. Keep the root shared barrel intact for app consumers.
4. Run Convex codegen and package typechecks.
5. Update this document with the shipped fix and verification results.

## Acceptance Targets

- `convex codegen` completes successfully from the workspace
- Convex typecheck remains green
- admin and teacher app typechecks remain green
- shared UI exports remain usable by the apps
- no React dependency is introduced into the Convex backend bundle

## Implementation Notes

### Shared Import Boundary

- Convex functions that previously imported from the root `@school/shared` barrel now import from server-safe subpaths instead:
  - `@school/shared/name-format`
  - `@school/shared/exam-recording`
- the shared root barrel still remains available for app-facing UI imports, including `WorkspaceNavbar`

### Convex TypeScript Config

- `packages/convex/tsconfig.json` no longer pins `rootDir` to the Convex package folder
- this allows Convex typecheck and codegen to include the server-safe shared source files resolved through the workspace path aliases without failing `TS6059`

## Verification

- `corepack pnpm convex:codegen`
- `corepack pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`
