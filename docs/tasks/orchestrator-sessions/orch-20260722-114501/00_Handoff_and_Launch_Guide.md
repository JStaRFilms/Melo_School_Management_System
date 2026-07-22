# OBHIS + Admissions — External Harness Handoff

**Session:** `orch-20260722-114501`  
**Mode:** Genesis first; Design and Build packets are prepared but **must not launch** until the Genesis review gate is passed.

## Confirmed decisions

1. Stay in this monorepo. Do **not** create a repository per school.
2. Use two implementation worktrees only after the shared foundation is merged:
   - `feature/admissions-platform`
   - `feature/obhis-public-site`
3. A managed school gets a bespoke, code-controlled visual renderer. Its admin can edit approved structured content, not assemble arbitrary layouts.
4. A verified guardian owns one or more paid application slots. One slot may produce one child application, can be resumed, and becomes immutable at submission.
5. An application is not a student. Only an accepted application is converted, idempotently and audibly, into canonical family/student/portal records.
6. The public application link is stable and works from a managed site, an externally hosted school site, or any shared link.

## Existing baseline to respect

- `apps/sites` already resolves hostnames, domains, metadata, and page content, but it currently uses a fixed template/content model in `apps/sites/lib/site.ts` and `site-ui.tsx`.
- `apps/admin`, `apps/portal`, `apps/teacher`, `apps/platform`, and `packages/convex` are shared production surfaces. Do not refactor them opportunistically.
- The supplied source booklet is at `C:/CreativeOS/01_Projects/Clients/OBHIS/Enrollment application form/` (eight photographed pages). Treat facts, contacts, pricing, policy language, and imagery as **unverified source material** until an OBHIS owner confirms them.

## Launch protocol

1. Read this file, `master_plan.md`, the assigned task packet, the current source, and related docs.
2. For every Convex code task, first read `packages/convex/_generated/ai/guidelines.md` in full. It overrides generic habits.
3. Make no changes outside the assigned ownership paths. If a shared schema, manifest, auth surface, or navigation export needs change, record a concrete proposed patch in the task result for the integration owner.
4. Every task returns: changed files, decisions, test commands/results, unresolved assumptions, migration impact, and exact handoff dependency.
5. A task may not silently invent public school claims, pricing, legal wording, required sensitive fields, or payment behavior.

## Worktree and merge protocol

- **Integration owner only:** creates/merges `B0` foundation and `B6` integration commits on the shared integration branch.
- **Admissions worktree:** runs `B1 → B2/B3` serially where files overlap. It owns the new `apps/apply/**`, admissions functions, and admissions-specific admin surfaces.
- **Sites worktree:** runs `B4 → B5` serially. It owns `apps/sites/**` and the explicitly assigned structured-content admin surfaces.
- Never make parallel edits to `packages/convex/schema.ts`, root manifests, generated Convex artifacts, or shared navigation. These are integration-owner files.
- Merge order: `B0`, `B1`, `B4`, `B2`, `B3`, `B5`, `B6`. Rebase each worktree on the last integration commit immediately before its merge request.

## Gates

| Gate | Required evidence |
| --- | --- |
| Genesis review | Architecture/ADR documents resolve lifecycle, security, routes, ownership, and source-material assumptions. |
| Design review | Journeys, field taxonomy, content permissions, and OBHIS IA have explicit approval notes. |
| Foundation merge | Shared contracts/types/schema migration is reviewed and green. |
| Admissions merge | Tenant authorization, entitlement replay, document access, and conversion idempotency tests pass. |
| Site merge | Domain/SEO checks, responsive/a11y checks, and no unapproved school claims pass. |
| Release | Full cross-link, payment webhook, private-file, and conversion E2E flows pass. |
