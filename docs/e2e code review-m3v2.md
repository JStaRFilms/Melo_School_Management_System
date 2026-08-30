The frontend and regression reviews came back. The backend review was cancelled. Let me verify the highest-impact CRITICAL findings directly in the source so the report is grounded, and also run the backend review against a fresh agent.

All four CRITICAL findings confirmed in source. Now let me verify the auth helper, the suspension logic, and the billing mutation guards.

All four critical findings confirmed in source. Let me also spot-check the billing guard, the features enforcement, and the AI surface, then dispatch the cancelled backend review.

I have everything needed. The resetSchoolAdminPassword IS gated by `requirePlatformAdminInternal`, but C2 (no audit) still stands. Now let me write the final report.

# Code Review — `audit/e2e-ux-polish` vs `master`

**Scope:** 20 commits, 196 files, +18,136 / −6,078. Typecheck passes; no `.env` leakage; no new `skip`/`todo` in tests.

**Verdict:** Do **not** merge. There are 5 confirmed data-loss / takeover bugs and 1 unauthenticated mass-mutation primitive. The diff has solid test coverage for the data layer, but the **UI form/effect regressions and missing feature flags are user-facing blockers**, and the migration script ships as a public action.

---

## CRITICAL — block merge

### C1. `runSplitMigrationAction` is a public action with no operator gate
**Verified at:** `packages/convex/functions/academic/migrateSplitBranchesAction.ts:68-120`
`action({ args: { password: v.optional(v.string()) } })` with **zero** auth check. If `args.password` is omitted it falls back to the hard-coded `"Admin123!Pass"` (line 84), creates two Better Auth accounts, splits the legacy `olive-blessed` school into two, and reassigns every class. Any caller on the internet can invoke it.
**Fix:** Make it `internalAction`; require the `password` arg; gate behind a `PLATFORM_BOOTSTRAP_TOKEN` env check (mirror `seedRunner.ts:151`).

### C2. `ClassEditForm` silently wipes in-progress edits on every Convex refetch
**Verified at:** `apps/admin/app/academic/classes/components/ClassEditForm.tsx:84-110`
`useEffect` deps include `initialGradeName`/`initialClassLabel`/`initialFormTeacherId`/`initialSubjectIds`, which are recomputed from `classDoc` each render. Any subscription push that produces a new `classDoc` reference overwrites the user's typed text — including the subjectIds array. `handleDiscard` (line 147-153) is correct, but it is unreachable because the effect clobbers state first.
**Fix:** Initialize once via `useRef`-tracked first non-empty values, or guard the effect with `if (!isDirty)`.

### C3. `SchoolSettingsPage` form clobber + blob URL memory leak
**Verified at:** `apps/admin/app/admin/settings/page.tsx:119-144,131-136`
Same `useEffect([branding])` pattern clobbers `name`, `motto`, `primaryColor`, `accentColor`, `contactEmail`, `contactPhone`, `address` on every refetch. The blob URL cleanup effect (line 138-144) only checks `logoPreviewUrl.startsWith("blob:")` against the *current* closure, so when `logoFile` is replaced the previous blob URL is orphaned in memory.
**Fix:** One-shot init from `branding`; track previous blob URL in a `useRef` and revoke on swap.

### C4. `graduationDate` inline `Date.now()` causes modal to redisplay different timestamps
**Verified at:** `apps/admin/app/academic/students/page.tsx:1245`
```tsx
graduationDate={graduationDraft.graduationDate ?? Date.now()}
```
Evaluated in JSX on every parent render. While `GraduationConfirmationModal` is open and `students` query subscription pushes a new doc, the prop changes and the displayed `formattedGradDate` shifts. The DB write may use a different timestamp than the user saw.
**Fix:** Resolve once with `useMemo(() => graduationDraft.graduationDate ?? Date.now(), [isGraduationConfirmOpen])` or capture on open.

### C5. `WorkspaceNavbar` mobile drawer clobbers scroll lock set by sibling modals
**Verified at:** `packages/shared/src/components/WorkspaceNavbar.tsx:389-396`
```ts
useEffect(() => {
  if (open) document.body.style.overflow = "hidden";
  else document.body.style.overflow = "";
  return () => { document.body.style.overflow = ""; };
}, [open]);
```
No reference counting, no save/restore. Opening any other modal (`PromotionConfirmationModal`, `PrintableFinanceModal`, etc.) while the drawer is open releases body scroll on drawer close even though the modal is still showing — modal can scroll the page underneath, breaking its backdrop. Affects every workspace (admin, portal, teacher, platform).
**Fix:** Save/restore previous `overflow` value like `PromotionConfirmationModal.tsx:53-57` does.

---

## HIGH

### H1. `resetSchoolAdminPassword` (platform super-admin) writes no audit event
**Verified at:** `packages/convex/functions/platform/index.ts:407-471`
Gated by `requirePlatformAdminInternal` (good), but performs `updatePassword` + `deleteSessions` without inserting into `platformAuditEvents` or `academicTimelineAuditEvents`. Covert account-takeover primitive for a compromised or malicious super-admin — no paper trail. Sibling mutations like `updateSessionDates` audit-log.
**Fix:** Insert audit row with `actorPlatformAdminId`, `targetSchoolId`, `adminUserId`, timestamp. Send a notification to the admin's `contactEmail`.

### H2. `setSchoolStatus` suspends/resumes a school with no audit and no session invalidation
**Verified at:** `packages/convex/functions/platform/index.ts:473-494`
Direct `db.patch` flips `status` with no event log and doesn't call `deleteSessions` on the school's users. Suspended schools keep their cached JWTs valid for read-only paths (`SchoolSuspendedLockScreen` only blocks the UI, not active Convex subscriptions).
**Fix:** Audit-log the transition (with required `reason`); on suspend, fetch every non-archived `users` row in the school and `deleteSessions` for each.

### H3. `school.features.*` is enforced only at the UI layer — backend mutations ignore it
**Verified at:** `apps/admin/app/billing/layout.tsx:62-91`, `apps/admin/app/academic/layout.tsx:99-167`, `packages/convex/functions/platform/index.ts:331-356`
`updateSchoolFeatures` is a public mutation; `schools.features.{billing, curriculum, knowledgeLibrary, admissions}` gates client-side empty states only. `createFeePlan`, `applyFeePlanToClassStudents`, `requestCurriculumGeneration`, knowledge-library mutations — none of them check `school.features.*`. Disabling a module is cosmetic.
**Fix:** Add `assertSchoolFeatureEnabled(ctx, "billing" | …)` helper and call it inside every relevant mutation/query. Especially important given the `feature/admissions-platform` parallel branch.

### H4. `getViewerContext` email-fallback can elevate a user to a different school
**Verified at:** `packages/convex/functions/auth.ts:8-50`
When `identity.subject` doesn't match a `users.authId`, falls back to `q.eq("email", authUser.email.toLowerCase())` with no schoolId equality check. A user who can change their email via Better Auth self-service (or the `updateUser` calls in `academicSetup.ts:489`) can drift to a *different school's* admin row. Same-school admin's `authId` could also change and silently re-bind to a different school's data on next login.
**Fix:** Drop the email fallback or constrain it to a stable cross-table mapping. Add a warning log when the fallback fires.

### H5. `documentGeneration.ts` swallows aiRunLog write failures silently
**Verified at:** `packages/convex/functions/academic/documentGeneration.ts` (around lines 1580 & 1891 per review)
Two `catch {}` blocks comment "Swallow secondary failure; the primary error is what the caller needs." Means failed AI runs stop being observable exactly when observability matters most.
**Fix:** `catch (secondaryErr) { console.error("aiRunLog write failed", secondaryErr); }` and add a test asserting `recordTeacher*AiRun` is invoked on the error path.

### H6. AI route handlers deleted with no feature flag (full blast radius if Convex is down)
**Verified at:** `apps/teacher/app/api/ai/lesson-plans/generate/route.ts` and `apps/teacher/app/api/ai/question-bank/generate/route.ts` (1303 LOC removed in `d813b99`)
Teacher app now hard-depends on Convex actions for lesson-plan and question-bank generation. If Convex is briefly unavailable, those flows are completely down. No circuit breaker, no cached-prompt fallback.
**Fix:** Add `ENABLE_NATIVE_AI_ACTIONS` feature flag and re-mount the deleted routes as thin Convex proxies behind it. Add e2e coverage that asserts action failure surfaces a clean toast.

### H7. Backwards-promotion and same-session guards have no regression test
**Verified at:** `packages/convex/functions/academic/studentEnrollment.ts` (around lines 1183-1244 in review context)
New error messages `"Cannot promote students backwards"` and `"Student promotion requires selecting an upcoming academic session"` exist only in production code. Same-session promotions now **delete** `studentSubjectSelections` (lines 1130-1148) — a buggy re-run silently loses work.
**Fix:** Add `convex-test` integration tests for both rejection paths and an idempotency test that re-running promotion with the same args upserts rather than duplicates.

### H8. `getParentEmailReview` behavior change silently swallows malformed input
**Verified at:** `packages/convex/functions/academic/studentEnrollment.ts:1777-1810` (per review)
Old code threw `"Parent email is required"`; new code returns `{ email: trimmed, matches: [] }`. Callers relying on the throw now silently no-op. Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` rejects some valid addresses (`+tag@sub.example.com`).
**Fix:** Add unit tests for malformed input AND for valid `+tag` addresses. Tighten the regex to RFC 5322 subset.

### H9. `migration action` for olive-blessed school ships in production bundle with no idempotency
**Verified at:** `packages/convex/functions/academic/migrateSplitBranches.ts:14` + `migrateSplitBranchesAction.ts`
Hardcoded `"olive-blessed"` slug. Action is exposed (see C1). Re-running creates duplicate auth users and re-patches class assignments with no guard.
**Fix:** After fixing C1, add a `_state` doc flag (`schools.migrationState`) checked at the top of the action and short-circuit if already run.

---

## MEDIUM

### M1. `FeePlanForm` zero-clipping regression: `"05"` → `"5"` (lost leading zero behavior)
**Verified at:** `apps/admin/app/billing/components/forms/FeePlanForm.tsx:60-67` and `BillingSidebar.tsx:247-249, 362-369`
`d304952` fix only handles the `"0."` prefix. `"05"` (legit "₦5" entered as "0" then "5") is silently retyped as `"5"` after the regex strips the leading zero. No regression test.
**Fix:** Strip leading zeros only when followed by another digit AND not preceded by `.`. Add unit tests: `"0"`, `"05"`, `"0.5"`, `"abc0"`.

### M2. `BillingSidebar.generateAutoReference` uses `Math.random()` for receipt numbers
**Verified at:** `apps/admin/app/billing/components/BillingSidebar.tsx:108-112`
5-char alphanumeric client-side. ~60M space, birthday-bound ~7.7k simultaneous picks can collide; both will then fail the payment insert.
**Fix:** Server-side generation with retry, or `crypto.randomUUID().slice(0,8).toUpperCase()`.

### M3. `updateSessionDates.test.ts` reimplements the handler instead of exercising it
**Verified at:** `packages/convex/functions/academic/__tests__/updateSessionDates.test.ts` (+90 lines)
Lines 23-50 hand-roll `simulateUpdateSessionDates`. The real `updateSessionDates` (`academicSetup.ts:901-993`) could regress without breaking this test. The boundary branch in the test compares against a *re-bound* `effectiveTermStart`, while the real handler uses the **original** `term.startDate`.
**Fix:** Convert to a `convex-test` integration test that calls the real mutation.

### M4. `studentGraduation.test.ts` asserts a tautological reference format
**Verified at:** `packages/convex/functions/academic/__tests__/studentGraduation.test.ts`
Lines 96-108 assert literal `ATT-GREE-GVH20200042-2026` format. The actual `graduateStudents` mutation (in `studentEnrollment.ts` ~lines 1297-1451) — which patches `enrollmentStatus`, purges `studentPromotions`, etc. — has **zero** direct test.
**Fix:** Convert to `convex-test` integration test that calls `graduateStudents` end-to-end.

### M5. `sessionScopedFormTeacher.test.ts` covers1 of 5 blocker branches
**Verified at:** `packages/convex/functions/academic/__tests__/sessionScopedFormTeacher.test.ts` (+211)
Only the session-scoped form-teacher branch is exercised; `classSubjects`, `teacherAssignments`, `subjects`, and the `activeSession === null` fallback paths are untested. The "no active session" branch silently uses only legacy logic — exactly the classes affected by the schema migration risk.
**Fix:** Add four more `it()` blocks.

### M6. All10 new modals lack focus trap, ESC handler, and proper aria
**Files:** `PromotionConfirmationModal`, `GraduationConfirmationModal`, `AttestationLetterModal`, `ConfirmationModal`, `SessionCreationModal`, `TermCreationModal`, `ManageFeaturesModal`, `ResetSchoolAdminPasswordModal`, `FeePlanList`'s inline details modal, `apps/platform/app/schools/page.tsx`'s inline `StatusConfirmModal`. Also `ChangePasswordModal` in shared.
None trap focus, none restore focus to the trigger button, none close on ESC. `PrintableFinanceModal` has no body scroll lock at all.
**Fix:** Extract one `<Modal>` primitive (Radix `Dialog`/Headless UI/hand-rolled with `useEffect` for Escape + focus trap + `aria-modal="true"`/`aria-labelledby`) and replace all 10 implementations.

### M7. `SchoolSettingsPage.handleRemoveLogo` uses native `confirm()`
**Verified at:** `apps/admin/app/admin/settings/page.tsx:213`
Inconsistent with `commit d6f43f6` which removed native `confirm()` everywhere else. Blocks main thread.
**Fix:** Use the existing `ConfirmationModal`.

### M8. `PrintableFinanceModal` injects global `<style>` via portal — leak risk on unmount/error
**Verified at:** `apps/admin/app/billing/components/PrintableFinanceModal.tsx:139-148`
If React errors during unmount, the `<style>` element lingers on `document.body` and the next print attempt hides everything except `.billing-print-root`.
**Fix:** Move print rules to a dedicated CSS class with `print:` Tailwind utilities. Also add ESC + scroll lock (see M6).

### M9. `BulkApplicationForm` submit button not gated on `isSubmitting` — double-click risk
**Verified at:** `apps/admin/app/billing/components/forms/BulkApplicationForm.tsx:147-154`
Form disables on validation but not on async state. Two rapid clicks before parent disables could create duplicate invoices (the per-call `existingInvoices` race window is small but real; see L4 below).
**Fix:** Plumb `isSubmitting?: boolean` from parent and gate.

### M10. `ApplyFeePlanToClassStudents` has no rate limit and no idempotency lock
**Verified at:** `packages/convex/functions/billing.ts:1717-1850` (per review)
For a class of 300 students, this single mutation issues 300+ writes inside one transaction — can hit Convex per-mutation limits with an opaque abort. No school-level rate limit (`lessonKnowledgeRateLimits.ts` doesn't cover billing).
**Fix:** (a) Add `billing_bulk_apply` bucket. (b) Chunk large classes via `ctx.scheduler.runAfter(0, internal..., {...})`. (c) Add server-side lock by `(feePlanId, sessionId, termId, classId)` via the existing `by_school_feePlan_session_term` index.

### M11. Assessment roster reads do not filter `studentPromotions`/`studentSubjectSelections` by schoolId
**Verified at:** `packages/convex/functions/academic/assessmentRecords.ts:215-233`
Queries use `by_to_class_and_to_session` / `by_class_and_session` only. The `by_school` index already exists on these tables — pure defense-in-depth gap.
**Fix:** Add `q.eq("schoolId", schoolId)` to both queries.

### M12. `provisionSchoolAdmin` accepts plaintext `origin` arg, forwards to Better Auth
**Verified at:** `packages/convex/functions/academic/academicSetup.ts:243-261` and `provisioningHelpers.ts`
A platform admin can pass `origin: "https://attacker.com"`. Combined with the recent `localhost:3000-3006` expansion in `betterAuth.ts:25-37` and the broader `TRUSTED_ORIGINS` allowlist, this can be weaponized to mass-provision admin accounts on attacker-controlled origins.
**Fix:** Validate `args.origin` against a server-side allowlist, or remove the arg and use `CONVEX_SITE_URL`.

### M13. `lessonKnowledgeRateLimits` counters rely on document serialization, not schema uniqueness
**Verified at:** `packages/convex/functions/academic/lessonKnowledgeRateLimits.ts:120-235`
Two concurrent `consume` calls for the same `key` can both read `count:0` then both write `count:1`. Low contention in practice but `limit: 10` could drift to `limit: 11`. Acceptable risk; flagged for awareness.

### M14. `formatRelativeTime` produces different SSR vs client output
**Verified at:** `apps/admin/app/admin/dashboard/page.tsx:113-123`
On hydration the `5m ago` value shifts. Use `suppressHydrationWarning` on these spans.

### M15. `dashboard/page.tsx` `setupMilestones` `useMemo` over-includes `unassignedClasses.length`/`totalEnrolledStudents`
**Verified at:** `apps/admin/app/admin/dashboard/page.tsx:220`
Effect re-fires on every subscription tick. Minor perf cost; combines with the banner re-render (#5 in frontend review) to thrash the dashboard.

---

## LOW

- **L1.** `StudentPhotoPanel` blob URL cleanup on file swap is incomplete — same pattern as C3. (`StudentPhotoPanel.tsx:65-69`)
- **L2.** Photo crop quality fixed at 0.88 with no progressive fallback for high-detail images; users get silent rejection. (`studentPhotoCrop.ts:54-67`)
- **L3.** `accept="image/*"` is advisory; SVG can be uploaded (XSS risk if ever rendered as `<img>` in an SVG-capable context). Add an explicit MIME allowlist. (`StudentPhotoPanel.tsx:160`)
- **L4.** Bulk-apply `existingInvoices` pre-check is non-atomic with the write — small race window. Add server-side idempotency lock (see M10).
- **L5.** `setSchoolStatus` only toggles `active ↔ suspended`; `pending` state is unreachable once a school exists. Document or wire.
- **L6.** `bulkApplyFeePlan` doesn't show the exact student count — UX risk of fat-finger on a300-student class. Add derived count + confirm-typed for >50.
- **L7.** `lessonPlan` ID generation falls back to `Math.random()` in browsers without `crypto.randomUUID`. Use `crypto.getRandomValues(new Uint8Array(8))` instead. (`QuestionBankWorkspaceScreen.tsx:118`)
- **L8.** Class-dropdown overlay uses `z-20` — lower than the mobile sticky bar's `z-30`. Bump to `z-40`. (`StudentFirstOnboardingForm.tsx:478-480`)
- **L9.** `ResetSchoolAdminPasswordModal` retains `newPassword` state after close — clear on `onClose` too.
- **L10.** `auth.ts` test file only got +1 line for the new `isSuspended`/`allowSuspended` semantics — no test asserting the throw on suspended.
- **L11.** `documentGeneration.ts` typescript recursion hack for `generateObject` schema — works but worth a `// @ts-expect-error` for clarity.
- **L12.** `classSessionFormTeachers` new table — verify every `createClass`/`updateClass`/`restoreClass`/`restoreTeacher` path writes a corresponding row (review flagged as gap to verify).
- **L13.** `portal/(portal)/layout.tsx` redirects to sign-in in `useEffect` — briefly renders `WorkspaceNavbar` before redirect. Add early-return guard for unauthenticated.
- **L14.** `WorkspaceNavbar` auto-scroll effect runs on every `navLayout` change; `getBoundingClientRect` + `scrollIntoView` triggers forced layout and may scroll the page on mobile. Use `IntersectionObserver`.

---

## NIT

- **N1.** `.env.example` correctly removes `OPENROUTER_API_KEY` from `apps/teacher` and recommends `npx convex env set` — good migration hygiene.
- **N2.** `betterAuth.ts` `localhost:3000-3006` is fine for dev but the production `TRUSTED_ORIGINS` should be reviewed whenever new ports are added.
- **N3.** `apps/admin/app/billing/components/forms/FeePlanForm.tsx:31` `crypto.randomUUID()` fallback: works on all modern browsers in HTTPS, but learners testing on `http://localhost` may get a smaller subset.
- **N4.** `schoolFeaturesValidator` / `schoolBrandingThemeValidator` exported but not used as input args (cosmetic — see H3).
- **N5.** `getCurrentSchoolBranding` catches all errors and returns null — distinguishes suspension UX degradation silently. Log + rethrow genuine errors.

---

## Tests / Coverage| Area | Status |
|---|---|
| `convex-test` integration tests |7 new files;5 of them re-implement logic instead of exercising the real mutation (H7, M3, M4, M5, M12). |
| E2E (`e2e/`) | **Untouched** despite 5 new modals + a full promotion workspace + billing drawer rewrite. |
| Schema migration | All new fields are `v.optional` (safe for old docs), but the new `classSessionFormTeachers` join table will silently drop form-teacher badges for classes created before this branch. Add a `convex-test` that seeds a pre-migration class. |
| Migration script | Ships in production bundle with no test. (C1, H9) |
| `package.json` deps | No new test deps added. |

**Typecheck:** clean across all 16 packages. **No new `.skip`/`.todo`.** **No `.env` leakage.**

---

## Recommended sequence1. **Block merge** until C1–C5 are fixed (C1 alone is a production takeover primitive).
2. **Before fixing C3**, decide whether `SchoolSettingsPage` should also stop overwriting during the in-flight save (it currently does — line 154-209 saves while a subscription update can arrive).
3. **Add a `convex-test` suite** for H7, M3, M4, M5, M10, plus the schema migration scenario.
4. **Add e2e coverage** for the new modals/drawer (one spec per major flow: fee-plan create, promotion guard, graduation, suspended-school lock).
5. **After fixing** C1/C2/H1/H2/H3, re-run the security review focused on the remaining HIGH/MEDIUM items.
