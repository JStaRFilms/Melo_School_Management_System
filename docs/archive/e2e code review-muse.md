## Code Review: `audit/e2e-ux-polish` vs `origin/master`

Fixed point: `origin/master` (merge-base). Diff: `git diff origin/master...HEAD --stat` = 196 files, +18136/-6078, 84 commits (`git log origin/master..HEAD`). Branch `audit/e2e-ux-polish` currently checked out, 20 commits ahead of `origin/audit/e2e-ux-polish`.

No `CODING_STANDARDS.md`/`CONTRIBUTING.md` found. `AGENTS.md:1` only points to `packages/convex/_generated/ai/guidelines.md`.

---

## Standards

*Report from Standards sub-agent - documented standards + Fowler smell baseline (repo overrides baseline, smells are judgement calls).*

**Documented Standards: No hard violations** - `packages/convex/_generated/ai/guidelines.md:82-85` (validators) and `:155` (index naming) followed: `packages/convex/schema.ts:1142` index `by_class_and_session`, `packages/convex/functions/academic/documentGeneration.ts:1` uses `v.*` validators, `withIndex`. Tooling (eslint/tsc) skipped.

**Smells (judgement):**

- **God File - `packages/convex/functions/academic/documentGeneration.ts:1-1898`** (new): attestation + graduation + fee certificates + PDF layout + storage + audit in one file. Repeated `switch` on `documentType`. -> split per document type.
- **Duplicated Code - `apps/admin/app/academic/sessions/components/SessionCreationModal.tsx:1` / `TermCreationModal.tsx:1` vs deleted `SessionCreationForm.tsx`/`TermCreationForm.tsx`, and 4 modals `AttestationLetterModal.tsx:276` / `GraduationConfirmationModal.tsx:211` / `PromotionConfirmationModal.tsx:223` duplicate confirm flows.** -> extract shared modal scaffold.
- **Data Clumps/Primitive Obsession - `packages/convex/schema.ts:230-251` `schools.theme{primaryColor,accentColor}`, `features{billing,...}`** travels together in `packages/convex/functions/platform/index.ts:199` and `apps/admin/app/admin/settings/page.tsx:684` as plain strings. -> branded type.
- **Middle Man/Message Chains - `packages/shared/src/components/WorkspaceNavbar.tsx:841` (+600 lines) proxies `workspace-navigation.ts:129` which proxies Convex queries; `apps/admin/app/academic/sessions/page.tsx:449` chains `ctx.db.query().withIndex().collect()`** -> hide behind one method.
- **Speculative Generality - `packages/convex/schema.ts:231` `features` object + `schema.ts:1777` `isOptional/isSelected`** added for future toggles not yet used.
- **`apps/admin/next.config.js:12` `allowedOrigins: ["100.*","*.ts.net"]`** - wildcard overly broad (see Security HIGH).

---

## Spec

*Report from Spec sub-agent - origin spec vs diff.*

**Spec source:** No issue refs in commit messages. `prompt.md` deleted in branch (235 lines removed). Treated `00_Notes/e2e_ux_findings.md:1` (E2E & UX Audit Tracking Log) + `docs/design/AdminSplitPaneWorkbenchArchitecture.md:1` as spec per skill fallback order.

**a) Missing/Partial:**

- `00_Notes/e2e_ux_findings.md:15-23` Steps 3-4 (New Demo School walkthrough, systematic app-by-app UX for `teacher/portal/platform/sites`) remain unchecked `[ ]` - branch polished already-`Done` items (`:27-148`) without evidencing manual walkthrough gate.
- `docs/features/SchoolAssetsAndPdfCompression.md:20-30` spec (`schoolAssets` table, 5 GiB quota, `compressSchoolAsset` action) - docs added, zero `packages/convex/schema.ts` implementation. Correctly in backlog `00_Notes/e2e_ux_findings.md:216-221` but gap if v1 considered in-scope.
- Teacher AI migration to Convex (`00_Notes/e2e_ux_findings.md:224-228`) deletes `apps/teacher/app/api/ai/question-bank/generate/route.ts:675` + `lesson-plans/generate/route.ts:628` but does not consolidate all 6 `SCHOOL_AI_*` models to single Convex env as spec demands; `ea1f263` still documents split env.

**b) Scope Creep (not asked for):**

- Platform/Admin theming, suspension lock screens (`packages/shared/src/components/SchoolSuspendedLockScreen.tsx:244`), FLIP animations, Top Domain Switcher - no line in `00_Notes/e2e_ux_findings.md` Done/Backlog asks for these.
- Billing invoice redesign + `AttestationLetterModal.tsx:276` ships `00_Notes/e2e_ux_findings.md:234` roadmap item prematurely before timeline audit log prerequisite.

**c) Implemented but Wrong/Churn:**

- Split-pane lock correctly follows `docs/design/AdminSplitPaneWorkbenchArchitecture.md:29` (`lg:overflow-hidden` on `aside`, inner `flex-1 overflow-y-auto`) verified in `apps/admin/app/academic/classes/page.tsx`, `teachers/page.tsx`. However re-applied 3 times (`5052e1c`, `7c08512`, `c9aa385`) - final state compliant. Cursor-jump fix per `docs/design:94-108` correctly applied to `SubjectCreationForm.tsx`/`SubjectEditForm.tsx`.

---

## Security (extra axis requested: regressions/vulns)

1. **HIGH - `apps/admin/next.config.js:12-13` `experimental.serverActions.allowedOrigins: ["100.*","*.ts.net"]`** - `100.*` is not valid CIDR origin pattern (Next expects exact origins), `*.ts.net` widens CSRF to any Tailscale tailnet subdomain. Use exact hosts or remove; Tailscale ACLs != browser origin.
2. **MEDIUM - `packages/convex/functions/academic/documentGeneration.ts:1-1898` no rate limit** - migration from Vercel (`/api/ai/*/generate`) to Convex `action` with `generateObject` against paid OpenRouter models removes Vercel throttling; any teacher can loop/cost-exhaustion. Add token-bucket per `userId+schoolId` before `createDocumentModel()`.
3. **LOW - `packages/convex/functions/billing.ts:2580` `toggleInvoiceOptionalLineItem` lacks `billingEvents` audit insert** - `schoolId`/`status`/`isOptional` guards correct but total mutation untraced vs other billing mutations.
4. **OK - `packages/convex/functions/academic/auth.ts:42` `allowSuspended` opt-in** - default-deny, no caller passes `true` in diff. `apps/teacher/.env.example:14-27` correctly moves `OPENROUTER_API_KEY` to `convex env set` (server-only `process.env`). Platform `packages/convex/functions/platform/index.ts:335-445` `getAuthenticatedPlatformAdmin` + `internalQuery` not enumerable.

---

**Summary:** Standards: 0 hard violations, 6 judgement smells (worst: `documentGeneration.ts:1` God File). Spec: ~90% compliant to audit log Done list, 2 scope-creep areas (theming/suspension), 1 partial (walkthrough verification unchecked). Security: 1 HIGH (`next.config.js:12` wildcard origins), 1 MEDIUM (rate limit regression on Convex AI actions).
