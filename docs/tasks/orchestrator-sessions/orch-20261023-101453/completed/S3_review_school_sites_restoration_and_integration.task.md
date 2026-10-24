# Task S3: Review school Sites restoration and integration

## Agent setup
### Workflow to follow
Takomi Build review checkpoint, canonical reviewer persona. The owner explicitly switched remaining work to Takomi GPT models after OpenCode quota exhaustion. Use Takomi GPT-6.1 Sol. This is an independent read-only local branch review, not a hosted PR review.
### Prime context
Read `C:/Users/johno/.agents/skills/branch-review/SKILL.md`, root `AGENTS.md`, `packages/convex/_generated/ai/guidelines.md`, this session's `S1_scope_result.md`, `S2_implementation_report.md`, and existing `branch_review.md`. Inspect source and tests, not just the implementation report.

## Objective
Find confirmed regressions or missing dependencies in the 36-path school Sites content restoration, especially its integration with the already-reviewed/deployed optimizations. Verify it actually preserves the maintained live upkeep source and excludes private artifacts and marketing work.

## Scope
Review staged/working restoration against explicit starting ref `eb30018`. Overall PR base is `d2ba632a09776e43684a99b4739885974790e094`. Approved source is `c03047629d09e206113ecb6a2ffd01ca3384a784`, which contains both the school's upkeep and the optimizations. Review the actual restored code and surrounding callers/contracts, including Admin/Platform Sites controls, icon metadata and alt-field rules, shared manifests, capability grants, approval lifetimes, domain adoption, schema and generated API declarations.

Verify the union in `functions/sites/shared.ts` retains transaction-local asset reuse and all publication/consent/lifetime checks. Verify original Sites optimization fixtures returned because the original contracts returned, not to excuse a failure. Verify academic optimization functions and consumers are unchanged from `eb30018`. Check the full staged path list and raw-asset/marketing exclusions.

This is a scoped review of the restoration and integration. The original optimization slice already received R1 REVIEW CLEAR against `94ef195`; R2/R3 incomplete attempts remain historical limitations, not passes. Do not claim a fresh full independent review of unrelated old optimization-test sections you did not inspect.

## Constraints
Read-only, requiredCapabilities empty. No edits, staging, commits, pushes, fetches, network/provider calls, credentials, deployment, school-record access or further delegation. No operator-script execution. Preserve all historical finding IDs and do not manufacture stylistic/speculative findings. Report actionable correctness, security, contract or explicit-scope failures only. Do not request unrelated cleanup.

No source writer is running. Do not run heavyweight tests; inspect existing logs if useful. Parent verified the entire apps/packages trees equal c030476 and reran all five typechecks successfully. Three affected frontend builds passed. There are 94 passing focused tests. All six local TLS tests now pass with a process-local OpenSSL config. The existing browser fixture still times out on Windows, including its pre-restoration baseline; no assertions or timeouts were changed. Isolated-backend browser QA is separately blocked by missing `.env.qa.local`. Distinguish review correctness from those remaining verification limits.

## Definition of done
- Inspect all 36 restored paths or explicitly list any coverage gap.
- Check publication/auth/tenant/icon/domain contracts and the optimization integration.
- Verify source parity and exclusions, not merely the report's claims.
- Return a complete branch-review response with Scope, Verdict, Findings, Previous findings, Checks/limitations and implementer actions if needed.

## Expected artifacts
A returned final review with `REVIEW CLEAR`, `NEEDS CHANGES`, or `INCOMPLETE` and stable `BR-...` findings. Do not write a report file. Return the actual completed verdict, not a progress note or a list of future work.

## Prior review round and continuity
The interrupted OpenCode review has no final verdict and is not a pass. Its backing thread is interrupted with activeRunId null; cancellation was requested before this replacement round. Preserve its sole unresolved observation: access.ts rejects any second live site_operator package, while one feature-doc sentence mentions overlapping grants. The same document also explicitly requires duplicate/extension denial. The old reviewer ultimately considered this intentional stricter behavior or ambiguous wording, not a confirmed functional/security defect. Independently assess that observation in context; do not widen permissions or fix speculative requirements. No BR finding ID was finalized. All other inspected publication/auth/icon/domain concerns in that round were rejected as non-defects. Original R1 clear and R2/R3 incomplete history remain unchanged.

Use one focused pass and return a decisive scoped verdict. Avoid repeated speculative edge-case hunting. No code changes have occurred since restoration; only parent evidence documents were updated.

## Dependencies and review checkpoint
S1 approved; S2 restoration is complete and source is frozen. Parent owns remaining test-environment checks and will reconcile your verdict before committing, updating PR139, or marking it ready. No GitHub merge or Production deployment is authorized.
