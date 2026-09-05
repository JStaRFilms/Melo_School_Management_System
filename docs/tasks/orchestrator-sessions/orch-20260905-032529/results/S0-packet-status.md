# S0 packet status inventory

Inventory basis: `03-stabilization.task.md`, `implementation-plan.md`, all packet tasks/results, `ui-coverage-matrix.md`, `review-findings.md`, `R1-security.md`, and current `git status`. This is a local source/status inventory, not runtime acceptance. **Every packet remains E0 (no authenticated browser, deployed-function, migration, provider, production, or print/runtime evidence). No packet is overall complete without its stated DoD.**

## Packet-by-packet status

| Packet | Local implementation status | Runtime verification status | Exact missing code / DoD not satisfied |
|---|---|---|---|
| U1a access contract | **Implemented locally** | **Not runtime-verified (E0)** | Roll out schema/functions in authorized development; prove selected-branch and full legacy parity. |
| U1b workspaces | **Partial** | **Not runtime-verified (E0)** | Selected-branch activation/persistence/reset, scoped caller adapters, capability/entitlement parity, and full awaited departure/router guard adoption. Switching remains disabled on unsupported routes. |
| U1c groups | **Implemented locally** | **Not runtime-verified (E0)** | Runtime ownership/link rehearsal and browser evidence; no claim that group membership grants branch access. |
| U1d permissions | **Implemented locally** | **Not runtime-verified (E0)** | Capability parity for all adopted APIs/storage/export paths and managed legacy projection; browser/network evidence. |
| U1e audit | **Implemented locally** | **Not runtime-verified (E0)** | Tenant/group-addressable scalable history/export pagination, producer retention/alert coverage, schema rollout, and print/export runtime fidelity. |
| U1f group defaults | **Partial** | **Not runtime-verified (E0)** | Effective resolvers/consumers for roles, admission, reports, notifications, academic policy, and calendar; only branding plus grading-reference slices exist. |
| U1g group overview | **Partial** | **Not runtime-verified (E0)** | Five authoritative bounded numeric aggregate adapters, exclusions/period semantics, delegated summaries, and guarded drilldowns; current metrics remain unavailable/null. |
| U2a grade policy | **Implemented locally** | **Not runtime-verified (E0)** | Authorized rollout and browser/320px/keyboard acceptance; no runtime claim from local tests. |
| U2b grade consumers | **Implemented locally** | **Not runtime-verified (E0)** | Runtime single/batch print, pagination, grayscale and certified-history evidence; rollout remains gated. |
| U2c numbering | **Partial** | **Not runtime-verified (E0)** | Named branch/level/group counters, inherited/group templates, optimistic policy/counter checks, and import integration. |
| U2d banks | **Implemented locally** | **Not runtime-verified (E0)** | Authorized rollout plus browser/print evidence; no provider verification or live finance operation. |
| U3a draft core | **Partial** | **Not runtime-verified (E0)** | Operational expiry scheduling/retry and active-instance index/claim; actual form adoption, durable recovery and browser history/reload acceptance. |
| U3b people forms | **Partial** | **Not runtime-verified (E0)** | Server draft adapters/recovery Preview/Resume/Discard, validated progress, durable follow-up identity/context reconciliation, and no-duplicate partial-failure handling. |
| U3c long forms | **Partial** | **Not runtime-verified (E0)** | Persistent recovery/tombstones for fee/academic/report forms, Teacher planning adoption/conflict/reauth, and U4b import handoff. |
| U3d theme | **Implemented locally** | **Not runtime-verified (E0)** | Authorized rollout, branch switching/runtime token update, Sites published synchronization seam, and 320px/keyboard/print evidence. |
| U4a email | **Implemented locally** | **Not runtime-verified (E0)** | Provider outbox/provisioning/verification remains intentionally unavailable; persistent review recovery, pagination, and authenticated runtime evidence are missing. |
| U4b import review | **Partial** | **Not runtime-verified (E0)** | Public commit must be disabled or replaced by immutable reviewed per-row plan; explicit create/merge/ignore and class/subject/family decisions, H4 missing-only allocation, audit/reconciliation receipts, bounded retry, and identity/privacy-safe outcomes. |
| U5a commercial | **Partial** | **Not runtime-verified (E0)** | Group totals/delegated summaries, proprietor contract-choice flow, >500 batching/pagination, custom cadence, invoice correction lifecycle, and full draft adoption. Provider/finance/legal gates also remain. |
| U5b usage | **Partial** | **Not runtime-verified (E0)** | Versioned entitlements/caps/cycles/top-ups/exceptions/grace/group pools/model profiles; authoritative estimate/confirm/cancel → reserve/dispatch/settle/reconcile; upload/range batching and all-operation coverage. Disabled controls are not completed workflows. |
| U5c assets | **Partial; upload unavailable** | **Not runtime-verified (E0)** | See `S0-storage.md`. New asset/logo/photo/knowledge/Portal/PDF-candidate intake is server-disabled after authorization. Enabling requires authoritative school/caller/purpose transport evidence, versioned purchased-quota reservation before transfer, provider size enforcement, single-use settlement, abandoned/terminal cleanup and reconciliation. Full search, deeper OOXML validation, and AV/private-delivery approval also remain. Disabled upload is not completion. |
| U5d trash/PDF | **Partial** | **Not runtime-verified (E0)** | Cursor/fair cleanup and durable failure ledger/provider-failure tests; entitlement linkage; PDF/AV fidelity approval. Exact purge remains local synthetic only. |
| U6a transfers | **Implemented locally** | **Not runtime-verified (E0)** | Canonical identity continuity for destination Portal, authorized rollout, and source/destination/denied/mobile/keyboard browser acceptance. |
| U7a acceptance | **Not implemented** | **Not run (E0)** | No safe no-seed browser harness, authenticated journey evidence, evidence manifest, disk-openable HTML report, or screenshots/assets. |

### Counts and release conclusion

- **Implemented locally:** 10 (U1a, U1c, U1d, U1e, U2a, U2b, U2d, U3d, U4a, U6a).
- **Partial:** 12 (U1b, U1f, U1g, U2c, U3a, U3b, U3c, U4b, U5a, U5b, U5c, U5d).
- **Not implemented:** 1 (U7a).
- Runtime verification: **0/23** packets verified; **23/23 E0**.
- Release status: **not complete / NEEDS CHANGES**. R1 Critical 4 is locally contained by fail-closed server upload issuance/finalization, but upload remains unavailable and its authoritative transport/reservation/cleanup implementation is not complete. Critical 1 (import commit) and warnings on Portal transfer identity, draft retention/indexing, cleanup fairness, and group audit scalability remain outside this storage-only task.

Local tests/typechecks reported by packet owners are evidence of local slices only. No live command, provider, migration, deployment, credential, destructive storage, or index operation was performed for this inventory.

## S0 teacher-planning and sharing stabilization update

F5 and F7 from the manual authorization review are locally remediated and focused tests pass; see `S0-teacher-sharing.md`. This does **not** change packet counts or E0 status. U1d remains locally implemented but not runtime-verified; U5c remains partial for its entitlement/transport/AV/search gaps, not for the removed hidden dual-branch sharing dependency. No account/role migration or runtime rollout occurred.
