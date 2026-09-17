Now I have all three reports. Let me also do a few targeted verifications on the most critical findings before compiling.

Confirmed R1 — the symmetric `class_default` + zero classes guard was removed. Let me verify R5 (toggleInvoiceOptionalLineItem auth) and R2 (promote re-promote overwrite).

Confirmed R5 — no `assertAdmin(viewer)` call. Let me verify R4 (migrateSplitBranches idempotency) and R8 (WorkspaceNavbar userRole filter).

Confirmed M1 — `viewerContext !== undefined` returns `true` even when `viewerContext === null`, breaking the loading-state protection. Let me check the WorkspaceNavbar userRole issue and the platform password reset audit gap.

Confirmed R8 — `isStudentPortalUser` is computed but not consumed for filtering. Let me check the migrateSplitBranches password overwrite and the platform audit gap.

Confirmed — no audit events anywhere on platform mutations. Let me check the `migrateSplitBranches` default password.

Confirmed — every re-run of `runSplitMigrationAction` resets both branch admin passwords to `"Admin123!Pass"` (the default), which is a real security regression on a re-run. Let me check the 100.* wildcard config.

Confirmed M2. Now I have enough verification. Let me compile the consolidated report.

# E2E-UX-Polish Code Review

Branch: `audit/e2e-ux-polish` vs `master` · 20 commits · 196 files · +18,136 / −6,078

**Verdict:** Not safe to merge as-is. **6 confirmed regressions** (data integrity + privilege escalation + auth regression), **2 medium security findings**, and a sprawling **1,800-line Convex action file** that centralizes teacher AI generation. The AI migration itself is **more secure than the deleted Next.js routes**, but it inherits unfixed issues from the legacy code path.

---

## BLOCK MERGE — Fix before merge

### R1. Fee-plan `class_default` invariant silently dropped (regression)
`packages/convex/functions/billing.ts:1583-1598` · commit `ddc7c4c`

The "class-default plan must have ≥1 target class" guard was removed alongside the unrelated `ArgumentValidationError` fix. A school can now save a `class_default` plan with zero classes, which `applyFeePlanToClassStudents` later rejects with a confusing error. The UI label "All Classes (Universal Template)" still renders only for `manual_extra`, so the persisted shape contradicts what the user picked.

**Fix:** restore the symmetric check, or coerce `billingMode → "manual_extra"` when `targetClassIds.length === 0`.

### R2. `promoteStudents` silently overwrites prior promotions and allows same-grade repeats
`packages/convex/functions/academic/studentEnrollment.ts:1048-1250` · commit `afc633c` + `1ba12df`

Three holes:
1. **Same-class-different-session** (e.g. JSS1→JSS1 across years) passes all guards — should be rejected unless explicitly a repeat-year.
2. **Already-promoted**: if a student has a prior `studentPromotions` row for `(studentId, fromSessionId)`, the code patches it, **overwrites** `toClassId`/`toSessionId`/`createdAt`, and only re-writes subject selections. The original promotion decision is lost with no warning.
3. **Double-click race**: no transaction guard; two rapid promotes both pass validation.

**Fix:** reject `fromClassId === toClassId` unless `confirmRepeatYear: true`; on existing `studentPromotions` with different target, throw unless `confirmRepromote: true`; preserve `createdAt` on patch.

### R3. `graduateStudents` and `cancelStudentGraduation` are multi-session-unsafe
`packages/convex/functions/academic/studentEnrollment.ts:1297-1447`

A student can be graduated under multiple sessions. The `patch` overwrites prior `graduationDate` and certificate fields. `cancelStudentGraduation` only matches `sessionId`, leaving an orphaned graduation row and clearing `enrollmentStatus` for the wrong session.

**Fix:** reject when any graduation row exists for the student; require explicit cancel first. Or always `insert`, never `patch`.

### R4. `migrateSplitBranches` is non-idempotent, has no audit log, and resets passwords on re-run
`packages/convex/functions/academic/migrateSplitBranches.ts:66-452` + `migrateSplitBranchesAction.ts:84`

- **No migration marker**: a partial re-run will re-archive students, re-delete `teacherAssignments`, and orphan records.
- **No audit events** for: school rename, class moves, student relocations, teacher assignment deletes, John-archive. Destructive operations on 100+ students leave no trail.
- **Default password `"Admin123!Pass"`** (line 84): every re-run resets both branch admins' passwords via `authContext.internalAdapter.updatePassword`. An operator who changed the password post-migration will silently lose it on re-run.
- **`existingObhi` branch** (line 338-348) reassigns ownership with no `confirmOwnershipTransfer` guard.

**Fix:** insert a `splitBranchMigrations` marker row, check `completedAt`; require `confirmOwnershipTransfer: true`; add audit rows; refuse default password if real accounts exist.

### R5. `toggleInvoiceOptionalLineItem` lets a teacher change invoice `balanceDue`
`packages/convex/functions/billing.ts:2581-2645` · commit `ddc7c4c`

Privilege escalation. Every other billing mutation calls `assertAdmin(viewer)`. This one only checks `schoolId` — a regular teacher can flip an optional line item on/off any student's invoice and alter their `balanceDue`. Also: changing the total does **not** regenerate the installment schedule, so per-installment `amount` becomes stale.

**Fix:** add `assertAdmin(viewer);` and call `buildBillingInstallmentSchedule` with the new total.

### R6. AuthProvider loading-state regression — sign-out can leave cached membership
`apps/{admin,teacher,portal,platform}/lib/AuthProvider.tsx:100-114` · commit `c7c80a2`

```ts
if (viewerContext !== undefined) { return true; }   // ← includes null!
return Boolean(sessionRole);
```

Previously `Boolean(viewerContext?.role ?? sessionRole)`. The new logic returns `true` whenever the Convex `useQuery` has resolved to *anything*, including `null`. A logged-out tab with a cached `viewerContext` permanently looks authenticated. Combined with the `getCurrentSchoolBranding` swallowing all errors and returning `null`, a suspended-or-deleted school row can also leave the layout in a weird non-loading state.

**Fix:** mirror the old semantic — `return viewerContext === undefined ? Boolean(sessionRole) : Boolean(viewerContext?.role);`. Also clear the viewer query on sign-out (remount provider or add a query key reset).

---

## Medium-severity findings

### M1. Admin `next.config.js` `100.*` allowedOrigins is `100.0.0.0/8`, not CGNAT
`apps/admin/next.config.js:13-18`

Tailscale CGNAT is `100.64.0.0/10`. The wildcard `"100.*"` matches ~16M addresses. Server Actions are also authentication-gated, so this is not a direct bypass, but the wildcard is much wider than the comment in commit `458efa7` implies. Pin to `"100.6{4-9}.*"`–`"100.1{0-2}{0-9}.*"` or document the intent.

### M2. No audit log on platform mutations`packages/convex/functions/platform/index.ts:331, 366-446, 473-495`

`setSchoolStatus`, `updateSchoolFeatures`, `resetSchoolAdminPassword` write zero audit rows. `resetSchoolAdminPassword` is a credential-rotation event with no trail. Other functions in this file have no `platformAuditEvents` insert. Either the table doesn't exist or it's not being called. Either way, super-admin actions that suspend a tenant or reset a credential must be traceable.

### M3. `WorkspaceNavbar` `userRole` is computed but never filters nav`packages/shared/src/components/WorkspaceNavbar.tsx:154`

```ts
const isStudentPortalUser = userRole === "student";   // never read for filtering
```

A parent who lands on the admin workspace, or a student on portal, sees every link. The avatar initial and profile paragraph consume the role, but link visibility does not. Defense-in-depth gap; relevant because the suspended-school lock screen is currently the only gate (R6 weakens it).

### M4. `getCurrentSchoolBranding` catches all errors → `null`
`packages/convex/functions/academic/schoolBranding.ts:53-87`

`getAuthenticatedSchoolMembership` throws on `Unauthorized`, archived, and missing-school. Catching all and returning `null` makes transient network blips, account archival, and school deletion all silently look like "no branding". Layouts check `=== undefined`, so `null` slips past the loading gate.

### M5. Reset-password action is non-atomic and has TOCTOU
`packages/convex/functions/platform/index.ts:366-446`

`findSchoolAdminAuthIdInternal` → `findUserByEmail` → `updatePassword OR linkAccount` → `deleteSessions`. Between the email lookup and the password write, an admin could be linked/recreated, landing the password on the wrong account. `linkAccount` does not invalidate the user's *other* auth methods, so a previously-OAuth'd admin gains a new credential entry point.

### M6. `getBillingDashboard` filter tautology hides invoice-less events
`packages/convex/functions/billing.ts:1219-1224`

```ts
if (!event.invoiceId) {
  return visibleInvoiceIds.has(String(event.invoiceId ?? ""));   // always false
}
```

Pre-existing, but the dashboard's `summary.gatewayEventCount` calls this; webhook-test events are always dropped.

### M7. `toggleInvoiceOptionalLineItem` does not regenerate installment schedule
`packages/convex/functions/billing.ts:2612-2636`

`installmentSchedule[*].amount` is stale after a total change. Student sees a schedule that doesn't sum to `totalAmount`.

---

## Notable but lower-priority

### L1. `recordManualPayment` over-application creates unapplied limbo
`packages/convex/functions/billing.ts:1878-1884`

Overpayment is allowed (against `balanceDue` only, not the invoice total) and the unapplied portion is stored on the payment but there is no UI to allocate it to other invoices. Visible in the redesigned printable modal.

### L2. `academic-timeline.ts` collapses T2/T3 for very short sessions
`packages/shared/src/academic-timeline.ts:31-95`

For sessions <60 days, `calculateDynamicTermSchedule` produces overlapping terms. Add a minimum-length validator in `createSession` (e.g. ≥60 days) or reduce term count.

### L3. AI route migration is a **security upgrade** (positive finding)
Commits `d813b99`, `ea1f263`

- Auth checks run earlier; Convex validators are non-bypassable.
- OpenRouter key moved out of `apps/teacher/.env` to Convex env (`.env.example` no longer seeds a placeholder).
- No public HTTP surface for `/api/ai/**` anymore.
- Rate-limit consume is atomic with the action.
- **Issue carried over:** `consumeTeacherLessonPlanGenerationLimit` is not idempotent under Convex's automatic 3x action retries — a flaky network can lock a teacher out for the full window. Patch the counter or set `context.preventRetry()` for non-retryable failures.

### L4. `recordTeacherLessonPlanAiRun` failure is silently swallowed in catch
`packages/convex/functions/academic/documentGeneration.ts:1556-1582`

If the audit-log write fails after the primary error, the AI run row is stuck in `"running"` forever. Surface or log to a side channel.

### L5. Dashboard `totalEnrolledStudents` double-counts cross-listed students
`apps/admin/app/admin/dashboard/page.tsx:160-163`

Sums `class.studentCount` across classes. With `classSubjectAggregations` / opt-outs, electives inflate the number. Use the `students` table count as the source of truth.

### L6. Dashboard "Upcoming Events" shows past events
`apps/admin/app/admin/dashboard/page.tsx:540-560`

`listEvents` returns ascending by `startDate` with no `fromTimestamp` filter. Panel shows oldest two.

### L7. Dashboard30-day celebration dismissal is per-browser `localStorage`
`apps/admin/app/admin/dashboard/page.tsx:206-223`

Multi-device and multi-admin: the celebration is silenced for everyone sharing that browser. Move to a per-user Convex setting.

### L8. `documentGeneration.ts` does not resolve session-scoped form teachers for non-active sessions
`packages/convex/functions/academic/documentGeneration.ts`

Generation targeted at a non-active session falls back to active-session teacher mappings. `reportCards.ts` does this correctly.

### L9. WorkspaceNavbar document.title + favicon are written client-side without cleanup
`packages/shared/src/components/WorkspaceNavbar.tsx:131-147`

No `useEffect` cleanup — favicon `<link>` from a prior school persists across route changes. Move to per-workspace `generateMetadata`.

### L10. WorkspaceNavbar desktop `domain_tabs` always navigates to first link in group
`packages/shared/src/components/WorkspaceNavbar.tsx:612-639`

Clicking a top tab from a deep route (`/billing/payments`) yanks to `/billing`, losing state. Make tabs `<button>`s that only swap the sidebar, or pick an in-group child that's currently active.

### L11. `RemoveSchoolLogo` deletes storage before patching school row
`packages/convex/functions/academic/schoolBranding.ts:174-189`

If `db.patch` throws, storage is orphaned. Reverse the order.

### L12. `setSchoolStatus` lacks "pending → active" transition
`packages/convex/functions/platform/index.ts:473-495`

Validator only accepts `"active" | "suspended"`. A "pending" school has no UI path to "active" via this mutation.

### L13. `ResetSchoolAdminPasswordModal` discards password on success
`apps/platform/app/schools/ResetSchoolAdminPasswordModal.tsx:42-65`

Operator has no copy-to-clipboard affordance; the typed password is gone once the modal closes.

### L14. `ManageFeaturesModal` doesn't warn on disabling a live module
`apps/platform/app/schools/ManageFeaturesModal.tsx:104-115`

Flipping Billing off for a school with live invoices silently blocks them on next request.

### L15. Hard-coded "Convex Dev — 100% Online" copy in platform admin
`apps/platform/app/schools/page.tsx:344-355`

Dev leftover; misleads operators about system status.

### L16. SchoolSuspendedLockScreen shows hard-coded phone `+234 (800) 6356-724`
`packages/shared/src/components/SchoolSuspendedLockScreen.tsx`

Fake contact. Wire to runtime config or remove.

---

## AI route migration — security & qualityThe migration from `apps/teacher/app/api/{ai,planning}/.../generate/route.ts` to `packages/convex/functions/academic/documentGeneration.ts` (1,898 lines) is a **net security improvement**:

| Concern | Old (deleted) | New (Convex action) |
|---|---|---|
| Auth | Better-auth token in `Authorization` header (client-supplied) | `getAuthenticatedSchoolMembership` (server-validated) |
| Role check | None at the route boundary | `assertStaffGenerationAccess` runs first |
| Input validation | `requestSchema.safeParse(await request.json())` | Convex `v.*` validators (non-bypassable) |
| OpenRouter secret | Next.js `.env` (could leak into bundles) | Convex env (`.env.example` no longer seeds placeholder) |
| CORS | Implicit Next defaults | N/A — server-to-server |
| Cross-school access | Implicit via Convex queries | Re-checked inside save mutation |

**Carried over:**
- `MAX_PROVIDER_RETRY_ATTEMPTS = 1` × Convex's automatic 3x retry → rate-limit counter is not idempotent. Patch or prevent retry on terminal failures.
- AI run audit log writes are silently swallowed on secondary failure.
- No request-size enforcement; Convex action payloads are larger, but the `sourceExcerptBundle` now travels server-side only — that's a privacy win.

---

## Files most worth a focused re-read

| Priority | File | Why |
|---|---|---|
| 🔴 | `packages/convex/functions/academic/studentEnrollment.ts` | Promote/graduate logic (R2, R3) |
| 🔴 | `packages/convex/functions/billing.ts` | R1, R5, M6, M7 |
| 🔴 | `packages/convex/functions/academic/migrateSplitBranches.ts` | R4 (one-shot, can't be undone safely) |
| 🟠 | `apps/admin/lib/AuthProvider.tsx` | R6 |
| 🟠 | `packages/convex/functions/platform/index.ts` | M2, M5 |
| 🟠 | `packages/shared/src/components/WorkspaceNavbar.tsx` | M3, L9, L10, 1,144 lines |

## Recommended merge path

1. **Block merge.** Land R1–R6 fixes; each is small but collectively load-bearing.
2. **Refactor before next release:** split `WorkspaceNavbar.tsx` and `apps/admin/app/admin/settings/page.tsx` (god-components); split `documentGeneration.ts` into action orchestrator + per-task helpers.
3. **Address M-tier findings** before next code-freeze.
4. **Add the audit-log middleware** (`recordPlatformAuditEvent`, `recordAcademicAuditEvent`) — R4 and M2 share the same fix.
5. **Re-test the AI migration** end-to-end against `consumeTeacherLessonPlanGenerationLimit` retry semantics before promoting teacher AI back to production traffic.
