# PR101 backend-first rollout

The user explicitly authorized deployment of PR #101's additive Convex schema/functions, registration verification, and a merge commit. They confirmed that the Vercel production apps use `outgoing-warbler-782`. This supersedes the earlier report that production deployment was not authorized.

## Confirmed target

- Convex team: `j-star-films-studios`.
- Project: `school-management-system`, project ID `1860901`.
- Deployment: `prod:outgoing-warbler-782`, deployment ID `3060762`.
- Cloud API: `https://outgoing-warbler-782.eu-west-1.convex.cloud`.
- HTTP actions: `https://outgoing-warbler-782.eu-west-1.convex.site`.
- The separate local development target, `scrupulous-chinchilla-25`, was not deployed, migrated or selected for this rollout.

Existing private CLI authentication was used. Only non-secret target metadata was printed. A temporary target file contained only the production deployment identifier. Existing environment files and credential values were not copied. Vercel environment inspection was denied by the cached credential, so production-app target confirmation came explicitly from the owner rather than an invented configuration assumption. No frontend origins were changed.

## Deployment preflight and fix

Frontend builds and TypeScript tests do not validate Convex's runtime classification. An offline equivalent esbuild check found that `functions/sites/providerNode.ts` imported Node DNS/net/TLS/HTTPS APIs without the `use node` declaration. Commit `989651ab3a1547ed70289769501c1c9d92dd375a` adds that declaration and a regression test for deployable Sites modules importing Node APIs.

After correction, the offline check bundled 167 isolate and 13 Node entry points successfully. This was a local equivalent check, not a remote analysis claim. The official Convex deployment dry run then passed against the confirmed production target, including TypeScript and live schema validation. It reported no index deletions.

The deployment command used the exact temporary target file, unset alternate deployment-key/self-hosted selectors, enabled typechecking and disabled codegen to preserve the reviewed generated bindings:

```sh
pnpm exec convex deploy --typecheck enable --codegen disable --env-file <public-target-file>
```

It completed successfully on the confirmed cloud API. Source code revision deployed: `989651ab`. Four additive indexes already present in the merged base code were added:

- `aiGenerationResults.by_attempt`.
- `usageCycles.by_school_and_startAt`.
- `usageCycles.by_school_and_status`.
- `usageOperationAttempts.by_school_and_status_and_updatedAt`.

No seeds, explicit data migrations, accepted file uploads, school publication, DNS changes or Vercel domain operations were run. Schema/index changes were part of the authorized deployment; no index deletion or destructive migration was reported.

## Production verification

Read-only `convex function-spec --prod --file` metadata confirmed the exact regional cloud URL and all 43 Sites functions. The expected content/preview/publication, management, domain/readiness/instructions and public loader functions are registered. Internal storage registration, preview recording, provider-operation reservation/completion, private loaders and preview reads remain internal. Ordinary provider-helper exports are not exposed as RPC functions. No pupil or school record bodies were inspected.

Three unauthenticated negative probes passed on the deployed backend:

| Probe | Result |
| --- | --- |
| Public path with no gateway authority and a synthetic invalid host | `{status: "unavailable"}` |
| Asset byte endpoint without gateway authority | 404, no-store |
| Anonymous empty upload | 403 before storage |

The upload probe sent no usable image and produced no accepted upload. No content/domain mutations or fixture creation were performed during verification.

The final parent-selected suites pass 325 tests: 46 Convex/Sites/foundation/schema tests across 15 files, 13 Sites tests, 9 Admin tests, the 234-test full shared suite and 23 Apply compatibility tests. The runtime-boundary regression, fresh headless synthetic management integration and local TLS tests are included. All six relevant package typechecks, touched-code lint and whitespace checks pass.

## Merge-ready corrections and local configuration

Automatic Codex/Kilo merge-ready reviews produced five threads covering three root defects: public IPv6 classification, unsafe alias-query routing and Unicode upload metadata. Commit `b1684800` corrects these with numeric CIDR/pin checks, terminating proxy denial and a bounded URI-v1 header codec. Legacy raw upload clients remain accepted, including literal percent text. The five matching threads were replied to and resolved after regression verification.

The corrected backwards-compatible backend was redeployed successfully to the same confirmed production target from `b1684800`, before merging frontend changes. No index additions or deletions were reported on that correction deployment. The 43 function registrations and the three production negative probes were reverified. This is the deployed backend code checkpoint, not the latest local correction; `989651ab` above records the initial rollout.

At the owner's explicit request, root and existing touched-app `.env.local` files were copied from the original checkout into this owned worktree without overwriting files. Git ignore was checked first, destinations use mode 0600, no values were printed and no environment file was staged. These files point to development, not the production target. Every production command continues to use the explicit production-selector file and ignores alternate deploy-key/self-hosted selectors. CI does not inherit these local files or need interactive sign-in; it uses its own hosting settings and private deployment authentication.

## Late readiness correction awaiting redeploy

A late PR #101 review of deployed `b1684800` found that its DNS safety check covers every A/AAAA answer, but its trusted TLS/marker probe uses only the first. The local correction on top of PR head `5c09ceeb` probes every advertised public address in batches of at most four and waits for in-flight peers before failing. Its unregistered `probeResolvedTlsEndpoints(ips, probe)` helper accepts a mock transport only in local code/tests; the registered readiness action still accepts no IP, CA, port or probe callback. Every endpoint checks its own handshake against its own pinned HTTPS response. The stored fingerprint represents the first valid leaf while the stored expiry is the minimum across endpoints. See `sites-production-core-merge-ready-fix-results.md` for exact tests and commands. Production remains on `b1684800` until the owner authorizes and performs the same-target backend redeploy; the local fix is not production evidence. No schema or table change is needed.

## Merge and frontend sequence

Backend registration is complete before the frontend merge. The runtime fix and this deployment record must be included in the reviewed PR head. Final application preview checks must be evaluated on that updated head, not the earlier `4bf63c77` successes. Use a merge commit only, then monitor the production application builds and perform read-only verification where access is available. Preserve all worktrees and pushed history.

This document records the backend checkpoint before merge; GitHub's PR and merge record provide the final head and merge status. No fresh application review approval is inferred from a prior review or a skipped advisory check.

## Remaining boundaries

The deployment does not publish OBHIS or configure/activate a real school domain. Its production renderer mapping, fixed field/asset editor additions, real content and photo approvals, gateway/provider settings and domain cutover remain separate work. The refined OBHIS source has its specific ink/coral headline correction; full accessibility and visual approval remain separate.

Authenticated deployed UI E2E was not performed through the Vercel SSO-protected routes. Synthetic headless integration and production registration/negative probes are different kinds of evidence. No live school launch claim follows from this infrastructure rollout.
