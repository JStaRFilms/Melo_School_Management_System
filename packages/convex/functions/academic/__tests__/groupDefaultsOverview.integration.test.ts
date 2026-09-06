import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import { resolveEffectiveTheme } from "../groupSettings";

const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob([
  "../../../**/*.ts",
  "!../../../**/*.test.ts",
]);
const modules = Object.fromEntries(
  Object.entries(rawModules).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);
const endpoints = api.functions.academic.groups;
const theme = { primaryColor: "#123456", accentColor: "#abcdef" };

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Headquarters",
      slug: "hq",
      status: "active",
      theme: { primaryColor: "#112233", accentColor: "#445566" },
      createdAt: 1,
      updatedAt: 1,
    });
    const branchId = await ctx.db.insert("schools", {
      name: "Other branch",
      slug: "other",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const outsiderSchoolId = await ctx.db.insert("schools", {
      name: "Unrelated",
      slug: "unrelated",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("persons", {
      authTokenIdentifier: "test|owner",
      email: "owner@example.test",
      name: "Owner",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const memberId = await ctx.db.insert("persons", {
      authTokenIdentifier: "test|member",
      email: "member@example.test",
      name: "Manager",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const groupId = await ctx.db.insert("schoolGroups", {
      name: "Group",
      slug: "group",
      proprietorPersonId: ownerId,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId,
      isHeadquarters: true,
      linkedAt: 1,
    });
    await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId: branchId,
      isHeadquarters: false,
      linkedAt: 1,
    });
    const ownerMembership = await ctx.db.insert("branchMemberships", {
      personId: ownerId,
      schoolId,
      status: "active",
      isDefaultBranch: true,
      joinedAt: 1,
      updatedAt: 1,
    });
    const ownerUser = await ctx.db.insert("users", {
      schoolId,
      personId: ownerId,
      authId: "owner",
      authTokenIdentifier: "test|owner",
      name: "Owner",
      email: "owner@example.test",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.patch(ownerMembership, { legacyUserId: ownerUser });
    const memberMembership = await ctx.db.insert("branchMemberships", {
      personId: memberId,
      schoolId,
      status: "active",
      isDefaultBranch: true,
      joinedAt: 1,
      updatedAt: 1,
    });
    const grantId = await ctx.db.insert("membershipDirectGrants", {
      membershipId: memberMembership,
      capability: "settings.branding.manage",
      grantedAt: 1,
    });
    await ctx.db.insert("platformAdmins", {
      authId: "platform",
      authTokenIdentifier: "test|platform",
      email: "platform@example.test",
      name: "Platform",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("platformAdmins", {
      authId: "legacy-platform",
      email: "legacy-platform@example.test",
      name: "Legacy Platform",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    return {
      schoolId,
      branchId,
      outsiderSchoolId,
      groupId,
      ownerId,
      ownerMembership,
      memberMembership,
      grantId,
    };
  });
  return {
    t,
    ...ids,
    owner: t.withIdentity({ tokenIdentifier: "test|owner" }),
    member: t.withIdentity({ tokenIdentifier: "test|member" }),
    platform: t.withIdentity({ tokenIdentifier: "test|platform" }),
    legacyPlatform: t.withIdentity({
      subject: "legacy-platform",
      issuer: "https://legacy-auth.test",
    }),
  };
}

describe("U1f versioned branding defaults", () => {
  it("admits trusted legacy Platform identities to governance APIs", async () => {
    const f = await fixture();
    await expect(
      f.legacyPlatform.query(endpoints.listGroups, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).resolves.toMatchObject({ page: [{ _id: f.groupId }] });
    await expect(
      f.legacyPlatform.query(api.functions.academic.audit.getAuditAccess, {
        scope: { kind: "platform" },
      }),
    ).resolves.toMatchObject({ platformOnly: true });
  });
  it("previews without writes, preserves legacy colors, explicitly inherits/overrides/resets and audits without school rewrites", async () => {
    const f = await fixture();
    const original = await f.t.run((ctx) => ctx.db.get(f.schoolId));
    const args = {
      groupId: f.groupId,
      expectedVersion: 0,
      theme,
      allowBranchOverride: true,
    };
    expect(
      await f.owner.query(endpoints.previewGroupBranding, args),
    ).toMatchObject({ candidate: { version: 1, theme } });
    expect(
      (await f.owner.query(endpoints.getGroupBranding, { groupId: f.groupId }))
        .version,
    ).toBe(0);
    await f.owner.mutation(endpoints.saveGroupBranding, {
      ...args,
      confirmation: "group",
    });
    const branch = { groupId: f.groupId, schoolId: f.schoolId };
    expect(
      await f.member.query(endpoints.getBranchBranding, branch),
    ).toMatchObject({ source: "branch_legacy", groupVersion: 1, revision: 0 });
    const change = {
      ...branch,
      expectedVersion: 1,
      expectedRevision: 0,
      confirmation: "hq",
      change: { mode: "inherit" as const },
    };
    await f.member.mutation(endpoints.saveBranchBranding, change);
    expect(
      await f.member.query(endpoints.getBranchBranding, branch),
    ).toMatchObject({ source: "group", theme, revision: 1 });
    await f.member.mutation(endpoints.saveBranchBranding, {
      ...change,
      expectedRevision: 1,
      change: {
        mode: "override",
        theme: { primaryColor: "#ffffff", accentColor: "#000000" },
      },
    });
    expect(
      await f.member.query(endpoints.getBranchBranding, branch),
    ).toMatchObject({ source: "branch_override", revision: 2 });
    await f.member.mutation(endpoints.saveBranchBranding, {
      ...change,
      expectedRevision: 2,
    });
    const effective = await f.t.run(async (ctx) => {
      const school = await ctx.db.get(f.schoolId);
      if (!school) throw new Error("Missing fixture");
      return resolveEffectiveTheme(ctx, school);
    });
    expect(effective).toMatchObject({ source: "group", theme, revision: 3 });
    const currentBranding = await f.owner.query(
      api.functions.academic.schoolBranding.getCurrentSchoolBranding,
      {},
    );
    expect(currentBranding).toMatchObject({
      schoolId: f.schoolId,
      groupId: f.groupId,
      theme,
    });
    if (!currentBranding) throw new Error("Missing branding fixture");
    await f.owner.mutation(
      api.functions.academic.schoolBranding.updateSchoolProfile,
      { name: "Renamed Headquarters", theme: currentBranding.theme },
    );
    const profileSaved = await f.t.run((ctx) => ctx.db.get(f.schoolId));
    expect(profileSaved).toMatchObject({
      name: "Renamed Headquarters",
      theme: original?.theme,
    });
    await expect(
      f.owner.mutation(
        api.functions.academic.schoolBranding.updateSchoolProfile,
        {
          name: "Renamed Headquarters",
          theme: { primaryColor: "#ffffff", accentColor: "#000000" },
        },
      ),
    ).rejects.toThrow("School group branding");
    expect(await f.t.run((ctx) => ctx.db.get(f.schoolId))).toEqual(profileSaved);
    const events = await f.t.run((ctx) =>
      ctx.db
        .query("auditEvents")
        .withIndex("by_school_and_timestamp", (q) =>
          q.eq("schoolId", f.schoolId),
        )
        .take(10),
    );
    expect(events).toHaveLength(4);
    expect(
      events.every((event) => event.retentionClass === "permanent_statutory"),
    ).toBe(true);
  });

  it("rejects outsiders/platform defaults and group linkage as branch authority, rechecks capability/revocation", async () => {
    const f = await fixture();
    const args = {
      groupId: f.groupId,
      expectedVersion: 0,
      theme,
      allowBranchOverride: true,
      confirmation: "group",
    };
    await expect(
      f.member.mutation(endpoints.saveGroupBranding, args),
    ).rejects.toThrow("proprietor");
    await expect(
      f.platform.mutation(endpoints.saveGroupBranding, args),
    ).rejects.toThrow("proprietor");
    await expect(
      f.t.query(endpoints.getGroupBranding, { groupId: f.groupId }),
    ).rejects.toThrow("authentication");
    await f.owner.mutation(endpoints.saveGroupBranding, args);
    const metadata = await f.platform.query(endpoints.getGroupOverview, {
      groupId: f.groupId,
    });
    expect(metadata.group).not.toHaveProperty("brandingDefault");
    expect(metadata.branches[0]).not.toHaveProperty("brandingOverride");
    await expect(
      f.owner.query(endpoints.getBranchBranding, {
        groupId: f.groupId,
        schoolId: f.branchId,
      }),
    ).rejects.toThrow("active membership");
    await expect(
      f.platform.query(endpoints.getBranchBranding, {
        groupId: f.groupId,
        schoolId: f.schoolId,
      }),
    ).rejects.toThrow("Forbidden");
    await f.t.run((ctx) => ctx.db.delete(f.grantId));
    await expect(
      f.member.query(endpoints.getBranchBranding, {
        groupId: f.groupId,
        schoolId: f.schoolId,
      }),
    ).rejects.toThrow("capability");
    await f.t.run((ctx) =>
      ctx.db.patch(f.ownerMembership, { status: "archived" }),
    );
    await expect(
      f.owner.query(endpoints.getBranchBranding, {
        groupId: f.groupId,
        schoolId: f.schoolId,
      }),
    ).rejects.toThrow();
  });

  it("blocks malformed colors, wrong confirmation, stale group/branch revisions and forbidden overrides", async () => {
    const f = await fixture();
    const args = {
      groupId: f.groupId,
      expectedVersion: 0,
      theme,
      allowBranchOverride: false,
      confirmation: "group",
    };
    await expect(
      f.owner.mutation(endpoints.saveGroupBranding, {
        ...args,
        theme: { ...theme, accentColor: "red" },
      }),
    ).rejects.toThrow("hex");
    await expect(
      f.owner.mutation(endpoints.saveGroupBranding, {
        ...args,
        confirmation: "wrong",
      }),
    ).rejects.toThrow("slug");
    await f.owner.mutation(endpoints.saveGroupBranding, args);
    await expect(
      f.owner.mutation(endpoints.saveGroupBranding, args),
    ).rejects.toThrow("Conflict");
    const branch = {
      groupId: f.groupId,
      schoolId: f.schoolId,
      expectedVersion: 1,
      expectedRevision: 0,
      confirmation: "hq",
      change: { mode: "override" as const, theme },
    };
    await expect(
      f.member.mutation(endpoints.saveBranchBranding, branch),
    ).rejects.toThrow("disabled");
    await f.member.mutation(endpoints.saveBranchBranding, {
      ...branch,
      change: { mode: "inherit" },
    });
    await expect(
      f.member.mutation(endpoints.saveBranchBranding, {
        ...branch,
        change: { mode: "inherit" },
      }),
    ).rejects.toThrow("Conflict");
    await f.owner.mutation(endpoints.saveGroupBranding, {
      ...args,
      expectedVersion: 1,
      allowBranchOverride: true,
    });
    await expect(
      f.member.mutation(endpoints.saveBranchBranding, {
        ...branch,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("Conflict");
  });
});

describe("U1g honest unavailable operational aggregates", () => {
  it("returns null, never invented totals; distinguishes denied/inactive/module-disabled and scoped branches", async () => {
    const f = await fixture();
    const args = { groupId: f.groupId, startDate: 0, endDate: 86400000 };
    const overview = await f.owner.query(
      endpoints.getOperationalOverview,
      args,
    );
    expect(overview.totals).toHaveLength(5);
    expect(overview.totals.every((metric) => metric.value === null)).toBe(true);
    expect(
      overview.branches.find((branch) => branch.schoolId === f.schoolId),
    ).toMatchObject({ access: "scoped", drilldown: null });
    expect(
      overview.branches.find((branch) => branch.schoolId === f.branchId),
    ).toMatchObject({ access: "denied", metrics: [], drilldown: null });
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.branchId, { status: "suspended" });
      await ctx.db.patch(f.schoolId, {
        features: {
          billing: false,
          curriculum: true,
          admissions: true,
          knowledgeLibrary: true,
        },
      });
    });
    const next = await f.owner.query(endpoints.getOperationalOverview, args);
    expect(
      next.branches.find((branch) => branch.schoolId === f.branchId)?.access,
    ).toBe("inactive");
    expect(
      next.branches
        .find((branch) => branch.schoolId === f.schoolId)
        ?.metrics.find((metric) => metric.key === "finance")?.state,
    ).toBe("module_disabled");
    expect(JSON.stringify(next)).not.toMatch(
      /owner@example|member@example|admissionNumber|bankAccount/,
    );
  });

  it("rejects Platform/ordinary membership, unrelated branch injection and invalid periods; filters exact linked branch", async () => {
    const f = await fixture();
    const args = { groupId: f.groupId, startDate: 0, endDate: 86400000 };
    await expect(
      f.platform.query(endpoints.getOperationalOverview, args),
    ).rejects.toThrow("proprietor");
    await expect(
      f.member.query(endpoints.getOperationalOverview, args),
    ).rejects.toThrow("proprietor");
    await expect(
      f.owner.query(endpoints.getOperationalOverview, {
        ...args,
        branchId: f.outsiderSchoolId,
      }),
    ).rejects.toThrow("not in this group");
    await expect(
      f.owner.query(endpoints.getOperationalOverview, { ...args, endDate: 0 }),
    ).rejects.toThrow("valid UTC period");
    await expect(
      f.owner.query(endpoints.getOperationalOverview, {
        ...args,
        endDate: 367 * 86400000,
      }),
    ).rejects.toThrow("366 days");
    const filtered = await f.owner.query(endpoints.getOperationalOverview, {
      ...args,
      branchId: f.schoolId,
    });
    expect(filtered.branches).toHaveLength(1);
    expect(filtered.period).toEqual({
      startDate: 0,
      endDate: 86400000,
      timezone: "UTC",
      endExclusive: true,
    });
    await f.t.run((ctx) =>
      ctx.db.patch(f.ownerMembership, { status: "archived" }),
    );
    expect(
      (
        await f.owner.query(endpoints.getOperationalOverview, {
          ...args,
          branchId: f.schoolId,
        })
      ).branches[0],
    ).toMatchObject({ access: "denied", metrics: [] });
  });
});
