import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { DEMO_ACCOUNTS, DEMO_SCHOOL_SLUG } from "./demoData";
import type { Id, TableNames } from "../../_generated/dataModel";
import { emptyDeploymentTableNames } from "./demoEmptyDeployment";

export const hasApplicationRowInternal = internalQuery({
  args: { tableName: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { tableName }) => {
    if (!emptyDeploymentTableNames().includes(tableName as TableNames)) {
      throw new Error("Unclassified application table");
    }
    return (await ctx.db.query(tableName as TableNames).first()) !== null;
  },
});

const LIMIT = 1_001;
const emails = Object.values(DEMO_ACCOUNTS).map((account) => account.email);

export const inspectDemoLogoInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  returns: v.union(v.id("_storage"), v.null()),
  handler: async (ctx, { schoolId }) => {
    const school = await ctx.db.get(schoolId);
    if (!school || school.slug !== DEMO_SCHOOL_SLUG) throw new Error("Demo-school changed during storage inspection");
    return school.logoStorageId ?? null;
  },
});

// Return counts and labels only. The two direct tables without by_school use
// bounded global scans; a full window never proves absence of later rows.
export const inspectDemoOwnershipInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  returns: v.object({
    counts: v.array(v.object({ name: v.string(), count: v.number(), truncated: v.boolean() })),
    authIds: v.array(v.string()),
    blockers: v.array(v.string()),
  }),
  handler: async (ctx, { schoolId }) => {
    const school = await ctx.db.get(schoolId);
    if (!school || school.slug !== DEMO_SCHOOL_SLUG) throw new Error("Demo-school changed during inspection");
    const blockers: string[] = [];
    const counts: Array<{ name: string; count: number; truncated: boolean }> = [];
    const record = (name: string, length: number, truncated = length >= LIMIT) => {
      counts.push({ name, count: Math.min(length, 1_000), truncated });
      if (truncated) blockers.push(`${name}: count exceeds 1000`);
    };
    const claims = await ctx.db.query("admissionNumberClaims").take(LIMIT);
    record("admissionNumberClaims", claims.filter((row) => row.schoolId === schoolId).length, claims.length >= LIMIT);
    if (claims.length >= LIMIT) blockers.push("admissionNumberClaims: global inspection truncated");
    if (claims.some((row) => row.schoolId === schoolId)) blockers.push("admissionNumberClaims: generic purge does not delete claims");
    for (const name of ["branchSettingOverrides", "roleTemplates"] as const) {
      const rows = await ctx.db.query(name).withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(LIMIT);
      record(name, rows.length);
    }
    const allocations = await ctx.db.query("usageBranchPoolAllocations").take(LIMIT);
    record("usageBranchPoolAllocations", allocations.filter((row) => row.schoolId === schoolId).length, allocations.length >= LIMIT);
    if (allocations.length > 0) {
      blockers.push("usageBranchPoolAllocations: allocation or foreign school link requires review");
    }
    for (const name of ["importWorkspaces", "pdfCompressionCandidates"] as const) {
      const rows = await ctx.db.query(name).withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(LIMIT);
      if (rows.length) blockers.push(`${name}: unsupported source storage references`);
    }
    const runs = await ctx.db.query("demoSeedRuns").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(LIMIT);
    record("demoSeedRunsVerified", runs.length);
    const run = runs.length === 1 ? runs[0] : null;
    const authIds = run ? [run.adminAuthId, run.teacherAuthId, run.portalAuthId] : [];
    if (!run || run.seedProfile !== "demo" || run.status !== "succeeded" || run.phase !== "complete" ||
        !run.authIssuer || new Set(authIds).size !== 3) blockers.push("demoSeedRuns: one succeeded demo cohort with three distinct auth IDs required");
    const users = await ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(LIMIT);
    const memberships = await ctx.db.query("branchMemberships").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(LIMIT);
    record("usersVerified", users.length);
    record("branchMembershipsVerified", memberships.length);
    const personIds = new Set<Id<"persons">>();
    for (const member of memberships) personIds.add(member.personId);
    for (const user of users) if (user.personId) personIds.add(user.personId);
    record("personsVerified", personIds.size);
    if (users.length >= LIMIT || memberships.length >= LIMIT) blockers.push("identities: truncated school cohort");
    if (personIds.size > 100) blockers.push("persons: ownership inspection exceeds 100 people");
    for (const personId of [...personIds].slice(0, 100)) {
      const person = await ctx.db.get(personId);
      const links = await ctx.db.query("branchMemberships").withIndex("by_person_and_school", (q) => q.eq("personId", personId)).take(LIMIT);
      const linkedUsers = await ctx.db.query("users").withIndex("by_person", (q) => q.eq("personId", personId)).take(LIMIT);
      if (!person || person.primarySchoolId !== schoolId || links.length !== 1 || links[0].schoolId !== schoolId ||
          linkedUsers.length !== 1 || linkedUsers[0].schoolId !== schoolId ||
          await ctx.db.query("schoolGroups").withIndex("by_proprietor", (q) => q.eq("proprietorPersonId", personId)).first()) {
        blockers.push("persons/branchMemberships: foreign or ambiguous ownership");
      }
    }
    if (run && users.length < LIMIT && memberships.length < LIMIT) {
      for (const [index, email] of emails.entries()) {
        const matches = users.filter((user) => user.authId === authIds[index]);
        if (matches.length !== 1 || matches[0].email !== email || !matches[0].personId ||
            matches[0].authTokenIdentifier !== `${run.authIssuer}|${authIds[index]}`) {
          blockers.push(`users: demo credential ${index + 1} has ambiguous ownership`);
        }
        for (const key of ["by_auth", "by_email"] as const) {
          const matchesByKey = key === "by_auth"
            ? await ctx.db.query("users").withIndex(key, (q) => q.eq("authId", authIds[index])).take(LIMIT)
            : await ctx.db.query("users").withIndex(key, (q) => q.eq("email", email)).take(LIMIT);
          if (matchesByKey.length !== 1 || matchesByKey[0].schoolId !== schoolId) blockers.push(`users: ${key} credential ${index + 1} is shared or ambiguous`);
        }
        if (await ctx.db.query("platformAdmins").withIndex("by_auth", (q) => q.eq("authId", authIds[index])).first() ||
            await ctx.db.query("platformAdmins").withIndex("by_email", (q) => q.eq("email", email)).first()) {
          blockers.push(`platformAdmins: credential ${index + 1} is shared`);
        }
        if (await ctx.db.query("admissionsGuardians").withIndex("by_better_auth_user_id", (q) => q.eq("betterAuthUserId", authIds[index])).first() ||
            await ctx.db.query("admissionsGuardians").withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", email)).first()) {
          blockers.push(`admissionsGuardians: credential ${index + 1} is shared`);
        }
      }
      for (const user of users) if (!authIds.includes(user.authId) && user.personId) blockers.push("users: unexpected canonical auth account");
      for (const personId of [...personIds].slice(0, 100)) {
        const person = await ctx.db.get(personId);
        const linkedUsers = await ctx.db.query("users").withIndex("by_person", (q) => q.eq("personId", personId)).take(2);
        if (!person || linkedUsers.length !== 1 || !authIds.includes(linkedUsers[0].authId) ||
            person.authTokenIdentifier !== `${run.authIssuer}|${linkedUsers[0].authId}`) {
          blockers.push("persons: unexpected credential or token identifier");
        }
      }
      if (memberships.length !== 3 || personIds.size !== 3) blockers.push("branchMemberships: expected exactly three demo credential members");
    }
    // Neither indirect table has an inverse school index. A bounded global
    // inspection can establish that no group/pool points at the target.
    const groups = await ctx.db.query("schoolGroups").take(LIMIT);
    const pools = await ctx.db.query("usageGroupPools").take(LIMIT);
    if (groups.length >= LIMIT || pools.length >= LIMIT) blockers.push("shared refs: group or usage pool inspection truncated");
    if (groups.some((group) => group.gradingDefault?.schoolId === schoolId) ||
        pools.some((pool) => pool.journalSchoolId === schoolId)) {
      blockers.push("shared refs: group or usage pool links to demo school");
    }
    return { counts, authIds, blockers: [...new Set(blockers)] };
  },
});

// These checks return labels, never rows. Any link to another school is a hard blocker.
export const inspectDemoLinksInternal = internalQuery({
  args: {},
  returns: v.object({
    school: v.union(v.null(), v.object({ id: v.id("schools"), name: v.string() })),
    blockers: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const school = await ctx.db.query("schools").withIndex("by_slug", (q) => q.eq("slug", DEMO_SCHOOL_SLUG)).unique();
    const schools = await ctx.db.query("schools").take(2);
    const blockers: string[] = [];
    if (schools.length > 1) blockers.push("schools: more than one school in deployment");
    if (!school && schools.length) blockers.push("schools: deployment is not empty");
    // A failed run can leave cleanup rows after the school itself is gone.
    if (await ctx.db.query("demoSeedStorageCleanup").withIndex("by_school_slug", (q) => q.eq("schoolSlug", DEMO_SCHOOL_SLUG)).first()) {
      blockers.push("demoSeedStorageCleanup: pending storage claims");
    }
    if (!school) return { school: null, blockers };
    const id = school._id;
    const [transfersOut, transfersIn, sharesOut, sharesIn, migrationsOut, migrationsIn, groups, claims, pendingStorage] = await Promise.all([
      ctx.db.query("studentTransfers").withIndex("by_source_school", (q) => q.eq("sourceSchoolId", id)).first(),
      ctx.db.query("studentTransfers").withIndex("by_destination_school", (q) => q.eq("destinationSchoolId", id)).first(),
      ctx.db.query("assetBranchShares").withIndex("by_owner", (q) => q.eq("ownerSchoolId", id)).first(),
      ctx.db.query("assetBranchShares").withIndex("by_recipient", (q) => q.eq("recipientSchoolId", id)).first(),
      ctx.db.query("migrationState").withIndex("by_source_school", (q) => q.eq("sourceSchoolId", id)).first(),
      ctx.db.query("migrationState").withIndex("by_target_school", (q) => q.eq("targetSchoolId", id)).first(),
      ctx.db.query("schoolGroupBranches").withIndex("by_school", (q) => q.eq("schoolId", id)).first(),
      ctx.db.query("admissionNumberClaims").withIndex("by_school_number", (q) => q.eq("schoolId", id)).first(),
      ctx.db.query("demoSeedStorageCleanup").withIndex("by_school", (q) => q.eq("schoolId", id)).first(),
    ]);
    if (transfersOut || transfersIn) blockers.push("studentTransfers: school link requires cross-school review");
    if (sharesOut || sharesIn) blockers.push("assetBranchShares: school link requires cross-school review");
    if (migrationsOut || migrationsIn) blockers.push("migrationState: school link requires cross-school review");
    if (groups) blockers.push("schoolGroupBranches: shared group ownership not resolved");
    if (claims) blockers.push("admissionNumberClaims: direct school rows lack by_school index");
    if (pendingStorage && !blockers.includes("demoSeedStorageCleanup: pending storage claims")) blockers.push("demoSeedStorageCleanup: pending storage claims");
    return { school: { id, name: school.name }, blockers };
  },
});
