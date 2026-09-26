import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { instructionTemplateResolutionKeys, selectInstructionTemplateBucket } from "../lessonKnowledgeTemplatesHelpers";

declare global {
  interface ImportMeta {
    glob(patterns: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]);
const modules = Object.fromEntries(Object.entries(rawModules).map(([path, module]) =>
  [`./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module]));

it("finds an active school default after more than 100 inactive templates share its key", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "template-resolution-school", status: "active", createdAt: now, updatedAt: now });
    const userId = await ctx.db.insert("users", { schoolId, authId: "template-admin", name: "Admin", email: "template-admin@example.test", role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
    const bucket = instructionTemplateResolutionKeys({ outputType: "lesson_plan", subjectId: null, level: null })[0];
    const base = {
      schoolId, templateKey: bucket.key, outputType: "lesson_plan" as const,
      templateScope: "school_default" as const, isSchoolDefault: true,
      description: "School default", requiredSectionIds: ["intro"],
      sectionDefinitions: [{ id: "intro", label: "Introduction", order: 0, required: true, minimumWordCount: 20 }],
      objectiveMinimums: { minimumObjectives: 1, minimumSourceMaterials: 1, minimumSections: 1 },
      searchText: "lesson plan", createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId,
    };
    for (let index = 0; index < 101; index += 1) {
      await ctx.db.insert("instructionTemplates", { ...base, title: `Inactive ${index}`, isActive: false });
    }
    const activeId = await ctx.db.insert("instructionTemplates", { ...base, title: "Active default", isActive: true });
    const rows = await ctx.db.query("instructionTemplates")
      .withIndex("by_school_and_template_key", (q) =>
        q.eq("schoolId", schoolId).eq("templateKey", bucket.key)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(100);
    expect(rows).toHaveLength(1);
    expect(selectInstructionTemplateBucket(rows, bucket, "lesson_plan")?._id).toEqual(activeId);
  });
});
