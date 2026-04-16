# T19 Public Web Operating Modes and Onboarding Policy

## Objective

Define and support the three practical public-web operating modes for the platform so school onboarding is not blocked by one rigid website assumption.

## Why This Exists

Not every school will want the same public-web setup.

We need to support at least:
1. **Platform marketing website** for selling SchoolOS itself
2. **School keeps existing website** and simply links into our platform surfaces
3. **Platform-built school website** that we deliver for the school during onboarding

This task exists so the platform does not accidentally assume that every school must use our public-site engine on day one.

## Requested Scope

- define the supported public-web operating modes clearly
- document which modes are first-class and supported in product/onboarding
- define the handoff/linking strategy when a school keeps its current website
- define the minimum branded entry points we should provide even for schools that do not adopt our public-site engine
- define which decisions are platform-team managed versus school-managed

## Operating Modes

### Mode A — Platform Marketing Site
- the product has its own website for selling SchoolOS
- audience: school owners, administrators, operators
- this is separate from tenant school public websites

### Mode B — School Keeps Existing Website
- school keeps its current public website
- school links buttons/CTAs into our platform surfaces
- examples:
  - portal login
  - staff login
  - fee payment page
  - apply/enquiry handoff pages later
- our system must still work cleanly in this model

### Mode C — Platform-Built School Website
- we build and host the school's public website for them
- the school may use one of our templates with customization
- later they may attach a custom public domain

## Requested Decisions

- define the default onboarding recommendation for new schools
- define whether a school can start in Mode B and later upgrade to Mode C
- define what minimum branded URLs we give every school regardless of website choice
- define how portal/admin/teacher entry links should be presented when a school keeps an external site
- define what content responsibilities stay with the platform team during early rollout

## Acceptance Criteria

- [ ] The platform supports schools that keep their own website without blocking adoption of admin/teacher/portal workflows.
- [ ] The platform marketing website is clearly separated from tenant school public websites.
- [ ] The platform-built school website option is clearly defined as an onboarding/service path, not the only allowed model.
- [ ] A migration path exists from existing external school website to platform-built website later.
- [ ] The product and onboarding docs clearly describe the supported operating modes.

## Notes

- This is a strategy/operating-model task, not just a UI task.
- It should guide the later implementation tasks in T20-T23.
- It should stay aligned with `docs/features/MultiTenantDomainAndAuthTopology_2026-04-12.md`.
