/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { subtleSha256 } from "./functions/academic/demoResetDigest";

const modules = import.meta.glob("./**/*.ts");
const endpoint = internal.functions.academic.demoResetDeletion.deleteReviewedDemoRowsBatchInternal;
afterEach(() => vi.unstubAllEnvs());
function gate() {
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "isolated-demo");
}
async function fixture() {
  gate();
  const t = convexTest(schema, modules);
  const { operationId, eventIds, schoolId } = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", createdAt: 1, updatedAt: 1 });
    const inventory = [];
    const userId = await ctx.db.insert("users", { schoolId, authId: "fixture", name: "Fixture", email: "fixture@example.test", role: "admin", createdAt: 1, updatedAt: 1 });
    inventory.push({ table: "users", id: userId, digest: await subtleSha256(await ctx.db.get(userId)) });
    const eventIds = [];
    for (let i = 0; i < 53; i++) {
      const id = await ctx.db.insert("schoolEvents", { schoolId, title: `event-${i}`, startDate: 1, endDate: 2, isAllDay: true, createdAt: 1, updatedAt: 1, updatedBy: userId });
      eventIds.push(id);
      inventory.push({ table: "schoolEvents", id, digest: await subtleSha256(await ctx.db.get(id)) });
    }
    inventory.push({ table: "schools", id: schoolId, digest: await subtleSha256(await ctx.db.get(schoolId)) });
    inventory.sort((a, b) => a.table.localeCompare(b.table) || a.id.localeCompare(b.id));
    const inventoryHash = await subtleSha256({ schoolId, cloudUrl: "https://test.convex.cloud", targetIdentity: "isolated-demo", inventory, authIssuer: "issuer", authIds: ["fixture"], personIds: [], storageCandidateIds: [], retainedStorageIds: [] });
    const operationId = await ctx.db.insert("demoResetOperations", {
      schoolId, schoolSlug: "demo-school", cloudUrl: "https://test.convex.cloud", targetIdentity: "isolated-demo",
      status: "deleting", deletionCursor: 0, deletionPhase: "rows", inventory, inventoryHash,
      confirmationPhrase: "reviewed", authIssuer: "issuer", authIds: ["fixture"], personIds: [], storageCandidateIds: [], retainedStorageIds: [], createdAt: 1,
    });
    return { operationId, eventIds, schoolId };
  });
  return { t, operationId, eventIds, schoolId, run: () => t.mutation(endpoint, { operationId }) };
}

test("changed row and wrong operation status refuse deletion", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.eventIds[0], { title: "changed" }));
  await expect(f.run()).rejects.toThrow("missing or changed row");
  expect((await f.t.run((ctx) => ctx.db.query("schoolEvents").collect()))).toHaveLength(53);
  await f.t.run((ctx) => ctx.db.patch(f.operationId, { status: "prepared" }));
  await expect(f.run()).rejects.toThrow("not in row deletion phase");
});

test("foreign transfer blocks the reviewed inventory", async () => {
  const f = await fixture();
  const other = await f.t.run((ctx) => ctx.db.insert("schools", { name: "Other", slug: "other", createdAt: 1, updatedAt: 1 }));
  await expect(f.run()).rejects.toThrow("school identity changed");
  expect(await f.t.run((ctx) => ctx.db.get(other))).toMatchObject({ slug: "other" });
  expect((await f.t.run((ctx) => ctx.db.query("schoolEvents").collect()))).toHaveLength(53);
  await f.t.run((ctx) => ctx.db.delete(other));
  // A link to this school without another school row still blocks the transaction.
  await f.t.run(async (ctx) => {
    const personId = await ctx.db.insert("persons", { email: "outside@example.test", name: "Outside", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("schoolGroups", { name: "Shared", slug: "shared", proprietorPersonId: personId, status: "active", gradingDefault: { schoolId: f.schoolId, version: 1, allowBranchOverride: false }, createdAt: 1, updatedAt: 1 });
  });
  await expect(f.run()).rejects.toThrow("shared or foreign link");
  expect((await f.t.run((ctx) => ctx.db.query("schoolEvents").collect()))).toHaveLength(53);
});

test("a mid-batch retry uses the stored cursor and never repeats deleted IDs", async () => {
  const f = await fixture();
  const first = await f.run();
  expect(first).toEqual({ cursor: 50, status: "deleting" });
  expect((await f.t.run((ctx) => ctx.db.query("schoolEvents").collect()))).toHaveLength(3);
  const result = await f.run();
  expect(result).toEqual({ cursor: 55, status: "storage_pending" });
  expect((await f.t.run((ctx) => ctx.db.get(f.operationId)))?.deletionPhase).toBe("storage_pending");
  await expect(f.run()).rejects.toThrow("not in row deletion phase");
});
