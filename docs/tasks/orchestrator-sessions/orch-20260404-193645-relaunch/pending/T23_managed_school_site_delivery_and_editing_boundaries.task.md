# T23 Managed School-Site Delivery and Editing Boundaries

## Objective

Define and implement the delivery workflow for school public websites so the platform team can build sites for schools during onboarding, while still leaving room for structured future editing, page expansion, and school-specific variation.

## Why This Exists

The preferred operating model is not purely self-serve website building.

Instead, the platform should support a managed delivery approach:
- we build the school website for them
- we can start from templates
- we can add pages as the school needs them
- schools may later get limited structured editing, but we do not need a full page builder immediately

## Requested Scope

- define the onboarding workflow for creating a school public website
- define which parts are platform-team managed vs school-admin editable
- define how new pages/sections are added when a school has special needs
- support schools that keep their external site and only use platform entry links
- define what minimum branded public entry points we provide even when the school does not adopt our full public-site engine

## Key Questions This Task Must Answer

- when a new school is onboarded, who chooses the template?
- who enters initial content?
- which content can school admins edit later?
- what content remains platform-team managed?
- how do we support a school that keeps its own public website?
- what happens when a school later wants to migrate from external site -> platform-built site?
- how do we support school-specific new pages without wrecking maintainability?

## Requested Deliverables

- onboarding workflow for a new school public site
- editing-boundary model (platform team vs school admin)
- page expansion/change request model
- external-site integration model for schools that keep their own site
- recommended operational policy for standard vs premium/custom website requests

## Acceptance Criteria

- [ ] The platform can support schools that keep their own external public website.
- [ ] The platform can support managed creation of a platform-hosted school website during onboarding.
- [ ] The responsibilities of the platform team and school admins are clearly separated.
- [ ] There is a clean path for adding new pages/sections per school without assuming a full custom codebase every time.
- [ ] There is a documented migration path from external school site -> platform-built school site.

## Notes

- This is the operational bridge between product architecture and real onboarding delivery.
- It should stay aligned with T19-T22.
- It should not assume we are building a fully self-serve website builder immediately.
