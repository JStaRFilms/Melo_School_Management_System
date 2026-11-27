# Infisical worktree rollout

Date: 2026-10-29. Scope: local setup code and local development configuration only.

## Result

- Integration code committed in all 32 valid worktrees. One stale/prunable registration was left unchanged.
- Frozen-lockfile validation passed in all 32. Five focused tests passed in each worktree. External worktrees received frozen dependency installations without lifecycle scripts.
- Seventeen worktrees completed development setup. Their bootstrap credentials remain ignored; matching legacy app env files were archived privately.
- Thirteen protected QA, Preview, production and deployment profiles were retained. Code availability does not authorize migrating their settings or deploying them. Use their existing dedicated runners or explicit dev:local as appropriate.
- Two development worktrees retained differing app values: feature/admissions-atomic-campaigns and feat/selectable-billing-items. SITE_URL/TRUSTED_ORIGINS differ; selectable-billing-items also has NEXT_PUBLIC_APPLY_ORIGIN. Normal Infisical startup refuses their old dotenv files. They need branch-specific origin reconciliation before migration; dev:local retains their previous behavior. No values were overwritten to force a green result.
- Fresh-checkout verification passed: create local bootstrap and target selector, idempotent rerun, and refusal to replace a different selector. This reused an existing credential privately; it did not test provisioning a new identity or a new PC's Convex CLI login.
- No remote Convex configuration, code, data, production hosting or deployment was changed. Existing unrelated work was not staged or committed.

## Git distribution

The source integration starts at commit 714d504. Worktrees carry their own follow-up commits so branch-specific ports and scripts remain intact. Detached worktree commits remain detached.

The initial publication used chore/infisical-local-setup and perf/convex-egress-master. The owner subsequently approved integration into master and preview. That follow-up applies only the Infisical setup diff onto each branch's current remote base, without merging unrelated feature ancestry. Publication uses normal fast-forward pushes and commit messages containing [skip vercel] to request no hosting builds. No Convex deployment or runtime-settings changes are included. Other historical worktree branch commits remain local unless separately pushed.

On another PC, use master or preview once the approved follow-up is published, install frozen dependencies, then run pnpm setup:dev and supply bootstrap credentials privately. The dedicated integration branch also remains available. No clone receives credentials from Git.

## Per-worktree evidence

| Worktree | Branch | Code commit | Lockfile | Tests | Local configuration |
| --- | --- | --- | --- | --- | --- |
| <project> | perf/convex-egress-master | 714d504 + follow-up | frozen-pass | 5-tests-pass | ready |
| <project>/.kilo/worktrees/showy-jam | detached | 7c0ba0dc | frozen-pass | 5-tests-pass | ready |
| <project>/.qa/worktrees/capture-content-poodle-172 | qa/studio-case-study-capture | cb38bbc6 | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/145-archived-student-release | fix/145-archived-student-release | bc409051 | frozen-pass | 5-tests-pass | ready |
| <project>/_w/archive-result-release | feature/archive-result-release | b39411d4 | frozen-pass | 5-tests-pass | ready |
| <project>/_w/atomic-campaigns | feature/admissions-atomic-campaigns | d3182d82 | frozen-pass | 5-tests-pass | different-app-values-retained |
| <project>/_w/consolidation-review | chore/consolidation-stack | 7d133056 | frozen-pass | 5-tests-pass | ready |
| <project>/_w/dev-combined-deploy | ops/dev-combined-20260914 | 63594d2b | frozen-pass | 5-tests-pass | ready |
| <project>/_w/master-curriculum-error-copy | detached | e82ab326 | frozen-pass | 5-tests-pass | ready |
| <project>/_w/melo-productization-44086fa | feat/melo-productization-44086fa | 3224786c | frozen-pass | 5-tests-pass | ready |
| <project>/_w/obhis-website | feature/obhis-website | a4cbd6fa | frozen-pass | 5-tests-pass | ready |
| <project>/_w/obhis-website-code | feature/obhis-website-code | 03095d82 | frozen-pass | 5-tests-pass | ready |
| <project>/_w/open-issues-20261021 | fix/open-issues-preview-20261021 | 6ef31592 | frozen-pass | 5-tests-pass | ready |
| <project>/_w/preview-env | preview | 406a3ddc | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/preview-env/tmp/issue-129 | fix/129-admin-profile-correction-exports | 43381a60 | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/preview-master-reconcile | chore/reconcile-master-preview-20261015 | 83b3ff77 | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/prod-deploy | feature/secure-storage-readiness | 16479426 | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/production-admin-build-fix-20261015 | fix/admin-page-export-20261015 | ba570403 | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/production-auth-hotfix | fix/production-auth-key-rotation | fc7e996f | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/production-auth-merge | fix/production-auth-rotation-master-20261014 | 6a98ac5c | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/production-email-footer | fix/email-footer-prod | 047095a8 | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/production-footer-pr | fix/email-footer-master | 4ae3fa41 | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/production-index-restore | fix/restore-original-footer-prod | c49c1bae | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/_w/release-test-fix-20261015 | fix/release-test-gates-20261015 | 7ace2a8c | frozen-pass | 5-tests-pass | ready |
| <project>/_w/selectable-billing-items | feat/selectable-billing-items | 1e188453 | frozen-pass | 5-tests-pass | different-app-values-retained |
| <project>/_w/student-staff-lifecycle | feature/student-staff-lifecycle | f0dca4c3 | frozen-pass | 5-tests-pass | ready |
| <project>/_w/www | feature/www-main-website | e630e2c1 | frozen-pass | 5-tests-pass | ready |
| <project>/tmp/worktrees/identity-onboarding-portal | feat/parent-profile-edit-permissions | ceec28d0 | frozen-pass | 5-tests-pass | ready |
| <project>/tmp/worktrees/identity-onboarding-portal/tmp/deployment-master-d825229 | detached | db86d492 | frozen-pass | 5-tests-pass | protected-profile-retained |
| <project>/tmp/worktrees/identity-onboarding-portal/tmp/deployment-pr109-949e493 | detached | c95cf18f | frozen-pass | 5-tests-pass | protected-profile-retained |
| <external>/melo-educlearance-design-pr | docs/educlearance-integration-design | 145bb2c5 | frozen-pass | 5-tests-pass | ready |
| <external>/ui-cleanup | fix/teacher-library-text-reading-unavailable | 3f446c38 | frozen-pass | 5-tests-pass | ready |
| <external>/fix-pr-103-agent-qa-review | fix/pr-103-agent-qa-review | not changed | not applicable | not applicable | invalid-or-prunable |

Private raw inventory, setup evidence, and rollback archives stay under ignored tmp/. No secrets are included in this report. Startup verification for the source checkout is documented in InfisicalLocalDevelopment.md. Full authenticated/provider workflows were not retested across historical branches.
