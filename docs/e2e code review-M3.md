I'll load the appropriate skills first, then do a thorough code review.

Skills loaded. Now let me set up the review.

The branch is `audit/e2e-ux-polish`, diverged from `master`. Let me set up the review plan and gather context in parallel.

Excellent — I now have the spec (`00_Notes/e2e_ux_findings.md`) and the coding guidelines. Let me read the Convex AI guidelines and verify the diff size before spawning sub-agents.

196 files, +18k/-6k LOC. Massive diff. I'll split the security/spec analysis into focused tasks for parallel sub-agents, with each tasked with reading the actual files. Let me also do the Convex guidelines already read.

Given the scale, I'll split the work into focused sub-agents (each doing their own context-managed reads) and converge the findings in this main thread.

Let me do the guardrail checks I can do directly first (they're cheap), then dispatch the deep sub-agents.

Two new dependencies: `ai` (the Vercel AI SDK) in convex package, and `@formkit/auto-animate` in shared. Let me verify them on npm.

Both deps are real. The Tailscale-origin (`100.*`, `*.ts.net`) is **wildcard origin matching** for Next.js server actions — that's a critical security finding worth flagging. Let me launch the parallel deep-dive sub-agents now.

All three sub-agents converged. Now I need to do a quick verify pass on the most critical claims (public migration action with no auth) before reporting.

Both files are net-new. Let me verify the critical claim directly.

Verified. The sub-agent claims on the migration action are accurate. Let me also quickly verify the AI SDK version mismatch and the schema index claim for classSessionFormTeachers, then deliver the final report.

Confirmed: `ai@6.0.168` is **3 major versions behind** the current `ai@7.x`. Verified. Let me look at the schema for classSessionFormTeachers and AI usage one last time, then deliver.

Schema indexes look correct (index names follow Convex guideline of `by_X_and_Y`). Sub-agent's index-name smell #9 in Standards was wrong on that point — `by_class_and_session` IS defined. Marking this as a minor correction. All other claims verified.

# Code Review — `audit/e2e-ux-polish` vs `master`

**Diff scope**: 196 files, +18,136 / -6,078 LOC. **Spec source**: `00_Notes/e2e_ux_findings.md` (3-axis: Done / Blast-radius / Backlog). **Standards**: `docs/Coding_Guidelines.md` + Convex guidelines. Three parallel sub-agents ran; key critical findings independently verified against source.

---

## CRITICAL (block merge)

### C1 — Public migration action with no auth, hardcoded default password, destructive ops
- **File**: `packages/convex/functions/academic/migrateSplitBranchesAction.ts:68,84`; companion `packages/convex/functions/academic/migrateSplitBranches.ts:66`
- **Issue**: `runSplitMigrationAction` is a public `action()` (not `internalAction`). It accepts an optional `password` arg, falls back to literal `"Admin123!Pass"` (line 84), then calls `ensureBetterAuthAccount` which `deleteSessions(userId)` for the branch admin emails, then triggers an internal mutation that renames a school, creates a new school, reassigns classes/students/invoices/assessments, deletes teacher assignments, and archives a real user (`johnoke2005@gmail.com`). The companion `executeSplitMigrationInternal` is correctly `internalMutation` — the leak is the wrapper.
- **Standards violation**: `docs/Coding_Guidelines.md` Security Rules ("Authorization is mandatory on every sensitive query, mutation, action…") and Convex guideline "Use `internalAction` to register private functions… Do NOT use `action` to register sensitive internal functions."
- **Fix**: Convert to `internalAction`; gate with `process.env.MIGRATION_KEY`; require non-optional `args.password` of ≥12 chars sourced from a deployment secret; add a `confirmMigration` token; write `academicTimelineAuditEvents` rows before/after. Remove the literal default.

### C2 — Wildcard origin acceptors for Next.js Server Actions
- **File**: `apps/admin/next.config.js:11-17`
- **Issue**: `experimental.serverActions.allowedOrigins: ["100.*", "*.ts.net", …]`. `100.*` matches the **entire `100.0.0.0/8` CGNAT range**, not just Tailscale's `100.64.0.0/10`. `*.ts.net` accepts any Tailscale peer that knows the origin hostname. CSRF/replay protection for Server Actions depends on a strict origin allowlist.
- **Standards violation**: Security Rules ("Authorization is mandatory on every sensitive query…"); industry standard for Server Actions.
- **Fix**: Tighten to `100.64.*` (or enumerate specific tailscale IPs) and pin the production FQDN. Never use wildcard TLD patterns.

### C3 — AI SDK pinned3 majors behind latest
- **File**: `packages/convex/package.json:18`
- **Issue**: `ai@^6.0.168` pinned; current line is `ai@7.x` (`npm view ai version` returns 7.0.84). Migration was supposed to make AI generation reliable and forward-compatible.
- **Fix**: Upgrade to `ai@^7` unless there's a documented Convex-incompatibility reason for staying on v6.

---

## HIGH

### H1 — Promotion claim unverified by integration test (Blast-radius checkpoint #2)
- **File**: `packages/convex/functions/academic/__tests__/studentGraduation.test.ts:1-109`
- **Issue**: Spec claims "Promoted students don't pollute the active session's roster"; the only test is a pure-function mock. The real `getBaselineRoster`/`getClassRoster` in `packages/convex/functions/academic/studentEnrollment.ts:1806-1815` is unproven.
- **Fix**: Add convex-test seeding a `studentPromotions` row with `fromSessionId == activeSession`, then assert the roster excludes that student.

### H2 — AI cost-control gaps on assessment generation
- **File**: `packages/convex/functions/academic/documentGeneration.ts:1589`
- **Issue**: `generateTeacherAssessmentDraft` caps `MAX_GENERATION_SOURCE_COUNT=12` but allows up to 300 questions (`Math.min(60, ...) × 5 types`). Rate limit is per-call count, not token-cost. Repair path runs unbounded second LLM call (`MAX_FAILED_RESPONSE_REPAIR_CHARS=8000`, `MAX_SCHEMA_REPAIR_INPUT_CHARS=24000`). A teacher (or compromised account) can drain OpenRouter credits.
- **Fix**: Hard-cap at 60 total questions. Add per-teacher daily token-cost budget. Add `maxDuration` to `generateObject`.

### H3 — AI migration under-delivered vs spec
- **Spec**: "Create Convex actions for `lesson_plan`, `student_note`, `assignment`, `question_bank_draft`, `cbt_draft`"
- **Code**: only `generateTeacherLessonPlanDraft` and `generateTeacherAssessmentDraft` exist. UI selectors still expose all 5 types (`apps/teacher/app/planning/lesson-plans/types.ts:1`, `apps/teacher/app/planning/page.tsx:79`).
- **Fix**: Implement the 3 missing actions or strip the dead options from UI until they exist.

### H4 — Historical report card teacher attribution unverified (Blast-radius #3)
- **File**: `packages/convex/functions/academic/reportCards.ts:694-702`
- **Issue**: Implementation is right (queries `classSessionFormTeachers` by `reportCardClassId` + `args.sessionId`) but no test pins this behavior. Critical for transcript integrity.
- **Fix**: Convex-test seeding `classSessionFormTeachers` for a past session, assert `classTeacherName` differs from active session's.

### H5 — Class roster session-switching unverified (Blast-radius #1)
- No test exercises `/academic/classes`'s session dropdown re-fetching flow.
- **Fix**: Convex-test calling `listClasses({sessionId: futureSessionId})` and asserting `formTeacherName` differs from active session.

### H6 — Unbounded `.collect()` on new matrix builder
- **File**: `packages/convex/functions/academic/studentEnrollment.ts:1790-1868`
- **Issue**: `getClassStudentSubjectMatrix` runs 4 unbounded `.collect()` calls (`students`, `studentPromotions` ×2, `studentGraduations`, `studentSubjectSelections`) plus N-point `Promise.all`. Will balloon at scale.
- **Standards violation**: Convex guideline "if the user does not explicitly tell you to return all results … ALWAYS return a bounded collection".
- **Fix**: Paginate via `paginationOptsValidator` or denormalize a per-session-per-class roster counter.

### H7 — `as unknown` cast on AI SDK call
- **File**: `packages/convex/functions/academic/documentGeneration.ts:642-658`
- **Issue**: `callGenerateObject` intentionally casts `schema as unknown` and routes around the SDK's typed signature.
- **Standards violation**: "Do not introduce `any` unless there is a documented reason" — `unknown` plus runtime cast is `any` by another name.
- **Fix**: One helper per output type so each call site is statically typed. Upgrade SDK (see C3).

### H8 — Platform password reset: no rate limit, no confirmation token
- **File**: `apps/platform/app/schools/ResetSchoolAdminPasswordModal.tsx:37, 46-49` + `packages/convex/functions/platform/index.ts:425`
- **Issue**: Modal calls the action with only client-side length check. Server gates via `requirePlatformAdminInternal` (correct), but there's no rate-limit, no audit-log write, and no confirmation dialog — a platform admin can take over any school in one click.
- **Fix**: Add `consumePlatformAdminResetLimit`, require explicit confirmation string showing affected school name + admin email, write audit event.

---

## WARNING

### W1 — `process.env` fallback default at the auth path
- **File**: `packages/convex/functions/auth.ts:18`
- **Issue**: `const authId = identity?.subject ?? authUser?._id ?? (authUser as any)?.id;` plus email fallback. Convex guideline explicitly prefers `identity.tokenIdentifier` over `subject`. The `any` cast loses type safety on a critical auth path.
- **Fix**: Use `identity.tokenIdentifier`. Drop the email fallback or gate it behind subject-null only.

### W2 — Billing: empty `targetClassIds` allowed for `class_default` mode
- **File**: `packages/convex/functions/billing.ts:1585`
- **Issue**: Validation `if (billingMode === "class_default" && targetClassIds.length === 0)` was removed; plans can be created with zero target classes silently producing zero invoices.
- **Fix**: Reintroduce validation or return "no application will be generated" warning.

### W3 — School branding validator stricter than schema
- **File**: `packages/convex/functions/academic/schoolBranding.ts:25`
- **Issue**: New fields (`slug`, `status`, `motto`, etc.) marked required on the validator when schema declares them optional. Risk of client crashes that mask real authz bugs.
- **Fix**: Mark new fields `v.optional(...)` to match schema.

### W4 — School branding favicon leak- **File**: `packages/shared/src/components/WorkspaceNavbar.tsx:129-145`
- **Issue**: Component mutates `document.head` on every render where `logoUrl` changes; never removes dynamically-added `<link rel="shortcut icon">` on unmount. Multiple favicon links accumulate.
- **Fix**: Track the previous `linkRef` and reuse/set `href` instead of appending.

### W5 — `try { … } catch (err: any)` in shared component
- **File**: `packages/shared/src/components/ChangePasswordModal.tsx:100`
- **Fix**: Replace with `catch (err: unknown)` + `err instanceof Error` guard.

### W6 — `documentGeneration.ts` is 1898 lines (Divergent Change / Shotgun Surgery)
- Hosts validators, schema-repair, retry/backoff, prompts, mapping, normalization, Markdown rendering, AI logging, and 2 actions. Every prompt tweak now edits one file.
- **Fix**: Split into `documentGeneration/{prompts,repair,actions/{lessonPlan,assessment}}.ts`.

### W7 — Promotion mutation drops prior subject selections silently (Blast-radius #2)
- **File**: `packages/convex/functions/academic/studentEnrollment.ts:1069-1248`
- **Issue**: If admin re-promotes to a different target class, prior staged `studentSubjectSelections` for the old target are deleted without audit-log write or UI warning. Violates "Payment, grading, and publishing actions must be auditable".
- **Fix**: Write `academicTimelineAuditEvents` row on target-class change; return deleted IDs so UI can warn.

### W8 — `consumeTeacherAssessmentGenerationLimit` scope unverified
- The action calls this public mutation with `{}` args. Need to confirm it derives `userId` server-side from `ctx.auth.getUserIdentity()`.
- **Fix**: Read `auth.ts` for the mutation and confirm; add explicit test.

### W9 — Scope creep: navigation chrome not in spec
- Commits `aed64aa`, `9f1346c`, `be0f712`, `9836522`, `031c495` (3 nav variants + preference switcher), plus dashboard overhaul `80e3bd7` + setup review `8f75b59`. WorkspaceNavbar grew +841 lines. None mentioned in Done list.
- **Fix**: Land navigation chrome in a separate branch.

### W10 — Scope creep: future-spec docs bundled
- `docs/features/StudentLifecycleAndEnrollmentHistory.md` (+94), `EduClearanceTransferNetwork.md` (+66), `KiddyTrackerAndGateOperations.md` (+85), `ParentWhatsAppAndTransactionalComms.md` (+57) all added under commit `de88dbe`. Pure documentation but expands scope.
- **Fix**: Move to a follow-up branch.

---

## INFO

- **`studentSessionPromotions` naming**: Spec says table `studentSessionPromotions`; actual is `studentPromotions` (schema.ts:1205). Conceptually identical, naming differs. Either rename or update the spec note.
- **Schema indexes correct**: `classSessionFormTeachers` and `studentGraduations` index names match field sets per Convex guideline (`by_class_and_session`, `by_school_and_session`, `by_student_and_session`).
- **Platform-admin gating correct**: `resetSchoolAdminPassword` delegates to `requirePlatformAdminInternal` (line 425). RLS holds.
- **`migrateSplitBranches.ts` internal mutation is properly internal**: only the wrapper is the problem (C1).
- **No new `v.any()` introduced**: All new validators use typed primitives + discriminated unions.
- **`apps/teacher/.env.example` cleanup**: `OPENROUTER_API_KEY` correctly removed and redirected to `npx convex env set`. Aligns with "keep secrets out of the serverless bundle."
- **Both new deps verified legitimate**: `ai@^6.0.168` (real, though stale — see C3) and `@formkit/auto-animate@^0.10.0` (current latest).

---

## Two-axis summary

**Standards**: 18 findings (3 critical, 4 high, 7 warning, 4 info). Worst: unauthenticated public `action()` that can split a school and reset named admin passwords.

**Spec**: 12 findings (1 high from under-delivered AI migration, 2 high from unverified blast-radius claims, 1 critical from unverified roster isolation claim, others warning/info). Worst: the central isolation claim ("promoted students don't pollute active rosters") and the historical-report-card form-teacher claim — both explicitly marked Done — have **no integration tests**, only pure-function mocks.

**Security (overlap)**: C1 + C2 are the two findings unique to security review that would block a deploy even if all spec/standards findings were resolved.

---

## Recommended merge-blocking fixes (minimum to unblock)

1. **C1**: `migrateSplitBranchesAction.ts` → `internalAction` + env-key gate + drop hardcoded password (1 hour).
2. **C2**: Replace `100.*` with `100.64.*` in `apps/admin/next.config.js` (5 min).
3. **C3**: Upgrade `ai` to v7 or document the v6 pin reason (test in dev first).
4. **H1 + H4 + D6**: Add the three missing convex-tests for blast-radius claims (half day).
5. **H3**: Either implement the 3 missing AI actions or strip the dead UI options (1 hour).

Everything else is WARNING-level and can ship if you accept the risk.

Review complete. **3 critical, 5 high, 10 warning, 7 info findings**. The two merge-blockers are C1 (public `runSplitMigrationAction` with hardcoded `Admin123!Pass` fallback — anyone on the internet can split a school and reset branch admin passwords) and C2 (Next.js Server Actions accept `100.*` and `*.ts.net` wildcard origins). The spec also has two "Done" claims (promotion roster isolation, historical report-card teacher attribution) with **no integration tests** to back them up.
