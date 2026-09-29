/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { subtleSha256 } from "./functions/academic/demoResetDigest";

const modules = import.meta.glob("./**/*.ts");
const processCandidate = internal.functions.academic.demoResetStorage.processDemoResetStorageCandidateInternal;
afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "isolated-demo");
  const t = convexTest(schema, modules);
  const { operationId, retainedStorageIds, extra } = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", createdAt: 1, updatedAt: 1 });
    const retainedStorageIds = [];
    for (let i = 0; i < 37; i++) retainedStorageIds.push(await ctx.storage.store(new Blob([`original-${i}`])));
    const extra = await ctx.storage.store(new Blob(["extra"]));
    const storageCandidateIds = [...retainedStorageIds, extra];
    const inventory = [{ table: "schools", id: schoolId, digest: await subtleSha256(await ctx.db.get(schoolId)) }];
    const cloudUrl = "https://test.convex.cloud";
    const targetIdentity = "isolated-demo";
    const authIssuer = "issuer";
    const authIds: string[] = [];
    const personIds: never[] = [];
    const inventoryHash = await subtleSha256({ schoolId, cloudUrl, targetIdentity, inventory, authIssuer, authIds, personIds, storageCandidateIds, retainedStorageIds });
    const operationId = await ctx.db.insert("demoResetOperations", { schoolId, schoolSlug: "demo-school", cloudUrl, targetIdentity,
      status: "storage_pending", deletionPhase: "storage_pending", deletionCursor: 1, inventory, inventoryHash,
      confirmationPhrase: "reviewed", authIssuer, authIds, personIds, storageCandidateIds, retainedStorageIds,
      storageAcknowledgedIds: [], createdAt: 1 });
    await ctx.db.delete(schoolId);
    return { operationId, retainedStorageIds, extra };
  });
  return { t, operationId, retainedStorageIds, extra,
    process: (storageId: typeof extra) => t.mutation(processCandidate, { operationId, storageId }) };
}

test("all 37 originals stay live; extra storage is deleted and acknowledged atomically", async () => {
  const f = await fixture();
  for (const id of f.retainedStorageIds) {
    expect(await f.process(id)).toMatchObject({ status: "storage_pending" });
    expect(await f.t.run((ctx) => ctx.db.system.get("_storage", id))).not.toBeNull();
  }
  expect(await f.process(f.extra)).toEqual({ status: "auth_pending", acknowledged: 38 });
  expect(await f.t.run((ctx) => ctx.db.system.get("_storage", f.extra))).toBeNull();
  expect(await f.process(f.extra)).toEqual({ status: "auth_pending", acknowledged: 38 });
});

test("a cross-school claimant arriving before processing blocks deletion", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.insert("schools", { name: "Foreign", slug: "foreign", logoStorageId: f.extra, createdAt: 1, updatedAt: 1 }));
  await expect(f.process(f.extra)).rejects.toThrow("another claim");
  expect(await f.t.run((ctx) => ctx.db.system.get("_storage", f.extra))).not.toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(f.operationId)))?.storageAcknowledgedIds).toEqual([]);
});

test("an interrupted retry accepts an already-missing nonretained blob", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.storage.delete(f.extra));
  expect(await f.process(f.extra)).toEqual({ status: "storage_pending", acknowledged: 1 });
  expect(await f.process(f.extra)).toEqual({ status: "storage_pending", acknowledged: 1 });
  for (const id of f.retainedStorageIds) await f.process(id);
  expect((await f.t.run((ctx) => ctx.db.get(f.operationId)))?.status).toBe("auth_pending");
});

test("missing original refuses ACK and auth transition", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.storage.delete(f.retainedStorageIds[0]));
  await expect(f.process(f.retainedStorageIds[0])).rejects.toThrow("retained file missing");
  expect((await f.t.run((ctx) => ctx.db.get(f.operationId)))?.status).toBe("storage_pending");
});

test("foreign claim on an already ACKed original blocks final auth transition", async () => {
  const f = await fixture();
  for (const id of f.retainedStorageIds) await f.process(id);
  await f.t.run((ctx) => ctx.storage.delete(f.extra));
  await f.t.run((ctx) => ctx.db.insert("schools", { name: "Foreign", slug: "foreign", logoStorageId: f.retainedStorageIds[0], createdAt: 1, updatedAt: 1 }));
  await expect(f.process(f.extra)).rejects.toThrow("another claim");
  expect((await f.t.run((ctx) => ctx.db.get(f.operationId)))?.status).toBe("storage_pending");
});

test("final ACK rechecks an earlier retained blob still exists", async () => {
  const f = await fixture();
  for (const id of f.retainedStorageIds) await f.process(id);
  await f.t.run(async (ctx) => { await ctx.storage.delete(f.retainedStorageIds[0]); await ctx.storage.delete(f.extra); });
  await expect(f.process(f.extra)).rejects.toThrow("retained file missing");
  expect((await f.t.run((ctx) => ctx.db.get(f.operationId)))?.status).toBe("storage_pending");
});

test("failed final recheck rolls back deletion and acknowledgment", async () => {
  const f = await fixture();
  for (const id of f.retainedStorageIds) await f.process(id);
  await f.t.run((ctx) => ctx.storage.delete(f.retainedStorageIds[0]));
  await expect(f.process(f.extra)).rejects.toThrow("retained file missing");
  expect(await f.t.run((ctx) => ctx.db.system.get("_storage", f.extra))).not.toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(f.operationId)))?.storageAcknowledgedIds).toHaveLength(37);
});

test("51 candidates refuse final ACK without deleting or advancing", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const op = (await ctx.db.get(f.operationId))!;
    const extra = [];
    for (let i = 0; i < 13; i++) extra.push(await ctx.storage.store(new Blob([String(i)])));
    const storageCandidateIds = [...op.storageCandidateIds, ...extra];
    const inventoryHash = await subtleSha256({ ...op, storageCandidateIds });
    await ctx.db.patch(f.operationId, { storageCandidateIds, inventoryHash });
  });
  await expect(f.process(f.extra)).rejects.toThrow("reviewed storage phase");
  expect(await f.t.run((ctx) => ctx.db.system.get("_storage", f.extra))).not.toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(f.operationId)))?.storageAcknowledgedIds).toEqual([]);
});

test("a changed retention seal cannot be acknowledged", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.operationId, { retainedStorageIds: f.retainedStorageIds.slice(1) }));
  await expect(f.process(f.extra)).rejects.toThrow("reviewed storage phase");
});
