# U4a — Institutional email policy and review

## Status and safety boundary

**Local safe workbench implemented and locally tested. P/G, screenshot evidence E0. Not approval of the complete H5 provider program.** No provider, DNS, network delivery, migration, seed, deployment, production, credential or commit action was performed. Existing unrelated working-tree changes were preserved. No subagents or additional writers were launched.

Read: packet U4a, normative H5 product decisions, D01 privacy/release gates, D03 directory spike contracts, D04 badge contract, Convex generated guidance, actual email/schema/RBAC/auth/audit APIs and U3a/U3b guard patterns.

## Delivered surface

`/admin/settings/email-domains`, linked from School Settings and student/teacher onboarding:
- Separate staff/student templates (`firstname.lastname` default; `f.lastname` supported). Versioned future-address policy; no existing address/login rewrites.
- Branch-owned domain registration **intent**, pending control evidence; declared provider intent is explicitly not a connected/licensed/delegated provider.
- Source domain administrator must explicitly grant sharing to the exact active group before a branch can inherit the domain. Unrelated, unshared, moved-group or archived-group access fails closed. Stopping sharing blocks new inherited approvals without changing old allocations.
- Deterministic candidate sequence, collision reason/stage, optional minor initial naming, manual local-part review, syntax/reserved-name/length and global namespace checks. A candidate already reserved by the same person is explicitly retained (including across a shared-domain branch move); source ownership/lifecycle are not changed and the UI does not relabel its existing provider evidence as a new login-only allocation. Confidence is explicitly not supplied by this deterministic API.
- Dry run is read-only. Approval confirms the exact address and reviewed policy version, revalidates authority/domain/uniqueness transactionally, and reserves **login-only metadata, not an inbox or a new usable authentication alias**.
- Additional-address/alias **metadata relation** can reference a distinct existing address owned by the same person and branch. Old allocation remains frozen. Provider alias activation/forwarding remains unavailable.
- Separate login-only/no inbox, externally evidenced mailbox, and provider-provisioned evidence badges. Last recorded evidence is not a live delivery/access assertion.
- Local suspend/archive intent with confirmation and permanent reservation. Copy explicitly states that neither external access nor Melo login access is revoked by these controls.
- Failure/reconciliation display exposes only safe transient/permanent/unknown classifications. Unknown outcomes require reconciliation before create retry; no fabricated retry/provision/verify/send action exists.
- Loading, empty, denied, duplicate registration, unavailable inherited domain, stale review, manual collision, confirmation and mutation-failure states. Failed mutation edits remain in the mounted form. U3a dirty/departure guard protects in-memory policy/review work and blocks departure during mutation; no credentials or approval state are persisted to drafts/browser storage.

## API / permission contract

All public functions derive authenticated membership/capabilities on the server. Client school/person/domain IDs are selectors, not authorization.

| API | Contract |
|---|---|
| `registerEmailDomain` | `settings.domains.manage`; validates normalized ASCII DNS name, idempotent same-branch registration, rejects an already-registered namespace elsewhere (use explicit inheritance/ownership reconciliation). Writes pending intent only. |
| `setEmailDomainSharing` | Derives source school from domain; source `settings.domains.manage` + explicit confirmation. Grant is pinned to exact active `schoolGroups` ID. No provider delegation implied. |
| `saveEmailPolicy` | `settings.domains.manage`; active owned/shared-domain resolver, confirmation, expected version. Audits immutable version/domain-reference/template summary. |
| `getEmailWorkbench` | Domain policy OR staff approval OR student approval authority; returns permissions, policy, minimized owned/explicitly shared domain context, eligible local people, scoped allocations, provider unavailable marker. No provider account/operation IDs, DNS challenge or raw failure payloads. |
| `getSchoolEmailDomains` | Same email workspace read authority; own-branch domain records only. DNS TXT challenge is a public challenge, not provider credentials; does not verify anything. |
| `proposeEmailAddresses` | Staff recipients require `staff.onboard`; student recipients require `enrollment.intakes.manage`; unclassified membership requires both. Active canonical person/membership; at most 100 supplied people. Requires registered/configured domain; custom arbitrary/fallback domains are rejected. Returns stage, alternatives, reason, policy version, `retainedExistingAddress` and proposal/login-only state (not the state of a retained mailbox). No writes. |
| `reviewEmailAddress` | Same target authority; expected policy version, normalized local part, syntax/reserved/uniqueness review across global `by_email`. Returns valid/email/reason, no reservation. |
| `assignInstitutionalMailbox` | Same target authority + active target + server domain/policy/length/reserved/global uniqueness validation. Configured policies require matching `expectedPolicyVersion`. Legacy unconfigured callers retain version-zero compatibility with an explicitly registered branch domain. New rows include approved policy version and optional same-person/branch alias relation. Does not touch persons/users/memberships/auth. |
| Approval replay | Returns original mailbox/state for same-person reservation; never reactivates status, changes source school, updates alias relation or erases provider failure/evidence. Other-person allocation remains permanently frozen. |
| `getInstitutionalMailboxes` | Same recipient classification used to filter branch rows; not coarse `staff.list.view`. No raw provider identifiers/error payloads returned. |
| `suspendOrArchiveMailbox` | Appropriate recipient authority; staff/unclassified also requires `staff.account.suspend`. Registrar may record student lifecycle. Same-state replay is no-op; archived cannot be moved back to suspended. Local metadata only. |
| `verifyDomain` / `applyProviderMailboxResult` | Internal trusted evidence transitions only. Provider result must match verified domain/provider and stable provider identifier; inactive records reject late result. Last operation replay is idempotent and cannot erase a later failure. No public action invokes them. |
| `recordProviderFailure` | Internal fixed enum only (`transient`, `permanent`, `unknown`), immutable safe audit. Keeps identity, membership and last evidence state intact. No arbitrary provider log or credential input. |

Recipient kind derives from reviewed `branchMemberships.legacyUserId` mapping and server user role, not display title, client `isMinor`, or a caller-selected staff/student label. Unclassified recipients are explicit; they do not inherit staff authority by default. Existing Platform support bypass from U1a is retained, not expanded, and writes are attributed as Platform audit events.

## Files / serialized schema changes

- Created `apps/admin/app/admin/settings/email-domains/page.tsx` and `error.tsx`.
- Created `apps/admin/__tests__/institutional-email.test.tsx`.
- Modified `packages/convex/functions/academic/institutionalEmail.ts` and its existing `emailAndAiImport.integration.test.ts`.
- Narrow additions to existing dirty `packages/convex/schema.ts`: `emailAddressPolicies` table/index; optional domain `sharedGroupId`; optional mailbox `aliasOfMailboxId`, `approvedPolicyVersion`, `lastProviderOperationId`. No RBAC catalog, auth, identity migration or generated API file changed.
- Added links only in existing dirty `apps/admin/app/admin/settings/page.tsx`, `StudentFirstOnboardingForm.tsx`, `TeacherCreationForm.tsx`; preserved earlier changes.
- Updated this result, U4a packet notes and the H5 coverage-matrix row.

Classification: policies/domain-sharing metadata are internal administrative policy; address/person relations are personal/child-confidential under D01. Existing mailbox/audit protections apply. No new external egress, secrets, uploads or credential drafts. Deployment/retention/privacy approval is not established by local schema/test changes.

## Local verification

Final focused commands:
- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/emailAndAiImport.integration.test.ts` — **12 passed** (8 existing + 4 substantial U4a cases).
- `pnpm --filter @school/admin exec vitest run __tests__/institutional-email.test.tsx __tests__/form-adoption-guards.test.tsx` — **12 passed** (8 email + 4 existing guard regressions).
- `pnpm --filter @school/convex typecheck` — **PASS**.
- `pnpm --filter @school/admin typecheck` — **PASS**.
- Focused ESLint: new email route/error/test and email backend/integration tests — **PASS**.
- `git diff --check` — **PASS**; existing CRLF conversion warnings only.
- `node scripts/audit-theme-colors.mjs` — ran, informational. Link additions introduce no colors. Existing onboarding emerald/rose/amber/blue are semantic success/error/warning/info; settings presets are existing tenant inputs. New workbench slate/white are product neutrals, amber is semantic provider/privacy warning. Script scans tracked diffs only; new route was manually classified. No global color replacement.

An initial `pnpm ... test -- <file>` invocation passed a literal `--` to Vitest and unexpectedly selected the broader local Convex suite. It exposed unrelated commercial/assets old auth-message assertions and verticals H1/H4/H3 legacy expectations, then exited with a Windows native failure. It is **not a passing full-suite result**. The touched email authorization test was updated from stale unauthenticated wording to the current `UNAUTHENTICATED` contract, and the intended suite was rerun directly with `exec vitest run` and passed. No unrelated failing tests were edited. An initial DOM assertion checked button `.disabled` instead of inherited fieldset disability; corrected the assertion, reran and passed. Local Prettier is not installed; no dependency was installed.

## Self-review / acceptance evidence

- Cross-branch frozen namespace and same-person address retention without changing source ownership, source sharing opt-in/revocation and archived-group rejection; approval race after dry run; independent domains remain independent.
- Reserved names, malformed/long local parts, arbitrary custom domains, duplicate domain registration, manual invalid review and stale/missing configured-policy version rejected.
- Registrar versus staff approvals/reads and policy/sharing denial tested; public unauthenticated/cross-tenant reads/proposals/writes still denied.
- Canonical person/membership snapshots unchanged through approval, new-name additional-address relation, provider failure and lifecycle.
- Approval retry preserves archived allocation and external evidence; trusted success replay cannot clear a later unknown failure; late inactive provider result rejected.
- Safe attributable immutable approval/alias/failure audit and omission of provider operation ID from DTO checked.
- DOM proves distinct badges, no provider activation controls, unavailable/denied/empty/loading, duplicate prevention, confirmation, failed-edit retention, source sharing confirmation and U3a dirty registration.
- Self-review found and fixed: group linkage alone permitting inheritance; reactive policy or collision updates silently refreshing an already-confirmed approval; stale approval reactivating lifecycle; raw failure/provider IDs in read DTOs.

## U4b address proposal handoff

AI never provisions. For already-created canonical members, call `proposeEmailAddresses` using explicit branch/person IDs and reviewed name inputs. Use returned alternatives/reason/version, then `reviewEmailAddress` for manual local-part edits. Human approval calls `assignInstitutionalMailbox` with exact reviewed email and policy version; allocation is login-only metadata. Do not put proposed addresses into `users.email`, person identity, credentials or memberships. Do not invent canonical IDs for staged import rows. Rows without canonical membership can be previewed within the importer but must return through this authority/validation seam after reviewed identity creation. Arbitrary `customDomain` fallback is no longer supported. Different configured policy domain IDs are rejected.

## Remaining code/program gates and U7 capture contract

- No provider outbox worker, delegated connection, live DNS check, mailbox creation/send, external alias activation, forwarding, recovery or external suspension/archive implementation is enabled. Last-operation replay metadata is **not** a complete out-of-order provider operation ledger. A reviewed provider/outbox program must supply D03 operation idempotency/history/reconciliation before activation.
- Policy/review edits have guarded in-memory retention only, not server draft recovery, multi-tab recovery or durable resume. Do not label this full U3a persistence adoption. Query error boundary may require re-entry; arbitrary browser/history/account behavior still follows U3a limitations.
- Workbench intentionally retains bounded discovery (first 100 local memberships/allocations, first 50 group branches/domains per branch), explicitly labelled. Pagination/search beyond these windows is follow-up code, not a provider gate.
- Templates support the two declared patterns, not arbitrary token-language templates or group-wide template defaults.
- Admin shell retains U1b default-school legacy compatibility restrictions; this page does not activate branch switching or solve capability-only legacy-shell parity.
- **E0: no screenshots captured.** U7 needs an authorized no-seed local browser fixture/target; existing global Playwright setup invokes seed CLI and was not run. Required desktop/320px captures: owner policy + sharing confirmation; registrar student dry-run + manual collision; staff-only denial of student actions; all three evidence badges + unknown/permanent/transient failure; empty/denied/loading; approval/lifecycle confirmation; failed save with preserved edits; Stay/discard departure and keyboard focus/reflow. No image should imply a live mailbox or connected provider.

D01 counsel/minor naming/notice, school controller authority, provider-specific control/licensing/scopes/DPA and D03 sandbox/failure/retry evidence remain unfulfilled. No launch or external activation claim.
