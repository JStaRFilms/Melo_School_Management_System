"use node";

import { action } from "../../_generated/server";
import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { createAuth } from "../../betterAuth";
import { ConvexError, v } from "convex/values";
import { demoPortraitPng, demoSchoolLogoPng } from "./demoAssets";
import { DEMO_ACCOUNTS, DEMO_RESET_CONFIRMATION, DEMO_STUDENTS } from "./demoData";

const MAX_RESET_BATCHES = 500;
const PRODUCTION_RESET_PHRASE = "RESET demo-school IN PRODUCTION";

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

type SeedAuthUser = (typeof DEMO_ACCOUNTS)[keyof typeof DEMO_ACCOUNTS];

type ExistingAuthLookup = {
  user: { id: string; email: string; name?: string | null };
  accounts?: Array<{ id: string }>;
};

export function assertOperatorGate(args: {
  confirmation: string;
  operatorToken: string;
  targetIdentity: string;
  deploymentEnvironment: "development" | "preview" | "production";
  productionConfirmation?: string;
}) {
  if (args.confirmation !== DEMO_RESET_CONFIRMATION) {
    throw new ConvexError(`Set confirmation exactly to "${DEMO_RESET_CONFIRMATION}" to reset the demo tenant.`);
  }
  const expectedToken = process.env.DEMO_SEED_OPERATOR_TOKEN?.trim();
  if (!expectedToken || args.operatorToken !== expectedToken) {
    throw new ConvexError("Demo seed operator token is missing or invalid.");
  }
  const expectedIdentity = process.env.DEMO_SEED_DEPLOYMENT_IDENTITY?.trim();
  const expectedEnvironment = process.env.DEMO_SEED_DEPLOYMENT_ENV?.trim();
  if (!expectedIdentity || !expectedEnvironment) {
    throw new ConvexError("Set DEMO_SEED_DEPLOYMENT_IDENTITY and DEMO_SEED_DEPLOYMENT_ENV before a demo reset.");
  }
  if (args.targetIdentity !== expectedIdentity || args.deploymentEnvironment !== expectedEnvironment) {
    throw new ConvexError("Caller target identity/environment does not match the explicitly configured deployment gate.");
  }
  if (args.deploymentEnvironment === "production") {
    if (process.env.DEMO_SEED_ALLOW_PRODUCTION !== "true" || args.productionConfirmation !== PRODUCTION_RESET_PHRASE) {
      throw new ConvexError("Production reset requires DEMO_SEED_ALLOW_PRODUCTION=true and the dedicated production confirmation phrase.");
    }
  }
}

async function findExistingAuthId(ctx: ActionCtx, account: SeedAuthUser) {
  const auth = createAuth(ctx);
  const authContext = await auth.$context;
  const existing = (await authContext.internalAdapter.findUserByEmail(account.email.trim().toLowerCase(), { includeAccounts: true })) as ExistingAuthLookup | null;
  return existing?.user?.id ?? null;
}

async function reconcileAuthUser(ctx: ActionCtx, account: SeedAuthUser) {
  const auth = createAuth(ctx);
  const authContext = await auth.$context;
  const email = account.email.trim().toLowerCase();
  const passwordHash = await authContext.password.hash(account.password);
  const existing = (await authContext.internalAdapter.findUserByEmail(email, { includeAccounts: true })) as ExistingAuthLookup | null;

  if (!existing?.user?.id) {
    const created = await authContext.internalAdapter.createUser({ email, name: account.name, emailVerified: false });
    if (!created?.id) throw new ConvexError(`Failed to create the Better Auth account for ${email}.`);
    try {
      await authContext.internalAdapter.linkAccount({ userId: created.id, providerId: "credential", accountId: created.id, password: passwordHash });
    } catch (error) {
      await authContext.internalAdapter.deleteUser(created.id);
      throw error;
    }
    await authContext.internalAdapter.deleteSessions(created.id);
    return created.id;
  }

  await authContext.internalAdapter.updateUser(existing.user.id, { email, name: account.name });
  if (existing.accounts?.length) {
    await authContext.internalAdapter.updatePassword(existing.user.id, passwordHash);
  } else {
    await authContext.internalAdapter.linkAccount({ userId: existing.user.id, providerId: "credential", accountId: existing.user.id, password: passwordHash });
  }
  // A reset deliberately invalidates prior demo sessions after resetting credentials.
  await authContext.internalAdapter.deleteSessions(existing.user.id);
  return existing.user.id;
}

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

async function drainStorageCleanup(ctx: ActionCtx) {
  for (let batch = 0; batch < MAX_RESET_BATCHES; batch += 1) {
    const storageIds = await ctx.runQuery(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, {});
    if (storageIds.length === 0) return;
    await acknowledgeDeletedStorage(ctx, storageIds);
  }
  throw new ConvexError("Demo storage cleanup exceeded its safety batch limit.");
}

async function storeDemoAssets(ctx: ActionCtx) {
  const storageIds: Id<"_storage">[] = [];
  try {
    const logoStorageId = await ctx.storage.store(new Blob([demoSchoolLogoPng()], { type: "image/png" }));
    storageIds.push(logoStorageId);
    const portraitStorageIds: Id<"_storage">[] = [];
    for (let index = 0; index < DEMO_STUDENTS.length; index += 1) {
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
    // Do this before deleting tenant rows: neither a matching email nor a Better
    // Auth ID may be linked to a non-demo school or platform administrator.
    const existingAuthIds = (await Promise.all(Object.values(DEMO_ACCOUNTS).map((account) => findExistingAuthId(ctx, account)))).filter((id): id is string => id !== null);
    const preflight = await ctx.runQuery(internal.functions.academic.seed.inspectDemoAuthUsageInternal, {
      authIds: existingAuthIds, emails: Object.values(DEMO_ACCOUNTS).map((account) => account.email.toLowerCase()),
    });
    if (preflight.conflicts.length) throw new ConvexError(`Demo auth preflight failed: ${preflight.conflicts.join("; ")}`);

    const [adminAuthId, teacherAuthId, portalAuthId] = await Promise.all([
      reconcileAuthUser(ctx, DEMO_ACCOUNTS.admin), reconcileAuthUser(ctx, DEMO_ACCOUNTS.teacher), reconcileAuthUser(ctx, DEMO_ACCOUNTS.portal),
    ]);
    const postAuthPreflight = await ctx.runQuery(internal.functions.academic.seed.inspectDemoAuthUsageInternal, {
      authIds: [adminAuthId, teacherAuthId, portalAuthId], emails: Object.values(DEMO_ACCOUNTS).map((account) => account.email.toLowerCase()),
    });
    if (postAuthPreflight.conflicts.length) throw new ConvexError(`Demo auth linkage preflight failed: ${postAuthPreflight.conflicts.join("; ")}`);

    await drainStorageCleanup(ctx);
    let resetDeletedCount = 0;
    for (let batch = 0; batch < MAX_RESET_BATCHES; batch += 1) {
      const result = await ctx.runMutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, {});
      resetDeletedCount += result.deletedCount;
      // The mutation records IDs in a durable ledger before removing database
      // rows. A failed delete is therefore retried before another reset batch.
      await acknowledgeDeletedStorage(ctx, result.storageIds);
      if (result.complete) break;
      if (batch === MAX_RESET_BATCHES - 1) throw new ConvexError("Demo reset exceeded its safety batch limit; inspect the tenant before retrying.");
    }

    const assets = await storeDemoAssets(ctx);
    let runId: Id<"demoSeedRuns"> | null = null;
    try {
      runId = await ctx.runMutation(internal.functions.academic.seed.startDemoSeedRunInternal, {
        adminAuthId, teacherAuthId, portalAuthId, logoStorageId: assets.logoStorageId, portraitStorageIds: assets.portraitStorageIds,
      });
      await ctx.runMutation(internal.functions.academic.seed.populateDemoFoundationInternal, { runId });
      for (let batch = 0; batch < 10; batch += 1) {
        const progress = await ctx.runMutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId });
        if (progress.phase !== "students") break;
      }
      for (let batch = 0; batch < 10; batch += 1) {
        const progress = await ctx.runMutation(internal.functions.academic.seed.populateDemoAssessmentsBatchInternal, { runId });
        if (progress.phase !== "assessments") break;
      }
      for (let batch = 0; batch < 10; batch += 1) {
        const progress = await ctx.runMutation(internal.functions.academic.seed.populateDemoBillingBatchInternal, { runId });
        if (progress.phase !== "billing") break;
      }
      const seeded = await ctx.runMutation(internal.functions.academic.seed.populateDemoKnowledgeAndFinalizeInternal, { runId });
      return { ...seeded, resetDeletedCount, adminEmail: DEMO_ACCOUNTS.admin.email, teacherEmail: DEMO_ACCOUNTS.teacher.email, portalEmail: DEMO_ACCOUNTS.portal.email };
    } catch (error) {
      if (runId) {
        // Keep assets attached to the failed partial tenant. The next gated reset
        // records and deletes them through the durable cleanup ledger.
        await ctx.runMutation(internal.functions.academic.seed.markDemoSeedRunFailedInternal, { runId, errorMessage: error instanceof Error ? error.message : "Unknown seed failure" });
      } else {
        await Promise.allSettled(assets.storageIds.map((storageId) => ctx.storage.delete(storageId)));
      }
      throw error;
    }
  },
});

/** @deprecated Use seedDemoSchool with target identity and operator gates. */
export const seedExamRecordingData = seedDemoSchool;
