import { internalMutation, internalQuery } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { DEMO_SCHOOL_SLUG, DEMO_STUDENTS } from "./demoData";
import { collectStorageClaimInventory } from "./assetStorageBoundary";
import { TENANT_SCHOOL_TABLES, tenantSchoolTableValidator } from "./tenantPurgeManifest";
import { originalAssetIds, resetSeal, subtleSha256 } from "./demoResetDigest";
import type { MutationCtx } from "../../_generated/server";

const rowValidator = v.object({ table: v.string(), id: v.string(), digest: v.string() });
export const inventoryValidator = v.array(rowValidator);
const childTables = ["membershipRoleAssignments", "membershipDirectGrants", "membershipDirectRestrictions", "delegationCeilings", "subscriptionInvoiceStudents", "usageExceptionDecisions", "usageOperationTransitions"] as const;
const childValidator = v.union(...childTables.map((name) => v.literal(name)));

// Raw documents cross only an internal function boundary; the public action
// hashes them and never returns or logs them. The extra row proves overflow.
export const readDirectRowsInternal = internalQuery({
  args: { schoolId: v.id("schools"), table: tenantSchoolTableValidator },
  returns: v.array(v.any()),
  handler: async (ctx, { schoolId, table }) => {
    const school = await ctx.db.get(schoolId);
    if (!school || school.slug !== DEMO_SCHOOL_SLUG) throw new ConvexError("Demo target changed");
    return ctx.db.query(table).withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(1001);
  },
});

export const readSpecialRowsInternal = internalQuery({
  args: { schoolId: v.id("schools"), table: v.union(v.literal("branchSettingOverrides"), v.literal("roleTemplates")) },
  returns: v.array(v.any()),
  handler: async (ctx, { schoolId, table }) => {
    const school = await ctx.db.get(schoolId);
    if (!school || school.slug !== DEMO_SCHOOL_SLUG) throw new ConvexError("Demo target changed");
    return table === "branchSettingOverrides"
      ? ctx.db.query(table).withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(1001)
      : ctx.db.query(table).withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(1001);
  },
});

export const readChildRowsInternal = internalQuery({
  args: { schoolId: v.id("schools"), table: childValidator, parentIds: v.array(v.string()) },
  returns: v.array(v.any()),
  handler: async (ctx, { schoolId, table, parentIds }) => {
    const school = await ctx.db.get(schoolId);
    if (!school || school.slug !== DEMO_SCHOOL_SLUG || parentIds.length > 1000) throw new ConvexError("Demo target changed or parent bound exceeded");
    const rows: unknown[] = [];
    for (const id of parentIds) {
      const part = table === "membershipRoleAssignments"
        ? await ctx.db.query(table).withIndex("by_membership", (q) => q.eq("membershipId", id as Id<"branchMemberships">)).take(1001)
        : table === "membershipDirectGrants"
        ? await ctx.db.query(table).withIndex("by_membership", (q) => q.eq("membershipId", id as Id<"branchMemberships">)).take(1001)
        : table === "membershipDirectRestrictions"
        ? await ctx.db.query(table).withIndex("by_membership", (q) => q.eq("membershipId", id as Id<"branchMemberships">)).take(1001)
        : table === "delegationCeilings"
        ? await ctx.db.query(table).withIndex("by_membership", (q) => q.eq("membershipId", id as Id<"branchMemberships">)).take(1001)
        : table === "subscriptionInvoiceStudents"
        ? await ctx.db.query(table).withIndex("by_invoiceId", (q) => q.eq("invoiceId", id as Id<"subscriptionInvoices">)).take(1001)
        : table === "usageExceptionDecisions"
        ? await ctx.db.query(table).withIndex("by_request", (q) => q.eq("requestId", id as Id<"usageExceptionRequests">)).take(1001)
        : await ctx.db.query(table).withIndex("by_attempt", (q) => q.eq("attemptId", id as Id<"usageOperationAttempts">)).take(1001);
      rows.push(...part);
      if (rows.length > 1000) throw new ConvexError(`${table}: inventory exceeds 1000`);
    }
    return rows;
  },
});

export const readIdentityRowsInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  returns: v.object({ school: v.any(), run: v.any(), people: v.array(v.any()), authIds: v.array(v.string()) }),
  handler: async (ctx, { schoolId }) => {
    const school = await ctx.db.get(schoolId);
    if (!school || school.slug !== DEMO_SCHOOL_SLUG || (await ctx.db.query("schools").take(2)).length !== 1) throw new ConvexError("Not a single demo-school deployment");
    const runs = await ctx.db.query("demoSeedRuns").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(2);
    const run = runs.length === 1 ? runs[0] : null;
    if (!run || run.seedProfile !== "demo" || run.status !== "succeeded" || run.phase !== "complete" || !run.authIssuer) throw new ConvexError("No completed demo cohort");
    const authIds = [run.adminAuthId, run.teacherAuthId, run.portalAuthId];
    const allUsers = await ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(1001);
    const users = allUsers.filter((user) => authIds.includes(user.authId));
    const members = await ctx.db.query("branchMemberships").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(4);
    const personIds = users.map((user) => user.personId);
    if (allUsers.length > 1000 || new Set(authIds).size !== 3 || users.length !== 3 || members.length !== 3 ||
        personIds.some((id) => !id) || new Set(personIds).size !== 3 ||
        users.some((user) => !authIds.includes(user.authId)) ||
        members.some((member) => !personIds.includes(member.personId))) throw new ConvexError("Demo identities changed");
    const people = await Promise.all(personIds.map((id) => ctx.db.get(id!)));
    if (people.some((person) => !person || person.primarySchoolId !== schoolId)) throw new ConvexError("Demo people changed");
    return { school, run, people, authIds };
  },
});

export const reserveDemoResetInternal = internalMutation({
  args: {
    schoolId: v.id("schools"), schoolSlug: v.string(), cloudUrl: v.string(), targetIdentity: v.string(),
    inventory: inventoryValidator, inventoryHash: v.string(), confirmationPhrase: v.string(),
    authIssuer: v.string(), authIds: v.array(v.string()), personIds: v.array(v.id("persons")),
    storageCandidateIds: v.array(v.id("_storage")), retainedStorageIds: v.array(v.id("_storage")),
  },
  returns: v.id("demoResetOperations"),
  handler: async (ctx, args) => {
    if (process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" ||
        args.cloudUrl !== process.env.CONVEX_CLOUD_URL || args.cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
        args.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY ||
        args.schoolSlug !== DEMO_SCHOOL_SLUG) throw new ConvexError("Development target gate failed");
    const school = await ctx.db.get(args.schoolId);
    if (!school || school.slug !== args.schoolSlug || (await ctx.db.query("schools").take(2)).length !== 1) throw new ConvexError("Demo school changed");
    // Indexed reads and insert share one OCC transaction, including the gap
    // between authorization and the first deletion batch.
    for (const status of ["prepared", "deleting", "storage_pending", "auth_pending", "ready_to_seed", "seeding"] as const) {
      if (await ctx.db.query("demoResetOperations").withIndex("by_school_slug_and_status", (q) => q.eq("schoolSlug", args.schoolSlug).eq("status", status)).first()) throw new ConvexError("A demo reset is already active");
    }
    if (args.storageCandidateIds.length > 50 || new Set(args.storageCandidateIds).size !== args.storageCandidateIds.length ||
        args.inventory.length > 5000 || args.authIds.length !== 3 || new Set(args.authIds).size !== 3 ||
        args.personIds.length !== 3 || new Set(args.personIds).size !== 3 ||
        args.inventoryHash.length !== 64 || !args.confirmationPhrase.includes(args.schoolId) ||
        !args.confirmationPhrase.includes(args.inventoryHash)) throw new ConvexError("Invalid reset inventory");
    const runs = await ctx.db.query("demoSeedRuns").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(2);
    if (runs.length !== 1 || runs[0].status !== "succeeded" || runs[0].phase !== "complete" || runs[0].seedProfile !== "demo" ||
        runs[0].authIssuer !== args.authIssuer ||
        [runs[0].adminAuthId, runs[0].teacherAuthId, runs[0].portalAuthId].some((id, i) => id !== args.authIds[i])) throw new ConvexError("Cohort changed during preparation");
    for (const [table, row] of [["schools", school], ["demoSeedRuns", runs[0]]] as const) {
      const matches = args.inventory.filter((entry) => entry.table === table && entry.id === row._id);
      if (matches.length !== 1 || matches[0].digest !== await subtleSha256(row)) throw new ConvexError("Original run or school changed during preparation");
    }
    const retained = originalAssetIds(runs[0]);
    if (retained.some((id, i) => id !== args.retainedStorageIds[i]) ||
        args.retainedStorageIds.length !== 37 ||
        args.retainedStorageIds.some((id) => !args.storageCandidateIds.includes(id)) ||
        school.logoStorageId !== retained[0]) throw new ConvexError("Original demo assets changed during preparation");
    const students = await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(37);
    if (students.length !== 36 || DEMO_STUDENTS.some((student, i) =>
        students.filter((row) => row.admissionNumber === student.admissionNumber && row.photoStorageId === retained[i + 1]).length !== 1)) {
      throw new ConvexError("Original demo portraits changed during preparation");
    }
    const claims = await collectStorageClaimInventory(ctx, args.retainedStorageIds);
    for (const id of args.retainedStorageIds) {
      if (!await ctx.db.system.get("_storage", id)) throw new ConvexError("Original demo file is missing");
      const owners = claims.get(String(id)) ?? [];
      if (!owners.some((claim) => claim.ownerId === runs[0]._id && claim.schoolId === args.schoolId) ||
          owners.some((claim) => claim.schoolId !== args.schoolId ||
            (claim.purpose === "demoSeedRunLogoReference" || claim.purpose === "demoSeedRunPortraitReference"
              ? claim.ownerId !== runs[0]._id
              : claim.purpose === "schoolLogo" ? claim.ownerId !== args.schoolId || id !== retained[0]
              : claim.purpose === "studentPhoto" ? !students.some((student) => student._id === claim.ownerId && student.photoStorageId === id)
              : true))) throw new ConvexError("Original demo file has another claim");
    }
    if (await subtleSha256(resetSeal(args)) !== args.inventoryHash) throw new ConvexError("Reviewed inventory seal changed");
    return ctx.db.insert("demoResetOperations", { ...args, status: "prepared", deletionCursor: 0, deletionPhase: "rows", createdAt: Date.now() });
  },
});

// Only the Node operator action reads this private record. The phrase is never
// exposed by a public query; resume must compare it before any destructive work.
export const readReviewedDemoResetInternal = internalQuery({
  args: { operationId: v.id("demoResetOperations") },
  returns: v.union(v.null(), v.object({
    schoolId: v.id("schools"), schoolSlug: v.string(), cloudUrl: v.string(),
    targetIdentity: v.string(), status: v.union(v.literal("prepared"), v.literal("cancelled"), v.literal("deleting"), v.literal("storage_pending"), v.literal("auth_pending"), v.literal("ready_to_seed"), v.literal("seeding"), v.literal("complete")),
    inventoryHash: v.string(), confirmationPhrase: v.string(),
    deletionCursor: v.optional(v.number()), inventoryLength: v.number(),
    storageCandidateIds: v.array(v.id("_storage")), retainedStorageIds: v.array(v.id("_storage")), storageAcknowledgedIds: v.optional(v.array(v.id("_storage"))),
  })),
  handler: async (ctx, { operationId }) => {
    const op = await ctx.db.get(operationId);
    if (!op) return null;
    const school = await ctx.db.get(op.schoolId);
    if (school && school.slug !== op.schoolSlug) throw new ConvexError("Demo school changed");
    return { schoolId: op.schoolId, schoolSlug: op.schoolSlug, cloudUrl: op.cloudUrl,
      targetIdentity: op.targetIdentity, status: op.status, inventoryHash: op.inventoryHash,
      confirmationPhrase: op.confirmationPhrase, deletionCursor: op.deletionCursor,
      inventoryLength: op.inventory.length, storageCandidateIds: op.storageCandidateIds, retainedStorageIds: op.retainedStorageIds,
      storageAcknowledgedIds: op.storageAcknowledgedIds };
  },
});

// Reseeding reads only the recorded inputs it needs; the public action never
// accepts replacement issuer, auth IDs or asset IDs from its caller.
export const readDemoResetSeedInputsInternal = internalQuery({
  args: { operationId: v.id("demoResetOperations") },
  returns: v.union(v.null(), v.object({
    authIssuer: v.string(), authIds: v.array(v.string()), retainedStorageIds: v.array(v.id("_storage")),
    newRunId: v.optional(v.id("demoSeedRuns")), newSchoolId: v.optional(v.id("schools")),
    status: v.union(v.literal("ready_to_seed"), v.literal("seeding"), v.literal("complete")),
  })),
  handler: async (ctx, { operationId }) => {
    const op = await ctx.db.get(operationId);
    if (!op || !["ready_to_seed", "seeding", "complete"].includes(op.status)) return null;
    return { authIssuer: op.authIssuer, authIds: op.authIds, retainedStorageIds: op.retainedStorageIds,
      newRunId: op.newRunId, newSchoolId: op.newSchoolId, status: op.status as "ready_to_seed" | "seeding" | "complete" };
  },
});

export const readDemoResetSeedPhaseInternal = internalQuery({
  args: { operationId: v.id("demoResetOperations"), runId: v.id("demoSeedRuns") },
  returns: v.object({ status: v.union(v.literal("running"), v.literal("succeeded"), v.literal("failed")),
    phase: v.union(v.literal("foundation"), v.literal("students"), v.literal("assessments"), v.literal("billing"), v.literal("knowledge"), v.literal("complete")) }),
  handler: async (ctx, { operationId, runId }) => {
    const op = await ctx.db.get(operationId);
    const run = await ctx.db.get(runId);
    if (!op || !run || !["seeding", "complete"].includes(op.status) || op.newRunId !== runId || op.newSchoolId !== run.schoolId)
      throw new ConvexError("Reset seed binding changed");
    return { status: run.status, phase: run.phase };
  },
});

export const completeDemoResetSeedInternal = internalMutation({
  args: { operationId: v.id("demoResetOperations"), runId: v.id("demoSeedRuns"), schoolId: v.id("schools") },
  returns: v.object({ operationId: v.id("demoResetOperations"), runId: v.id("demoSeedRuns"), schoolId: v.id("schools"),
    status: v.literal("complete"), studentCount: v.number(), classCount: v.number(), invoiceCount: v.number(), assessmentRecordCount: v.number() }),
  handler: async (ctx, { operationId, runId, schoolId }) => {
    const op = await ctx.db.get(operationId);
    const run = await ctx.db.get(runId);
    const school = await ctx.db.get(schoolId);
    if (!op || !["seeding", "complete"].includes(op.status) || op.newRunId !== runId || op.newSchoolId !== schoolId ||
        !run || run.schoolId !== schoolId || run.seedProfile !== "demo" || run.status !== "succeeded" || run.phase !== "complete" ||
        !school || school.slug !== DEMO_SCHOOL_SLUG || school.logoStorageId !== op.retainedStorageIds[0] ||
        run.authIssuer !== op.authIssuer || run.logoStorageId !== op.retainedStorageIds[0] ||
        [run.adminAuthId, run.teacherAuthId, run.portalAuthId].some((id, i) => id !== op.authIds[i]) ||
        run.portraitStorageIds.some((id, i) => id !== op.retainedStorageIds[i + 1]) ||
        op.authIds.length !== 3 || op.retainedStorageIds.length !== 37 || run.portraitStorageIds.length !== 36 ||
        process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || op.cloudUrl !== process.env.CONVEX_CLOUD_URL ||
        !process.env.DEMO_SEED_EXPECTED_CLOUD_URL || op.cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
        !process.env.DEMO_SEED_DEPLOYMENT_IDENTITY || op.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY) {
      throw new ConvexError("Completed reset seed binding or development target changed");
    }
    const schools = await ctx.db.query("schools").take(2);
    const runs = await ctx.db.query("demoSeedRuns").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(2);
    const students = await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(37);
    const classes = await ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(4);
    const invoices = await ctx.db.query("studentInvoices").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(37);
    const assessments = await ctx.db.query("assessmentRecords").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(757);
    if (schools.length !== 1 || schools[0]._id !== schoolId || runs.length !== 1 || runs[0]._id !== runId ||
        students.length !== 36 || classes.length !== 3 || invoices.length !== 36 || assessments.length !== 756 ||
        DEMO_STUDENTS.some((student, i) => students.filter((row) => row.admissionNumber === student.admissionNumber && row.photoStorageId === op.retainedStorageIds[i + 1]).length !== 1)) {
      throw new ConvexError("Reset seed counts or portraits changed");
    }
    if (op.status === "seeding") await ctx.db.patch(operationId, { status: "complete" });
    return { operationId, runId, schoolId, status: "complete" as const,
      studentCount: 36, classCount: 3, invoiceCount: 36, assessmentRecordCount: 756 };
  },
});

// Read-only proof for browser checks after an operator has completed a reset.
export const verifyCompletedDemoResetInternal = internalQuery({
  args: { operationId: v.id("demoResetOperations") },
  returns: v.object({ schoolId: v.id("schools"), runId: v.id("demoSeedRuns"), studentCount: v.number(), classCount: v.number(), invoiceCount: v.number(), assessmentRecordCount: v.number() }),
  handler: async (ctx, { operationId }) => {
    const op = await ctx.db.get(operationId);
    if (!op || op.status !== "complete" || !op.newSchoolId || !op.newRunId ||
        op.schoolSlug !== DEMO_SCHOOL_SLUG || op.cloudUrl !== process.env.CONVEX_CLOUD_URL ||
        op.cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
        op.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY) throw new ConvexError("Completed reset target changed");
    const school = await ctx.db.get(op.newSchoolId);
    const run = await ctx.db.get(op.newRunId);
    if (!school || school.slug !== DEMO_SCHOOL_SLUG || school.logoStorageId !== op.retainedStorageIds[0] ||
        !run || run.schoolId !== school._id || run.seedProfile !== "demo" || run.status !== "succeeded" || run.phase !== "complete" ||
        run.authIssuer !== op.authIssuer || run.logoStorageId !== op.retainedStorageIds[0] ||
        run.portraitStorageIds.length !== 36 || op.retainedStorageIds.length !== 37 ||
        run.portraitStorageIds.some((id, i) => id !== op.retainedStorageIds[i + 1]) ||
        [run.adminAuthId, run.teacherAuthId, run.portalAuthId].some((id, i) => id !== op.authIds[i]) ||
        (await ctx.db.query("schools").take(2)).length !== 1 ||
        (await ctx.db.query("demoSeedRuns").withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(2)).length !== 1) {
      throw new ConvexError("Completed reset binding changed");
    }
    const students = await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(37);
    const classes = await ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(4);
    const invoices = await ctx.db.query("studentInvoices").withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(37);
    const assessments = await ctx.db.query("assessmentRecords").withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(757);
    if (students.length !== 36 || classes.length !== 3 || invoices.length !== 36 || assessments.length !== 756 ||
        DEMO_STUDENTS.some((student, i) => students.filter((row) => row.admissionNumber === student.admissionNumber && row.photoStorageId === op.retainedStorageIds[i + 1]).length !== 1)) {
      throw new ConvexError("Completed reset counts changed");
    }
    return { schoolId: school._id, runId: run._id, studentCount: students.length, classCount: classes.length, invoiceCount: invoices.length, assessmentRecordCount: assessments.length };
  },
});

// Authorization only changes the operation state. It does not schedule or delete anything.
export const authorizeReviewedDemoResetInternal = internalMutation({
  args: {
    operationId: v.id("demoResetOperations"), operatorToken: v.string(),
    inventoryHash: v.string(), confirmationPhrase: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = process.env.DEMO_SEED_OPERATOR_TOKEN?.trim();
    if (!token || args.operatorToken !== token) throw new ConvexError("Demo reset operator gate failed");
    const op = await ctx.db.get(args.operationId);
    if (!op || op.status !== "prepared") throw new ConvexError("No prepared operation");
    if (process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || !process.env.CONVEX_CLOUD_URL ||
        !process.env.DEMO_SEED_EXPECTED_CLOUD_URL || !process.env.DEMO_SEED_DEPLOYMENT_IDENTITY ||
        op.cloudUrl !== process.env.CONVEX_CLOUD_URL || op.cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
        op.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY || op.schoolSlug !== DEMO_SCHOOL_SLUG) {
      throw new ConvexError("Development target gate failed");
    }
    if (!/^[a-f0-9]{64}$/.test(op.inventoryHash) || args.inventoryHash !== op.inventoryHash ||
        args.confirmationPhrase !== op.confirmationPhrase ||
        !op.confirmationPhrase.startsWith(`RESET demo-school ${op.schoolId} ${op.inventoryHash} `) ||
        !/^RESET demo-school .+ [a-f0-9]{64} [a-f0-9]{32}$/.test(op.confirmationPhrase)) {
      throw new ConvexError("Reviewed confirmation does not match");
    }
    const school = await ctx.db.get(op.schoolId);
    if (!school || school.slug !== op.schoolSlug || (await ctx.db.query("schools").take(2)).length !== 1) {
      throw new ConvexError("Demo school changed");
    }
    // Read each active status in this transaction so competing authorizations
    // and reservations conflict rather than opening two active operations.
    for (const status of ["prepared", "deleting", "storage_pending", "auth_pending", "ready_to_seed", "seeding"] as const) {
      const active = await ctx.db.query("demoResetOperations")
        .withIndex("by_school_slug_and_status", (q) => q.eq("schoolSlug", DEMO_SCHOOL_SLUG).eq("status", status)).take(2);
      if (status === "prepared" ? active.length !== 1 || active[0]._id !== op._id : active.length !== 0) {
        throw new ConvexError("Another demo reset is active");
      }
    }
    if (op.inventory.length > 5000 || op.inventory.some((entry) => !/^[a-f0-9]{64}$/.test(entry.digest)) ||
        new Set(op.inventory.map((entry) => `${entry.table}:${entry.id}`)).size !== op.inventory.length ||
        await subtleSha256(resetSeal(op)) !== op.inventoryHash) {
      throw new ConvexError("Reviewed inventory seal changed");
    }
    await ctx.db.patch(args.operationId, {
      status: "deleting", deletionPhase: "rows", deletionCursor: 0, storageAcknowledgedIds: [],
    });
    return null;
  },
});

// Cancellation is a status-only write; inventory and its hash remain available for audit.
export const cancelDemoResetInternal = internalMutation({
  args: { operationId: v.id("demoResetOperations") },
  returns: v.null(),
  handler: async (ctx, { operationId }) => {
    const operation = await ctx.db.get(operationId);
    if (!operation || operation.status !== "prepared") throw new ConvexError("No prepared operation");
    if (operation.schoolSlug !== DEMO_SCHOOL_SLUG || operation.cloudUrl !== process.env.CONVEX_CLOUD_URL ||
        operation.cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
        operation.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY ||
        process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development") throw new ConvexError("Development target gate failed");
    await ctx.db.patch(operationId, { status: "cancelled" });
    return null;
  },
});
