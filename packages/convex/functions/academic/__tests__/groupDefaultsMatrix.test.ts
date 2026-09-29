import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import { resolveEffectiveGroupSetting } from "../groupDefaultsResolver";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));

const DOMAIN = "academic_policy" as const;
const GROUP_VALUE = { examInputMode: "raw60_scaled_to_40" } as const;
const LOCAL_VALUE = { examInputMode: "raw40" } as const;

async function seed() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const person = await ctx.db.insert("persons", { authTokenIdentifier: "test|p10", name: "P", email: "p@p10.test", status: "active", createdAt: now, updatedAt: now });
    const schoolId = await ctx.db.insert("schools", { name: "S", slug: "p10-s", status: "active", createdAt: now, updatedAt: now });
    const groupId = await ctx.db.insert("schoolGroups", { name: "G", slug: "p10-g", proprietorPersonId: person, status: "active", createdAt: now, updatedAt: now });
    return { schoolId, groupId, person };
  });
  return { t, ...ids };
}

async function link(t: ReturnType<typeof convexTest>, schoolId: Id<"schools">, groupId: Id<"schoolGroups">) {
  return t.run((ctx) =>
    ctx.db.insert("schoolGroupBranches", { groupId, schoolId, isHeadquarters: false, linkedAt: Date.now() }),
  );
}

async function publishDefaults(
  t: ReturnType<typeof convexTest>,
  groupId: Id<"schoolGroups">,
  person: Id<"persons">,
  allowBranchOverride: boolean,
) {
  return t.run((ctx) =>
    ctx.db.insert("groupSettingVersions", {
      groupId,
      domain: DOMAIN,
      version: 1,
      allowBranchOverride,
      value: { ...GROUP_VALUE },
      createdAt: Date.now(),
      createdBy: person,
    }),
  );
}

async function choose(
  t: ReturnType<typeof convexTest>,
  groupId: Id<"schoolGroups">,
  schoolId: Id<"schools">,
  person: Id<"persons">,
  mode: "inherit" | "override",
) {
  return t.run((ctx) =>
    ctx.db.insert("branchSettingOverrides", {
      groupId,
      schoolId,
      domain: DOMAIN,
      mode,
      ...(mode === "override" ? { value: { ...LOCAL_VALUE } } : {}),
      revision: 1,
      groupVersion: 1,
      createdAt: Date.now(),
      createdBy: person,
    }),
  );
}

describe("group active/inactive by override matrix (consolidation P10)", () => {
  it("falls back to legacy without a link", async () => {
    const { t, schoolId } = await seed();
    const effective = await t.run((ctx) =>
      resolveEffectiveGroupSetting(ctx, schoolId, DOMAIN, { domain: DOMAIN, value: { ...LOCAL_VALUE } } as never),
    );
    expect(effective).toMatchObject({ mode: "legacy", source: "branch_legacy", groupId: null });
  });

  it("inherits the group value when active and chosen", async () => {
    const { t, schoolId, groupId, person } = await seed();
    await link(t, schoolId, groupId);
    await publishDefaults(t, groupId, person, true);
    await choose(t, groupId, schoolId, person, "inherit");
    const effective = await t.run((ctx) => resolveEffectiveGroupSetting(ctx, schoolId, DOMAIN, null));
    expect(effective).toMatchObject({ mode: "inherit", source: "group", value: GROUP_VALUE, groupVersion: 1 });
  });

  it("applies a branch override when allowed", async () => {
    const { t, schoolId, groupId, person } = await seed();
    await link(t, schoolId, groupId);
    await publishDefaults(t, groupId, person, true);
    await choose(t, groupId, schoolId, person, "override");
    const effective = await t.run((ctx) => resolveEffectiveGroupSetting(ctx, schoolId, DOMAIN, null));
    expect(effective).toMatchObject({ mode: "override", source: "branch_override", value: LOCAL_VALUE });
  });

  it("silently inherits a forbidden override on the read path (write paths throw)", async () => {
    const { t, schoolId, groupId, person } = await seed();
    await link(t, schoolId, groupId);
    await publishDefaults(t, groupId, person, false);
    await choose(t, groupId, schoolId, person, "override");
    const effective = await t.run((ctx) => resolveEffectiveGroupSetting(ctx, schoolId, DOMAIN, null));
    expect(effective).toMatchObject({ mode: "inherit", source: "group", value: GROUP_VALUE });
  });

  it("falls back to legacy when the group is inactive", async () => {
    const { t, schoolId, groupId, person } = await seed();
    await link(t, schoolId, groupId);
    await publishDefaults(t, groupId, person, true);
    await choose(t, groupId, schoolId, person, "inherit");
    await t.run((ctx) => ctx.db.patch(groupId, { status: "archived" }));
    const effective = await t.run((ctx) =>
      resolveEffectiveGroupSetting(ctx, schoolId, DOMAIN, { domain: DOMAIN, value: { ...LOCAL_VALUE } } as never),
    );
    expect(effective).toMatchObject({ mode: "legacy", source: "branch_legacy", groupId: null });
  });
});
