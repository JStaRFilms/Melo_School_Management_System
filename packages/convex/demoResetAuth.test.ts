/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { subtleSha256 } from "./functions/academic/demoResetDigest";
import { DEMO_ACCOUNTS } from "./functions/academic/demoData";

const modules = import.meta.glob("./**/*.ts");
const check = internal.functions.academic.demoResetAuth.checkDemoResetAuthDetachedInternal;
const ack = internal.functions.academic.demoResetAuth.acknowledgeDemoResetAuthInternal;
afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "isolated-demo");
  const t = convexTest(schema, modules);
  const ids = ["admin-auth", "teacher-auth", "portal-auth"];
  const operationId = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", createdAt: 1, updatedAt: 1 });
    const personIds = [];
    for (const email of Object.values(DEMO_ACCOUNTS).map((account) => account.email)) {
      personIds.push(await ctx.db.insert("persons", { email, name: email, status: "active", primarySchoolId: schoolId, createdAt: 1, updatedAt: 1 }));
    }
    const retainedStorageIds = [];
    for (let i = 0; i < 37; i++) retainedStorageIds.push(await ctx.storage.store(new Blob([`original-${i}`])));
    const storageId = await ctx.storage.store(new Blob(["deleted"]));
    await ctx.storage.delete(storageId);
    const inventory = [];
    const cloudUrl = "https://test.convex.cloud";
    const targetIdentity = "isolated-demo";
    const authIssuer = "issuer";
    const storageCandidateIds = [...retainedStorageIds, storageId];
    const inventoryHash = await subtleSha256({ schoolId, cloudUrl, targetIdentity, inventory, authIssuer, authIds: ids, personIds, storageCandidateIds, retainedStorageIds });
    const operationId = await ctx.db.insert("demoResetOperations", {
      schoolId, schoolSlug: "demo-school", cloudUrl, targetIdentity, status: "auth_pending", deletionCursor: 0,
      deletionPhase: "storage_pending", storageAcknowledgedIds: storageCandidateIds, inventory, inventoryHash,
      confirmationPhrase: "reviewed", authIssuer, authIds: ids, personIds, storageCandidateIds, retainedStorageIds, createdAt: 1,
    });
    for (const personId of personIds) await ctx.db.delete(personId);
    await ctx.db.delete(schoolId);
    return operationId;
  });
  return { t, ids, operationId, check: () => t.query(check, { operationId }),
    ack: (index: number, authId = ids[index]) => t.mutation(ack, { operationId, index, authId }) };
}

test("exact recorded ID, sequential acknowledgments and retries", async () => {
  const f = await fixture();
  expect(await f.check()).toHaveLength(3);
  await expect(f.ack(0, "foreign-auth")).rejects.toThrow("wrong recorded auth ID");
  await expect(f.ack(2)).rejects.toThrow("sequentially");
  expect(await f.ack(0)).toEqual({ status: "auth_pending", acknowledged: 1 });
  expect(await f.ack(0)).toEqual({ status: "auth_pending", acknowledged: 1 });
  expect(await f.ack(1)).toEqual({ status: "auth_pending", acknowledged: 2 });
  expect((await f.t.run((ctx) => ctx.db.get(f.operationId)))?.status).toBe("auth_pending");
  expect(await f.ack(2)).toEqual({ status: "ready_to_seed", acknowledged: 3 });
  expect(await f.ack(2)).toEqual({ status: "ready_to_seed", acknowledged: 3 });
  await expect(f.ack(1, "wrong")).rejects.toThrow("wrong recorded auth ID");
});

test("foreign canonical person membership blocks inspection and acknowledgment", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const other = await ctx.db.insert("schools", { name: "Other", slug: "other", createdAt: 1, updatedAt: 1 });
    const personId = await ctx.db.insert("persons", { email: "foreign@example.test", name: "Foreign", status: "active",
      authTokenIdentifier: `issuer|${f.ids[0]}`, primarySchoolId: other, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("branchMemberships", { schoolId: other, personId, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
  });
  await expect(f.check()).rejects.toThrow("foreign membership");
  await expect(f.ack(0)).rejects.toThrow("foreign membership");
});

test("target, phase and unconfirmed storage cannot authorize auth progress", async () => {
  const f = await fixture();
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://other.convex.cloud");
  await expect(f.check()).rejects.toThrow("development target gate");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  await f.t.run((ctx) => ctx.db.patch(f.operationId, { status: "storage_pending" }));
  await expect(f.ack(0)).rejects.toThrow("operation phase");
});
