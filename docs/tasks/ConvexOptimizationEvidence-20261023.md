# Melo Convex optimization evidence, 23 October 2026

## Result and scope

Implemented on `perf/convex-egress-evidence`, based on the clean local `master` commit `94ef195`. No deployment, production function invocation, seed/reset, migration, school data/file deletion, environment change, plan upgrade, job disabling or push was performed. Remote access was limited to authenticated GETs for management metadata and aggregate usage. Credentials and school records were not printed.

The three changes address different costs:

1. Compact class options reduce both serialized client responses and database read dependencies.
2. Sites reuses already-validated assets within one transaction, reducing repeated database reads without changing responses or access freshness.
3. Archives skip unrelated history datasets and narrow material/topic/term/assignment reads. The archive was an expensive individual read, but measured traffic does not make it the dominant monthly cause.

Existing full `listClasses`, archive arguments/response fields, Sites DTOs, scoring locks, billing/results and file authorization remain intact. No indexes, dependencies or schema changed. No cross-request cache was added.

## Verified environments

Management metadata verified these exact names, project `1860901`, School Management System, slug `school-management-system`, region `aws-eu-west-1`. Team `428903` was independently matched to `j-star-films-studios`.

| Purpose | Deployment | Management API type | Configuration evidence |
| --- | --- | --- | --- |
| Production | `outgoing-warbler-782` | `prod` | Saved Vercel Production profile has matching cloud/site URLs |
| Copied-data Preview | `expert-giraffe-253` | `prod` | Preview workflow and saved Preview profiles agree |
| Normal development | `scrupulous-chinchilla-25` | `dev` | Root `.env.local` and Admin/Teacher/Portal/Platform/Apply/WWW local profiles agree |
| Isolated synthetic QA | `content-poodle-172` | `dev` | `.env.e2e.local` and QA guidance agree |

Each cloud URL is `https://<name>.eu-west-1.convex.cloud`; the matching site URL ends in `.convex.site`. Saved local profiles are not proof of the current Vercel environment or deployed source revision.

`convex.json` selects `packages/convex`. Browser apps use their configured Convex clients. Sites uses server-only `CONVEX_URL`, `CONVEX_SITE_URL` and its gateway secret in `apps/sites/core/gateway.ts`. A local production-mode build does not select the Production backend automatically. All inspected local app profiles pointed to normal development, not QA.

The existing Preview worktree and private rollback archives were left untouched. Preview and local master have different source tips. A later release must compare the exact feature commit set rather than merge unrelated ancestry.

## Refreshed usage and attribution limits

The initial coherent October aggregate refresh during this pass returned:

| Metric | Raw value |
| --- | ---: |
| Data egress | 860,004,463 bytes |
| Database I/O | 578,031,809 bytes |
| Function calls | 73,174 |
| Action compute | 0.6764 GB-hours |
| Database storage | 78,026,303 bytes |
| File storage | 71,428,494 bytes |

The egress total is about 820.16 MiB. Dashboard labels can use MB for binary-sized units, so raw bytes are retained here.

| Egress category | Bytes |
| --- | ---: |
| User Function Reads | 525,184,402 |
| File Serving | 179,490,828 |
| Backup / Restore | 129,151,800 |
| Outbound fetch | 26,177,433 |

Backup/restore consisted of 110,415,697 snapshot-export bytes and 18,736,103 snapshot-import bytes. It is not a query-response optimization opportunity in this patch.

A later summary refresh returned 860,078,087 egress bytes, 578,386,370 database-I/O bytes and 73,242 calls. Usage continued during the investigation; this is not a measured effect of the local patch.

### What the function table establishes

The dashboard function breakdown exposes `databaseEgressSize` as internal database-read bytes and `dataEgress` as fetch egress. It does **not** provide per-function client-response bytes, subscription delivery bytes or a complete breakdown of the User Function Reads category.

| Function | Deployment type | Calls | Internal read bytes |
| --- | --- | ---: | ---: |
| `sites/public:publicAtTime` | prod | 1,086 | 172,419,366 |
| `sites/public:assetAtTime` | prod | 623 | 75,395,029 |
| `academic/academicSetup:listClasses` | prod | 822 | 42,566,205 |
| `academic/studentEnrollment:getClassStudentSubjectMatrix` | prod | 1,183 | 42,269,679 |
| `academic/qaInspectionData:inspectQaFixtureInternal` | dev | 133 | 42,224,450 |
| `academic/academicSetup:listClasses` | dev | 404 | 16,817,819 |
| `academic/lessonKnowledgeTeacher:listTeacherPlanningTopicWork` | prod | 54 | 12,126,863 |
| `portal:getWorkspaceData` | prod | 464 | 8,076,131 |
| `academic/archiveRecords:listArchivedRecords` | prod | 1 | 1,330,727 |

The four admin selectors together read only 256,839 prod-class bytes. Their DTOs were already small. They were not changed.

The function rows totalled 447,719,196 internal read bytes for `prod` and 108,951,994 for `dev`, including system-job rows and the table's remainder handling. These are deployment-type aggregates, not individually attributed deployments.

**Important limitation:** Preview is also classified as `prod`. Supplying `deploymentName=outgoing-warbler-782` or `expert-giraffe-253` to the function-breakdown endpoint returned identical 328-row results, including dev rows. Supplying each of the four deployment names to the summary endpoint also returned identical totals. Those endpoints ignored the selector for these datasets. No outgoing-warbler-only attribution is claimed. The metadata endpoints did distinguish deployment identities correctly. The Production resource-insight query for 20-23 October returned no rows; that does not prove low usage.

`sites/domainActions:maintenanceCheck` accounted for 24,699,393 fetch-egress bytes across prod-class rows, about 23.56 MiB. Its table is not the User Function Reads total. Its cadence remains unchanged.

### Reproduction of the read-only telemetry

Used existing local CLI login material only inside the process, never as command arguments or printed output. Requests were GETs to `https://api.convex.dev`:

- `/v1/deployments/<exact-name>`, `/v1/projects/1860901`, and `/api/teams` for identity.
- `/api/dashboard/teams/428903/usage/query` with `projectId=1860901`, `from=2026-10-01`, `to=2026-11-01`.
- Summary query ID `b63fe48d-320c-401a-8682-0a0b36b50e2b`.
- Egress categories query ID `67ce838f-b2d0-4cda-9a2e-580c6d134466`.
- Function breakdown query ID `76c86baa-418e-4d7f-ac21-46f397030595`.
- Database I/O query ID `9f606f77-521d-44bb-83ef-b1057b0fb1c9`.

Mappings were checked against the public Convex dashboard `hooks/usageMetrics.ts` source. These internal dashboard query IDs are evidence of this investigation, not a supported application API. Do not add them to Melo runtime code or use an unverified selector for writes.

## Implemented changes and affected workflows

### Compact class options

`packages/convex/functions/academic/academicSetup.ts` adds `listClassOptions`, with the same academic-context membership and admin checks as the full list. It returns every active class as `_id`, normalized `name`, `level` and `gradeName`, with the same numeric display ordering. Both omitted and explicit-false archive flags remain active.

These option-only consumers now use it:

- Student onboarding.
- Admin knowledge library.
- Instruction templates.
- Curriculum readiness.

Dashboard, class management and roster consumers retain full `listClasses`. Their staff projections, subject names and enrollment counts are unchanged. Options no longer read pupil collections, class-subject offerings, form-teacher assignments or subject documents. Their database dependencies therefore no longer include those tables. Actual subscription recomputation/delivery counts were not measured.

### Transaction-local Sites asset reuse

`functions/sites/shared.ts` returns asset documents that `validatePublication` already validated. `functions/sites/public.ts` uses those local documents for DTO construction and requested-asset resolution instead of repeating `approvedAsset` reads.

Every invocation still validates current domain readiness, the complete publication and digest, checksum/storage metadata, reviewer independence, current approval evidence and child consent. There is no global map, TTL, retained authorization or cross-school cache. `streamWebsiteAsset` still runs separate fresh authorization queries before and after reading its blob. The five-minute maintenance sweep and fifteen-minute readiness limit are unchanged. Public responses do not acquire storage IDs, approval records or private evidence.

### Conditional archive history reads

`functions/academic/archiveRecords.ts` first reads its seven base datasets. Supporting terms, assignments, selections, offerings and assessments are loaded only when an archived record type uses them. Archived materials use the existing review-status index. Terms and teacher assignments use existing session/teacher indexes with school checks. Only distinct material-referenced topics are fetched, and foreign-school topics are rejected.

No archive record, linked-history field, client-side search input or summary count was removed. Mixed archives still read assessments when required and preserve scoring-lock redaction. Large mixed archives remain a candidate for a separate pagination/detail design; this patch does not truncate them.

## Synthetic before/after evidence

Reproduce with:

```sh
pnpm --filter @school/convex exec vitest run functions/academic/__tests__/classOptions.test.ts functions/sites/public.optimization.test.ts functions/academic/__tests__/archiveRecords.optimization.test.ts
```

The test-only reader proxy counts database query/get calls and returned-document read occurrences, including repeated reads and authentication. JSON document bytes approximate the size of returned stored documents. They are **not** Convex transaction metrics, index bytes, scanned-filter bytes, network framing, cache behavior or billed production usage. `_creationTime` formatting can move the JSON-byte proxy slightly between runs.

| Synthetic case | Database query + get calls | Returned-document occurrences | JSON document-byte proxy | Serialized response bytes |
| --- | --- | --- | --- | --- |
| Class options, before | 50 + 176 = 226 | 703 | about 184,000 | 6,367 |
| Class options, after | 16 + 12 = 28 | 31 | about 13,000 | 1,303 |
| Sites public page, legacy-equivalent | 23 + 16 = 39 | 38 | about 18,370 | 1,364 |
| Sites public page, after | 14 + 10 = 24 | 23 | about 11,361 | 1,364 |
| Sites requested asset, legacy-equivalent | 15 + 12 = 27 | 27 | about 13,499 | 72 |
| Sites requested asset, after | 12 + 10 = 22 | 22 | about 11,169 | 72 |

The class fixture has twelve active classes, twelve subjects per class and thirty pupils per class, plus archived/foreign classes and reviewed memberships. The test runs the unchanged full list and the new compact list against the same data and compares all consumer-needed fields and ordering. Response reduction is 79.5%; returned-document occurrences fall 95.6%. These percentages are fixture-specific.

The Sites fixture has independently reviewed hero, favicon and social-share assets with child consent. The before case explicitly reproduces the old post-validation asset rereads on top of the new query. It is a **legacy-equivalent read model**, not an old deployed binary. Page document occurrences fall 39.5%; requested-asset occurrences fall 18.5%. Response bytes remain identical. No production egress reduction percentage is inferred from these internal-read improvements.

Archive tests prove zero assessment/selection/offering/assignment/term/topic queries for empty and event-only archives, versus the old unconditional thirteen-table data load. Seven base dataset queries remain, excluding authentication and scoring-job checks. Material-only tests check topic deduplication/tenant denial, and mixed tests check exact history counts and lock redaction. No production-wide archive saving is extrapolated from its one observed call.

## Validation and focused review

Passed:

- Fourteen backend test files, 70 distinct tests across focused runs, covering archive optimization, compact selectors, academic setup, branch selectors, authorization remediation, session scoring, Sites publication/access/activation, domain lifecycle/freshness, mocked provider actions and probes.
- Four Admin test files, 25 tests, covering onboarding retries and atomic admission fields, upload UI and instruction templates. The onboarding test explicitly rejects mounting the full class query in the standalone page.
- `pnpm --filter @school/convex typecheck`.
- `pnpm --filter @school/admin typecheck`.
- `pnpm --filter @school/sites typecheck`.
- `pnpm --filter @school/admin build` and `pnpm --filter @school/sites build`.
- ESLint on all thirteen changed/new TS/TSX files, zero errors. One existing unused `Sparkles` import warning in curriculum-readiness remains untouched.
- `git diff --check`.
- `node scripts/audit-theme-colors.mjs`, informational. Touched-file amber colors are semantic warning UI; emerald is an existing semantic readiness indicator. The audit also reports unrelated previous-commit files because its base is `HEAD~1`. No colors were replaced.

The first cold baseline academic-setup test run exceeded its existing fifteen-second timeout. Subsequent dedicated and combined runs passed without changing its timeout or assertions. Initial new-test failures were a mistaken expected display-name separator and test-only typing issues; both were corrected, followed by successful tests/typechecks. Build warnings concern stale Browserslist data, not this patch.

One parent review checked the actual diff for completeness, authorization ordering, optional archive flags, scoring locks, Sites revocation/expiry/consent/kind/ownership, private DTO leaks and deployment compatibility. The OpenCode completion message alone was not used as acceptance. The final simplification removed an obsolete Sites catch and replaced a broad test-handler cast with one checked test-only runtime boundary.

No Playwright global setup or QA browser command was run. The inspected root Playwright setup can seed/reset a demo tenant. No backend was deployed, so the unchanged live QA/Preview backend cannot attest this source revision. Real-browser and live-production acceptance remain unverified. Local builds and in-process Convex tests are not a substitute for that later acceptance.

## Remaining work, ranked

| Priority | Work | Likely benefit and evidence | Risk |
| --- | --- | --- | --- |
| 1 | Reduce remaining Sites publication work per request without weakening freshness | Largest internal-read functions remain. Each image still validates the complete publication; middleware, metadata and page paths also resolve the site. Measure request-level calls before changing it. | Medium/high. Cross-request caching or removing whole-publication validation could retain revoked content. React cache availability must be checked against the installed runtime. |
| 2 | Separate portal shell viewer from `getWorkspaceData` | Layout needs viewer name/role but mounts the full workspace on every portal route. Workspace content passes additional history/time arguments, so these are not necessarily identical cache keys. About 8 MB internal prod-class reads were observed for the function. | Low/medium. Preserve selected-student membership and role semantics. Never claim identical hooks always duplicate backend executions. |
| 3 | Optimize remaining full `listClasses` counts and repeated subject reads | Full consumers still need details. Existing measured prod-class reads were 42.6 MB before moving option-only views. Profile the residual mix first. | Medium. Accurate counters/aggregates require all writes to update them atomically. More indexes/counters have storage/write cost. |
| 4 | Portal source-proof previews and class-scoped material bindings | Source proof reads up to 100 text/search-text chunks to display two; bindings scan other classes despite an existing material/class index. Strong per-view waste; total traffic contribution unmeasured. | Low/medium. Keep page summaries for callers that need them, preserve file denial and test matching bindings beyond the old first twenty rows. |
| 5 | Teacher planning topic-work summaries | 12.1 MB internal reads in only 54 prod-class calls. It hydrates materials, artifacts and banks to form summaries. | Medium. Access filtering and complete summary semantics must survive narrower reads. |
| 6 | File transfer sizing | File serving was 179.5 MB. Identify largest files and repeat downloads through aggregate metadata, then test image sizing/upload compression. | Medium. Existing private/no-store proxies preserve per-request revocation. Do not introduce public caching or rewrite existing files without approval. |
| 7 | Lightweight QA attestation reads | Dev QA inspection accounted for 42.2 MB across 133 calls. Distinguish necessary verification from repeated full-fixture inspection. | Low/medium. Do not weaken backend/source/fixture attestation or disable QA jobs. |
| 8 | Archive pagination and lazy history | One call read 1.33 MB. Improved now, but mixed archives can still be large. Lower monthly priority than measured Sites/class paths. | Medium. Current search includes history/detail text; pagination must update search, filters and every consumer together. |

Do not slow domain checks as a shortcut: the current bounded sweep is every five minutes and public readiness fails closed at fifteen. Do not disable draft expiry, admissions retention or backups. Shared autosave already debounces for one to two seconds, skips identical serialized payloads and serializes in-flight saves; no per-keystroke-write defect was established.

## Later release action, not performed or authorized here

The patch requires a backend deployment to affect usage. Local edits alone save no production traffic.

1. Obtain explicit approval for each intended backend target. Compare the full release source/schema against what is actually deployed. Do not blindly deploy this checkout, since its base may contain other undeployed work. Preserve current function/source revision and rollback artifacts without adding an unapproved export/backup.
2. With separate approval, verify first on synthetic QA `content-poodle-172` using its exact cloud/site URLs and deployment-specific credentials. Do not seed/reset data. Exercise the four option-only Admin paths, full dashboard/class list, mixed archive/restores and scoring locks, approved Sites pages/assets, and synthetic denial/revocation cases. No outbound payments/email/provider writes are needed.
3. If using copied-data Preview, separately approve exact target `expert-giraffe-253`, not merely deployment type `prod`, and follow `docs/testing/PreviewWorkflow.md`. Do not run the synthetic QA runner there.
4. Production target must be exactly `outgoing-warbler-782`, cloud `https://outgoing-warbler-782.eu-west-1.convex.cloud`, site `https://outgoing-warbler-782.eu-west-1.convex.site`, project `1860901`, team `428903`. Deploy only the reviewed backend change set after approval. No index rollout, migration or environment setting is needed.
5. Deploy the matching Admin frontend **after** the additive backend query is available. Old frontend works with the new backend. A new Sites frontend deployment is not required by this patch; its backend resolver behavior changes with the backend release.
6. Compare fixed before/after windows normalized by requests/users. Capture internal reads separately from delivered response/subscription bytes and file/fetch categories. Monthly cumulative totals alone cannot demonstrate savings. Watch denied Sites responses, dropdown loading, archive counts and authorization failures.
7. Roll back the Admin hook changes/frontend first if needed, restoring the full-list calls. Then restore the reviewed previous backend revision or revert only this patch on the current release base. Rolling the backend back first would leave new clients calling a missing `listClassOptions`. Keep data, files, evidence, domains, jobs and configuration unchanged. Confirm the same exact target before rollback.
