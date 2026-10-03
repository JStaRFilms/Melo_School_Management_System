# Production school-site core implementation plan

Status: user approved the schema and evidence rules; implementation and local synthetic verification are complete. Two independent review lanes and final focused review produced security corrections, now covered by regression tests. OBHIS transfer and actual hosting configuration remain external prerequisites. No real school publication, production deployment, migration or DNS/provider mutation occurred. See `sites-production-core-readiness.md` for the final check results and PR handoff.

## Repository and isolation

- Repository: `JStaRFilms/Melo_School_Management_System`.
- Owned worktree: `/Users/toji/Documents/johnsax/sites-production-core`.
- Owned branch: `feature/sites-production-core`.
- Starting base: current local `master`, `d21e76647be62c22cd67a21c850cef78fba9925e`.
- Remote master observed through `git ls-remote`: `5d854e2c30a4cdb68e55d94ffea053597e6eb8bf`.
- Local master is 62 commits behind and two commits ahead of that remote history. The local-only commits are `130c0be6`, admissions redesign mockups, and `d21e7664`, guardian intake presentation. They remain preserved.
- User approved fetching and merging `origin/master` into this owned branch. Completed without conflicts as merge commit `dd88f551dcbdbcdff97519a3db2670d22a7d4310`. The original master worktree and every other worktree remain unchanged.
- User confirmed OBHIS is on another computer. `_w/obhis-website`, its requested review documents, and `feature/obhis-website` are absent here and on the remote. Recommended transfer: push its code and documents after excluding secrets/private image bytes, then fetch for read-only inspection. Backend work can proceed independently; exact renderer integration cannot be certified until that transfer. Do not substitute `feature/obhis-public-site` or fabricated static OBHIS content.
- No environment files were copied or secret values inspected. Global model routing only. Audit subagent used synchronous Sol High.

## Sources read

- Applicable root and global `AGENTS.md` instructions.
- `docs/project_requirements.md`.
- `docs/decisions/ADR-009-shared-core-bespoke-school-sites.md`.
- `docs/features/SharedCoreBespokeSchoolWebsiteArchitecture.md`.
- `docs/tasks/orchestrator-sessions/orch-20260722-114501/pending/B4_site_core_structured_content.task.md`.
- `docs/features/SchoolContentAndAdmissionsSettingsUX.md`.
- `docs/features/AdmissionsAndSiteFoundationContract.md`.
- `packages/convex/_generated/ai/guidelines.md`.
- Implemented site routes/proxy, foundation validators, capability checks, application-link resolver and site schema.
- Read-only architectural audit of admin/platform patterns, test scripts and hosting evidence.

The four requested OBHIS areas have not been inspected because their worktree is unavailable. Their inspection is a prerequisite for an exact integration packet.

## Actual gaps

| Area | Existing implementation | Required work |
| --- | --- | --- |
| Site identity | Additive `schoolSiteProfiles`; existing schools need no profile | Profile management, school ownership, renderer selection by platform delivery only, default-deny public loading |
| Content | `schoolSiteRevisions` with semantic field values and SEO entries | Bounded validators, manifest validation, optimistic draft saves, authenticated preview, atomic immutable publication, revert by clone |
| Permissions | Membership resolver and explicit school/programme/intake capability grants | Enforce same-school objects and school-wide site grants on every operation; keep platform domain ops separate from content publishing |
| Approvals | `schoolApprovalEvidence` with class, subject, expiry and revocation | Bind evidence to the specific facts/content digest or asset; enforce current identity and sensitive-public evidence independently from publisher authority |
| Assets | Separate site asset table with storage, rights and expiry | Website-only upload provenance, review/consent evidence, private preview placeholders, gated public delivery, expiry and revocation checks |
| Domains | Hostname index, lifecycle enum, token hash, canonical references | Transactional uniqueness, real TXT checks, provider routing/certificate checks, evidence freshness, activation, alias handling, suspension and retirement |
| Renderer | Static template catalogue and shared page components | Separate core and compiled exact-key/schema registry; no fallback; validated read-only production context |
| Links | `ApplicationLinkV1` and foundation resolver | Consume its `href` and availability; preserve `/s/{schoolSlug}` and optional intake convention; managed `/apply` redirect; conditional approved portal destination |
| SEO | Static metadata, robots, sitemap and JSON-LD helpers | Published routes/timestamps, deployment-owned HTTPS canonical, non-indexable denied/preview states, safe typed structured data |
| Management | Operational branding/settings and platform school-management patterns | Scoped site-content/publishing/domain screens, no generic page builder or unrelated redesign |
| Hosting | Next.js app and provider-neutral planning; no confirmed sites provider integration | Confirm provider and operator responsibilities before implementing its actual API and status handling |
| OBHIS | Fabricated legacy object in current sites catalogue | Exclude it entirely; inspect private review and renderer contracts elsewhere without changing their worktree |

The implemented revision envelope is `fields: [{ fieldId, value }]` plus `routeSeo`. Its field union includes `text`, string-backed `rich_text`, `boolean`, `link_intent`, `asset_ref`, and `string_list`. The architecture's sample interfaces are not existing APIs. A string-backed rich-text value must either parse into a strictly bounded approved AST or be rejected by the registered field schema. Raw HTML is not a supported interpretation.

The current application-link and capability queries use wall-clock time. Time-sensitive website decisions must be server-fresh and must not accept a public caller's fake time as authorization. Prefer authenticated/server-timed actions with atomic internal checks, or materialized expiry state and scheduled mutation invalidation. Any small shared resolver change needs an explicit integration boundary and backwards-compatible tests; do not broaden this into admissions lifecycle work.

## Proposed choices requiring approval

1. Integrate current remote master into the new owned branch by merge commit. Do not reset or rebase any branch.
2. User confirmed Vercel. Inspected its current official OpenAPI at `https://openapi.vercel.sh` without credentials. Build one Vercel integration using actual project-domain/configuration APIs. Team/project identities may be placeholders for mocked development, but must be confirmed before live checks or activation.
3. Use existing school capabilities for content actions and the existing authenticated platform-admin pattern for profile/renderer provisioning and domain operations. School editors request domains; school DNS owners change records; platform operators verify readiness and approve activation. Platform status alone does not permit school fact or photo approval.
4. Keep previews authenticated and same-school. No anonymous share tokens in this pass. Keep production context separate from `PrivateReviewContext`.
5. Add only the schema fields needed for durable ownership/routing/TLS observations, challenge presentation/rotation/expiry, operator audit identity, child-consent applicability/evidence/expiry, and publication evidence policy. Existing domain status and token hash alone cannot prove all activation checks; existing asset fields do not express whether child consent is required. Preserve all existing school and foundation rows.
6. Accept only `primaryColor` and `accentColor` tenant configuration. Derive other tokens with `@school/shared/theme`; update contradictory illustrative brand-role documentation.
7. Use a small code-owned managed renderer to exercise the full production path with synthetic approved content. This is not a fallback and does not register `obhis-v1` before its actual schema is inspected. Retain only confirmed demo tenants in an explicit legacy allowlist; never include OBHIS.

The user approved `docs/tasks/sites-production-core-schema-proposal.md` with "Approve and proceed". The implementation also adds a bounded optional provider-operation reservation to address the verified external-write race. Actual APIs and operational limits are recorded in the handoff and operator documents. Provider choice determines the domain observation fields and instructions. Child-image absence must not be assumed from missing legacy fields; missing applicability/evidence must deny publication where imagery could contain children.

## Ownership

| Owner | Paths and responsibilities |
| --- | --- |
| Production backend coder | `packages/convex/functions/sites/**`, site backend tests, only approved additive site schema/validator changes and generated API reconciliation |
| Shared site-core coder | `apps/sites/core/**`, thin request routes, proxy/domain routing, SEO, gated asset routes, compiled registry and explicit legacy adapter |
| Management workflow coder | Assigned `apps/admin/app/admin/settings` site subroutes/components and a scoped platform school-site/domain view using existing auth/navigation patterns |
| Integration owner | Shared contract exports if needed, exact compatibility changes to foundation helpers, generated types, package dependencies and deployment/environment documentation |
| OBHIS branch | `apps/sites/renderers/obhis-v1/**`, its private local review fixture/context/route and visual design. Read-only here. No private images are copied |
| Focused reviewers | Read-only backend/authorization/domain review and read-only core/SEO/OBHIS-boundary review in one consolidated round |

Run artifact-producing subagents synchronously and one writer at a time in this worktree. Every subagent targeting it receives its explicit absolute `cwd`. No project-local model routing files are created.

## Implementation sequence

### 1. Settle prerequisites

Approve this plan and choices, integrate the base if authorized, locate and inspect OBHIS, confirm provider/operator ownership, then write the exact schema and public/preview DTO contract. Inspect any additional applicable instructions in the OBHIS worktree without changing it.

### 2. Implement publication and assets

- Enforce active membership and explicit school-scoped capabilities. Check the school ownership of every profile, revision, asset, evidence and domain reference.
- Provision managed profiles only through platform-delivery controls; no missing-profile fallback.
- Save bounded drafts with expected-version checks. Reject unknown semantic fields, duplicate fields, executable input, arbitrary HTML/CSS/scripts/module paths, route construction and page-builder data.
- Validate against the exact compiled renderer/schema descriptor on draft validation and publication. Backend publication and frontend loading must use matching code-owned manifests, not separately guessed schemas.
- Preview only after authenticated `site.preview` authorization, with noindex/nofollow, a watermark, no canonical and no sitemap. Pending/private assets have placeholders, not public URLs.
- Publish in one transaction: authorize, validate current evidence/assets/links/content, insert an immutable revision, update the public pointer, audit. A draft save never changes public output.
- Revert clones an owned historical publication into a new draft. Revalidate before republishing; never mutate history.
- Accept site uploads only through the website-specific workflow and verified upload/storage provenance. Reject student/admissions storage reuse. Validate supported non-executable MIME/signature/size and meaningful image alt/decorative data.
- Gate public asset bytes through a first-party delivery route that rechecks school, current publication reference, rights, review, consent and expiry. Do not expose raw storage IDs or reusable private upstream URLs.
- Start with uncached/no-store public availability and asset checks. Any later caching must have a documented expiry bound and suspension/publication invalidation; correctness comes before caching.

### 3. Implement provider-backed domains

- Normalize ASCII hostname, trailing dot/case and permitted port handling. Deny malformed URLs, credentials, wildcard inputs, loopback/private/reserved production hosts and duplicate host ownership.
- Issue a bounded expiring random ownership challenge; verify authoritative DNS evidence server-side. UI acknowledgment never sets verified state.
- Use the confirmed provider's actual add/check/status endpoints and project ownership, with mocked API behavior in tests. Accurate apex/subdomain routing records come from verified provider configuration/API responses, not invented IPs.
- Keep ownership, routing and TLS observations distinct and fresh. Prevent stale asynchronous check results from activating a rotated, suspended or retired domain.
- Activation requires an active school, managed profile, current valid publication and exact renderer, fresh ownership/routing/TLS checks and operator-approved cutover.
- Enforce one active canonical host transactionally. Active aliases refer to that same school's canonical record. Suspension/retirement immediately deny public pages, SEO, assets and redirects where appropriate.
- Use normalized actual Host with deployment-configured trust rules. Never derive canonical scheme or tenant identity from arbitrary forwarded headers. Production canonical origins use HTTPS.

### 4. Wire site rendering, links and SEO

- Load public data by the approved hostname and immutable publication pointer only. Treat backend failures, invalid references, unknown renderer/schema, unavailable publication/assets and unready domains as unavailable.
- Construct and deeply freeze or equivalently protect the validated read-only production context. Renderers receive approved URLs/link projections, not persistence clients or internal evidence.
- Preserve valid allowlisted paths and safe query parameters in canonical HTTPS 308 alias redirects. Unknown routes do not redirect to home. `/apply` temporarily redirects to the available canonical `ApplicationLinkV1.href` and never embeds/proxies admissions.
- Show portal links only from deployment-owned approved configuration and current school availability. Content cannot set origins.
- Generate canonical metadata, robots, sitemap publication timestamps and safe structured data from the published manifest. Preview and denied states are non-indexable.
- Keep analytics disabled unless an explicitly approved code-owned adapter exists. No admin scripts, sensitive events or unbounded query capture.
- Keep demos behind an explicit allowlist and OBHIS's development-only review route production-disabled after branch integration.

### 5. Implement operator and school workflows

Use existing settings/platform UI components for typed draft editing, conflict preservation, validation and publish review, authorized preview, publication history/revert, pending-rights assets, evidence selection and domain request/status. Platform controls provision renderer profiles, invoke real checks and activate/suspend/retire hosts. Do not redesign operational branding, admissions or unrelated navigation.

### 6. Verify and document

Run focused synthetic tests first, then relevant typechecks, lint, builds, local configured integration and fresh headless browser checks. External provider behavior is mocked. No seeds, migrations or deployment commands target a remote environment. Local runtime work must confirm its synthetic backend target before writing fixtures.

Produce actual-implementation architecture updates, environment/hosting instructions, the domain operator guide, rollout order, merge plan and exact OBHIS adapter packet.

### 7. Review and PR

Use two independent focused reviews in one consolidated round, fix confirmed blockers in one correction pass, then final verification. Avoid optional cleanup and endless reviewer rounds.

The user's closing instruction authorizes pushing the completed branch, opening a well-described PR, requesting `@codex review`, and monitoring/replying to actionable review feedback and checks. It does not authorize merge, deployment, real DNS mutation, migration or production publication. Confirm what Vercel/hosting previews a push will trigger and that they cannot deploy backend changes or mutate live domains. Initial and final preview rounds follow the babysit-pr policy; no claim of preview readiness based on local builds.

## Acceptance criteria

| Area | Required evidence |
| --- | --- |
| Isolation/auth | Two-school fixtures deny cross-school revision, evidence, asset, domain and preview requests; missing/expired/revoked/scoped-only grants deny school-wide site actions |
| Validation | Common and renderer-specific bounds; wrong schema/key, duplicate/unknown fields, executable text, raw HTML/CSS/module/page-builder input and invalid links deny publication |
| Publication | Draft denial on public paths; expected-version conflicts; immutable publication snapshot; unchanged public output after draft edit; revert creates a new draft and needs current validation |
| Approval/assets | Pending, rejected, expired, revoked, wrong-school and wrong-subject evidence/assets deny; child-consent applicability and expiry enforced; no storage IDs/internal rights notes/private bytes in public responses |
| Preview | Authenticated same-school only, expired authorization denied, watermark, noindex/nofollow, no canonical or sitemap; no anonymous token path |
| Domains | Hostname normalization/collision, real mocked TXT verification, provider status transitions, stale-result rejection, readiness enforcement, canonical uniqueness, suspension/retirement and safe same-school alias redirects |
| Header/routing | Spoofed forwarded host/protocol cannot choose school or canonical origin; invalid paths/queries cannot create open redirects; valid aliases retain paths/query |
| Links | Actual `ApplicationLinkV1` parity for managed/external/no-site callers; exact `/s/...` convention; unavailable CTA denial; `/apply` redirects; no fabricated portal destination |
| SEO/legacy | Published allowlisted routes and timestamps only; safe JSON-LD; denied and preview noindex; explicit demo allowlist; missing profile unavailable; fabricated OBHIS excluded |
| Production assets | Inspect build bundles/static output and test traces for private OBHIS image bytes/references; no production import of private review fixtures/context |
| Management | Synthetic operator can request/check/activate a domain and school user can save/preview/publish/revert through the UI on a configured local test setup |
| Verification | Focused tests, applicable shared/Convex/sites/admin/platform typecheck/lint/build; touched tenant colours classified by `node scripts/audit-theme-colors.mjs`; headless integration results reported accurately |

## Merge and OBHIS integration contract

Merge the production-core PR by merge commit after authorization. Incorporate it into the OBHIS branch by an authorized merge commit, never rebase or squash by default. Resolve shared registry/routes once; preserve OBHIS presentation files. Review combined changes before OBHIS publication.

The required adapter work is bounded:

1. Register the actual `obhis-v1` key and exact schema-version string with its code-owned route and semantic-field manifests in both publication validation and rendering.
2. Provide a typed conversion from the approved public DTO to the renderer's production props. Keep private-review fixtures and `PrivateReviewContext` separate; no casts or production fixture imports.
3. Replace fixture identity/contact/copy/assets with validated published fields. Asset props contain approved delivery URLs and presentation metadata only. Missing optional content gets intentional empty states, not invented facts.
4. Pass `ApplicationLinkV1` and approved portal projection from core. Remove renderer-built admissions destinations, tenant lookup and data access.
5. Use core canonical metadata/routes and no-index preview behavior. Renderer metadata contributions remain typed and publication-controlled.
6. Keep `/review/obhis` private and disabled in production, with all private photos excluded from production public folders, bundles and traces.
7. Run combined contract, route, asset, admissions-link, accessibility and build-output checks.

Exact OBHIS symbol names, field IDs, schema version and changed files cannot be established until its requested worktree is provided. That inspection is an explicit prerequisite, not an unspecified implementation TODO. This plan does not approve its school facts, photo rights, inherited hero contrast issue, publication or actual domain cutover.

## External approvals and readiness report

Remaining approvals/configuration include base integration, OBHIS access, hosting provider/account/project, private credential delivery, DNS owner, public application and portal origins, content/evidence policy, school cutover approval and any live provider/DNS/deployment operations.

Report code-ready, review-ready, preview-ready, runtime-ready and release-ready separately. Local tests, headless synthetic integration, typechecks, lint and builds pass. PR/Codex and final remote previews require their own recorded head-specific results. Deployed runtime, release order, OBHIS mapping and real school approvals remain unverified. No merge, production deployment or migration is authorized.
