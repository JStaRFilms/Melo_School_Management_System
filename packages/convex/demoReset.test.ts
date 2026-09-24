/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import schema from "./schema";
import { DEMO_STUDENTS } from "./functions/academic/demoData";
import { TENANT_SCHOOL_TABLES } from "./functions/academic/tenantPurgeManifest";

vi.mock("./betterAuth", async (original) => ({
  ...await original<typeof import("./betterAuth")>(),
  createAuth: () => ({ $context: Promise.resolve({ internalAdapter: {
    findUserByEmail: async (email: string) => {
      const index = ["admin@demo-academy.school", "teacher@demo-academy.school", "parent@demo-academy.school"].indexOf(email);
      const id = ["auth-admin-demo", "auth-teacher-demo", "auth-portal-demo"][index];
      return index < 0 ? null : { user: { id }, accounts: [{ providerId: "credential", accountId: id }] };
    },
  } }) }),
}));
const modules = import.meta.glob("./**/*.ts");
const args = { operatorToken: "operator", targetIdentity: "isolated-demo" };
afterEach(() => vi.unstubAllEnvs());
function gate() {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", args.operatorToken);
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", args.targetIdentity);
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://seed-auth.test");
}
async function seeded() {
  gate();
  const t = convexTest(schema, modules);
  const files = await t.run(async (ctx) => ({
    logoStorageId: await ctx.storage.store(new Blob(["logo"])),
    portraitStorageIds: await Promise.all(DEMO_STUDENTS.map(() => ctx.storage.store(new Blob(["portrait"])))),
  }));
  const runId = await t.mutation(internal.functions.academic.seed.startDemoSeedRunInternal, {
    seedProfile: "demo", authIssuer: "https://seed-auth.test", adminAuthId: "auth-admin-demo", teacherAuthId: "auth-teacher-demo", portalAuthId: "auth-portal-demo", ...files,
  });
  await t.mutation(internal.functions.academic.seed.populateDemoFoundationInternal, { runId });
  for (let i = 0; i < 3; i++) await t.mutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId });
  for (let i = 0; i < 6; i++) await t.mutation(internal.functions.academic.seed.populateDemoAssessmentsBatchInternal, { runId });
  for (let i = 0; i < 3; i++) await t.mutation(internal.functions.academic.seed.populateDemoBillingBatchInternal, { runId });
  await t.mutation(internal.functions.academic.seed.populateDemoKnowledgeAndFinalizeInternal, { runId });
  return t;
}

test("authorized batches delete the complete 36-student seed and resume after interruption", async () => {
  const t = await seeded();
  const before = await t.run(async (ctx) => ({
    schools: await ctx.db.query("schools").collect(),
    persons: await ctx.db.query("persons").collect(),
    users: await ctx.db.query("users").collect(),
    memberships: await ctx.db.query("branchMemberships").collect(),
    students: await ctx.db.query("students").collect(),
    assessments: await ctx.db.query("assessmentRecords").collect(),
  }));
  expect(before.schools).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("demoSeedRuns").first())).toMatchObject({ status: "succeeded", phase: "complete" });
  expect(before.students).toHaveLength(36);
  expect(before.assessments).toHaveLength(756);
  expect(before.users).toHaveLength(58);
  expect(before.memberships.length).toBeGreaterThanOrEqual(3);
  expect(before.persons).toHaveLength(3);

  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const { operationId } = prepared;
  const operation = await t.run((ctx) => ctx.db.get(operationId));
  expect(operation?.status).toBe("prepared");
  if (!operation) throw new Error("Missing prepared operation");
  expect(operation.inventory.length).toBeGreaterThan(756);
  expect(operation.inventory.length).toBeLessThanOrEqual(5000);
  expect(operation.storageCandidateIds.length).toBeGreaterThan(0);
  expect(operation.retainedStorageIds).toHaveLength(37);
  expect(new Set(operation.retainedStorageIds).size).toBe(37);
  expect(operation.inventory.filter((entry) => entry.table === "assessmentRecords")).toHaveLength(756);
  await t.mutation(internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal, {
    operationId, operatorToken: args.operatorToken, inventoryHash: prepared.inventoryHash,
    confirmationPhrase: prepared.confirmationPhrase,
  });
  expect(await t.run((ctx) => ctx.db.get(operationId))).toMatchObject({ status: "deleting", deletionCursor: 0, deletionPhase: "rows" });

  const endpoint = internal.functions.academic.demoResetDeletion.deleteReviewedDemoRowsBatchInternal;
  const runBatch = () => t.mutation(endpoint, { operationId });
  const total = operation.inventory.length;
  const interruptedAt = Math.ceil(total / 100) * 50;
  let cursor = 0;
  await expect((async () => {
    while (cursor < interruptedAt) {
      const result = await runBatch();
      cursor = Math.min(cursor + 50, total);
      expect(result).toEqual({ cursor, status: "deleting" });
    }
    // Inject a worker failure after a committed batch, before the next mutation.
    throw new Error("injected worker failure");
  })()).rejects.toThrow("injected worker failure");
  expect(cursor).toBeGreaterThan(0);
  expect(cursor).toBeLessThan(total);
  expect(await t.run((ctx) => ctx.db.get(operationId))).toMatchObject({ status: "deleting", deletionPhase: "rows", deletionCursor: cursor });
  while (cursor < total) {
    const result = await runBatch();
    cursor = Math.min(cursor + 50, total);
    expect(result).toEqual({ cursor, status: cursor === total ? "storage_pending" : "deleting" });
  }
  const finished = await t.run((ctx) => ctx.db.get(operationId));
  expect(finished).toMatchObject({ status: "storage_pending", deletionPhase: "storage_pending", deletionCursor: total });
  expect(finished?.inventory).toEqual(operation.inventory);
  expect(finished?.inventoryHash).toBe(prepared.inventoryHash);
  expect(finished?.storageCandidateIds).toEqual(operation.storageCandidateIds);
  expect(finished?.storageAcknowledgedIds).toEqual([]);
  for (const storageId of operation.storageCandidateIds) {
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull();
  }
  // Check the whole inventory, not just the tables named in the test title.
  for (let i = 0; i < total; i += 50) {
    const remaining = await t.run(async (ctx) => Promise.all(operation.inventory.slice(i, i + 50).map((entry) => ctx.db.get(entry.id as Id<TableNames>))));
    expect(remaining, `inventory rows ${i}..${Math.min(i + 50, total)}`).toEqual(Array(Math.min(50, total - i)).fill(null));
  }
  expect(await t.run(async (ctx) => ({
    schools: await ctx.db.query("schools").collect(), persons: await ctx.db.query("persons").collect(),
    users: await ctx.db.query("users").collect(), memberships: await ctx.db.query("branchMemberships").collect(),
    students: await ctx.db.query("students").collect(), assessments: await ctx.db.query("assessmentRecords").collect(),
  }))).toEqual({ schools: [], persons: [], users: [], memberships: [], students: [], assessments: [] });
  await expect(runBatch()).rejects.toThrow("not in row deletion phase");
});

test("full seeded reset continues through storage and auth ledger without live Better Auth changes", async () => {
  const t = await seeded();
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const { operationId } = prepared;
  const operation = await t.run((ctx) => ctx.db.get(operationId));
  if (!operation) throw new Error("Missing prepared operation");
  expect(operation.storageCandidateIds.length).toBe(DEMO_STUDENTS.length + 1);
  const run = await t.run((ctx) => ctx.db.query("demoSeedRuns").first());
  expect(operation.retainedStorageIds).toEqual([run?.logoStorageId, ...run!.portraitStorageIds]);
  expect(operation.authIds).toEqual(["auth-admin-demo", "auth-teacher-demo", "auth-portal-demo"]);
  await t.mutation(internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal, {
    operationId, operatorToken: args.operatorToken, inventoryHash: prepared.inventoryHash,
    confirmationPhrase: prepared.confirmationPhrase,
  });
  const deleteRows = internal.functions.academic.demoResetDeletion.deleteReviewedDemoRowsBatchInternal;
  while ((await t.run((ctx) => ctx.db.get(operationId)))?.status === "deleting") {
    await t.mutation(deleteRows, { operationId });
  }
  expect(await t.run((ctx) => ctx.db.get(operationId))).toMatchObject({
    status: "storage_pending", deletionCursor: operation.inventory.length, storageAcknowledgedIds: [],
  });

  const processStorage = internal.functions.academic.demoResetStorage.processDemoResetStorageCandidateInternal;
  const firstId = operation.storageCandidateIds[0];
  // A file claim from another school must block both eligibility and ACK.
  {
    const foreignSchoolId = await t.run((ctx) => ctx.db.insert("schools", {
      name: "Foreign", slug: "foreign", logoStorageId: firstId, createdAt: 1, updatedAt: 1,
    }));
    await expect(t.mutation(processStorage, { operationId, storageId: firstId })).rejects.toThrow("another claim");
    await t.run((ctx) => ctx.db.delete(foreignSchoolId));
  }

  // Original assets remain live through ACK and retries.
  expect(await t.mutation(processStorage, { operationId, storageId: firstId })).toEqual({ status: "storage_pending", acknowledged: 1 });
  expect(await t.mutation(processStorage, { operationId, storageId: firstId })).toEqual({ status: "storage_pending", acknowledged: 1 });
  expect(await t.run((ctx) => ctx.db.system.get("_storage", firstId))).not.toBeNull();
  for (const [index, storageId] of operation.storageCandidateIds.entries()) {
    if (index === 0) continue;
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull();
    expect(await t.mutation(processStorage, { operationId, storageId })).toEqual({
      status: index === operation.storageCandidateIds.length - 1 ? "auth_pending" : "storage_pending",
      acknowledged: index + 1,
    });
  }
  expect(await t.run((ctx) => ctx.db.get(operationId))).toMatchObject({
    status: "auth_pending", storageAcknowledgedIds: operation.storageCandidateIds,
  });
  for (const id of operation.retainedStorageIds) expect(await t.run((ctx) => ctx.db.system.get("_storage", id))).not.toBeNull();

  // This checks application ownership only; no Better Auth reconciliation is performed here.
  const inspectAuth = internal.functions.academic.demoResetAuth.checkDemoResetAuthDetachedInternal;
  const markAuth = internal.functions.academic.demoResetAuth.acknowledgeDemoResetAuthInternal;
  const ownership = await t.query(inspectAuth, { operationId });
  expect(ownership.map(({ index, authId, acknowledged }) => ({ index, authId, acknowledged }))).toEqual(
    operation.authIds.map((authId, index) => ({ index, authId, acknowledged: false })),
  );
  for (const [index, authId] of operation.authIds.entries()) {
    expect(await t.mutation(markAuth, { operationId, index, authId })).toEqual({
      status: index === operation.authIds.length - 1 ? "ready_to_seed" : "auth_pending",
      acknowledged: index + 1,
    });
  }
  expect(await t.run((ctx) => ctx.db.get(operationId))).toMatchObject({
    status: "ready_to_seed", authAcknowledgedIds: operation.authIds,
  });
});

test("reviewed and deleted operation starts one seed, rejects changed inputs, and replays safely", async () => {
  const t = await seeded();
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const operationId = prepared.operationId;
  const op = (await t.run((ctx) => ctx.db.get(operationId)))!;
  await t.mutation(internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal, {
    operationId, operatorToken: args.operatorToken, inventoryHash: prepared.inventoryHash,
    confirmationPhrase: prepared.confirmationPhrase,
  });
  while ((await t.run((ctx) => ctx.db.get(operationId)))?.status === "deleting") {
    await t.mutation(internal.functions.academic.demoResetDeletion.deleteReviewedDemoRowsBatchInternal, { operationId });
  }
  for (const storageId of op.storageCandidateIds) {
    await t.mutation(internal.functions.academic.demoResetStorage.processDemoResetStorageCandidateInternal, { operationId, storageId });
  }
  for (const [index, authId] of op.authIds.entries()) {
    await t.mutation(internal.functions.academic.demoResetAuth.acknowledgeDemoResetAuthInternal, { operationId, index, authId });
  }
  const start = internal.functions.academic.seed.startDemoSeedRunInternal;
  const input = { resetOperationId: operationId, seedProfile: "demo" as const, authIssuer: op.authIssuer,
    adminAuthId: op.authIds[0], teacherAuthId: op.authIds[1], portalAuthId: op.authIds[2],
    logoStorageId: op.retainedStorageIds[0], portraitStorageIds: op.retainedStorageIds.slice(1) };
  await expect(t.mutation(start, { ...input, authIssuer: "https://wrong.test" })).rejects.toThrow("issuer");
  vi.stubEnv("CONVEX_SITE_URL", "https://other-site.test");
  await expect(t.mutation(start, input)).rejects.toThrow("issuer");
  vi.stubEnv("CONVEX_SITE_URL", "https://seed-auth.test");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://other.convex.cloud");
  await expect(t.mutation(start, input)).rejects.toThrow("target gate");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  await expect(t.mutation(start, { ...input, teacherAuthId: "wrong" })).rejects.toThrow("inputs");
  await expect(t.mutation(start, { ...input, portraitStorageIds: [...input.portraitStorageIds].reverse() })).rejects.toThrow("inputs");
  const foreign = await t.run((ctx) => ctx.db.insert("schools", { name: "Other", slug: "other", createdAt: 1, updatedAt: 1 }));
  await expect(t.mutation(start, input)).rejects.toThrow("detached");
  await t.run((ctx) => ctx.db.delete(foreign));
  const foreignClaim = await t.run((ctx) => ctx.db.insert("demoSeedStorageCleanup", {
    schoolId: op.schoolId, schoolSlug: "demo-school", storageId: op.retainedStorageIds[0], createdAt: 1,
  }));
  await expect(t.mutation(start, input)).rejects.toThrow("another claim");
  await t.run((ctx) => ctx.db.delete(foreignClaim));
  const competing = await t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = op;
    return ctx.db.insert("demoResetOperations", { ...fields, status: "prepared" });
  });
  await expect(t.mutation(start, input)).rejects.toThrow("Another demo reset");
  await t.run((ctx) => ctx.db.delete(competing));
  await t.run((ctx) => ctx.storage.delete(op.retainedStorageIds[1]));
  await expect(t.mutation(start, input)).rejects.toThrow("retained file missing");
  // Restore the original storage ID by testing missing-file rejection separately below;
  // convex-test cannot recreate a deleted storage ID, so use a fresh prepared fixture for success.
  const fresh = await seeded();
  const next = await fresh.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const reviewed = (await fresh.run((ctx) => ctx.db.get(next.operationId)))!;
  await fresh.mutation(internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal, {
    operationId: next.operationId, operatorToken: args.operatorToken, inventoryHash: next.inventoryHash, confirmationPhrase: next.confirmationPhrase,
  });
  while ((await fresh.run((ctx) => ctx.db.get(next.operationId)))?.status === "deleting") {
    await fresh.mutation(internal.functions.academic.demoResetDeletion.deleteReviewedDemoRowsBatchInternal, { operationId: next.operationId });
  }
  for (const storageId of reviewed.storageCandidateIds) await fresh.mutation(internal.functions.academic.demoResetStorage.processDemoResetStorageCandidateInternal, { operationId: next.operationId, storageId });
  for (const [index, authId] of reviewed.authIds.entries()) await fresh.mutation(internal.functions.academic.demoResetAuth.acknowledgeDemoResetAuthInternal, { operationId: next.operationId, index, authId });
  const exact = { resetOperationId: next.operationId, seedProfile: "demo" as const, authIssuer: reviewed.authIssuer,
    adminAuthId: reviewed.authIds[0], teacherAuthId: reviewed.authIds[1], portalAuthId: reviewed.authIds[2],
    logoStorageId: reviewed.retainedStorageIds[0], portraitStorageIds: reviewed.retainedStorageIds.slice(1) };
  const [a, b] = await Promise.all([fresh.mutation(start, exact), fresh.mutation(start, exact)]);
  expect(a).toBe(b);
  expect(await fresh.mutation(start, exact)).toBe(a);
  expect(await fresh.run(async (ctx) => ({ schools: await ctx.db.query("schools").collect(), runs: await ctx.db.query("demoSeedRuns").collect() })))
    .toMatchObject({ schools: [expect.objectContaining({ logoStorageId: exact.logoStorageId })],
      runs: [expect.objectContaining({ _id: a, portraitStorageIds: exact.portraitStorageIds })] });
  expect(await fresh.run((ctx) => ctx.db.get(next.operationId))).toMatchObject({ status: "seeding", newRunId: a, newSchoolId: expect.any(String) });
  await fresh.run((ctx) => ctx.db.patch(next.operationId, { status: "complete" }));
  expect(await fresh.mutation(start, exact)).toBe(a);
});

test("an extra reviewed file is deleted while the 37 original files survive", async () => {
  const t = await seeded();
  const extra = await t.run(async (ctx) => {
    const school = (await ctx.db.query("schools").first())!;
    const storageId = await ctx.storage.store(new Blob(["extra"]));
    await ctx.db.insert("schoolSiteAssets", { schoolId: school._id, storageId, kind: "document", fileName: "extra.txt",
      mediaType: "text/plain", byteSize: 5, checksum: "extra", decorative: false, rightsStatus: "approved",
      status: "draft", createdAt: 1, updatedAt: 1 });
    return storageId;
  });
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const op = (await t.run((ctx) => ctx.db.get(prepared.operationId)))!;
  expect(op.storageCandidateIds).toContain(extra);
  expect(op.retainedStorageIds).not.toContain(extra);
  await t.mutation(internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal, {
    operationId: op._id, operatorToken: args.operatorToken, inventoryHash: prepared.inventoryHash, confirmationPhrase: prepared.confirmationPhrase,
  });
  while ((await t.run((ctx) => ctx.db.get(op._id)))?.status === "deleting") {
    await t.mutation(internal.functions.academic.demoResetDeletion.deleteReviewedDemoRowsBatchInternal, { operationId: op._id });
  }
  const processStorage = internal.functions.academic.demoResetStorage.processDemoResetStorageCandidateInternal;
  for (const id of op.storageCandidateIds) {
    await t.mutation(processStorage, { operationId: op._id, storageId: id });
  }
  expect((await t.run((ctx) => ctx.db.get(op._id)))?.status).toBe("auth_pending");
  expect(await t.run((ctx) => ctx.db.system.get("_storage", extra))).toBeNull();
  for (const id of op.retainedStorageIds) expect(await t.run((ctx) => ctx.db.system.get("_storage", id))).not.toBeNull();
});

test("51 storage candidates block preparation and reservation before authorization or deletion", async () => {
  const t = await seeded();
  const initial = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const original = (await t.run((ctx) => ctx.db.get(initial.operationId)))!;
  await t.action(api.functions.academic.demoResetAction.cancelDemoReset, { ...args, operationId: initial.operationId });
  const extra = await t.run(async (ctx) => {
    const schoolId = original.schoolId;
    const ids = [];
    for (let i = 0; i < 14; i++) {
      const storageId = await ctx.storage.store(new Blob([`extra-${i}`]));
      ids.push(storageId);
      await ctx.db.insert("schoolSiteAssets", { schoolId, storageId, kind: "document", fileName: `extra-${i}.txt`,
        mediaType: "text/plain", byteSize: 8, checksum: `extra-${i}`, decorative: false, rightsStatus: "approved",
        status: "draft", createdAt: 1, updatedAt: 1 });
    }
    return ids;
  });
  const inspection = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, args);
  expect(inspection.blockers).toContain("storage: candidate inventory exceeds 50");
  await expect(t.action(api.functions.academic.demoResetAction.prepareDemoReset, args)).rejects.toThrow();
  await expect(t.mutation(internal.functions.academic.demoResetInventory.reserveDemoResetInternal, {
    schoolId: original.schoolId, schoolSlug: original.schoolSlug, cloudUrl: original.cloudUrl,
    targetIdentity: original.targetIdentity, inventory: original.inventory, inventoryHash: original.inventoryHash,
    confirmationPhrase: original.confirmationPhrase, authIssuer: original.authIssuer, authIds: original.authIds,
    personIds: original.personIds, storageCandidateIds: [...original.storageCandidateIds, ...extra],
    retainedStorageIds: original.retainedStorageIds,
  })).rejects.toThrow("Invalid reset inventory");
  expect(await t.run((ctx) => ctx.db.query("schools").first())).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.query("demoResetOperations").collect())).toHaveLength(1);
});

test("missing or shared original files refuse a reservation", async () => {
  const missing = await seeded();
  const logo = (await missing.run((ctx) => ctx.db.query("demoSeedRuns").first()))!.logoStorageId;
  await missing.run((ctx) => ctx.storage.delete(logo));
  await expect(missing.action(api.functions.academic.demoResetAction.prepareDemoReset, args)).rejects.toThrow();
  expect(await missing.run((ctx) => ctx.db.query("demoResetOperations").collect())).toEqual([]);

  const shared = await seeded();
  const portrait = (await shared.run((ctx) => ctx.db.query("demoSeedRuns").first()))!.portraitStorageIds[0];
  await shared.run(async (ctx) => {
    const school = (await ctx.db.query("schools").first())!;
    await ctx.db.insert("schoolSiteAssets", { schoolId: school._id, storageId: portrait, kind: "document",
      fileName: "shared.txt", mediaType: "text/plain", byteSize: 1, checksum: "shared", decorative: false,
      rightsStatus: "approved", status: "draft", createdAt: 1, updatedAt: 1 });
  });
  await expect(shared.action(api.functions.academic.demoResetAction.prepareDemoReset, args)).rejects.toThrow();
  expect(await shared.run((ctx) => ctx.db.query("demoResetOperations").collect())).toEqual([]);
});

test("operator preflight accepts a completed seed and cancelled history, but refuses an active reservation", async () => {
  const t = await seeded();
  const inspect = () => t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, args);
  const initial = await inspect();
  expect(initial.school).not.toBeNull();
  expect(initial.blockers).toEqual([]);
  expect(initial.ready).toBe(true);

  const first = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const active = await inspect();
  expect(active.ready).toBe(false);
  expect(active.blockers).toContain("demoResetOperations: demo reset already prepared");
  await expect(t.action(api.functions.academic.demoResetAction.prepareDemoReset, args)).rejects.toThrow();

  await t.action(api.functions.academic.demoResetAction.cancelDemoReset, { ...args, operationId: first.operationId });
  const afterCancellation = await inspect();
  expect(afterCancellation.blockers).toEqual([]);
  expect(afterCancellation.ready).toBe(true);
  const second = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  expect(second.operationId).not.toBe(first.operationId);
});

test("authorization blocks a second reservation before any deletion batch", async () => {
  const t = await seeded();
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const op = (await t.run((ctx) => ctx.db.get(prepared.operationId)))!;
  await t.mutation(internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal, {
    operationId: op._id, operatorToken: args.operatorToken, inventoryHash: prepared.inventoryHash,
    confirmationPhrase: prepared.confirmationPhrase,
  });
  expect((await t.run((ctx) => ctx.db.get(op._id)))?.deletionCursor).toBe(0);
  expect((await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, args)).blockers)
    .toContain("demoResetOperations: demo reset already deleting");
  await expect(t.mutation(internal.functions.academic.demoResetInventory.reserveDemoResetInternal, {
    schoolId: op.schoolId, schoolSlug: op.schoolSlug, cloudUrl: op.cloudUrl, targetIdentity: op.targetIdentity,
    inventory: op.inventory, inventoryHash: op.inventoryHash, confirmationPhrase: op.confirmationPhrase,
    authIssuer: op.authIssuer, authIds: op.authIds, personIds: op.personIds,
    storageCandidateIds: op.storageCandidateIds, retainedStorageIds: op.retainedStorageIds,
  })).rejects.toThrow("already active");
});

test("all active phases block preflight and reservation; terminal history allows a new reservation", async () => {
  const t = await seeded();
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const op = (await t.run((ctx) => ctx.db.get(prepared.operationId)))!;
  const reserve = () => t.mutation(internal.functions.academic.demoResetInventory.reserveDemoResetInternal, {
    schoolId: op.schoolId, schoolSlug: op.schoolSlug, cloudUrl: op.cloudUrl, targetIdentity: op.targetIdentity,
    inventory: op.inventory, inventoryHash: op.inventoryHash, confirmationPhrase: op.confirmationPhrase,
    authIssuer: op.authIssuer, authIds: op.authIds, personIds: op.personIds,
    storageCandidateIds: op.storageCandidateIds, retainedStorageIds: op.retainedStorageIds,
  });
  for (const status of ["prepared", "deleting", "storage_pending", "auth_pending", "ready_to_seed", "seeding"] as const) {
    await t.run((ctx) => ctx.db.patch(op._id, { status }));
    expect((await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, args)).blockers)
      .toContain(`demoResetOperations: demo reset already ${status}`);
    await expect(reserve()).rejects.toThrow("already active");
  }
  await t.run((ctx) => ctx.db.patch(op._id, { status: "complete" }));
  expect((await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, args)).ready).toBe(true);
  await expect(reserve()).resolves.toBeTruthy();
});

test("two simultaneous preparations reserve only one immutable inventory; cancellation touches no school rows", async () => {
  const t = await seeded();
  const before = await t.run(async (ctx) => ({
    users: await ctx.db.query("users").collect(), schools: await ctx.db.query("schools").collect(),
  }));
  const results = await Promise.allSettled([t.action(api.functions.academic.demoResetAction.prepareDemoReset, args), t.action(api.functions.academic.demoResetAction.prepareDemoReset, args)]);
  expect(results.filter((result) => result.status === "fulfilled"), JSON.stringify(results.filter((result) => result.status === "rejected").map((result) => String(result.reason)))).toHaveLength(1);
  const success = results.find((result) => result.status === "fulfilled");
  if (success?.status !== "fulfilled") throw new Error("No prepared operation");
  const { operationId, schoolId, inventoryHash, confirmationPhrase, counts } = success.value;
  expect(confirmationPhrase).toContain(`${schoolId} ${inventoryHash}`);
  expect(counts.find((entry) => entry.table === "persons")?.count).toBe(3);
  expect(counts.find((entry) => entry.table === "schools")?.count).toBe(1);
  const stored = await t.run((ctx) => ctx.db.get(operationId));
  expect(stored).toMatchObject({ status: "prepared", schoolId, inventoryHash, confirmationPhrase, authIds: ["auth-admin-demo", "auth-teacher-demo", "auth-portal-demo"] });
  expect(stored?.inventory.length).toBeGreaterThan(100);
  expect(stored?.storageCandidateIds.length).toBeGreaterThan(0);
  expect(TENANT_SCHOOL_TABLES).not.toContain("demoResetOperations");
  await expect(t.action(api.functions.academic.demoResetAction.prepareDemoReset, args)).rejects.toThrow("Populated demo preflight or development cloud URL gate failed");
  await t.action(api.functions.academic.demoResetAction.cancelDemoReset, { ...args, operationId });
  expect((await t.run((ctx) => ctx.db.get(operationId)))?.status).toBe("cancelled");
  expect(await t.run(async (ctx) => ({ users: await ctx.db.query("users").collect(), schools: await ctx.db.query("schools").collect() }))).toEqual(before);
});

test("internal authorization rejects mismatches and cancelled operations without changing school or auth rows", async () => {
  const t = await seeded();
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const endpoint = internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal;
  const valid = { operationId: prepared.operationId, operatorToken: args.operatorToken,
    inventoryHash: prepared.inventoryHash, confirmationPhrase: prepared.confirmationPhrase };
  const before = await t.run(async (ctx) => ({
    schools: await ctx.db.query("schools").collect(), users: await ctx.db.query("users").collect(),
    persons: await ctx.db.query("persons").collect(),
  }));
  for (const invalid of [
    { ...valid, operatorToken: "wrong" }, { ...valid, inventoryHash: "0".repeat(64) },
    { ...valid, confirmationPhrase: valid.confirmationPhrase + " " },
    { ...valid, confirmationPhrase: valid.confirmationPhrase.slice(0, -32) },
  ]) {
    await expect(t.mutation(endpoint, invalid)).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.get(prepared.operationId)))?.status).toBe("prepared");
  }
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://other.convex.cloud");
  await expect(t.mutation(endpoint, valid)).rejects.toThrow();
  gate();
  await t.action(api.functions.academic.demoResetAction.cancelDemoReset, { ...args, operationId: prepared.operationId });
  await expect(t.mutation(endpoint, valid)).rejects.toThrow("No prepared operation");
  expect((await t.run((ctx) => ctx.db.get(prepared.operationId)))?.status).toBe("cancelled");
  expect(await t.run(async (ctx) => ({
    schools: await ctx.db.query("schools").collect(), users: await ctx.db.query("users").collect(),
    persons: await ctx.db.query("persons").collect(),
  }))).toEqual(before);
});

test("internal authorization refuses a changed school and an altered inventory seal", async () => {
  const t = await seeded();
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const endpoint = internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal;
  const input = { operationId: prepared.operationId, operatorToken: args.operatorToken,
    inventoryHash: prepared.inventoryHash, confirmationPhrase: prepared.confirmationPhrase };
  await t.run(async (ctx) => {
    const school = await ctx.db.get(prepared.schoolId);
    if (!school) throw new Error("Missing school");
    await ctx.db.patch(prepared.schoolId, { slug: "another-school" });
  });
  await expect(t.mutation(endpoint, input)).rejects.toThrow("Demo school changed");
  await t.run((ctx) => ctx.db.patch(prepared.schoolId, { slug: "demo-school" }));
  await t.run(async (ctx) => {
    const op = await ctx.db.get(prepared.operationId);
    if (!op) throw new Error("Missing operation");
    await ctx.db.patch(prepared.operationId, { inventory: op.inventory.slice(1) });
  });
  await expect(t.mutation(endpoint, input)).rejects.toThrow("Reviewed inventory seal changed");
  expect((await t.run((ctx) => ctx.db.get(prepared.operationId)))?.status).toBe("prepared");
});

test("altering an ordered retained ID breaks the operation seal before deletion", async () => {
  const t = await seeded();
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const op = (await t.run((ctx) => ctx.db.get(prepared.operationId)))!;
  await t.run((ctx) => ctx.db.patch(op._id, { retainedStorageIds: [...op.retainedStorageIds].reverse() }));
  await expect(t.mutation(internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal, {
    operationId: op._id, operatorToken: args.operatorToken, inventoryHash: prepared.inventoryHash,
    confirmationPhrase: prepared.confirmationPhrase,
  })).rejects.toThrow("seal changed");
  expect(await t.run((ctx) => ctx.db.get(op.schoolId))).not.toBeNull();
});

test("two simultaneous internal authorizations allow one status transition and no row deletion", async () => {
  const t = await seeded();
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, args);
  const endpoint = internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal;
  const input = { operationId: prepared.operationId, operatorToken: args.operatorToken,
    inventoryHash: prepared.inventoryHash, confirmationPhrase: prepared.confirmationPhrase };
  const before = await t.run(async (ctx) => ({
    schools: await ctx.db.query("schools").collect(), users: await ctx.db.query("users").collect(),
    assessments: await ctx.db.query("assessmentRecords").collect(),
  }));
  const results = await Promise.allSettled([t.mutation(endpoint, input), t.mutation(endpoint, input)]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.get(prepared.operationId))).toMatchObject({
    status: "deleting", deletionPhase: "rows", deletionCursor: 0, storageAcknowledgedIds: [],
  });
  expect(await t.run(async (ctx) => ({
    schools: await ctx.db.query("schools").collect(), users: await ctx.db.query("users").collect(),
    assessments: await ctx.db.query("assessmentRecords").collect(),
  }))).toEqual(before);
});

test("operator token and exact development URL are mandatory before reservation", async () => {
  const t = await seeded();
  await expect(t.action(api.functions.academic.demoResetAction.prepareDemoReset, { ...args, operatorToken: "wrong" })).rejects.toThrow("operator gate failed");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://other.convex.cloud");
  await expect(t.action(api.functions.academic.demoResetAction.prepareDemoReset, args)).rejects.toThrow("cloud URL gate failed");
  expect(await t.run((ctx) => ctx.db.query("demoResetOperations").collect())).toEqual([]);
});

test("an indirect grant pointing at an unowned person refuses preparation", async () => {
  const t = await seeded();
  await t.run(async (ctx) => {
    const member = await ctx.db.query("branchMemberships").first();
    if (!member) throw new Error("Missing membership");
    const foreign = await ctx.db.insert("persons", { email: "foreign@example.test", name: "Foreign", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("membershipDirectGrants", { membershipId: member._id, capability: "foreign", grantedBy: foreign, grantedAt: 1 });
  });
  await expect(t.action(api.functions.academic.demoResetAction.prepareDemoReset, args)).rejects.toThrow("unreviewed owner");
  expect(await t.run((ctx) => ctx.db.query("demoResetOperations").collect())).toEqual([]);
});

test("foreign schools and oversized inventories fail closed without a reservation", async () => {
  const foreign = await seeded();
  await foreign.run(async (ctx) => {
    await ctx.db.insert("schools", { name: "Foreign", slug: "foreign", createdAt: 1, updatedAt: 1 });
  });
  await expect(foreign.action(api.functions.academic.demoResetAction.prepareDemoReset, args)).rejects.toThrow();
  expect(await foreign.run((ctx) => ctx.db.query("demoResetOperations").collect())).toEqual([]);

  const oversized = await seeded();
  for (let batch = 0; batch < 11; batch++) await oversized.run(async (ctx) => {
    const school = await ctx.db.query("schools").first();
    const user = await ctx.db.query("users").first();
    if (!school || !user) throw new Error("Missing seed");
    for (let i = batch * 100; i < Math.min(1001, (batch + 1) * 100); i++) await ctx.db.insert("schoolEvents", {
      schoolId: school._id, title: `event-${i}`, startDate: 1, endDate: 2, isAllDay: true, createdAt: 1, updatedAt: 1, updatedBy: user._id,
    });
  });
  await expect(oversized.action(api.functions.academic.demoResetAction.prepareDemoReset, args)).rejects.toThrow();
  expect(await oversized.run((ctx) => ctx.db.query("demoResetOperations").collect())).toEqual([]);
});
