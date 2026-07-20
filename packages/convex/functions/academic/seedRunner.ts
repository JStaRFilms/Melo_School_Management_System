"use node";

import { action } from "../../_generated/server";
import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { ConvexError, v } from "convex/values";
import { demoPortraitPng, demoSchoolLogoPng } from "./demoAssets";
import { DEMO_ACCOUNTS, JUDGE_ACCOUNT_IDENTITIES, getSchoolSeedProfile, type SchoolSeedProfileKey } from "./demoData";
import { assertDemoOperatorGate, assertJudgeOperatorGate, findExistingAuthId, reconcileAuthUser, type SeedActionArgs, type SeedAuthUser } from "./seedRunnerSecurity";

const MAX_RESET_BATCHES = 500;

type SeedDemoResult = {
  schoolId: Id<"schools">;
  studentCount: number;
  classCount: number;
  invoiceCount: number;
  assessmentRecordCount: number;
  resetDeletedCount: number;
  adminEmail: string;
  teacherEmail: string;
  portalEmail: string;
};

export const assertOperatorGate = assertDemoOperatorGate;
export { assertJudgeOperatorGate };

export function isMissingStorageObjectError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("StorageIdNotFound") || message.includes("storage id") && message.includes("not found");
}

async function acknowledgeDeletedStorage(ctx: ActionCtx, storageIds: Id<"_storage">[]) {
  if (storageIds.length === 0) return;
  for (const storageId of storageIds) {
    try {
      await ctx.storage.delete(storageId);
    } catch (error) {
      // Cleanup is idempotent: an interrupted prior attempt may have deleted the
      // blob before it could acknowledge the durable ledger row.
      if (!isMissingStorageObjectError(error)) throw error;
    }
  }
  await ctx.runMutation(internal.functions.academic.seed.acknowledgeDemoStorageCleanupInternal, { storageIds });
}

async function drainStorageCleanup(ctx: ActionCtx, seedProfile: SchoolSeedProfileKey) {
  for (let batch = 0; batch < MAX_RESET_BATCHES; batch += 1) {
    const storageIds = await ctx.runQuery(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, { seedProfile });
    if (storageIds.length === 0) return;
    await acknowledgeDeletedStorage(ctx, storageIds);
  }
  throw new ConvexError("Demo storage cleanup exceeded its safety batch limit.");
}

async function storeDemoAssets(ctx: ActionCtx, portraitCount: number) {
  const storageIds: Id<"_storage">[] = [];
  try {
    const logoStorageId = await ctx.storage.store(new Blob([demoSchoolLogoPng()], { type: "image/png" }));
    storageIds.push(logoStorageId);
    const portraitStorageIds: Id<"_storage">[] = [];
    for (let index = 0; index < portraitCount; index += 1) {
      const storageId = await ctx.storage.store(new Blob([demoPortraitPng(index)], { type: "image/png" }));
      storageIds.push(storageId);
      portraitStorageIds.push(storageId);
    }
    return { logoStorageId, portraitStorageIds, storageIds };
  } catch (error) {
    await Promise.allSettled(storageIds.map((storageId) => ctx.storage.delete(storageId)));
    throw error;
  }
}

function judgeAccounts(): Record<"admin" | "teacher" | "portal", SeedAuthUser> {
  const password = process.env.JUDGE_DEMO_PASSWORD?.trim();
  if (!password || password.length < 12) throw new ConvexError("Set JUDGE_DEMO_PASSWORD to at least 12 characters before seeding the judge tenant.");
  return {
    admin: { ...JUDGE_ACCOUNT_IDENTITIES.admin, password },
    teacher: { ...JUDGE_ACCOUNT_IDENTITIES.teacher, password },
    portal: { ...JUDGE_ACCOUNT_IDENTITIES.portal, password },
  };
}

async function runSchoolSeed(
  ctx: ActionCtx,
  args: SeedActionArgs,
  seedProfile: SchoolSeedProfileKey,
  accounts: Record<"admin" | "teacher" | "portal", SeedAuthUser>,
): Promise<SeedDemoResult> {
  const profile = getSchoolSeedProfile(seedProfile);
  const accountValues = Object.values(accounts);
  const existingAuthIds = (await Promise.all(accountValues.map((account) => findExistingAuthId(ctx, account)))).filter((id): id is string => id !== null);
  const preflight = await ctx.runQuery(internal.functions.academic.seed.inspectDemoAuthUsageInternal, {
    authIds: existingAuthIds,
    emails: accountValues.map((account) => account.email.toLowerCase()),
    seedProfile,
  });
  if (preflight.conflicts.length) throw new ConvexError(`${profile.schoolName} auth preflight failed: ${preflight.conflicts.join("; ")}`);

  const [adminAuthId, teacherAuthId, portalAuthId] = await Promise.all([
    reconcileAuthUser(ctx, accounts.admin),
    reconcileAuthUser(ctx, accounts.teacher),
    reconcileAuthUser(ctx, accounts.portal),
  ]);
  const postAuthPreflight = await ctx.runQuery(internal.functions.academic.seed.inspectDemoAuthUsageInternal, {
    authIds: [adminAuthId, teacherAuthId, portalAuthId],
    emails: accountValues.map((account) => account.email.toLowerCase()),
    seedProfile,
  });
  if (postAuthPreflight.conflicts.length) throw new ConvexError(`${profile.schoolName} auth linkage preflight failed: ${postAuthPreflight.conflicts.join("; ")}`);

  await drainStorageCleanup(ctx, seedProfile);
  let resetDeletedCount = 0;
  for (let batch = 0; batch < MAX_RESET_BATCHES; batch += 1) {
    const result = await ctx.runMutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, { seedProfile });
    resetDeletedCount += result.deletedCount;
    await acknowledgeDeletedStorage(ctx, result.storageIds);
    if (result.complete) break;
    if (batch === MAX_RESET_BATCHES - 1) throw new ConvexError(`${profile.schoolName} reset exceeded its safety batch limit.`);
  }

  const assets = await storeDemoAssets(ctx, profile.students.length);
  let runId: Id<"demoSeedRuns"> | null = null;
  try {
    runId = await ctx.runMutation(internal.functions.academic.seed.startDemoSeedRunInternal, {
      seedProfile,
      adminAuthId,
      teacherAuthId,
      portalAuthId,
      logoStorageId: assets.logoStorageId,
      portraitStorageIds: assets.portraitStorageIds,
    });
    await ctx.runMutation(internal.functions.academic.seed.populateDemoFoundationInternal, { runId });
    for (let batch = 0; batch < 10; batch += 1) if ((await ctx.runMutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId })).phase !== "students") break;
    for (let batch = 0; batch < 10; batch += 1) if ((await ctx.runMutation(internal.functions.academic.seed.populateDemoAssessmentsBatchInternal, { runId })).phase !== "assessments") break;
    for (let batch = 0; batch < 10; batch += 1) if ((await ctx.runMutation(internal.functions.academic.seed.populateDemoBillingBatchInternal, { runId })).phase !== "billing") break;
    const seeded = await ctx.runMutation(internal.functions.academic.seed.populateDemoKnowledgeAndFinalizeInternal, { runId });
    return { ...seeded, resetDeletedCount, adminEmail: accounts.admin.email, teacherEmail: accounts.teacher.email, portalEmail: accounts.portal.email };
  } catch (error) {
    if (runId) await ctx.runMutation(internal.functions.academic.seed.markDemoSeedRunFailedInternal, { runId, errorMessage: error instanceof Error ? error.message : "Unknown seed failure" });
    else await Promise.allSettled(assets.storageIds.map((storageId) => ctx.storage.delete(storageId)));
    throw error;
  }
}

/**
 * Operator-only full reset/populate entry point. It is permanently scoped to
 * `schools.slug = demo-school`; callers must prove the deployment target.
 */
export const seedDemoSchool = action({
  args: {
    confirmation: v.string(),
    operatorToken: v.string(),
    targetIdentity: v.string(),
    deploymentEnvironment: v.union(v.literal("development"), v.literal("preview"), v.literal("production")),
    productionConfirmation: v.optional(v.string()),
  },
  returns: v.object({
    schoolId: v.id("schools"), studentCount: v.number(), classCount: v.number(), invoiceCount: v.number(), assessmentRecordCount: v.number(), resetDeletedCount: v.number(),
    adminEmail: v.string(), teacherEmail: v.string(), portalEmail: v.string(),
  }),
  handler: async (ctx, args): Promise<SeedDemoResult> => {
    assertOperatorGate(args);
    return await runSchoolSeed(ctx, args, "demo", DEMO_ACCOUNTS);
  },
});

export const seedJudgeSchool = action({
  args: {
    confirmation: v.string(),
    operatorToken: v.string(),
    targetIdentity: v.string(),
    deploymentEnvironment: v.union(v.literal("development"), v.literal("preview"), v.literal("production")),
    productionConfirmation: v.optional(v.string()),
  },
  returns: v.object({
    schoolId: v.id("schools"), studentCount: v.number(), classCount: v.number(), invoiceCount: v.number(), assessmentRecordCount: v.number(), resetDeletedCount: v.number(),
    adminEmail: v.string(), teacherEmail: v.string(), portalEmail: v.string(),
  }),
  handler: async (ctx, args): Promise<SeedDemoResult> => {
    assertJudgeOperatorGate(args);
    return await runSchoolSeed(ctx, args, "judge", judgeAccounts());
  },
});

/** @deprecated Use seedDemoSchool with target identity and operator gates. */
export const seedExamRecordingData = seedDemoSchool;
