# Managed website access provisioning

## Goal and scope

Provide the missing initial permission setup for a managed school website. Existing website operations continue to require same-school membership and explicit `schoolCapabilityGrants`. Neither a school-admin label nor platform-admin status grants editing, review, or publishing access.

The reviewed implementation was deployed to Production `outgoing-warbler-782` with explicit owner approval. Access provisioning remains disabled. Deployment does not authorize grant changes, content publication, domain changes, activation, or Preview operations.

## Operational bootstrap boundary

The initial grant cannot satisfy ordinary delegated grant management because a new school has no grant manager. This feature defines a narrow operational bootstrap exception to the foundation contract, not a generic replacement for delegated access management.

An active platform operator must authenticate through the existing token-first identity resolver and explicitly confirm the target school's slug. `SITES_ALLOW_ACCESS_PROVISIONING` must equal `enabled`. Keep that deployment-owned flag off except during an independently approved setup or revocation window.

The only assignments are fixed, school-scoped packages with a reason and an expiry no later than 30 days from setup:

| Package | Capabilities |
| --- | --- |
| Editor | `settings.view`, `settings.manage`, `site.preview` |
| Reviewer | `settings.view`, `privacy.approve`, `site.preview` |
| Publisher | `settings.view`, `site.preview`, `site.publish.standard` |
| Domain requester | `site.domain.request` |

Sensitive publishing adds `site.publish.sensitive` only when separately selected for a publisher. Website images count as sensitive publications. The separately selected domain-requester package can request a school's hostnames and read its verification instructions, but cannot edit, review, publish, attach provider domains or activate traffic. It is used only for an explicitly approved domain launch. No package grants admissions operations, provider-write authority, `site.revert`, or `grants.manage`.

The existing names `settings.manage` and `privacy.approve` are shared capabilities. This setup does not redefine them as website-exclusive permissions. It only limits which capabilities this operator workflow can issue.

Recipients must be unarchived staff members of the active target school, with a canonical auth token identifier. Duplicate or ambiguous school identities, the operator's own identity, conflicting reviewer/publisher identities, and existing active overlapping grants are rejected. Setup never renews or extends a grant. Expired access requires a new explicitly approved setup. The actual reviewer remains independent of the publishing identity; content approvals, image rights and consent are never supplied by this setup.

## Components and data flow

There is no new frontend page. An authenticated operational client calls `functions/sites/access:configureAccess`, which accepts only the fixed provision/revoke request union. The action checks the operator and enable flag, then invokes the corresponding internal mutation with the authenticated identity propagated by Convex. Each internal mutation rechecks the boundary and owns its transaction.

Provisioning validates school, managed profile, recipient, bounded existing grants, role, reason, confirmation and expiry. It inserts the exact package and one `schoolSiteAuditEvents` entry atomically. Authorization continues through `functions/foundation/auth.ts`; no website content endpoint changes.

Revocation names one exact operational grant and the school slug, verifies its provenance, and records the real platform revoker and reason in the audit transaction. It never deletes records or revokes legacy school-issued grants. Repeating revocation does not change the original revocation record.

## Schema and compatibility

`schoolCapabilityGrants` becomes a union:

- The existing school-issued shape remains unchanged, including its required `grantedByUserId`.
- Operational site grants require `provisioningSource: site_operator`, `grantedByPlatformAdminId`, `siteAccessRole`, school scope, a finite `expiresAt`, and `isBreakGlass: true`. They do not have a fabricated school-user grantor. Operational revocation can add `revokedByPlatformAdminId`.

Common school, user, capability and revocation fields and all existing indexes remain compatible. The schema coverage registry must derive its changed references and fingerprint from the exported validator. Existing audit fields and the `grant_changed` event are reused.

## Verification and release

Use synthetic `convex-test` fixtures and the actual authenticated action-to-internal-mutation flow. Cover default-off, authentication, school isolation, identity ambiguity, role packages, expiry, self-provisioning, duplicate/extension denial, independent review, exact revocation and audit records. Run the existing Sites, foundation and schema coverage regressions and backend typecheck.

Do not use `--push`, remote codegen, a fabricated identity, direct database insertion, or a production call to validate this local implementation. A later release must review the schema union and operational exception, confirm the exact deployment and real staff identities, approve a bounded setup window, then turn the enable flag off again. No setup assigns `grants.manage`, so it cannot bootstrap a standing delegation chain.

### Local verification results

- All six new access integration tests pass, including the authenticated action-to-internal flow, default-off/authentication denials, exact packages, recipient isolation, duplicate identities, synthetic image upload, independent review, explicit sensitive publishing, expiry and exact revocation.
- Sites backend, foundation and schema-coverage checks pass, 53 tests in 14 files, using `--exclude '**/browser-bridge.test.ts' --testTimeout=15000`. The first full run hit the existing Olive publication test's five-second timeout; its assertions pass under the command-line timeout override, with no test-source changes.
- Direct Convex and shared typechecks pass. Focused ESLint passes with zero warnings; whitespace checks pass.
- The browser bridge remains unverified on Windows. It timed out before finding the synthetic provisioning button. Its unchanged Vite root calculation strips only forward-slash `/packages/convex` from `process.cwd()`, which uses backslashes here. This implementation does not change that test harness.
- Root `pnpm typecheck` also builds unrelated applications and failed in the local Teacher build with a missing `.next/server/app/_not-found/page.js.nft.json` trace. No Teacher source changes were made. This is not a successful workspace-wide check or an observation about Preview.
- One independent implementation review reported no confirmed security or correctness blockers. No remote credentials, deployment, grant changes, publication, DNS or Preview operations were used for local implementation verification.

### Production deployment checkpoint

Owner-approved deployment used an explicit selector file for `prod:outgoing-warbler-782`, with TypeScript enabled and code generation disabled. Schema validation passed; no indexes were deleted. Post-deployment metadata confirms public `configureAccess`, internal `provision` and `revoke`, and the existing `rotateKeysForStaticConfig` still internal. The source is checkout `d2ba632a09776e43684a99b4739885974790e094` plus the reviewed, uncommitted access implementation, not a new Git commit.

An earlier CLI process-environment override did not select Production. The four Sites connection settings had been stored on Development `scrupulous-chinchilla-25`; the owner was informed and explicitly authorized correction. The four values were copied to verified Production, checked privately for equality, removed from verified Development, and checked again. Use explicit `--prod` for supported metadata/environment commands; do not rely on a process `CONVEX_DEPLOYMENT` override in this checkout. Deployment uses its explicit selector file.

Production now has the four connection settings, while Development has none of those task-created copies. `SITES_ALLOW_ACCESS_PROVISIONING` and `SITES_ALLOW_PROVIDER_WRITES` remain off. No actual staff grants, frontend deployment, content publication, domain activation, DNS changes or Preview operations occurred. The broader local verification limitations above remain unresolved.
