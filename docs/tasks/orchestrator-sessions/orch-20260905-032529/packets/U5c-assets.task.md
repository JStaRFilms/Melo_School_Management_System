# U5c — Private asset library and upload

## Execution status
Local implementation slice remains **PARTIAL / E0**, not full acceptance. Assets inventory/metadata/sharing UI and closed AV delivery remain, but new upload intake is now server-disabled and shown as unavailable because current transport cannot prove ownership, reserve purchased quota, or guarantee abandoned cleanup. See `../results/S0-storage.md` and `../results/U5c.md`. This is an external/runtime gate plus missing approved internal transport work, not a completed upload feature. U5d consumed the inspection/navigation seam. No live operations or commits.

## Objective / scope
Deliver a private general-school asset library separate from lesson knowledge, with plan-aware upload and truthful quarantine. Dedicated PR, not bundled with commercial settings.

## Context / dependencies
U1d/U1e/U5b. Read H9/H8 and D03 S5/S6. `assets.listSchoolAssets/createAssetUploadIntent/finalizeAssetUpload/getDownloadableAssetUrl` exist; byte validation/scanner results are internal. No app route consumes them. Assets currently expose fixed default constants; group share/edit metadata and fine-grained lifecycle permissions need API parity rather than schema assumptions.

## Ownership
assets.ts upload/list/download/metadata/share sections; proposed `/admin/assets` and components; tests. U5d owns later lifecycle sections, no concurrent edits. Schema/capability/export changes serialized; do not rewrite knowledge library.

## Instructions
1. Add library nav/list/search/filter/kind/metadata/inspection and upload progress for private branch-owned assets. Explicit group sharing requires permitted recipient branches and capability; group membership does not imply access. No anonymous/public links.
2. Use plan-derived caps (25MB default, configurable), authoritative storage metadata and magic/signature checks; ensure upload intent ownership/tenant/type/size/quota. Show quarantine until required scanner evidence, never clean because storage upload succeeded.
3. Keep controlled administrative boundary while scanner/privacy/runtime gates unresolved. Disable downloads for unverified/infected/failed scans and retain recoverable errors. Do not expose internal scanner result writes to the browser.
4. Distinguish view/upload/download/edit/share capabilities and audit sensitive download/finalization/share safely. Integrate U5b active/trash/temp storage reporting without falsely freeing bytes.

## Definition of done / verification
Commercial/assets integration cases cover spoofed school/storage IDs, intent ownership, actual metadata/signature/size/quota, scan unavailable/infected/clean states, explicit sharing and no anonymous URL. UI loading/empty/upload failure/denied/quarantine states, keyboard and 320px behavior; tests/typechecks recorded.

## Artifacts
`results/U5c.md` APIs/permissions/upload-state/storage contract, tests/self-review, scanner gates and U7 requests. Matrix updated; hand U5d library inspection/navigation seam. No live scanner/provider activation, production, migration/deploy, credential or unapproved CLI/PR operations.
