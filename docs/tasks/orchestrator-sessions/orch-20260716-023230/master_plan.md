# Full Demo School Population

## Goal
Create a polished, deterministic, screen-recording-ready demo school across every visible product flow, validate it in development, and prepare a separately confirmed production launch.

## Confirmed decisions
- Reset only the tenant with slug `demo-school`; do not affect other schools.
- Cover all visible workflows: academics, reports, attendance, families, billing, events, knowledge, and representative AI artifacts.
- Use photo-like synthetic face assets plus school branding.
- Stop for final confirmation before applying to production.

## Safety constraints
- The reset path must be protected, explicit, and tenant-scoped.
- No real payment charges or external AI generation during seeding.
- No deployment writes until target identity is verified.
- Existing unrelated working-tree changes must be preserved.
- Credentials must be configurable and should not be leaked into source or normal logs.

## Delivery stages
1. Genesis: audit schema, workflows, auth, media, and deployment boundaries.
2. Design: specify deterministic dataset, reset/reconcile architecture, assets, and validation matrix.
3. Build: implement seed tooling, tests, apply to development, validate UI, and prepare production confirmation.
