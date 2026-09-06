import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";

const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]);
const modules = Object.fromEntries(Object.entries(rawModules).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module]));
const identity = { subject: "planning-owner", tokenIdentifier: "https://auth.test|planning-owner" };

describe("teacher planning domain draft conflicts", () => {
  it("rejects a stale revision without replacing the newer document", async () => {
    const t = convexTest(schema, modules);
    const subjectId = await t.run(async ctx => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", { name: "Planning School", slug: "planning-school", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name: "Planning Admin", email: "planner@example.test", role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
      return await ctx.db.insert("subjects", { schoolId, name: "Mathematics", code: "MTH", createdAt: now, updatedAt: now });
    });
    const actor = t.withIdentity(identity);
    const save = api.functions.academic.lessonKnowledgeLessonPlans.saveTeacherInstructionArtifactDraft;
    const first = await actor.mutation(save, { artifactId: null, expectedRevisionNumber: 0, outputType: "lesson_plan", title: "Fractions", documentState: "# Fractions", plainText: "Fractions", sourceIds: [], subjectId, level: "Primary 4", topicLabel: "Fractions", revisionKind: "manual_save" });
    await expect(actor.mutation(save, { artifactId: first.artifactId, expectedRevisionNumber: 0, outputType: "lesson_plan", title: "Stale", documentState: "# Stale", plainText: "Stale", sourceIds: [], subjectId, level: "Primary 4", topicLabel: "Fractions", revisionKind: "manual_save" })).rejects.toThrow(/newer planning revision/);
    const latest = await actor.mutation(save, { artifactId: first.artifactId, expectedRevisionNumber: 1, outputType: "lesson_plan", title: "Current", documentState: "# Current", plainText: "Current", sourceIds: [], subjectId, level: "Primary 4", topicLabel: "Fractions", revisionKind: "manual_save" });
    expect(latest.revisionNumber).toBe(2);
    expect(latest.documentState).toContain("Current");
  });
});
