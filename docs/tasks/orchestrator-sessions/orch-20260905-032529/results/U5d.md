# U5d — Asset Archive, Trash, retention and PDF disclosure

**Local lifecycle/UI slice implemented; PARTIAL / E0. Keep packet open for the code/evidence gaps below.** Consumed U5c's actual Assets library, inspector and navigation seam, exclusive writer. No live purge, cleanup, provider, AV, Convex CLI/codegen, deploy, migration, production, credentials, server/browser or commit. All destructive tests used isolated in-memory synthetic records.

## Delivered routes and semantics

- First-class `/admin/assets/archive` and `/admin/assets/trash`, with Library/Archive/Trash links and separate academic Archive cross-link. Existing academic `/academic/archived-records` behavior preserved; only a link to Asset Archive added.
- Archive is optional `archivedAt/archivedByUserId`, not `isTrashed`. Archive has no deletion countdown and remains charged active storage. Archive/unarchive is independently authorized and audited. Normal deletion moves to Trash; no library permanent-delete button.
- Actual paginated lists, loaded-record search/type/category/recorded-scan filters and inline inspection. Owner, owning branch, private scope, upload/delete times/actor, safe description/name/category/hash/type/bytes, deadline/countdown, holds, sharing and original retention are visible. Long values wrap; controls have labels and native keyboard operation. Inspection focuses its heading and close returns focus to its trigger when present. Browser geometry/accessibility screenshots remain unverified.
- Trash default 30 days or internal approved policy; stored item deadline is authoritative. Policy changes do not rewrite old deadlines. Expired still-present items explicitly mean retained/pending/failed cleanup, not deleted or freed. Restore preserves uploader, branch, archive flag and explicit shares. Restoring archived Trash returns it to Archive, not silently to Library.
- Three storage partitions show recorded active (including Archive), trash and temp/rollback separately; missing values remain unknown. Trash/restore only transfer partitions; deletion releases bytes after storage deletion. Legacy/reconciliation-required assets are disabled in UI and rejected by server accounting guard.
- Apply hold and release hold are separate from Trash/manage, restore and permanent delete. Principal factory role can apply but does not receive removal authority. `assets.holds.remove` is a sensitive permission. Hold removal is not inferred from holding Trash access. Active holds disable purge in UI and block it in the backend.
- Permanent purge requires exact `PURGE <current file name>`, independently checks tenant/permanent-delete capability/Trash/accounting/holds, displays exact file and asset ID, and retains an error for retry without success/credit claims. New immutable purge receipt permits authorized exact-confirmation retries without charging/releasing twice. Foreign/mismatched missing targets do not become idempotent success. Successful manual/expired cleanup writes permanent audit and removes obsolete explicit share grants only after storage deletion succeeds.
- Stopped existing cleanup's zero-delay hot loop when a full batch contains only holds. This is a safety fix, **not a complete cursor-based sweep**; see remaining gap.

## Permission / lifecycle matrix

| Operation | Authority and constraints | Storage / access effect |
| --- | --- | --- |
| List/inspect own Library or Archive | `assets.library.view`, exact active branch authorization | Safe metadata only; no storage URL |
| List/inspect Trash | library view + `assets.trash.manage` | No file serving |
| Edit metadata | `assets.metadata.edit`, not Trash, expected update version | Bytes/hash untouched |
| Archive/unarchive | `assets.archive.manage`, not Trash | Active charge unchanged |
| Move to Trash | `assets.trash.manage`, initialized/reconciled accounting | Active → trash; total unchanged |
| Restore | `assets.restore`, same tenant/accounting | Trash → active, owner/archive/shares preserved |
| Apply hold | `assets.trash.manage` + `assets.holds.apply`, bounded reason | Purge blocked; bytes retained |
| Release hold | separate sensitive `assets.holds.remove` | Explicit removal; expired cleanup may retry |
| Permanent purge | `assets.permanent_delete`, Trash, exact current filename confirmation, no holds | Storage deletion first, then partitions/audit/receipt |
| Download | independent download capability and security gates, then unconditional D03 gate | No URL or successful download |
| Share/revoke | `assets.group_share.manage` and explicit permitted same-group recipient | Read-only metadata, no download; owner charged |

## PDF gate / preservation matrix

| State | Actual UI/server behavior |
| --- | --- |
| Non-PDF | Skip: not a PDF |
| Quarantine, failed/unverified, infected or Trash PDF | Unavailable; no eligibility/clean claim |
| Recorded clean and signature-valid PDF | Still unavailable: D03 runtime/fidelity approval absent; no assumed signatures/encryption/form checks |
| Signed/encrypted/form-sensitive/malformed/unsupported | Inspector discloses must remain unchanged; existing internal verifier rejects unsafe structures |
| Rejected/verified candidate evidence | Bounded last 10 evidence rows, reason/time/cleanup due; structural verification is not promotion permission |
| Commit | Internal-only and hard-gated in server code; no environment switch or browser wrapper |
| Historical optimized asset/original | Shows recorded historical state, retained-original availability and rollback expiry; no new savings or image-compression claim |
| Historical rollback | Remains internal. Now rejects Trash and active holds so it cannot delete a retained version or mischarge active storage; synthetic rollback still measured from original storage metadata |
| Cleanup expiry | Deadline is not proof of deletion; retained temp remains charged until cleanup succeeds |

No image recompression, native binary, scanner/provider invocation or runtime/fidelity approval was introduced. Existing original-preservation implementation remains behind the promotion gate.

## Verification and self-review

Combined final checks (commands/details in U5c): Convex **30 tests PASS** across new workspace (6), commercial/assets (19), U5b usage (5). Admin **12 PASS** across workspace DOM (5) and shell (7). Convex/Admin/Shared typechecks **PASS**. Focused ESLint and `git diff --check` **PASS**. Informational theme audit ran; new surfaces use product-neutral slate/white; academic existing amber is retention warning, blue product accent. No print or global recoloring.

New integration coverage verifies distinct Archive pages/accounting, policy deadline, scope-preserving restore, membership-does-not-share, explicit grant/revoke and branch spoof denial, hold-removal denial, wrong/exact/held purge, confirmed duplicate purge/cleanup idempotence, signature/quota/caller spoof and failed-scan gate. Existing promotion-success test now verifies mandatory closed gate, unchanged original, then uses an explicit synthetic historical promoted fixture to preserve rollback/accounting tests; new hold test proves original remains while rollback is blocked. DOM tests exercise Archive return mutation, metadata inspection/search/nav, exact confirmation, held purge and missing removal authority, retryable deletion-error display, unknown temp bucket and disabled AV/PDF controls.

Self-review removed fake unreachable download return payload, preserved predecessor schema/RBAC/nav changes, kept byte references out of new browser metadata projections, added monotonic metadata version to reject same-millisecond stale edits, protected rollback from held/trashed deletion, bounded new inventory reads and disallowed no-progress cleanup self-rescheduling. No broad academic Archive or lesson-library rewrite.

## Real incomplete acceptance / follow-up

1. Cleanup still uses existing bounded head reads. Full held batches can hide later expired rows; cursor-based sweep/fairness and durable per-item cleanup failure code/retry history are CODE gaps. UI honestly shows expired retained/pending/failed rather than claiming a known failure cause. Manual exact-confirmed purge is a retry seam for authorized operators, not automatic recovery proof.
2. No injected backend storage-provider deletion failure test. Ordering/transactional accounting remains implemented; UI error handling is tested, but this is not external storage atomicity or timeout evidence. Audit/receipts are immutable app records, not an external WORM claim.
3. Retention-policy linkage/editor still depends on U5b authoritative commercial entitlement work. Internal policy is configurable, not purchased entitlement evidence or a universal promise of 30 days. Raw abandoned uploads/knowledge-library bytes remain unreconciled (U5c).
4. Search filters only loaded records. No full-text backend search. File owner is shown from stored school-user attribution; historical Platform uploads may truthfully have no recorded owner name.
5. Candidate evidence remains structural, not approved fidelity/AV job/hash provenance. No runtime optimization/promotion acceptance; exact visual fidelity, unsafe corpus breadth, stale-source runtime races and cleanup failures require additional approved synthetic tests. Rejected candidate evidence remains subject to existing short-lived cleanup rather than a new long-term verification ledger.
6. U7 **required synthetic screenshots**, not performed: desktop/320px keyboard Library → Archive → Trash → Inspect → Restore; long filenames; empty/filter; held Trash with removal denied; exact-confirmation purge disabled/enabled using mock/no destructive live dispatch; revoked permission; stale edit; expired retained/cleanup-error and unchanged partitions; quarantined/failed scanner; PDF skip/unavailable/rejected and retained original. No destructive live acceptance is authorized.

Files shared with U5c result; additional lifecycle schema: archive fields, purge receipts, policies/shares; sensitive capability separation; academic cross-link; results/matrix/packet notes. Additive schema rollout and existing asset baseline migration remain separately gated. **Do not classify these remaining implementation gaps as merely AV/provider-blocked, and do not mark U5d done.**
