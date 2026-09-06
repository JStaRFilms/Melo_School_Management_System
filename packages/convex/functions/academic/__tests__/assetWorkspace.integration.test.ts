import { seedReviewedTenantOperator, seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const a = api.functions.academic.assets;
async function storeTypedBlob(t: ReturnType<typeof convexTest>, contentType: string) {
  return t.run(async ctx => {
    const id = await ctx.storage.store(new Blob(["not a PDF"]));
    // convex-test omits Blob.type; emulate endpoint metadata in the test-only unparameterized harness.
    await ctx.db.patch(id, { contentType });
    return id;
  });
}
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "Owner", slug: "owner", status: "active", createdAt: now, updatedAt: now });
    const otherId = await ctx.db.insert("schools", { name: "Recipient", slug: "recipient", status: "active", createdAt: now, updatedAt: now });
    const outsiderId = await ctx.db.insert("schools", { name: "Outsider", slug: "outsider", status: "active", createdAt: now, updatedAt: now });
    await ctx.db.insert("platformAdmins", { authId: "platform", authTokenIdentifier: "test|platform", name: "Operator", email: "operator@test.invalid", isActive: true, createdAt: now, updatedAt: now });
    const userId = await ctx.db.insert("users", { schoolId, authId: "admin", authTokenIdentifier: "test|admin", name: "Principal", email: "admin@test.invalid", role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
    const personId = await ctx.db.insert("persons", { name: "Owner", email: "owner@test.invalid", status: "active", createdAt: now, updatedAt: now });
    const groupId = await ctx.db.insert("schoolGroups", { name: "Group", slug: "group", proprietorPersonId: personId, status: "active", settingsVersion: 1, createdAt: now, updatedAt: now });
    for (const id of [schoolId, otherId]) await ctx.db.insert("schoolGroupBranches", { schoolId: id, groupId, isHeadquarters: id === schoolId, linkedAt: now });
    const storageId = await ctx.storage.store(new Blob(["%PDF-synthetic"], { type: "application/pdf" }));
    const metadata = await ctx.db.system.get("_storage", storageId);
    if (!metadata) throw new Error("fixture storage missing");
    const assetId = await ctx.db.insert("schoolAssets", { schoolId, storageId, fileName: "Policy.pdf", category: "Policy", mimeType: "application/pdf", byteSize: metadata.size, sha256: metadata.sha256, scanStatus: "quarantined", validationStatus: "pending", isTrashed: false, uploadedByUserId: userId, storageAccountingInitializedAt: now, createdAt: now, updatedAt: now });
    await ctx.db.insert("usageMeterAllocations", { schoolId, meterType: "storage_bytes", allocatedUnits: 10000, consumedUnits: metadata.size, reservedUnits: 0, activeStorageBytes: metadata.size, trashStorageBytes: 0, tempStorageBytes: 0, resetCadence: "termly", lastResetAt: now, updatedAt: now });
    await seedReviewedTenantOperator(ctx, [schoolId, otherId], "test|reviewed");
    await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|source-share", ["assets.group_share.manage"]);
    await seedReviewedTenantOperatorWithCapabilities(ctx, [otherId], "test|recipient-library", ["assets.library.view"]);
    await seedReviewedTenantOperatorWithCapabilities(ctx, [outsiderId], "test|outsider-share", ["assets.group_share.manage"]);
    return { schoolId, otherId, outsiderId, assetId, storageId, size: metadata.size };
  });
  return { t, p: t.withIdentity({ tokenIdentifier: "test|reviewed", subject: "reviewed" }), principal: t.withIdentity({ tokenIdentifier: "test|admin", subject: "admin" }), ...ids };
}
it("authorizes every branch, projects no storage references and keeps delivery closed for clean flags", async () => {
  const { t, p, schoolId, otherId, assetId } = await fixture();
  await expect(t.query(a.getWorkspace, { schoolId })).rejects.toThrow();
  await expect(p.query(a.inspectAsset, { schoolId: otherId, assetId })).rejects.toThrow("branch");
  const row = await p.query(a.inspectAsset, { schoolId, assetId });
  expect(row).not.toHaveProperty("storageId"); expect(row).not.toHaveProperty("rollbackStorageId");
  await t.run(ctx => ctx.db.patch(assetId, { scanStatus: "clean", validationStatus: "valid" }));
  await expect(p.query(a.getDownloadableAssetUrl, { schoolId, assetId })).rejects.toThrow("approval required");
  expect(await p.query(a.getWorkspace, { schoolId })).toMatchObject({ downloadAvailable: false, optimizationAvailable: false, policyReference: null });
  await t.run(ctx => ctx.db.patch(assetId, { scanStatus: "scanning" }));
  await t.mutation(internal.functions.academic.assets.recordAssetScanFailure, { assetId, code: "timeout" });
  expect(await p.query(a.inspectAsset, { schoolId, assetId })).toMatchObject({ scanStatus: "failed", scanFailureCode: "timeout" });
  await expect(p.query(a.getDownloadableAssetUrl, { schoolId, assetId })).rejects.toThrow("Access Denied");
});
it("archive is active charged storage, Trash follows policy and restore preserves archive, owner and shares", async () => {
  const { t, p, schoolId, otherId, assetId, size } = await fixture();
  await t.mutation(internal.functions.academic.assets.configurePolicy, { schoolId, maxFileSizeBytes: 1024, trashRetentionDays: 7, policyReference: "approved synthetic policy" });
  await p.mutation(a.setBranchShare, { schoolId, assetId, recipientSchoolId: otherId, shared: true });
  await p.mutation(a.setArchived, { schoolId, assetId, archived: true });
  const pageArgs = { schoolId, paginationOpts: { numItems: 30, cursor: null } };
  expect((await p.query(a.listAssets, { ...pageArgs, workspace: "library" })).page).toHaveLength(0);
  expect((await p.query(a.listAssets, { ...pageArgs, workspace: "archive" })).page).toHaveLength(1);
  expect((await p.query(a.getWorkspace, { schoolId })).storage).toMatchObject({ active: size, trash: 0, consumed: size });
  await p.mutation(a.trashAsset, { schoolId, assetId });
  const trashed = await p.query(a.inspectAsset, { schoolId, assetId });
  expect(trashed.purgeScheduledAt).toBe(Date.now() + 7 * 86400000);
  expect((await p.query(a.getWorkspace, { schoolId })).storage).toMatchObject({ active: 0, trash: size, consumed: size });
  await p.mutation(a.restoreAsset, { schoolId, assetId });
  const restored = await p.query(a.inspectAsset, { schoolId, assetId });
  expect(restored.archivedAt).not.toBeNull(); expect(restored.ownerName).toBe("Principal"); expect(restored.shares).toHaveLength(1);
});
it("membership alone shares nothing; explicit grants are tenant-bound and revoked immediately", async () => {
  const { p, schoolId, otherId, assetId } = await fixture();
  expect((await p.query(a.listSharedAssets, { schoolId: otherId })).rows).toHaveLength(0);
  await expect(p.mutation(a.setBranchShare, { schoolId: otherId, assetId, recipientSchoolId: schoolId, shared: true })).rejects.toThrow();
  await p.mutation(a.setBranchShare, { schoolId, assetId, recipientSchoolId: otherId, shared: true });
  expect((await p.query(a.listSharedAssets, { schoolId: otherId })).rows).toHaveLength(1);
  await p.mutation(a.setBranchShare, { schoolId, assetId, recipientSchoolId: otherId, shared: false });
  expect((await p.query(a.listSharedAssets, { schoolId: otherId })).rows).toHaveLength(0);
});
it("lets a source-only operator choose an explicit same-group recipient without receiving recipient access", async () => {
  const { t, schoolId, otherId, outsiderId, assetId } = await fixture();
  const source = t.withIdentity({ tokenIdentifier: "test|source-share", subject: "source-share" });
  const recipient = t.withIdentity({ tokenIdentifier: "test|recipient-library", subject: "recipient-library" });
  const outsider = t.withIdentity({ tokenIdentifier: "test|outsider-share", subject: "outsider-share" });

  expect(await source.query(a.listShareRecipients, { schoolId })).toEqual([
    { schoolId: otherId, name: "Recipient" },
  ]);
  await source.mutation(a.setBranchShare, { schoolId, assetId, recipientSchoolId: otherId, shared: true });
  await expect(source.query(a.listSharedAssets, { schoolId: otherId })).rejects.toThrow();
  await expect(outsider.mutation(a.setBranchShare, { schoolId: outsiderId, assetId, recipientSchoolId: otherId, shared: true })).rejects.toThrow("branch");

  const shared = await recipient.query(a.listSharedAssets, { schoolId: otherId });
  expect(shared.rows).toHaveLength(1);
  expect(shared.rows[0]).toMatchObject({ _id: assetId, fileName: "Policy.pdf", ownerSchoolName: "Owner" });
  for (const privateField of ["schoolId", "storageId", "uploadedByUserId", "sha256", "trashedByUserId", "purgeScheduledAt", "accountingReady", "rollbackExpiryAt"])
    expect(shared.rows[0]).not.toHaveProperty(privateField);
});
it("holds have separate removal authority; confirmed purge cannot override holds or release charged bytes", async () => {
  const { t, p, principal, schoolId, assetId, size } = await fixture();
  const hold = await principal.mutation(a.applyRetentionHold, { schoolId, assetId, holdReason: "Statutory retention" });
  if (!hold) throw new Error("missing hold");
  await expect(principal.mutation(a.removeRetentionHold, { schoolId, holdId: hold._id })).rejects.toThrow();
  await principal.mutation(a.trashAsset, { schoolId, assetId });
  await expect(p.mutation(a.permanentPurgeAsset, { schoolId, assetId, confirmation: "PURGE wrong.pdf" })).rejects.toThrow("confirmation");
  await expect(p.mutation(a.permanentPurgeAsset, { schoolId, assetId, confirmation: "PURGE Policy.pdf" })).rejects.toThrow("hold");
  await t.run(ctx => ctx.db.patch(assetId, { purgeScheduledAt: Date.now() - 1 }));
  await t.mutation(internal.functions.academic.assets.cleanupExpiredAssetStorage, {});
  expect((await p.query(a.getWorkspace, { schoolId })).storage?.consumed).toBe(size);
  await p.mutation(a.removeRetentionHold, { schoolId, holdId: hold._id });
  await p.mutation(a.permanentPurgeAsset, { schoolId, assetId, confirmation: "PURGE Policy.pdf" });
  expect((await p.query(a.getWorkspace, { schoolId })).storage).toMatchObject({ consumed: 0, trash: 0 });
  await expect(p.mutation(a.permanentPurgeAsset, { schoolId, assetId, confirmation: "PURGE Policy.pdf" })).resolves.toMatchObject({ success: true });
  expect((await p.query(a.getWorkspace, { schoolId })).storage?.consumed).toBe(0);
  expect(await t.mutation(internal.functions.academic.assets.cleanupExpiredAssetStorage, {})).toMatchObject({ queued: 0, source: "trash", isDone: true });
});
it("advances past more than a batch of held rows without changing held storage or accounting", async () => {
  const { t, schoolId, size: fixtureSize } = await fixture();
  const seeded = await t.run(async ctx => {
    const allocation = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique();
    if (!allocation) throw new Error("missing allocation");
    const held: Array<{ assetId: Id<"schoolAssets">; storageId: Id<"_storage">; size: number }> = [];
    let addedBytes = 0;
    let laterAssetId: Id<"schoolAssets"> | undefined;
    for (let index = 0; index < 5; index++) {
      const storageId = await ctx.storage.store(new Blob([`cleanup-${index}`]));
      const metadata = await ctx.db.system.get("_storage", storageId);
      if (!metadata) throw new Error("missing storage metadata");
      const assetId = await ctx.db.insert("schoolAssets", { schoolId, storageId, fileName: `Cleanup ${index}.pdf`, category: "Test", mimeType: "application/pdf", byteSize: metadata.size, sha256: metadata.sha256, scanStatus: "quarantined", validationStatus: "pending", isTrashed: true, purgeScheduledAt: Date.now() - 100 + index, storageAccountingInitializedAt: Date.now(), createdAt: Date.now() + index, updatedAt: Date.now() });
      addedBytes += metadata.size;
      if (index < 4) {
        await ctx.db.insert("assetRetentionHolds", { assetId, schoolId, holdReason: "Required hold", appliedAt: Date.now() });
        held.push({ assetId, storageId, size: metadata.size });
      } else {
        laterAssetId = assetId;
      }
    }
    await ctx.db.patch(allocation._id, { consumedUnits: allocation.consumedUnits + addedBytes, trashStorageBytes: (allocation.trashStorageBytes ?? 0) + addedBytes, updatedAt: Date.now() });
    if (!laterAssetId) throw new Error("missing later asset");
    return { held, laterAssetId };
  });
  await t.mutation(internal.functions.academic.assets.cleanupExpiredAssetStorage, { limit: 3 });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.get(seeded.laterAssetId))).toBeNull();
  const heldState = await t.run(async ctx => {
    const rows = await Promise.all(seeded.held.map(row => ctx.db.get(row.assetId)));
    const storage = await Promise.all(seeded.held.map(row => ctx.db.system.get("_storage", row.storageId)));
    const allocation = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique();
    return { rows, storage, allocation };
  });
  expect(heldState.rows.every(Boolean)).toBe(true);
  expect(heldState.storage.every(Boolean)).toBe(true);
  const heldBytes = seeded.held.reduce((total, row) => total + row.size, 0);
  expect(heldState.allocation).toMatchObject({ consumedUnits: fixtureSize + heldBytes, trashStorageBytes: heldBytes });
  expect(await t.run(ctx => ctx.db.query("assetPurgeReceipts").take(10))).toHaveLength(1);
});

it("records a failed cleanup without accounting drift and retries it idempotently", async () => {
  const { t, schoolId, size: fixtureSize } = await fixture();
  const seeded = await t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob(["retry-cleanup"]));
    const metadata = await ctx.db.system.get("_storage", storageId);
    const allocation = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique();
    if (!metadata || !allocation) throw new Error("missing retry fixture state");
    const common = { schoolId, storageId, category: "Test", mimeType: "application/pdf", byteSize: metadata.size, sha256: metadata.sha256, scanStatus: "quarantined" as const, validationStatus: "pending" as const, isTrashed: true, purgeScheduledAt: Date.now() - 1, storageAccountingInitializedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() };
    const assetId = await ctx.db.insert("schoolAssets", { ...common, fileName: "Retry.pdf" });
    const conflictingAssetId = await ctx.db.insert("schoolAssets", { ...common, fileName: "Conflicting owner.pdf", isTrashed: false, purgeScheduledAt: undefined, storageAccountingInitializedAt: undefined });
    await ctx.db.patch(allocation._id, { consumedUnits: allocation.consumedUnits + metadata.size, trashStorageBytes: (allocation.trashStorageBytes ?? 0) + metadata.size, updatedAt: Date.now() });
    return { assetId, conflictingAssetId, byteSize: metadata.size };
  });
  await t.mutation(internal.functions.academic.assets.cleanupExpiredAssetStorage, { limit: 5 });
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
  const failed = await t.run(ctx => ctx.db.get(seeded.assetId));
  expect(failed).toMatchObject({ cleanupFailureCount: 1, cleanupFailureCode: "storage_delete_failed" });
  expect(await t.run(ctx => ctx.db.query("assetPurgeReceipts").withIndex("by_asset", q => q.eq("assetId", seeded.assetId)).take(2))).toHaveLength(0);
  expect(await t.run(ctx => ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique())).toMatchObject({ consumedUnits: fixtureSize + seeded.byteSize, trashStorageBytes: seeded.byteSize });
  await t.run(ctx => ctx.db.delete(seeded.conflictingAssetId));
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.get(seeded.assetId))).toBeNull();
  expect(await t.run(ctx => ctx.db.query("assetPurgeReceipts").withIndex("by_asset", q => q.eq("assetId", seeded.assetId)).take(2))).toHaveLength(1);
  expect(await t.run(ctx => ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique())).toMatchObject({ consumedUnits: fixtureSize, trashStorageBytes: 0 });
});

it("reports upload intake unavailable before generic transport can create or bind storage", async () => {
  const { t, p, schoolId } = await fixture();
  expect(await p.query(a.getWorkspace, { schoolId })).toMatchObject({ uploadAvailable: false });
  const before = await t.run(ctx => ctx.db.query("assetUploadIntents").withIndex("by_school_and_status", q => q.eq("schoolId", schoolId).eq("status", "pending")).take(10));
  await expect(p.mutation(a.createAssetUploadIntent, { schoolId })).rejects.toThrow("Uploads unavailable");
  const storageId = await storeTypedBlob(t, "application/pdf");
  const intentId = await t.run(ctx => ctx.db.insert("assetUploadIntents", { schoolId, status: "pending", createdAt: Date.now(), updatedAt: Date.now() }));
  await expect(p.mutation(a.finalizeAssetUpload, { schoolId, uploadIntentId: intentId, storageId, fileName: "Unsafe.pdf", category: "General" })).rejects.toThrow("Uploads unavailable");
  expect(await t.run(ctx => ctx.db.query("assetUploadIntents").withIndex("by_school_and_status", q => q.eq("schoolId", schoolId).eq("status", "pending")).take(10))).toHaveLength(before.length + 1);
  expect(await t.run(ctx => ctx.db.query("schoolAssets").withIndex("by_storage", q => q.eq("storageId", storageId)).take(1))).toHaveLength(0);
});

it("metadata validation and stale edits cannot change stored bytes or another branch", async () => {
  const { p, schoolId, otherId, assetId } = await fixture();
  const old = await p.query(a.inspectAsset, { schoolId, assetId });
  const change = { schoolId, assetId, expectedUpdatedAt: old.updatedAt, fileName: "Renamed.pdf", category: "Governance", description: "Safe description" };
  await expect(p.mutation(a.editMetadata, { ...change, schoolId: otherId })).rejects.toThrow();
  await expect(p.mutation(a.editMetadata, { ...change, fileName: " " })).rejects.toThrow();
  await p.mutation(a.editMetadata, change);
  const updated = await p.query(a.inspectAsset, { schoolId, assetId });
  expect(updated.sha256).toBe(old.sha256); expect(updated.fileName).toBe("Renamed.pdf");
  await expect(p.mutation(a.editMetadata, { ...change, expectedUpdatedAt: old.updatedAt - 1 })).rejects.toThrow("changed");
});
