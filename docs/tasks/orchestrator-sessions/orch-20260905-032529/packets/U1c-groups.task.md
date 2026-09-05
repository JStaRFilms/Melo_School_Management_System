# U1c — Group governance and proprietor overview

**Execution:** safe local vertical slice implemented and verified; runtime acceptance remains P/G, E0. See [results/U1c.md](../results/U1c.md). No live linking or migration performed.

## Objective / scope
Deliver Platform group creation/linking and a metadata-only proprietor landing page without merging tenant records. Aggregate metrics and default inheritance are separate U1g/U1f packets; no migration or live tenant linking.

## Context / dependencies
U1a/U1b. Read plan/matrix, F2 decisions, D02. `groups.ts` exports listUserBranches, getGroupOverview, listGroupBranches, createSchoolGroup and linkBranchToGroup. Overview returns metadata only; creation assigns caller person as proprietor; there is no safe Platform target-proprietor selection or group list. Overview authorizes any group-branch member for all metadata. These are code gaps, not product questions.

## Ownership
`groups.ts`, proposed Platform `/groups`, Admin `/admin/group`, existing Platform school layout/list group entry only; groups tests. Serialized schema changes. Domain default payloads remain with U2/U3/U1d rather than one untyped settings blob.

## Instructions
1. Add bounded authorized group discovery and explicit reviewed proprietor selection for Platform creation. Never infer owner by email/title or assign the Platform operator automatically. Require confirmation of target HQ/branch and preserve schoolId on every operational record.
2. Initially expose linking to Platform authority per approved rollout; prevent arbitrary proprietor linking of unrelated schools. Keep duplicate link/slug and archived/inactive states explicit and audit statutory ownership/link changes.
3. Provide a metadata-only group landing page with scoped branch navigation. Correct overview visibility rather than treating group membership as blanket branch authority. Aggregate metrics belong to U1g.
4. Publish group/branch/proprietor identifiers and ownership contract for U1f settings and U1g aggregates. Do not build domain defaults or aggregation into this packet.

## Definition of done / verification
Groups convex-test cases cover intended owner, unrelated branch, duplicate/retry, no rekeying, metadata scope and intended proprietor authority. UI has loading/empty/forbidden/conflict/confirm states and accessible navigation. Typecheck and local tests recorded; real linking/membership rehearsal remains gated.

## Artifacts
`results/U1c.md`: group/link contracts, exact ownership, metadata visibility, commands/self-review and screenshot requests. Matrix updated truthfully. No migrations/provider/production/deploy/CLI or credential reads; parent owns review/PRs.
