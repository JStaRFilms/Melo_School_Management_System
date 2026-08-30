# School Assets & PDF Compression Foundation

## Goal

Give every school a private, quota-governed document store for non-lesson-knowledge PDFs (school-wide policy PDFs, branding logos, report-card templates, brochures, past papers, circulars, and the like) and an automatic, in-action PDF compression pass that reduces storage cost without changing the on-screen experience for the people who download them.

This document is the implementation-grade source of truth for the **school asset lane**. It explicitly complements — and does not replace — the existing lesson-knowledge storage work in `LessonKnowledgeHub_v1.md` and `LessonKnowledgeHub_v2_ContextFirstPlanning.md`. Lesson knowledge keeps its per-material `storageId` and approval lifecycle. School assets get a flatter, broader-scope store with quota and compression.

## Locked Scope

### Included in v1

- A `schoolAssets` table keyed by `schoolId` with `storageId`, `kind`, size, MIME type, original name, `sha256`, uploader, and timestamps.
- Three Convex functions per school-asset lifecycle stage: upload URL generation, finalize-and-validate, list/get, delete.
- Per-school storage quota tracked on the `schools` row (`storageUsedBytes`), enforced at finalize time and decremented on delete.
- Client-side pre-flight validation (size, type) and a progress-aware uploader component.
- A server-side `compressSchoolAsset` action (Node runtime) using `pdf-lib` for structural re-serialization, metadata stripping, font deduplication, and object-stream compression. Stores the compressed result only if the savings exceed 10%.
- A post-commit compression hook on `finalizeSchoolAssetUpload` for any PDF over 2 MB.
- A `compressionStatus` discriminator (`original | compressed`) on each asset row, with `originalBytes` and `compressedBytes` recorded for the UI.
- An idempotent `bulkCompressSchoolAssets` cron action for backlog cleanup.
- A `SchoolAssetsPanel` admin component with usage bar, kind filter, and per-row delete.

### Explicitly excluded

- Ghostscript / MuPDF / native binary compression. The Convex Node action runtime cannot install system binaries; this lane is pure-Node only.
- Sharp-based image re-encoding inside PDFs in v1. (We can layer it in v1.1 if the Convex runtime loads `sharp` cleanly; until verified, image re-encoding is out of scope.)
- External compression APIs (CloudConvert, iLovePDF, Adobe). Bring them in only if pure-Node savings prove insufficient.
- Anti-virus / malware scanning on upload. Document as a follow-up.
- Image transforms (resize, WebP conversion) for non-PDF assets. Logo uploads stay as-uploaded.
- Public share links / parent-visible downloads of school assets in v1. School-internal only.

## Route Contracts

### Admin routes

| Route | Responsibility | Allowed actions | Notes |
| :--- | :--- | :--- | :--- |
| `/admin/school-assets` | School asset console | List, filter by `kind`, upload, delete, view compression stats and storage usage | Admin-only. Single source of truth for non-knowledge documents. |

### Shared queries / mutations (all school-scoped, all auth-checked)

| Function | Kind | Purpose |
| :--- | :--- | :--- |
| `generateSchoolAssetUploadUrl` | mutation | Returns a one-shot upload URL after quota check. |
| `finalizeSchoolAssetUpload` | mutation | Validates the uploaded file by `size` and `contentType`, inserts the row, increments `storageUsedBytes`, schedules compression. |
| `listSchoolAssets` | query | Returns assets for the caller's `schoolId` with a signed URL. |
| `getSchoolAsset` | query | Returns one asset with a signed URL, gated by `schoolId`. |
| `deleteSchoolAsset` | mutation | Deletes the `storageId`, deletes the row, decrements the quota. |
| `getSchoolStorageUsage` | query | Returns `usedBytes`, `quotaBytes`, and the percentage. |
| `compressSchoolAsset` | action | Node-runtime PDF compressor. Idempotent. |
| `bulkCompressSchoolAssets` | action | Cron-triggered pass that finds unprocessed PDFs above the size threshold and queues them. |

## Schema

### New `schoolAssets` table

```ts
// packages/convex/schema.ts (additive)
schoolAssets: defineTable({
  schoolId: v.id("schools"),
  storageId: v.id("_storage"),
  kind: v.union(
    v.literal("policy_pdf"),
    v.literal("report_template"),
    v.literal("past_paper"),
    v.literal("circular"),
    v.literal("brochure"),
    v.literal("logo"),
    v.literal("other"),
  ),
  originalName: v.string(),
  contentType: v.string(), // application/pdf | image/png | image/jpeg
  size: v.number(), // current bytes in storage
  originalBytes: v.number(), // pre-compression bytes
  compressionStatus: v.union(
    v.literal("original"),     // never compressed (or compression saved <10%)
    v.literal("compressed"),   // replaced with smaller copy
    v.literal("skipped"),      // non-PDF, not eligible
    v.literal("failed"),       // action threw; original retained
  ),
  sha256: v.string(), // dedup key
  uploadedBy: v.id("users"),
  uploadedAt: v.number(),
  compressedAt: v.optional(v.number()),
})
  .index("by_school", ["schoolId"])
  .index("by_school_kind", ["schoolId", "kind"])
  .index("by_school_hash", ["schoolId", "sha256"]),
```

### Additive change to `schools`

```ts
// extend the existing schools table
schools: defineTable({
  // ... existing fields ...
  storageQuotaBytes: v.optional(v.number()), // default 5 * 1024 * 1024 * 1024 (5 GiB)
  storageUsedBytes: v.optional(v.number()),  // maintained by mutations
}),
```

## Limits

| Limit | Value | Where enforced |
| :--- | :--- | :--- |
| Per-file size | 25 MB (25 * 1024 * 1024) | Client + `finalizeSchoolAssetUpload` |
| Per-school quota | 5 GiB (default, override per school) | `finalizeSchoolAssetUpload` (block), `deleteSchoolAsset` (decrement) |
| Compression threshold | Trigger only for PDFs ≥ 2 MB | Action entry guard |
| Compression minimum savings | Replace copy only if `newBytes < originalBytes * 0.9` | Action end |
| Action time | Convex action limit; PDFs ≤ 25 MB re-serialize in 2–5 s | Realistic budget |
| MIME allowlist | `application/pdf`, `image/png`, `image/jpeg` | Mutation validator + client `accept` |

## Implementation Notes

### Upload flow (mirrors existing pattern in `schoolBranding.ts:130`, `studentEnrollment.ts:867`, `lessonKnowledgePortal.ts:507`)

1. Client picks a file.
2. Pre-flight: reject if `file.size > 25 MB` or MIME not in allowlist.
3. `useMutation(api.schoolAssets.generateSchoolAssetUploadUrl)` — checks `storageUsedBytes + file.size <= storageQuotaBytes`, returns a one-shot URL.
4. `fetch(uploadUrl, { method: "POST", body: file })` — returns `{ storageId }`.
5. `useMutation(api.schoolAssets.finalizeSchoolAssetUpload, { storageId, ... })` — re-reads `ctx.db.system.get(_storage, id)` to confirm `contentType` and `size`, then inserts the row and increments the quota.
6. UI shows progress + final size.

### Compression flow

- Triggered automatically by `finalizeSchoolAssetUpload` for any PDF ≥ 2 MB, via `ctx.scheduler.runAfter(0, internal.schoolAssets.compressSchoolAsset, { ... })`. Fire-and-forget.
- Idempotent: action checks `compressionStatus` and skips if already `compressed` or `skipped`.
- Pure-Node `pdf-lib` pass:
  - Strip `Title`, `Author`, `Subject`, `Keywords`, `Producer`, `Creator`.
  - Re-serialize with `useObjectStreams: true`.
  - Replace the `storageId` and update the row only if savings exceed 10%.
- Originals are not retained. A `compressed` row points to the smaller copy; `originalBytes` is preserved for the UI.
- If the action throws, mark `compressionStatus: "failed"` and leave the original in place. A subsequent cron run can retry.

### Cron

Daily at 03:00 UTC, find PDFs with `compressionStatus: "original" | "failed"` and `originalBytes >= 2 MB` per school, dispatch the action per asset. This handles the backlog and any retries.

### Reuse existing helpers

- `ctx.storage.generateUploadUrl`, `ctx.storage.getUrl`, `ctx.storage.delete`, `ctx.storage.store` — same as everywhere else in the codebase.
- `ctx.db.system.get("_storage", id)` for content-type / size verification (already used in `lessonKnowledgeAdmin.ts:916`).
- School-scoped auth guard pattern from `lessonKnowledgeSourceProof.ts:57` and `lessonKnowledgePortal.ts`.
- Delete-orphans safety from `seedRunner.ts:38` and `schoolBranding.ts:181`.

## Out-of-Scope (Explicit Follow-Ups)

- **Real compression** (Ghostscript-class): blocked by the Convex Node action runtime. If schools complain about file sizes, evaluate (a) a Cloudflare Worker running a Ghostscript WASM port, or (b) an external API like CloudConvert. Not now.
- **Sharp-based image re-encoding inside PDFs**: verify `sharp` loads in this project's Convex Node runtime first; if it does, a v1.1 follow-up adds it to the compression action for embedded JPEGs.
- **AV / malware scanning**: document as a future requirement; consider Cloudflare R2 + Workers AV or ClamAV in a sidecar.
- **Public / parent-visible downloads**: defer until a parent-facing asset surface is actually requested.
- **Versioned assets**: schools overwrite a brochure and want the old one back. Out of scope; can be added with a `supersededById` field.

## Acceptance

- A school admin can upload a 4 MB school-policy PDF and see it land in `/admin/school-assets` with a `compressed` badge showing the byte savings.
- A school admin trying to upload a 30 MB file is blocked client-side with a clear message, and would also be blocked server-side if the client guard is bypassed.
- A school admin trying to push the school past 5 GiB sees the upload fail with a quota error referencing the current usage.
- The `bulkCompressSchoolAssets` cron processes a backlog of unprocessed PDFs without duplicating work.
- Existing lesson-knowledge storage in `LessonKnowledgeHub_v1.md` / `v2` is unaffected.
