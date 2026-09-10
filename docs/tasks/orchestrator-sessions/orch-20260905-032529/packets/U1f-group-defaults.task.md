# U1f — Group defaults and branch override contract

## Objective / scope
Establish reusable versioned group-default/branch-override governance for approved domains. Keep domain-specific editors with their owners; no giant settings editor or untyped configuration dump.

## Context / dependencies
U1c/U1d. Read F2/F6 and matrix. Inspected groups.ts returns group/branch metadata only; schoolBranding.ts reads branch branding; settings.ts manages legacy assessment settings. No implemented group effective-settings API was found. Schema entries are not evidence of inheritance.

## Ownership
Proposed `packages/convex/functions/academic/groupSettings.ts`, proposed typed shared `group-settings.ts`, group settings section under Admin `/admin/group`; focused group-setting tests. Group schema/export changes serialized; U1c groups.ts remains stable. U2a/U2c/U3d/U1d own domain consumer/editor adoption after contract lands.

## Instructions
1. Define typed, versioned defaults with explicit allowed branch overrides and effective origin/version for branding, grading colors/bands, role templates, admission templates, report-card templates, notification preferences, academic policies and calendar templates. Reuse actual domain validators/types rather than arbitrary JSON or duplicate policy stores.
2. Server checks proprietor/group-management authority for defaults and explicit target membership + domain capability for branch overrides. Linking alone never grants data or config authority. Validate branch is linked; distinguish inherit, override and reset-to-default.
3. Preserve branch dates for calendar overrides and immutable issued-report/invoice history. Defaults apply prospectively through relevant domain resolution, not tenant-row rewriting or historical batch updates.
4. Provide bounded effective-settings read and safe change preview/confirmation/audit. Publish exact consumer contract; coordinate migrations of caller code only, no data migration. Domain owner must consume the effective resolver before that matrix area becomes complete.

## Definition of done / verification
Tests for group/branch/outsider authority, disallowed overrides, inherited/default/reset state, stale version conflict, calendar date validation and no historical rewrites. UI shows source/version, loading/empty/denied/error/confirmation. Record local tests/typechecks and remaining domain adoption requirements.

## Artifacts
`results/U1f.md`: schema/API/ownership and each domain adoption checklist, tests/self-review, U2/U3 handoff. Update matrix. No production, backfill/migration, deployment, provider, credentials or unapproved CLI/PR operations; parent owns review coordination.
