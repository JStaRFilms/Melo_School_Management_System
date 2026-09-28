"use node";

import { createHash, randomBytes } from "node:crypto";
import { action, type ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import coverage from "../../schemaCoverageRegistry.json";
import { TENANT_SCHOOL_TABLES, type TenantSchoolTable } from "./tenantPurgeManifest";
import { inspectDemoSchoolForOperator } from "./demoPreflightAction";
import { DEMO_ACCOUNTS, DEMO_SCHOOL_SLUG } from "./demoData";
import { assertReviewedCredential, findExistingAuthId, reconcileAuthUser } from "./seedRunnerSecurity";
import { canonical, originalAssetIds, resetSeal } from "./demoResetDigest";
import { DEMO_STUDENTS } from "./demoData";

type Row = { _id: string; [key: string]: unknown };
type Entry = { table: string; id: string; digest: string };
type ChildTable = "membershipRoleAssignments" | "membershipDirectGrants" | "membershipDirectRestrictions" | "delegationCeilings" | "subscriptionInvoiceStudents" | "usageExceptionDecisions" | "usageOperationTransitions";
const directRef = makeFunctionReference<"query", { schoolId: Id<"schools">; table: TenantSchoolTable }, Row[]>("functions/academic/demoResetInventory:readDirectRowsInternal");
const childRef = makeFunctionReference<"query", { schoolId: Id<"schools">; table: ChildTable; parentIds: string[] }, Row[]>("functions/academic/demoResetInventory:readChildRowsInternal");
const identityRef = makeFunctionReference<"query", { schoolId: Id<"schools"> }, { school: Row; run: Row; people: Row[]; authIds: string[] }>("functions/academic/demoResetInventory:readIdentityRowsInternal");
const reserveRef = makeFunctionReference<"mutation", {
  schoolId: Id<"schools">; schoolSlug: string; cloudUrl: string; targetIdentity: string;
  inventory: Entry[]; inventoryHash: string; confirmationPhrase: string;
  authIssuer: string; authIds: string[]; personIds: Array<Id<"persons">>; storageCandidateIds: Array<Id<"_storage">>; retainedStorageIds: Array<Id<"_storage">>;
}, Id<"demoResetOperations">>("functions/academic/demoResetInventory:reserveDemoResetInternal");
const cancelRef = makeFunctionReference<"mutation", { operationId: Id<"demoResetOperations"> }, null>("functions/academic/demoResetInventory:cancelDemoResetInternal");
type Operation = {
  schoolId: Id<"schools">; schoolSlug: string; cloudUrl: string; targetIdentity: string;
  status: "prepared" | "cancelled" | "deleting" | "storage_pending" | "auth_pending" | "ready_to_seed" | "seeding" | "complete";
  inventoryHash: string; confirmationPhrase: string; deletionCursor?: number; inventoryLength: number;
  storageCandidateIds: Id<"_storage">[]; retainedStorageIds: Id<"_storage">[]; storageAcknowledgedIds?: Id<"_storage">[];
};
const opRef = makeFunctionReference<"query", { operationId: Id<"demoResetOperations"> }, Operation | null>("functions/academic/demoResetInventory:readReviewedDemoResetInternal");
const authorizeRef = makeFunctionReference<"mutation", { operationId: Id<"demoResetOperations">; operatorToken: string; inventoryHash: string; confirmationPhrase: string }, null>("functions/academic/demoResetInventory:authorizeReviewedDemoResetInternal");
const deleteRef = makeFunctionReference<"mutation", { operationId: Id<"demoResetOperations"> }, { cursor: number; status: "deleting" | "storage_pending" }>("functions/academic/demoResetDeletion:deleteReviewedDemoRowsBatchInternal");
const processStorageRef = makeFunctionReference<"mutation", { operationId: Id<"demoResetOperations">; storageId: Id<"_storage"> }, { status: "storage_pending" | "auth_pending"; acknowledged: number }>("functions/academic/demoResetStorage:processDemoResetStorageCandidateInternal");
const emptyStorageRef = makeFunctionReference<"mutation", { operationId: Id<"demoResetOperations"> }, "auth_pending">("functions/academic/demoResetStorage:finishEmptyDemoResetStorageInternal");
const checkAuthRef = makeFunctionReference<"query", { operationId: Id<"demoResetOperations"> }, Array<{ index: number; authId: string; email: string; acknowledged: boolean }>>("functions/academic/demoResetAuth:checkDemoResetAuthDetachedInternal");
const ackAuthRef = makeFunctionReference<"mutation", { operationId: Id<"demoResetOperations">; index: number; authId: string }, { status: "auth_pending" | "ready_to_seed"; acknowledged: number }>("functions/academic/demoResetAuth:acknowledgeDemoResetAuthInternal");
const MAX_DELETE_BATCHES = 100; // 5000 reviewed rows, 50 per transaction.

// Canonical representation of Convex values, including bigint and binary values.
// Never serialize full rows into the durable operation, only their SHA-256 digests.
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sha256 = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

function storageOnRow(table: string, row: Row): string[] {
  const paths = (coverage as Record<string, { storage: Record<string, string> }>)[table]?.storage ?? {};
  const ids: string[] = [];
  for (const [path, disposition] of Object.entries(paths)) {
    if (disposition === "unsupported-block-reset") throw new ConvexError(`Unsupported storage path in ${table}`);
    let values: unknown[] = [row];
    for (const segment of path.split(".")) {
      const array = segment.endsWith("[]");
      const key = array ? segment.slice(0, -2) : segment;
      values = values.flatMap((value) => {
        const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
        return array ? Array.isArray(next) ? next : [] : next === undefined || next === null ? [] : [next];
      });
    }
    for (const value of values) {
      if (typeof value !== "string") throw new ConvexError(`Invalid storage candidate in ${table}`);
      ids.push(value);
    }
  }
  return ids;
}

export const prepareDemoReset = action({
  args: { operatorToken: v.string(), targetIdentity: v.string() },
  returns: v.object({ operationId: v.id("demoResetOperations"), schoolId: v.id("schools"), inventoryHash: v.string(), confirmationPhrase: v.string(), counts: v.array(v.object({ table: v.string(), count: v.number() })) }),
  handler: async (ctx, args) => {
    const inspection = await inspectDemoSchoolForOperator(ctx, args);
    if (!inspection.ready || !inspection.school || inspection.blockers.length || inspection.tables.some((table) => table.truncated) ||
        !inspection.cloudUrl || inspection.cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
        process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development") throw new ConvexError("Populated demo preflight or development cloud URL gate failed");
    const schoolId = inspection.school.id;
    const { school, run, people, authIds } = await ctx.runQuery(identityRef, { schoolId });
    if (typeof run.authIssuer !== "string" || people.length !== 3) throw new ConvexError("Incomplete identity inventory");
    const rows = new Map<string, Row[]>();
    let total = 0;
    const add = (table: string, entries: Row[]) => {
      if (entries.length > 1000 || (total += entries.length) > 5000 || rows.has(table)) throw new ConvexError("Reset inventory exceeds 1000 per table or 5000 total");
      rows.set(table, entries);
    };
    add("schools", [school]);
    add("persons", people);
    for (const table of TENANT_SCHOOL_TABLES) add(table, await ctx.runQuery(directRef, { schoolId, table }));
    // Two indexed direct-school exceptions are checked by preflight for absence.
    for (const table of ["branchSettingOverrides", "roleTemplates"] as const) {
      // Both are direct by_school tables and belong in the exact inventory.
      const ref = makeFunctionReference<"query", { schoolId: Id<"schools">; table: typeof table }, Row[]>("functions/academic/demoResetInventory:readSpecialRowsInternal");
      add(table, await ctx.runQuery(ref, { schoolId, table }));
    }
    const parents: Record<ChildTable, string[]> = {
      membershipRoleAssignments: (rows.get("branchMemberships") ?? []).map((row) => row._id),
      membershipDirectGrants: (rows.get("branchMemberships") ?? []).map((row) => row._id),
      membershipDirectRestrictions: (rows.get("branchMemberships") ?? []).map((row) => row._id),
      delegationCeilings: (rows.get("branchMemberships") ?? []).map((row) => row._id),
      subscriptionInvoiceStudents: (rows.get("subscriptionInvoices") ?? []).map((row) => row._id),
      usageExceptionDecisions: (rows.get("usageExceptionRequests") ?? []).map((row) => row._id),
      usageOperationTransitions: (rows.get("usageOperationAttempts") ?? []).map((row) => row._id),
    };
    for (const [table, parentIds] of Object.entries(parents) as Array<[ChildTable, string[]]>) {
      add(table, parentIds.length ? await ctx.runQuery(childRef, { schoolId, table, parentIds }) : []);
    }
    const owns = (table: string, id: unknown) => typeof id === "string" && (rows.get(table) ?? []).some((row) => row._id === id);
    const allowedPeople = new Set(people.map((row) => row._id));
    if ((rows.get("membershipRoleAssignments") ?? []).some((row) => !owns("roleTemplates", row.roleTemplateId) || row.assignedBy && !allowedPeople.has(row.assignedBy as string)) ||
        (rows.get("membershipDirectGrants") ?? []).some((row) => row.grantedBy && !allowedPeople.has(row.grantedBy as string)) ||
        (rows.get("membershipDirectRestrictions") ?? []).some((row) => row.restrictedBy && !allowedPeople.has(row.restrictedBy as string)) ||
        (rows.get("delegationCeilings") ?? []).some((row) => row.updatedBy && !allowedPeople.has(row.updatedBy as string)) ||
        (rows.get("subscriptionInvoiceStudents") ?? []).some((row) => !owns("students", row.studentId)) ||
        (rows.get("usageExceptionDecisions") ?? []).some((row) => row.grantId && !owns("usageAllowanceGrants", row.grantId))) {
      throw new ConvexError("Indirect row links to an unreviewed owner");
    }
    if (typeof run.logoStorageId !== "string" || !Array.isArray(run.portraitStorageIds) ||
        !run.portraitStorageIds.every((id) => typeof id === "string")) throw new ConvexError("Original demo assets changed");
    const retainedStorageIds = originalAssetIds({ logoStorageId: run.logoStorageId, portraitStorageIds: run.portraitStorageIds }) as Array<Id<"_storage">>;
    const students = rows.get("students") ?? [];
    if (school.logoStorageId !== retainedStorageIds[0] || students.length !== DEMO_STUDENTS.length ||
        DEMO_STUDENTS.some((student, index) => students.filter((row) => row.admissionNumber === student.admissionNumber).length !== 1 ||
          students.find((row) => row.admissionNumber === student.admissionNumber)?.photoStorageId !== retainedStorageIds[index + 1])) {
      throw new ConvexError("Original demo asset references changed");
    }
    const personIds = people.map((row) => row._id as Id<"persons">);
    const storage = new Set<string>();
    const inventory: Entry[] = [];
    const counts: Array<{ table: string; count: number }> = [];
    for (const [table, entries] of rows) {
      counts.push({ table, count: entries.length });
      for (const row of entries) {
        for (const id of storageOnRow(table, row)) storage.add(id);
        inventory.push({ table, id: row._id, digest: sha256(row) });
      }
    }
    inventory.sort((a, b) => compare(a.table, b.table) || compare(a.id, b.id));
    if (retainedStorageIds.some((id) => !storage.has(id))) throw new ConvexError("Original demo asset missing from reviewed storage candidates");
    if (storage.size > 50) throw new ConvexError("Reset storage candidates exceed 50");
    const storageCandidateIds = [...storage].sort() as Array<Id<"_storage">>;
    const inventoryHash = sha256(resetSeal({ schoolId, cloudUrl: inspection.cloudUrl, targetIdentity: args.targetIdentity, inventory, authIssuer: run.authIssuer as string, authIds, personIds, storageCandidateIds, retainedStorageIds }));
    const confirmationPhrase = `RESET demo-school ${schoolId} ${inventoryHash} ${randomBytes(16).toString("hex")}`;
    const operationId = await ctx.runMutation(reserveRef, {
      schoolId, schoolSlug: DEMO_SCHOOL_SLUG, cloudUrl: inspection.cloudUrl, targetIdentity: args.targetIdentity,
      inventory, inventoryHash, confirmationPhrase, authIssuer: run.authIssuer, authIds, personIds,
      storageCandidateIds, retainedStorageIds,
    });
    // No row contents, credentials, emails or person/auth IDs leave this action.
    return { operationId, schoolId, inventoryHash, confirmationPhrase, counts };
  },
});

type ExecuteArgs = {
  operatorToken: string; targetIdentity: string; deploymentEnvironment: "development";
  schoolId: Id<"schools">; schoolSlug: string; operationId: Id<"demoResetOperations">;
  inventoryHash: string; confirmationPhrase: string;
};

// Inject only the Better Auth adapter for offline failure tests. Production uses
// the same lookup/reconcile functions as the first-run seed, after ID checks.
export async function executeReviewedDemoReset(
  ctx: ActionCtx, args: ExecuteArgs,
  authOps: { find: typeof findExistingAuthId; verify: typeof assertReviewedCredential; reconcile: typeof reconcileAuthUser } =
    { find: findExistingAuthId, verify: assertReviewedCredential, reconcile: reconcileAuthUser },
) {
  const token = process.env.DEMO_SEED_OPERATOR_TOKEN?.trim();
  const identity = process.env.DEMO_SEED_DEPLOYMENT_IDENTITY?.trim();
  const cloud = process.env.CONVEX_CLOUD_URL;
  if (!token || args.operatorToken !== token || !identity || args.targetIdentity !== identity ||
      process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || args.deploymentEnvironment !== "development" ||
      !cloud || !process.env.DEMO_SEED_EXPECTED_CLOUD_URL || cloud !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
      args.schoolSlug !== DEMO_SCHOOL_SLUG) throw new ConvexError("Demo reset operator or development target gate failed");

  const operation = await ctx.runQuery(opRef, { operationId: args.operationId });
  if (!operation || operation.schoolId !== args.schoolId || operation.schoolSlug !== args.schoolSlug ||
      operation.cloudUrl !== cloud || operation.targetIdentity !== args.targetIdentity ||
      !/^[a-f0-9]{64}$/.test(operation.inventoryHash) || operation.inventoryHash !== args.inventoryHash ||
      operation.confirmationPhrase !== args.confirmationPhrase ||
      !operation.confirmationPhrase.startsWith(`RESET demo-school ${args.schoolId} ${args.inventoryHash} `) ||
      !/^RESET demo-school .+ [a-f0-9]{64} [a-f0-9]{32}$/.test(operation.confirmationPhrase) ||
      operation.status === "cancelled") throw new ConvexError("Reviewed reset target or confirmation changed");

  if (operation.storageCandidateIds.length > 50) throw new ConvexError("Reset storage candidates exceed 50");
  let status = operation.status;
  if (status === "prepared") {
    await ctx.runMutation(authorizeRef, {
      operationId: args.operationId, operatorToken: args.operatorToken,
      inventoryHash: args.inventoryHash, confirmationPhrase: args.confirmationPhrase,
    });
    status = "deleting";
  }
  if (status === "deleting") {
    if (!Number.isSafeInteger(operation.inventoryLength) || operation.inventoryLength > 5000 ||
        !Number.isSafeInteger(operation.deletionCursor) || operation.deletionCursor! < 0 ||
        operation.deletionCursor! > operation.inventoryLength) throw new ConvexError("Invalid deletion progress");
    const remaining = Math.ceil((operation.inventoryLength - (operation.status === "prepared" ? 0 : operation.deletionCursor!)) / 50);
    if (remaining > MAX_DELETE_BATCHES) throw new ConvexError("Demo reset exceeds deletion batch limit");
    let cursor = operation.status === "prepared" ? 0 : operation.deletionCursor!;
    for (let batch = 0; batch < MAX_DELETE_BATCHES; batch++) {
      const result = await ctx.runMutation(deleteRef, { operationId: args.operationId });
      if (result.cursor <= cursor || result.cursor > operation.inventoryLength) throw new ConvexError("Demo reset deletion cursor did not advance");
      cursor = result.cursor;
      if (result.status === "storage_pending") { status = result.status; break; }
    }
    if (status !== "storage_pending") throw new ConvexError("Demo reset exceeded deletion batch limit");
  }
  if (status === "storage_pending") {
    if (operation.storageCandidateIds.length === 0) {
      status = await ctx.runMutation(emptyStorageRef, { operationId: args.operationId });
    } else {
      const acknowledged = new Set(operation.storageAcknowledgedIds ?? []);
      if (operation.retainedStorageIds.length !== 37 || new Set(operation.retainedStorageIds).size !== 37 ||
          operation.retainedStorageIds.some((id) => !operation.storageCandidateIds.includes(id))) throw new ConvexError("Invalid retained storage seal");
      if (operation.storageCandidateIds.length > 50 || acknowledged.size !== (operation.storageAcknowledgedIds ?? []).length ||
          [...acknowledged].some((id) => !operation.storageCandidateIds.includes(id))) throw new ConvexError("Invalid storage progress");
      for (const storageId of operation.storageCandidateIds) {
        if (acknowledged.has(storageId)) continue;
        const result = await ctx.runMutation(processStorageRef, { operationId: args.operationId, storageId });
        status = result.status;
      }
      if (status !== "auth_pending") throw new ConvexError("Storage cleanup did not reach auth phase");
    }
  }
  if (status === "auth_pending") {
    const accounts = Object.values(DEMO_ACCOUNTS);
    for (let index = 0; index < 3; index++) {
      const checked = await ctx.runQuery(checkAuthRef, { operationId: args.operationId });
      if (checked.length !== 3 || checked.some((row, i) => row.index !== i || row.email !== accounts[i].email.trim().toLowerCase()) ||
          checked.some((row, i) => row.acknowledged && checked.slice(0, i).some((prior) => !prior.acknowledged))) {
        throw new ConvexError("Recorded demo accounts changed");
      }
      const account = accounts[index];
      if (await authOps.find(ctx, account) !== checked[index].authId) throw new ConvexError("Better Auth ID differs from reviewed account");
      if (checked[index].acknowledged) continue;
      await authOps.verify(ctx, account, checked[index].authId);
      if (await authOps.reconcile(ctx, account, checked[index].authId) !== checked[index].authId) throw new ConvexError("Reconciled Better Auth ID changed");
      const result = await ctx.runMutation(ackAuthRef, { operationId: args.operationId, index, authId: checked[index].authId });
      status = result.status;
    }
    if (status !== "ready_to_seed") throw new ConvexError("Auth cleanup did not reach ready_to_seed");
  }
  if (status !== "ready_to_seed") throw new ConvexError("Demo reset did not finish cleanup");
  return { operationId: args.operationId, status: "ready_to_seed" as const };
}

export const executeDemoReset = action({
  args: { operatorToken: v.string(), targetIdentity: v.string(), deploymentEnvironment: v.literal("development"),
    schoolId: v.id("schools"), schoolSlug: v.string(), operationId: v.id("demoResetOperations"),
    inventoryHash: v.string(), confirmationPhrase: v.string() },
  returns: v.object({ operationId: v.id("demoResetOperations"), status: v.literal("ready_to_seed") }),
  handler: executeReviewedDemoReset,
});

const verifiedRef = makeFunctionReference<"query", { operationId: Id<"demoResetOperations"> }, {
  schoolId: Id<"schools">; runId: Id<"demoSeedRuns">; studentCount: number; classCount: number; invoiceCount: number; assessmentRecordCount: number;
}>("functions/academic/demoResetInventory:verifyCompletedDemoResetInternal");

export const verifyCompletedDemoReset = action({
  args: { operatorToken: v.string(), targetIdentity: v.string(), operationId: v.id("demoResetOperations") },
  returns: v.object({ cloudUrl: v.string(), operationId: v.id("demoResetOperations"), status: v.literal("complete"),
    schoolId: v.id("schools"), runId: v.id("demoSeedRuns"), studentCount: v.number(), classCount: v.number(), invoiceCount: v.number(), assessmentRecordCount: v.number() }),
  handler: async (ctx, args) => {
    const cloudUrl = process.env.CONVEX_CLOUD_URL;
    if (!process.env.DEMO_SEED_OPERATOR_TOKEN?.trim() || args.operatorToken !== process.env.DEMO_SEED_OPERATOR_TOKEN.trim() ||
        !process.env.DEMO_SEED_DEPLOYMENT_IDENTITY?.trim() || args.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY.trim() ||
        process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || !cloudUrl ||
        cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL) throw new ConvexError("Demo reset verification gate failed");
    const result = await ctx.runQuery(verifiedRef, { operationId: args.operationId });
    return { cloudUrl, operationId: args.operationId, status: "complete" as const, ...result };
  },
});

// Read-only resume probe. A caller must already hold the entire reviewed seal.
export const inspectDemoResetOperation = action({
  args: { operatorToken: v.string(), targetIdentity: v.string(), deploymentEnvironment: v.literal("development"),
    schoolId: v.id("schools"), schoolSlug: v.string(), operationId: v.id("demoResetOperations"),
    inventoryHash: v.string(), confirmationPhrase: v.string() },
  returns: v.object({ status: v.union(v.literal("prepared"), v.literal("deleting"), v.literal("storage_pending"),
    v.literal("auth_pending"), v.literal("ready_to_seed"), v.literal("seeding"), v.literal("complete")) }),
  handler: async (ctx, args) => {
    const cloud = process.env.CONVEX_CLOUD_URL;
    if (!process.env.DEMO_SEED_OPERATOR_TOKEN?.trim() || args.operatorToken !== process.env.DEMO_SEED_OPERATOR_TOKEN.trim() ||
        !process.env.DEMO_SEED_DEPLOYMENT_IDENTITY?.trim() || args.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY.trim() ||
        process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || args.deploymentEnvironment !== "development" ||
        !cloud || cloud !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL || args.schoolSlug !== DEMO_SCHOOL_SLUG) {
      throw new ConvexError("Demo reset operator or development target gate failed");
    }
    const op = await ctx.runQuery(opRef, { operationId: args.operationId });
    if (!op || op.status === "cancelled" || op.schoolId !== args.schoolId || op.schoolSlug !== args.schoolSlug ||
        op.cloudUrl !== cloud || op.targetIdentity !== args.targetIdentity ||
        !/^[a-f0-9]{64}$/.test(args.inventoryHash) || op.inventoryHash !== args.inventoryHash ||
        !/^RESET demo-school .+ [a-f0-9]{64} [a-f0-9]{32}$/.test(args.confirmationPhrase) ||
        !args.confirmationPhrase.startsWith(`RESET demo-school ${args.schoolId} ${args.inventoryHash} `) ||
        op.confirmationPhrase !== args.confirmationPhrase) throw new ConvexError("Reviewed reset target or confirmation changed");
    return { status: op.status };
  },
});

export const cancelDemoReset = action({
  args: { operatorToken: v.string(), targetIdentity: v.string(), operationId: v.id("demoResetOperations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await inspectDemoSchoolForOperator(ctx, args);
    if (process.env.CONVEX_CLOUD_URL !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL) throw new ConvexError("Development cloud URL gate failed");
    return ctx.runMutation(cancelRef, { operationId: args.operationId });
  },
});
