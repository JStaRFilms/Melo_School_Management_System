# Coding Guidelines

## Core Rules

- Use `pnpm` workspaces and `turbo` commands from the repo root.
- Keep the monorepo boundary strict: apps consume `packages/*`; apps do not import from each other directly.
- Prefer TypeScript with explicit types. Do not introduce `any` unless there is a documented reason.
- Keep school awareness explicit in domain code. Queries, mutations, and UI loaders must always know which school context they are operating inside.
- Build mobile-first by default. Desktop can enhance the layout, but the smallest viewport is the baseline.
- Use ASCII in source files unless an existing file already contains non-ASCII text that should be preserved.

## Next.js Rules

- Use App Router patterns and colocate route concerns cleanly.
- Keep server/client boundaries explicit.
- Shared visual components belong in `packages/ui`.
- Feature-specific UI belongs inside feature modules, then exported to apps.
- Use route groups and layout composition to keep `admin`, `teacher`, and `portal` navigations isolated.

## Convex Rules

- Organize Convex by domain, not by technical layer.
- All public Convex functions must declare validators for arguments and returns.
- Prefer indexes over filters.
- Throw structured user-facing errors and keep mutations idempotent where possible.
- Payment, grading, and publishing actions must be auditable.

## Security Rules

- Authorization is mandatory on every sensitive query, mutation, action, and page loader.
- Admin support access is read-only unless a later requirement explicitly changes that rule.
- Never expose student, payment, or report-card data across schools.
- Webhooks and payment callbacks must verify signatures before mutating state.
- Rate limit login, payment initialization, report publication, and AI-heavy endpoints.

## Delivery Rules

- Run `pnpm typecheck` after TypeScript changes.
- Run targeted tests as features are completed, then `pnpm test:e2e` for critical flows before marking a release ready.
- Keep docs in sync with implementation in `docs/features/`.
- When a feature changes public behavior, update its FR issue acceptance criteria and related docs in the same batch.

## Definition of Done

- Code is typed, linted, and covered by the relevant automated checks.
- Acceptance criteria are checked in the corresponding FR issue.
- Security implications are addressed for data access and role boundaries.
- Mobile-first behavior is verified.
- Documentation is updated if the change affects architecture, behavior, or operations.
