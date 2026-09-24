/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { getFunctionName } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { DEMO_STUDENTS } from "./functions/academic/demoData";
import { finishReviewedDemoReset } from "./functions/academic/demoResetSeedAction";
import schema from "./schema";

const authLinks = vi.hoisted(() => ({ accounts: null as null | Array<{ providerId: string; accountId: string }> }));
vi.mock("./betterAuth", async (original) => ({
  ...await original<typeof import("./betterAuth")>(),
  createAuth: () => ({ $context: Promise.resolve({ internalAdapter: {
    findUserByEmail: async (email: string) => {
      const index = ["admin@demo-academy.school", "teacher@demo-academy.school", "parent@demo-academy.school"].indexOf(email);
      const id = ["auth-admin-demo", "auth-teacher-demo", "auth-portal-demo"][index];
      return index < 0 ? null : { user: { id, email }, accounts: authLinks.accounts ?? [{ providerId: "credential", accountId: id }] };
    },
  } }) }),
}));
const modules = import.meta.glob("./**/*.ts");
const gate = { operatorToken: "operator", targetIdentity: "isolated-demo", deploymentEnvironment: "development" as const };
afterEach(() => { vi.unstubAllEnvs(); authLinks.accounts = null; });

async function ready() {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", gate.operatorToken);
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", gate.targetIdentity);
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://seed-auth.test");
  const t = convexTest(schema, modules);
  const files = await t.run(async (ctx) => ({
    logoStorageId: await ctx.storage.store(new Blob(["logo"])),
    portraitStorageIds: await Promise.all(DEMO_STUDENTS.map(() => ctx.storage.store(new Blob(["portrait"])))),
  }));
  const runId = await t.mutation(internal.functions.academic.seed.startDemoSeedRunInternal, {
    seedProfile: "demo", authIssuer: "https://seed-auth.test", adminAuthId: "auth-admin-demo",
    teacherAuthId: "auth-teacher-demo", portalAuthId: "auth-portal-demo", ...files,
  });
  await t.mutation(internal.functions.academic.seed.populateDemoFoundationInternal, { runId });
  for (let i = 0; i < 3; i++) await t.mutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId });
  for (let i = 0; i < 6; i++) await t.mutation(internal.functions.academic.seed.populateDemoAssessmentsBatchInternal, { runId });
  for (let i = 0; i < 3; i++) await t.mutation(internal.functions.academic.seed.populateDemoBillingBatchInternal, { runId });
  await t.mutation(internal.functions.academic.seed.populateDemoKnowledgeAndFinalizeInternal, { runId });
  const prepared = await t.action(api.functions.academic.demoResetAction.prepareDemoReset, { operatorToken: gate.operatorToken, targetIdentity: gate.targetIdentity });
  const op = (await t.run((ctx) => ctx.db.get(prepared.operationId)))!;
  await t.mutation(internal.functions.academic.demoResetInventory.authorizeReviewedDemoResetInternal, {
    operationId: op._id, operatorToken: gate.operatorToken, inventoryHash: prepared.inventoryHash, confirmationPhrase: prepared.confirmationPhrase,
  });
  while ((await t.run((ctx) => ctx.db.get(op._id)))?.status === "deleting") {
    await t.mutation(internal.functions.academic.demoResetDeletion.deleteReviewedDemoRowsBatchInternal, { operationId: op._id });
  }
  for (const storageId of op.storageCandidateIds) {
    await t.mutation(internal.functions.academic.demoResetStorage.processDemoResetStorageCandidateInternal, { operationId: op._id, storageId });
  }
  for (const [index, authId] of op.authIds.entries()) {
    await t.mutation(internal.functions.academic.demoResetAuth.acknowledgeDemoResetAuthInternal, { operationId: op._id, index, authId });
  }
  return { t, op, args: { ...gate, schoolId: prepared.schoolId, schoolSlug: "demo-school", operationId: op._id,
    inventoryHash: prepared.inventoryHash, confirmationPhrase: prepared.confirmationPhrase } };
}

test("public finish starts a ready operation and refuses wrong targets before START", async () => {
  const { t, op, args } = await ready();
  await expect(t.action(api.functions.academic.demoResetSeedAction.finishDemoReset, {
    ...args, targetIdentity: "other-target",
  })).rejects.toThrow("target gate");
  await expect(t.action(api.functions.academic.demoResetSeedAction.finishDemoReset, {
    ...args, confirmationPhrase: args.confirmationPhrase + "x",
  })).rejects.toThrow("confirmation");
  const verify = (operatorToken = gate.operatorToken) => t.action(api.functions.academic.demoResetAction.verifyCompletedDemoReset,
    { operatorToken, targetIdentity: gate.targetIdentity, operationId: op._id });
  await expect(verify()).rejects.toThrow("Completed reset target changed");
  await expect(verify("wrong")).rejects.toThrow("verification gate");
  expect(await t.run(async (ctx) => ctx.db.query("schools").take(1))).toEqual([]);
  const result = await t.action(api.functions.academic.demoResetSeedAction.finishDemoReset, args);
  expect(result).toMatchObject({ operationId: op._id, status: "complete", studentCount: 36, assessmentRecordCount: 756 });
  expect(await t.run((ctx) => ctx.db.get(result.runId))).toMatchObject({ status: "succeeded", phase: "complete" });
  expect(await verify()).toEqual({ cloudUrl: "https://test.convex.cloud", operationId: op._id, status: "complete",
    schoolId: result.schoolId, runId: result.runId, studentCount: 36, classCount: 3, invoiceCount: 36, assessmentRecordCount: 756 });
  authLinks.accounts = [{ providerId: "other", accountId: "auth-admin-demo" }];
  await expect(t.action(api.functions.academic.demoResetSeedAction.finishDemoReset, args))
    .rejects.toThrow("Reviewed Better Auth credential link changed");
  authLinks.accounts = null;
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://other.convex.cloud");
  await expect(verify()).rejects.toThrow("verification gate");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  await t.run(async (ctx) => {
    const student = (await ctx.db.query("students").first())!;
    await ctx.db.delete(student._id);
  });
  await expect(verify()).rejects.toThrow("counts changed");
  await expect(t.action(api.functions.academic.demoResetSeedAction.finishDemoReset, args)).rejects.toThrow("counts");
  expect(await t.run((ctx) => ctx.db.get(op._id))).toMatchObject({ status: "complete", newRunId: result.runId });
});

test.each([
  [{ providerId: "other", accountId: "auth-admin-demo" }],
  [{ providerId: "credential", accountId: "auth-admin-demo" }, { providerId: "other", accountId: "auth-admin-demo" }],
])("FINISH rejects a changed credential link before START (%j)", async (accounts) => {
  const { t, op, args } = await ready();
  authLinks.accounts = accounts;
  await expect(t.action(api.functions.academic.demoResetSeedAction.finishDemoReset, args))
    .rejects.toThrow("Reviewed Better Auth credential link changed");
  expect(await t.run((ctx) => ctx.db.query("schools").take(1))).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("demoSeedRuns").take(2))).toHaveLength(0);
  const unchanged = await t.run((ctx) => ctx.db.get(op._id));
  expect(unchanged?.status).toBe("ready_to_seed");
  expect(unchanged?.newRunId).toBeUndefined();
});

test("full reviewed reset resumes after a committed student batch and replays without inserts", async () => {
  const { t, op, args } = await ready();
  const verify = vi.fn(async (_ctx: ActionCtx, account: { email: string }, expectedId: string) => {
    const id = op.authIds[["admin@demo-academy.school", "teacher@demo-academy.school", "parent@demo-academy.school"].indexOf(account.email)];
    if (id !== expectedId) throw new Error("Better Auth ID differs from reviewed account");
    return id;
  });
  let interrupted = false;
  const ctx = {
    runQuery: (ref: Parameters<typeof t.query>[0], input: object) => t.query(ref, input),
    runMutation: async (ref: Parameters<typeof t.mutation>[0], input: object) => {
      const result = await t.mutation(ref, input);
      if (!interrupted && getFunctionName(ref).endsWith(":populateDemoStudentsBatchInternal")) {
        interrupted = true;
        throw new Error("injected interruption after student batch");
      }
      return result;
    },
  } as unknown as ActionCtx;
  await expect(finishReviewedDemoReset(ctx, args, verify)).rejects.toThrow("injected interruption");
  const bound = (await t.run((db) => db.db.get(op._id)))!;
  expect(bound).toMatchObject({ status: "seeding", newSchoolId: expect.any(String), newRunId: expect.any(String) });
  expect(await t.run((db) => db.db.get(bound.newRunId!))).toMatchObject({ status: "running", phase: "students", studentCursor: 12 });
  authLinks.accounts = [{ providerId: "credential", accountId: "auth-admin-demo" }, { providerId: "other", accountId: "auth-admin-demo" }];
  await expect(t.action(api.functions.academic.demoResetSeedAction.finishDemoReset, args))
    .rejects.toThrow("Reviewed Better Auth credential link changed");
  authLinks.accounts = null;
  expect(await t.run((db) => db.db.get(bound.newRunId!))).toMatchObject({ studentCursor: 12, status: "running" });
  await expect(finishReviewedDemoReset(ctx, { ...args, confirmationPhrase: args.confirmationPhrase + " " }, verify)).rejects.toThrow("confirmation");
  await expect(finishReviewedDemoReset(ctx, { ...args, inventoryHash: "b".repeat(64) }, verify)).rejects.toThrow("confirmation");
  await expect(finishReviewedDemoReset(ctx, args, async () => { throw new Error("Better Auth ID differs from reviewed account"); })).rejects.toThrow("Better Auth ID");
  expect(await t.run((db) => db.db.get(bound.newRunId!))).toMatchObject({ studentCursor: 12, status: "running" });
  const finished = await finishReviewedDemoReset(ctx, args, verify);
  expect(finished).toMatchObject({ status: "complete", runId: bound.newRunId, schoolId: bound.newSchoolId,
    studentCount: 36, classCount: 3, invoiceCount: 36, assessmentRecordCount: 756 });
  expect(await t.run((db) => db.db.get(op._id))).toMatchObject({ status: "complete", newRunId: bound.newRunId });
  const snapshot = await t.run(async (db) => ({
    schools: await db.db.query("schools").collect(), runs: await db.db.query("demoSeedRuns").collect(),
    students: await db.db.query("students").collect(), assessments: await db.db.query("assessmentRecords").collect(),
  }));
  expect(snapshot.schools).toHaveLength(1);
  expect(snapshot.runs).toHaveLength(1);
  expect(snapshot.students).toHaveLength(36);
  expect(snapshot.assessments).toHaveLength(756);
  expect(await t.action(api.functions.academic.demoResetSeedAction.finishDemoReset, args)).toEqual(finished);
  expect(await t.run(async (db) => ({
    schools: await db.db.query("schools").collect(), runs: await db.db.query("demoSeedRuns").collect(),
    students: await db.db.query("students").collect(), assessments: await db.db.query("assessmentRecords").collect(),
  }))).toEqual(snapshot);
  expect(verify).toHaveBeenCalledTimes(6);
});
