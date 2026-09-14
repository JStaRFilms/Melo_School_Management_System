import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(
    ([path, module]) => [
      `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
      module,
    ],
  ),
);

it("starts new schools with core access only and preserves legacy module defaults", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("platformAdmins", {
      authId: "platform-operator",
      authTokenIdentifier: "test|platform-operator",
      email: "operator@example.test",
      name: "Platform Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("schools", {
      name: "Legacy School",
      slug: "legacy-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
  });
  const platform = t.withIdentity({
    subject: "platform-operator",
    tokenIdentifier: "test|platform-operator",
  });

  await platform.mutation(api.functions.platform.index.createSchool, {
    name: "New School",
    slug: "new-school",
  });

  const schools = await platform.query(api.functions.platform.index.listSchools, {});
  expect(schools.find((school) => school.slug === "legacy-school")?.features).toEqual({
    familyPortal: true,
    billing: true,
    curriculum: true,
    knowledgeLibrary: true,
    admissions: false,
  });
  const newSchool = schools.find((school) => school.slug === "new-school");
  expect(newSchool?.features).toEqual({
    familyPortal: false,
    billing: false,
    curriculum: false,
    knowledgeLibrary: false,
    admissions: false,
  });
  if (!newSchool) throw new Error("New school missing");

  await platform.mutation(api.functions.platform.index.updateSchoolFeatures, {
    schoolId: newSchool._id,
    features: {
      familyPortal: true,
      billing: false,
      curriculum: false,
      knowledgeLibrary: true,
      admissions: true,
    },
  });

  const stored = await t.run((ctx) => ctx.db.get(newSchool._id));
  expect(stored?.features).toEqual({
    familyPortal: true,
    billing: false,
    curriculum: false,
    knowledgeLibrary: true,
    admissions: true,
  });
}, 20_000);
