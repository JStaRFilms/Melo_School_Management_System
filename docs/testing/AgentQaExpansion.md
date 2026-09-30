# Agent QA expansion

## Scope

Integrate upstream master, then extend the verified command workflow to Admin, Teacher, and Parent browser sessions and project-local agent discovery. Preserve the existing maintenance boundary: Git integration and ordinary QA do not deploy, seed, reset, or activate staged indexes.

Upstream `5193b3f` was first merged as `db924d7`. The owner then identified newer upstream work; a fresh fetch confirmed `5eaa434`, including session scoring and class result publication. It was merged as `ce1b965` after the isolated class-release index backfill was verified. The isolated backend was updated in the required staging/activation order. Reports still mark backend code revision unverified by ordinary preflight; maintenance proof is a separate record. Successful baseline journeys do not prove complete narrative or result-release contracts.

## Deliverables

- `qa:roles` for real Admin, Teacher, and Parent sessions, each isolated from the others. Verify access, dependent roster selection/reload, parent topic search/detail, mobile rendering, and teacher rejection from Admin editing.
- `qa:explore` for an agent-authored, worktree-contained feature module. It uses owned servers, the verified backend, a backend lease, known synthetic roles, named acceptance checks, and the same private evidence/report lifecycle. This is trusted agent code, not a security sandbox.
- Checkout/version metadata in reports and explicit coverage limits.
- A lean project-local `verify-melo` skill and feature map, with an AGENTS.md pointer. Reuse the existing agent-engineering verification recipe; do not modify global skill routers or promote a new core skill.
- Offline tests for workflow/role selection, custom script boundaries, truthful completion, skill links/frontmatter, and report/version metadata.
- Live browser execution of the generated skill's launch, doctor, drive, evidence, and cleanup steps.

## Boundaries

The owner's [standing QA authority](AgentQaAuthority.md) permits routine work and maintenance only in the QA worktree and isolated backend, without repeated approval questions. Production and normal development remain outside the write scope.

Only the already attested Admin, Teacher, and Portal origins are launched. The other four apps remain future work because their test accounts, published configuration, or server-side origins have not been established. Provider calls require configured sandbox mode, recipients, and budgets. Teacher score entry is read/filter/reload only in this phase; parent verification covers learning, not finance, new narrative issuance, or result publication. UI role denial is not a claim of complete backend authorization or cross-tenant coverage.

A failed backend contract or missing fixture is recorded as blocked. The ordinary runner does not repair it with a cloud operation; separately controlled isolated maintenance may resolve it under standing authority. Preserve backend fixtures and published evidence when stopping owned processes.

## Proof

Run the offline safety suite, targeted lint/typechecks, the original Admin template checks, the new role journeys, and at least one exploratory module through the skill's documented commands. Capture and review synthetic-only HTML/PNG evidence before Tailnet publication. Report passed, failed, blocked, and unexercised criteria separately, and leave source/skill changes committed on the QA branch without pushing or merging into local master.

## Verification

- 30 offline safety/skill tests passed. Targeted ESLint and diff checks passed. Admin, Teacher, Portal, and Convex typechecks passed.
- The skill's actual launch/doctor/drive/evidence/cleanup sequence was executed. Doctor works both before startup and against the ready owned servers. Evidence remained after shutdown and all local QA leases were released.
- Role journeys passed 16/16 after fixes and current backend registration. Parent detail proof now requires the actual linked URL and detail H1, not the matching title on the list card. That weak-assertion issue was found through screenshot review and has a regression test.
- Original Admin template workflow passed 12/12 on the merged source/backend. Its new inactive fixture remains run-marked for reviewed cleanup.
- A copied, worktree-contained exploratory module passed 4/4. Script effects are disclosed as declarations, not a sandbox guarantee. Invalid modules, failed prerequisites, setup failure, and interrupted current/future-role criteria have truthful blocked outcomes.
- Independent review approved after fixes for setup lease cleanup, pending-criterion accounting, and exploratory effect wording.
- Theme audit completed. Our UI edits only associated labels with controls; no colours were added/replaced. Existing Teacher indigo focus is a tenant-branding candidate retained outside this patch; existing Portal blue subject/category styling is product UI styling. Other audit findings came from the imported upstream changes and were not globally replaced.

### Isolated maintenance

The initial staging push registered narrative support and the staged class-release index. Activation then stopped safely because the readiness comparison did not account for Convex's implicit `_creationTime` suffix. The check was corrected and regression-tested; a protected metadata read proved the logical fields, staged state, and completed backfill. The newer upstream schema then activated that class-release index while keeping the separate narrative lookup staged.

Every push used a fresh short-lived, limited `content-poodle-172` key that succeeded on the isolated deployment and was denied on normal development. Normal-dev code/config/schema fingerprints matched before and after. The original synthetic cohort remains 36 students, 3 classes, 36 invoices, and 756 assessment records. No seed/reset/purge, production operation, or normal-dev write was performed in this expansion. Earlier incident history remains in [AgentQaVerification.md](AgentQaVerification.md).

Key revocation was confirmed and private key profiles removed. A brief cached-access delay was handled with protected read-only polling; an already-removed key counted as cleaned up only after denial. Private staged/active metadata, logs, and previous maintenance records remain archived under ignored `.qa/`.

### Reviewed evidence

- Latest complete roles: `qa-1790737801764-e3be3c8d`, [role report](https://macbook-air-2.tailb6e2d3.ts.net:3420/melo-agent-qa/qa-1790737801764-e3be3c8d/index.html).
- Latest exploration: `qa-1790737872119-0f62ad30`, [exploratory report](https://macbook-air-2.tailb6e2d3.ts.net:3420/melo-agent-qa/qa-1790737872119-0f62ad30/index.html).
- Original template rerun: `qa-1790735679731-7610387d`, private evidence retained.

Both published URLs returned HTTP 200 with HTML content type. Raw logs, authenticated traces, videos, session data, and credentials were not published. Reports record the merged checkout plus dirty-source status rather than pretending the uncommitted working tree was an immutable revision.

The other four apps, Student-only menu paths, external providers, full score writes, new narrative issuance, and class result-publication user workflows still require specific fixtures and acceptance checks. Backend deployment is not their browser verification.
