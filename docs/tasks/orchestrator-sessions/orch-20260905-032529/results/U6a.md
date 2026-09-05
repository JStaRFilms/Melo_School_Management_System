# U6a — Within-group student transfers

**Implementation delivered and locally verified; runtime/browser acceptance E0, U7 pending.** No live Convex/CLI/codegen, deployment, migration, provider, production operation, credential access, server, or commit was performed. Existing predecessor changes were preserved. Additive schema/functions are authored only, not rolled out. M9 and automated staff-transfer policy remain excluded.

## Routed workflow

Actual Admin `/academic/students/transfers`, discovered through Academic **Transfers** navigation, the student-list link, and the profile **Within-group transfer history** link (`?student=...`). Uses generated typed APIs, not mocked runtime data.

- Authoritative branch access gate before student queries. Source class → own-class student selector, same-active-group destination metadata, explicit proposed class/session names, guardian consent method/evidence reference and attestation, optional academic/attendance summary, minimal preview, and source/destination confirmation.
- Source proposal names are intentionally **not destination class/session selectors**: source authority does not confer destination operational access. Destination registrar chooses its actual nonarchived class and the one active academic session at acceptance. Names and session/class/number mappings are retained as snapshots.
- Incoming/outgoing/finalized list; scoped review, release, reject/cancel, actual class/session and policy preview, automatic number or separately authorized manual override with reason/confirmation/explicit counter choice, permanent timeline and scoped continuous history.
- Loading, empty/unlinked, denied, error/retry, missing class/session, missing policy, stale state/configuration, finalized and uncertain-response states. Confirmation and reason gates are native labelled controls. Wrapping layouts use a single column on narrow screens; no browser/mobile acceptance is claimed.
- U3a guard-only adoption: proposal/review dirty registration, guarded review/new-proposal navigation, pending-operation discard prevention. No server draft, browser storage, dossier recovery cache or fake Save draft action. Only page memory is used. Definitive Convex rejection unlocks correction; uncertain transport errors freeze the submitted payload and retain an identical retry closure/key. Hard reload does not restore form edits; reload recovery is the authoritative transfer list/history, not a durable draft promise.

## State / action / permission diagram

```text
source authority + same active group + verified guardian consent
                          |
                       initiated
                          | source release
                    source_released
                          | destination authority + actual class/session
                          | + atomic automatic allocation / governed manual claim
                       completed

initiated or source_released -- source explicit cancel + reason --> cancelled
initiated or source_released -- destination explicit reject + reason --> rejected
completed/cancelled/rejected -- no new transition

Identical acknowledged intent replay returns its original action result,
not a second transition; timeline independently shows current state.
```

Transfer authority retains the packet's current contract: U1a active branch membership plus Platform/legacy-admin compatibility, branch proprietor, or one of `enrollment.intakes.manage`, `academic.classes.manage`, `enrollment.decisions.record`. No group membership alone grants another branch's operations. Manual numbering additionally requires `enrollment.admissions.override_number` through U2c's own helper. Legacy shell admission remains U1b-compatible/default-school only; this packet does not activate global branch switching or claim capability-only shell parity.

Every mutation authorizes the acting branch **before** replay/state handling. Initiate/release/accept recheck active schools, unique branch links and active same group. Abort can unwind a pending proposal even if group configuration subsequently changed; it never rewrites source enrollment. Source release requires recorded consent. Acceptance also rejects a source student that has since been archived/withdrawn/graduated/transferred, an archived/foreign class, a foreign/stale session or changed reviewed numbering policy.

## API manifest — `api.functions.academic.transfers`

| API | Signature / behavior |
|---|---|
| `getTransferWorkspace` query | `{schoolId}` → denied flag or safe current-school classes/active sessions, same-group destination ID/names, independent `canOverrideNumber`. No other branch roster/class/session data. |
| `listTransferCandidates` query | `{schoolId,classId}` → own active students' ID/name/admission number only. Validates class scope before roster access. |
| `previewTransferNumber` query | `{schoolId,classId}` → U2c nonmutating proposed identifier/policyVersion or explicit unavailable configuration. Transfer authority, not a broader numbering-policy read grant. |
| `initiateStudentTransfer` mutation | Existing source/destination/student/guardian consent args plus optional `requestKey`, `proposalClassName`, `proposalSessionName`, academic summary/attendance. UI requires names and generates one stable source-scoped request key. Stored initiation fingerprint rejects changed payload reuse; exact replay returns original transfer ID/name/initiated action result even after later completion. Compatibility callers without a key still face the one-active-transfer and source-lifecycle gates. Legacy `medicalNotes` input is ignored, never stored/shared. |
| `authorizeSourceRelease` mutation | `{transferId,sourceReleaseNote?}`. Source authority, consent/group/state, bounded note. Exact recorded release/note replay returns original release result without a second audit. Different note is stale, not an edit operation. |
| `acceptDestinationTransfer` mutation | `{transferId,destinationClassId,destinationSessionId?,expectedPolicyVersion?,admissionNumberOverride?,admissionNumberOverrideReason?,admissionNumberOverrideConfirmed?,advanceCounterTo?}`. UI always supplies actual session and automatic preview version. Legacy absent session resolves only the one active destination session, never an arbitrary year. Fixed-field acceptance fingerprint makes argument property ordering irrelevant; identical completed replay returns original destination student ID/number. Changed finalized intent rejects. |
| `rejectOrCancelTransfer` mutation | `{transferId,reason,action?:'cancelled'|'rejected'}`. UI explicitly chooses its current branch persona; no proprietor/double-membership destination-first ambiguity. Legacy absent-action callers retain destination-first/source-fallback behavior. Same status/reason replays once; conflicting finalization rejects. |
| `getTransfer` query | `{transferId}` → scope-redacted participant record, or null for missing. No initiation/acceptance fingerprints or request keys returned. Legacy health data stripped at read time. |
| `listTransfersBySchool` query | Existing `{schoolId,direction?,status?}` signature. Current-branch redaction, newest first. |
| `listTransfersByGroup` query | Existing `{groupId,status?}` signature. Filters individually unauthorized transfer edges rather than failing an otherwise valid branch reader's entire group result. Does not grant all-group history. |
| `getStudentTransferHistory` query | `{studentId}`. First authorizes that student's actual school, then follows connected enrollment IDs across individually authorized transfer edges. Stops at unauthorized edges; no arbitrary source-student probing by a destination-only reader. |

## Numbering / history mapping

No allocator fork: automatic acceptance calls `allocateNextAdmissionNumberHelper` with actual class level and reviewed policy version. Manual acceptance now calls `commitManualAdmissionNumberHelper`: permanent uniqueness claim, separate capability, 8–240 character reason, confirmation, optional exact counter advancement. Blank advancement never parses the identifier or advances the counter. Preview never allocates. Claims/allocation, destination user/student creation, source lifecycle update, mapping and audits are one Convex mutation transaction; failure rolls everything back.

`studentTransfers` retains source student/school → destination student/school/class/session/admission number, class/session/branch display snapshots, consent, timestamps, source note and final reason. Source `students.schoolId`, `classId`, admission identifier, user and historical attendance/scores/invoices are not rekeyed. Only source student enrollmentStatus becomes `transferred_out` on successful acceptance. Release/abort do not touch the source student, including a later withdrawal. Destination gets a separate active student/user context, not a tenant rewrite.

Portable data is bounded identity plus explicitly supplied academic/attendance summary (or existing class/admission summary); missing attendance is **not** fabricated as 100%. No financial, health, safeguarding, disciplinary or custom-attribute copying. Existing source guardian name/phone, user phone, address and house fields are no longer automatically copied to destination enrollment. The existing supported student-account identity linkage/name/email remain in the new destination user context; the UI discloses that separately from the portable academic preview. Source-only readers do not receive destination class/session/student/admission mapping or accepting actor details; destination-only readers do not receive source release note/actor/timestamp. A safe release-exists flag preserves the released→rejected timeline without revealing private source details. Participant branch-name snapshots identify the actual transfer, not unrelated branch operations.

Permanent statutory audit events remain append-only through U1e. Abort audit summary no longer contains raw free-text reasons; reasons remain in scoped transfer detail. No cryptographic signing, legal verification, source dossier download, independent-school network or production immutable-database guarantee is claimed.

## Verification (executed locally)

- Convex `vitest run functions/academic/__tests__/transfers.integration.test.ts functions/academic/__tests__/admissionNumbers.integration.test.ts functions/academic/__tests__/groups.integration.test.ts`: **3 files / 24 PASS** (12 transfer, 8 numbering, 4 groups).
- Admin `vitest run __tests__/transfers-workspace.test.tsx __tests__/workspace-shell.test.tsx`: **2 files / 13 PASS** (6 new transfer DOM cases, 7 shell regressions).
- Shared navigation/route-access suites: **2 files / 9 PASS**.
- Convex, Admin, Shared `typecheck`: **all PASS**, rerun after implementation.
- Explicit changed-file ESLint: **0 errors, 4 existing unused-symbol warnings in student list**; no new warnings/errors. New backend, tests, routes and profile link pass.
- `node scripts/audit-theme-colors.mjs`: executed, informational. New transfer controls use product-neutral slate/white/border colors, no tenant palette/status/grade substitutions. Existing list/profile direct colors remain pre-existing product actions/status/neutral surfaces; link additions introduce no direct tenant color. No global replacement.
- `git diff --check`: PASS, existing LF/CRLF advisories only. Installed nested Prettier used locally; no dependency/download.

Changed-behavior tests cover source/destination separation and explicit cancel/reject, capability-only backend grant/revocation (including replay denial), unrelated group/foreign class selector denial, absent consent, pre-release acceptance, stale policy/session, archived group, source withdrawal, active duplicate/new-key rejection, altered intent, concurrent duplicate acceptance and one claim/student/audit, manual denied/reason/claim/unchanged counter, identical release/rejection/cancellation, legacy health redaction, missing attendance, full source invoice/attendance/score document equality, two-hop history and restricted source details. DOM covers denied/error, proposal confirmation and same-key retry, source-only controls/history, destination class/session/confirmation, same-payload acceptance retry, explicit rejection/finalized controls and governed manual advancement.

Ordinary failures resolved: unauthenticated history now returns the direct U1a `UNAUTHENTICATED` code, so the precise denial assertion was updated; no denial was weakened into success. A profile-link JSX placement and an unescaped apostrophe failed local checks, were corrected and rerun. Temporary generation files were removed by exact path. Root Prettier executable was absent; existing nested installation was used. No failing check was ignored.

## Self-review / boundaries / U7 request

Reviewed authorization-before-replay, stable fixed-field intents, source/destination dual-authority choice, current group/state revalidation, medical redaction even for legacy rows and both-scope callers, rollback and permanent claims, no source enrollment rewrite on abort, connected-history redaction, guarded imperative selection, no hidden draft data, discoverable actual routes and safe account/branch-keyed remount. Removed the duplicate manual uniqueness allocator, fabricated attendance, automatic guardian/contact copying and abort's incorrect forced-active patch.

Explicit operational bounds fail closed rather than silently truncating: 100 branch directory entries, 500 classes/students per selector, 100 sessions, 500 transfers per school direction/group list, 100 connected enrollment contexts/100 edges per student-history direction. A larger installation needs a separately reviewed paginated adapter; not presented as complete partial results. Source proposals are names until destination review. Long-form persistence/hard-reload draft restoration and global branch switching are not enabled.

U2c remaining named/group counters and inherited numbering templates remain its documented limitations; this packet consumes the actual branch-counter contract. No new allocator defect was discovered. Existing user/person identity behavior is retained; no portal membership/login migration was attempted.

**U7:** request authorized synthetic source-only, destination-only, dual-member and denied personas; desktop + 320px + keyboard confirmation/preview/timeline/history evidence; actual Back/sidebar/sign-out dirty guard behavior; source release then destination class/session acceptance with displayed final number; stale policy/class/session/consent, revoked authority, lost-response replay, reject/cancel and missing-group/numbering states. Verify no source private dossier/health/guardian-contact data in network payloads, no duplicate enrollment/number on retry, and unchanged source attendance/score/invoice records. No screenshots, browser evidence or deployed endpoint availability claimed here.

Files: `academic/transfers.ts`, transfer integration suite, only additive `studentTransfers` schema fields/index and optional attendance value; new Admin `academic/students/transfers/{page,error}.tsx`, new `__tests__/transfers-workspace.test.tsx`; narrow student-list/profile and shared Academic navigation links; this result, packet completion note and matrix. Numbering/auth/groups/draft helpers and generated files were not modified by U6a.
