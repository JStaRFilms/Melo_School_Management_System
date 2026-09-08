"use node";

import { action } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { createAuth } from "../../betterAuth";
import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  TENANT_SCHOOL_TABLES,
  type TenantSchoolTable,
} from "./tenantPurgeManifest";

const MAX_PURGE_BATCHES = 10_000;
const TENANT_STORAGE_TABLES = [
  "admissionsDocuments",
  "schoolSiteAssets",
  "students",
  "issuedReportCards",
  "knowledgeMaterials",
  "knowledgeOcrJobs",
  "demoSeedRuns",
  "demoSeedStorageCleanup",
  "importWorkspaces",
  "schoolAssets",
  "assetUploadIntents",
  "pdfCompressionCandidates",
  "assetStorageReconciliationIssues",
] as const satisfies readonly TenantSchoolTable[];

type TargetArgs = {
  schoolId: Id<"schools">;
  schoolSlug: string;
};
type TargetResult = {
  schoolId: Id<"schools">;
  schoolName: string;
  schoolSlug: string;
  status: string;
  totalSchools: number;
  logoStorageId?: Id<"_storage">;
};
type TableArgs = TargetArgs & { tableName: TenantSchoolTable };
type TableInventory = { count: number; truncated: boolean };
type IdentityInventory = {
  authCandidates: Array<{ authId: string; email: string }>;
  personIds: Array<Id<"persons">>;
  groupIds: Array<Id<"schoolGroups">>;
  guardianIds: Array<Id<"admissionsGuardians">>;
};
type PurgeBatch = {
  complete: boolean;
  deletedCount: number;
  tableName?: string;
  storageIds: Array<Id<"_storage">>;
};
type RetainedStorageArgs = {
  deletedSchoolId: Id<"schools">;
  candidateStorageIds: Array<Id<"_storage">>;
  tableName: TenantSchoolTable;
};

type BetterAuthLookup = {
  user: { id: string };
  accounts?: Array<{ id: string }>;
};

const targetRef = makeFunctionReference<"query", TargetArgs, TargetResult>(
  "functions/academic/tenantPurge:inspectTenantTargetInternal",
);
const tableRef = makeFunctionReference<"query", TableArgs, TableInventory>(
  "functions/academic/tenantPurge:inspectTenantTableInternal",
);
const verifyTableRef = makeFunctionReference<
  "query",
  { schoolId: Id<"schools">; tableName: TenantSchoolTable },
  boolean
>("functions/academic/tenantPurge:verifyTenantTableEmptyInternal");
const verifySpecialRef = makeFunctionReference<
  "query",
  { schoolId: Id<"schools"> },
  { schoolExists: boolean; residualSpecialRefs: string[] }
>("functions/academic/tenantPurge:verifyTenantSpecialRefsInternal");
const identityRef = makeFunctionReference<"query", TargetArgs, IdentityInventory>(
  "functions/academic/tenantPurge:collectTenantIdentityInternal",
);
const tenantStorageRef = makeFunctionReference<"query", TableArgs, Array<Id<"_storage">>>(
  "functions/academic/tenantPurge:collectTenantStorageInternal",
);
const retainedStorageRef = makeFunctionReference<"query", RetainedStorageArgs, Array<Id<"_storage">>>(
  "functions/academic/tenantPurge:collectRetainedStorageInternal",
);
const retainedLogosRef = makeFunctionReference<
  "query",
  { deletedSchoolId: Id<"schools">; candidateStorageIds: Array<Id<"_storage">> },
  Array<Id<"_storage">>
>("functions/academic/tenantPurge:collectRetainedSchoolLogosInternal");
const purgeBatchRef = makeFunctionReference<"mutation", TargetArgs, PurgeBatch>(
  "functions/academic/tenantPurge:purgeTenantBatchInternal",
);
const reconcilePeopleRef = makeFunctionReference<
  "mutation",
  { deletedSchoolId: Id<"schools">; personIds: Array<Id<"persons">> },
  number
>("functions/academic/tenantPurge:reconcileTenantPeopleInternal");
const purgeGuardiansRef = makeFunctionReference<
  "mutation",
  { guardianIds: Array<Id<"admissionsGuardians">> },
  number
>("functions/academic/tenantPurge:purgeOrphanAdmissionsGuardiansInternal");
const purgeGroupsRef = makeFunctionReference<
  "mutation",
  { groupIds: Array<Id<"schoolGroups">> },
  number
>("functions/academic/tenantPurge:purgeOrphanTenantGroupsInternal");
const authRetainedRef = makeFunctionReference<"query", { authId: string }, boolean>(
  "functions/academic/tenantPurge:isAuthCandidateRetainedInternal",
);

const targetArgsValidator = {
  schoolId: v.id("schools"),
  schoolSlug: v.string(),
  operatorToken: v.string(),
  targetIdentity: v.string(),
  deploymentEnvironment: v.literal("development"),
};

function assertDevelopmentGate(args: {
  schoolSlug: string;
  operatorToken: string;
  targetIdentity: string;
  deploymentEnvironment: "development";
}) {
  const expectedToken = process.env.TENANT_PURGE_OPERATOR_TOKEN?.trim();
  const expectedIdentity = process.env.TENANT_PURGE_DEPLOYMENT_IDENTITY?.trim();
  const expectedEnvironment = process.env.TENANT_PURGE_DEPLOYMENT_ENV?.trim();
  const protectedSlugs = process.env.TENANT_PURGE_PROTECTED_SLUGS
    ?.split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  if (!expectedToken || args.operatorToken !== expectedToken) {
    throw new ConvexError("Tenant-purge operator token is missing or invalid");
  }
  if (!expectedIdentity || expectedEnvironment !== "development") {
    throw new ConvexError("Tenant purge must be explicitly configured for a development deployment");
  }
  if (args.targetIdentity !== expectedIdentity || args.deploymentEnvironment !== expectedEnvironment) {
    throw new ConvexError("Caller target identity/environment does not match the configured development gate");
  }
  if (!protectedSlugs?.length) {
    throw new ConvexError("Set TENANT_PURGE_PROTECTED_SLUGS before using tenant cleanup");
  }
  if (protectedSlugs.includes(args.schoolSlug)) {
    throw new ConvexError("The requested school is protected from tenant cleanup");
  }
}

async function inspectAllTables(
  ctx: ActionCtx,
  target: TargetArgs,
) {
  const tables: Array<{ tableName: TenantSchoolTable; count: number; truncated: boolean }> = [];
  for (const tableName of TENANT_SCHOOL_TABLES) {
    const result = await ctx.runQuery(tableRef, { ...target, tableName });
    tables.push({ tableName, ...result });
  }
  return tables;
}

async function collectStoragePlan(
  ctx: ActionCtx,
  target: TargetArgs,
  logoStorageId?: Id<"_storage">,
) {
  const candidates = new Set<string>();
  if (logoStorageId) candidates.add(String(logoStorageId));
  for (const tableName of TENANT_STORAGE_TABLES) {
    const storageIds = await ctx.runQuery(tenantStorageRef, { ...target, tableName });
    for (const storageId of storageIds) candidates.add(String(storageId));
  }
  if (candidates.size > 8_000) throw new ConvexError("Tenant storage inventory exceeds the supported bound");
  const candidateStorageIds = [...candidates].map((storageId) => storageId as Id<"_storage">);
  const retained = new Set<string>();
  for (const tableName of TENANT_STORAGE_TABLES) {
    const storageIds = await ctx.runQuery(retainedStorageRef, {
      deletedSchoolId: target.schoolId,
      candidateStorageIds,
      tableName,
    });
    for (const storageId of storageIds) retained.add(String(storageId));
  }
  const retainedLogos = await ctx.runQuery(retainedLogosRef, {
    deletedSchoolId: target.schoolId,
    candidateStorageIds,
  });
  for (const storageId of retainedLogos) retained.add(String(storageId));
  return { candidateStorageIds, retained };
}

export const inspectDevelopmentTenantPurge = action({
  args: targetArgsValidator,
  returns: v.object({
    target: v.object({
      schoolId: v.id("schools"),
      schoolName: v.string(),
      schoolSlug: v.string(),
      status: v.string(),
      totalSchools: v.number(),
      logoStorageId: v.optional(v.id("_storage")),
    }),
    tables: v.array(v.object({ tableName: v.string(), count: v.number(), truncated: v.boolean() })),
    totalDirectRows: v.number(),
    authCandidateCount: v.number(),
    personCount: v.number(),
    groupCount: v.number(),
    admissionsGuardianCount: v.number(),
    storageCandidateCount: v.number(),
    sharedStorageCount: v.number(),
    requiredConfirmation: v.string(),
  }),
  handler: async (ctx, args) => {
    assertDevelopmentGate(args);
    const targetArgs = { schoolId: args.schoolId, schoolSlug: args.schoolSlug };
    const target = await ctx.runQuery(targetRef, targetArgs);
    const [tables, identities, storage] = await Promise.all([
      inspectAllTables(ctx, targetArgs),
      ctx.runQuery(identityRef, targetArgs),
      collectStoragePlan(ctx, targetArgs, target.logoStorageId),
    ]);
    return {
      target,
      tables,
      totalDirectRows: tables.reduce((sum, table) => sum + table.count, 0),
      authCandidateCount: identities.authCandidates.length,
      personCount: identities.personIds.length,
      groupCount: identities.groupIds.length,
      admissionsGuardianCount: identities.guardianIds.length,
      storageCandidateCount: storage.candidateStorageIds.length,
      sharedStorageCount: storage.retained.size,
      requiredConfirmation: `PURGE ${target.schoolId} ${target.schoolSlug}`,
    };
  },
});

export const verifyDevelopmentTenantPurge = action({
  args: targetArgsValidator,
  returns: v.object({
    schoolExists: v.boolean(),
    residualTables: v.array(v.string()),
    residualSpecialRefs: v.array(v.string()),
    complete: v.boolean(),
  }),
  handler: async (ctx, args) => {
    assertDevelopmentGate(args);
    const residualTables: string[] = [];
    for (const tableName of TENANT_SCHOOL_TABLES) {
      if (!(await ctx.runQuery(verifyTableRef, { schoolId: args.schoolId, tableName }))) {
        residualTables.push(tableName);
      }
    }
    const special = await ctx.runQuery(verifySpecialRef, { schoolId: args.schoolId });
    return {
      schoolExists: special.schoolExists,
      residualTables,
      residualSpecialRefs: special.residualSpecialRefs,
      complete: !special.schoolExists && residualTables.length === 0 && special.residualSpecialRefs.length === 0,
    };
  },
});

export const purgeDevelopmentTenant = action({
  args: {
    ...targetArgsValidator,
    confirmation: v.string(),
    backupReference: v.string(),
  },
  returns: v.object({
    schoolId: v.id("schools"),
    schoolSlug: v.string(),
    deletedRows: v.number(),
    batches: v.number(),
    reconciledPeople: v.number(),
    deletedGroups: v.number(),
    deletedAdmissionsGuardians: v.number(),
    deletedAuthUsers: v.number(),
    retainedAuthUsers: v.number(),
    deletedStorageFiles: v.number(),
    retainedSharedStorageFiles: v.number(),
  }),
  handler: async (ctx, args) => {
    assertDevelopmentGate(args);
    const targetArgs = { schoolId: args.schoolId, schoolSlug: args.schoolSlug };
    const target = await ctx.runQuery(targetRef, targetArgs);
    const requiredConfirmation = `PURGE ${target.schoolId} ${target.schoolSlug}`;
    if (args.confirmation !== requiredConfirmation) {
      throw new ConvexError(`Confirmation must exactly match: ${requiredConfirmation}`);
    }
    if (args.backupReference.trim().length < 12) {
      throw new ConvexError("A reviewed development-backup reference is required");
    }
    const tables = await inspectAllTables(ctx, targetArgs);
    if (tables.some((table) => table.truncated)) {
      throw new ConvexError("Tenant inventory contains a table above 1,000 rows; extend the reviewed purge bounds first");
    }
    const identities = await ctx.runQuery(identityRef, targetArgs);
    const storagePlan = await collectStoragePlan(ctx, targetArgs, target.logoStorageId);

    let deletedRows = 0;
    let batches = 0;
    for (; batches < MAX_PURGE_BATCHES; batches += 1) {
      const result = await ctx.runMutation(purgeBatchRef, targetArgs);
      deletedRows += result.deletedCount;
      if (result.complete) break;
    }
    if (batches === MAX_PURGE_BATCHES) {
      throw new ConvexError("Tenant purge exceeded its safety batch limit");
    }

    const reconciledPeople = await ctx.runMutation(reconcilePeopleRef, {
      deletedSchoolId: target.schoolId,
      personIds: identities.personIds,
    });
    const deletedGroups = await ctx.runMutation(purgeGroupsRef, { groupIds: identities.groupIds });
    const deletedAdmissionsGuardians = await ctx.runMutation(purgeGuardiansRef, { guardianIds: identities.guardianIds });

    const auth = await createAuth(ctx).$context;
    let deletedAuthUsers = 0;
    let retainedAuthUsers = 0;
    for (const candidate of identities.authCandidates) {
      if (await ctx.runQuery(authRetainedRef, { authId: candidate.authId })) {
        retainedAuthUsers += 1;
        continue;
      }
      const existing = (await auth.internalAdapter.findUserByEmail(
        candidate.email.trim().toLowerCase(),
        { includeAccounts: true },
      )) as BetterAuthLookup | null;
      if (existing?.user.id !== candidate.authId) {
        retainedAuthUsers += 1;
        continue;
      }
      await auth.internalAdapter.deleteSessions(candidate.authId);
      for (const account of existing.accounts ?? []) await auth.internalAdapter.deleteAccount(account.id);
      await auth.internalAdapter.deleteUser(candidate.authId);
      deletedAuthUsers += 1;
    }

    let deletedStorageFiles = 0;
    for (const storageId of storagePlan.candidateStorageIds) {
      if (storagePlan.retained.has(String(storageId))) continue;
      try {
        await ctx.storage.delete(storageId);
        deletedStorageFiles += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("StorageIdNotFound") && !(message.includes("storage id") && message.includes("not found"))) {
          throw error;
        }
      }
    }

    return {
      schoolId: target.schoolId,
      schoolSlug: target.schoolSlug,
      deletedRows,
      batches: batches + 1,
      reconciledPeople,
      deletedGroups,
      deletedAdmissionsGuardians,
      deletedAuthUsers,
      retainedAuthUsers,
      deletedStorageFiles,
      retainedSharedStorageFiles: storagePlan.retained.size,
    };
  },
});
