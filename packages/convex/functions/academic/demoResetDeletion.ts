import { internalMutation, type MutationCtx } from "../../_generated/server";
import type { Id, TableNames } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { DEMO_SCHOOL_SLUG } from "./demoData";
import { TENANT_SCHOOL_TABLES } from "./tenantPurgeManifest";
import { resetSeal, subtleSha256 } from "./demoResetDigest";

type Entry = { table: string; id: string; digest: string };
const children = {
  membershipRoleAssignments: ["branchMemberships", "membershipId", "by_membership"],
  membershipDirectGrants: ["branchMemberships", "membershipId", "by_membership"],
  membershipDirectRestrictions: ["branchMemberships", "membershipId", "by_membership"],
  delegationCeilings: ["branchMemberships", "membershipId", "by_membership"],
  subscriptionInvoiceStudents: ["subscriptionInvoices", "invoiceId", "by_invoiceId"],
  usageExceptionDecisions: ["usageExceptionRequests", "requestId", "by_request"],
  usageOperationTransitions: ["usageOperationAttempts", "attemptId", "by_attempt"],
} as const;
const direct = new Set<string>([...TENANT_SCHOOL_TABLES, "branchSettingOverrides", "roleTemplates"]);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const order = (entry: Entry) => entry.table === "schools" ? 2 : entry.table === "persons" ? 1 : 0;
function refuse(reason: string): never { throw new ConvexError(`Demo deletion blocked: ${reason}`); }

// Check the complete reviewed cohort in bounded indexed windows. The fixture has
// more than 250 assessment rows, so the per-table limit matches preparation.
async function verifySnapshot(ctx: MutationCtx, operation: {
  schoolId: Id<"schools">; personIds: Id<"persons">[]; authIds: string[];
  inventory: Entry[]; deletionCursor?: number;
}, remaining: Entry[]) {
  const expected = new Map<string, Set<string>>();
  for (const entry of remaining) {
    const ids = expected.get(entry.table) ?? new Set<string>();
    ids.add(entry.id);
    expected.set(entry.table, ids);
  }
  if (remaining.length > 5000) refuse("snapshot exceeds the reviewed 5000-row bound");
  const match = (table: string, ids: string[]) => {
    const wanted = expected.get(table) ?? new Set();
    if (ids.length !== wanted.size || ids.some((id) => !wanted.has(id))) refuse(`${table}: unrecorded or missing target row`);
  };
  match("schools", (await ctx.db.query("schools").take(2)).map((row) => row._id));
  const people = await ctx.db.query("persons").take(1001);
  if (people.length > 1000) refuse("persons: global scan exceeds 1000");
  match("persons", people.filter((row) => row.primarySchoolId === operation.schoolId).map((row) => row._id));
  for (const table of direct) {
    const wanted = expected.get(table)?.size ?? 0;
    if (wanted > 1000) refuse(`${table}: scan bound exceeded`);
    const rows = await ctx.db.query(table as typeof TENANT_SCHOOL_TABLES[number])
      .withIndex("by_school", (q) => q.eq("schoolId", operation.schoolId)).take(wanted + 1);
    match(table, rows.map((row) => row._id));
  }
  for (const [table, [parentTable, field, index]] of Object.entries(children)) {
    const ids: string[] = [];
    // This is a closed table/index mapping. Use the same indexed parent reads as preparation.
    for (const parent of operation.inventory.filter((entry) => entry.table === parentTable)) {
      const rows = await ctx.db.query(table as keyof typeof children)
        .withIndex(index as "by_membership" & "by_invoiceId" & "by_request" & "by_attempt", (q) => q.eq(field as "membershipId" & "invoiceId" & "requestId" & "attemptId", parent.id as Id<"branchMemberships"> & Id<"subscriptionInvoices"> & Id<"usageExceptionRequests"> & Id<"usageOperationAttempts">))
        .take(1001);
      if (rows.length > 1000) refuse(`${table}: scan bound exceeded`);
      ids.push(...rows.map((row) => row._id));
    }
    match(table, ids);
  }
  // Non-inventory links are never safe to delete implicitly. Indexed first()
  // reads protect against links introduced after the operator prepared the inventory.
  const id = operation.schoolId;
  if (await ctx.db.query("studentTransfers").withIndex("by_source_school", (q) => q.eq("sourceSchoolId", id)).first() ||
      await ctx.db.query("studentTransfers").withIndex("by_destination_school", (q) => q.eq("destinationSchoolId", id)).first() ||
      await ctx.db.query("assetBranchShares").withIndex("by_owner", (q) => q.eq("ownerSchoolId", id)).first() ||
      await ctx.db.query("assetBranchShares").withIndex("by_recipient", (q) => q.eq("recipientSchoolId", id)).first() ||
      await ctx.db.query("migrationState").withIndex("by_source_school", (q) => q.eq("sourceSchoolId", id)).first() ||
      await ctx.db.query("migrationState").withIndex("by_target_school", (q) => q.eq("targetSchoolId", id)).first() ||
      await ctx.db.query("schoolGroupBranches").withIndex("by_school", (q) => q.eq("schoolId", id)).first() ||
      await ctx.db.query("admissionNumberClaims").withIndex("by_school_number", (q) => q.eq("schoolId", id)).first()) refuse("foreign share, transfer, migration or unindexed school claim");
  for (const personId of operation.personIds) {
    const links = await ctx.db.query("branchMemberships").withIndex("by_person_and_school", (q) => q.eq("personId", personId)).take(4);
    if (links.some((row) => row.schoolId !== id)) refuse("foreign person membership");
    const users = await ctx.db.query("users").withIndex("by_person", (q) => q.eq("personId", personId)).take(4);
    if (users.some((row) => row.schoolId !== id || !operation.authIds.includes(row.authId))) refuse("foreign person user");
    if (await ctx.db.query("schoolGroups").withIndex("by_proprietor", (q) => q.eq("proprietorPersonId", personId)).first()) refuse("shared proprietor");
  }
  for (const authId of operation.authIds) {
    const users = await ctx.db.query("users").withIndex("by_auth", (q) => q.eq("authId", authId)).take(4);
    if (users.some((row) => row.schoolId !== id) ||
        await ctx.db.query("platformAdmins").withIndex("by_auth", (q) => q.eq("authId", authId)).first() ||
        await ctx.db.query("admissionsGuardians").withIndex("by_better_auth_user_id", (q) => q.eq("betterAuthUserId", authId)).first()) refuse("foreign credential link");
  }
  // No inverse index for these links. A full bounded window is mandatory.
  const groups = await ctx.db.query("schoolGroups").take(1001);
  const pools = await ctx.db.query("usageGroupPools").take(1001);
  const allocations = await ctx.db.query("usageBranchPoolAllocations").take(1001);
  if (groups.length > 1000 || pools.length > 1000 || allocations.length > 1000) refuse("global scan exceeds 1000");
  if (groups.some((row) => row.gradingDefault?.schoolId === id) ||
      pools.some((row) => row.journalSchoolId === id) || allocations.length) refuse("shared or foreign link");
}

// No action, scheduler, or public function references this mutation.
export const deleteReviewedDemoRowsBatchInternal = internalMutation({
  args: { operationId: v.id("demoResetOperations") },
  returns: v.object({ cursor: v.number(), status: v.union(v.literal("deleting"), v.literal("storage_pending")) }),
  handler: async (ctx, { operationId }) => {
    const op = await ctx.db.get(operationId);
    if (!op || op.status !== "deleting" || op.deletionPhase !== "rows" ||
        !Number.isSafeInteger(op.deletionCursor) || op.deletionCursor! < 0) refuse("operation is not in row deletion phase");
    if (process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || !process.env.CONVEX_CLOUD_URL ||
        op.cloudUrl !== process.env.CONVEX_CLOUD_URL || op.cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
        !process.env.DEMO_SEED_DEPLOYMENT_IDENTITY || op.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY ||
        op.schoolSlug !== DEMO_SCHOOL_SLUG) refuse("development target gate failed");
    const school = await ctx.db.get(op.schoolId);
    if (!school || school.slug !== op.schoolSlug ||
        (await ctx.db.query("schools").take(2)).length !== 1) refuse("school identity changed");
    if (await subtleSha256(resetSeal(op)) !== op.inventoryHash) refuse("inventory seal changed");
    const entries = [...op.inventory].sort((a, b) => order(a) - order(b) || compare(a.table, b.table) || compare(a.id, b.id));
    if (entries.length > 5000 || op.deletionCursor! > entries.length ||
        entries.some((entry, i) => !/^[a-f0-9]{64}$/.test(entry.digest) ||
          (!direct.has(entry.table) && !(entry.table in children) && entry.table !== "schools" && entry.table !== "persons") ||
          (i > 0 && entries[i - 1].table === entry.table && entries[i - 1].id === entry.id))) refuse("invalid inventory");
    const next = entries.slice(op.deletionCursor!, op.deletionCursor! + 50);
    // Snapshot check and writes share one OCC transaction. Never delete an
    // unreviewed row or infer absence after reaching a read limit.
    await verifySnapshot(ctx, op, entries.slice(op.deletionCursor!));
    const rows = [];
    for (const entry of next) {
      const table = entry.table as TableNames;
      if (!ctx.db.normalizeId(table, entry.id)) refuse(`${entry.table}: invalid table ID`);
      const row = await ctx.db.get(entry.id as Id<TableNames>);
      if (!row || await subtleSha256(row) !== entry.digest) refuse(`${entry.table}: missing or changed row`);
      const fields = row as Record<string, unknown>;
      if (entry.table === "schools" ? row._id !== op.schoolId :
          entry.table === "persons" ? !op.personIds.includes(entry.id as Id<"persons">) || fields.primarySchoolId !== op.schoolId :
          entry.table in children ? !op.inventory.some((parent) => parent.table === children[entry.table as keyof typeof children][0] && parent.id === fields[children[entry.table as keyof typeof children][1]]) :
          fields.schoolId !== op.schoolId) refuse(`${entry.table}: ownership changed`);
      if (next.includes(entry)) rows.push(entry);
    }
    for (const entry of rows) await ctx.db.delete(entry.id as Id<TableNames>);
    const cursor = op.deletionCursor! + next.length;
    const status: "storage_pending" | "deleting" = cursor === entries.length ? "storage_pending" : "deleting";
    if (status === "storage_pending") await verifySnapshot(ctx, op, []);
    await ctx.db.patch(operationId, { deletionCursor: cursor, deletionPhase: status === "storage_pending" ? "storage_pending" : "rows", status });
    return { cursor, status };
  },
});
