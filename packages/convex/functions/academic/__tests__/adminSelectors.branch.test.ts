declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";
import { seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";

const modules = import.meta.glob("../../../**/*.ts");
const convexRoot = new URL("../../../", import.meta.url).pathname;
const mapped = Object.fromEntries(Object.entries(modules).map(([path, module]) =>
  [`./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module]));
const selectors = api.functions.academic.adminSelectors;

async function setup() {
  const t = convexTest(schema, mapped);
  const ids = await t.run(async (ctx) => {
    const defaultSchool = await ctx.db.insert("schools", { name: "Default", slug: "selector-default", status: "active", createdAt: 1, updatedAt: 1 });
    const branch = await ctx.db.insert("schools", { name: "Branch", slug: "selector-branch", status: "active", createdAt: 1, updatedAt: 1 });
    const foreign = await ctx.db.insert("schools", { name: "Foreign", slug: "selector-foreign", status: "active", createdAt: 1, updatedAt: 1 });
    const operator = await seedReviewedTenantOperatorWithCapabilities(ctx, [defaultSchool, branch], "selector-admin", ["academic.report_cards.preview"]);
    await ctx.db.patch(operator.memberships[0].userId, { authTokenIdentifier: "selector-admin" });
    await seedReviewedTenantOperatorWithCapabilities(ctx, [branch], "selector-teacher", ["academic.report_cards.preview"], { role: "teacher" });
    const rows = [];
    for (const schoolId of [defaultSchool, branch, foreign]) {
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: `Session ${schoolId}`, startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: `Term ${schoolId}`, startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      const classId = await ctx.db.insert("classes", { schoolId, name: `Class ${schoolId}`, level: "Junior", createdAt: 1, updatedAt: 1 });
      rows.push({ sessionId, termId, classId });
    }
    return { defaultSchool, branch, foreign, rows };
  });
  return { t, ids };
}

describe("Admin report card selectors", () => {
  it("selects a non-default branch without changing no-arg defaults", async () => {
    const { t, ids } = await setup();
    const admin = t.withIdentity({ subject: "selector-admin", tokenIdentifier: "selector-admin" });
    expect(await admin.query(selectors.getAdminSessions, {})).toMatchObject([{ id: ids.rows[0].sessionId }]);
    expect(await admin.query(selectors.getAllClasses, {})).toMatchObject([{ id: ids.rows[0].classId }]);
    expect(await admin.query(selectors.getAdminSessions, { schoolId: ids.branch })).toMatchObject([{ id: ids.rows[1].sessionId }]);
    expect(await admin.query(selectors.getTermsBySession, { schoolId: ids.branch, sessionId: ids.rows[1].sessionId })).toMatchObject([{ id: ids.rows[1].termId }]);
    expect(await admin.query(selectors.getAllClasses, { schoolId: ids.branch })).toMatchObject([{ id: ids.rows[1].classId }]);
    expect(await admin.query(selectors.getTermsBySession, { sessionId: ids.rows[0].sessionId })).toMatchObject([{ id: ids.rows[0].termId }]);
    await expect(admin.query(selectors.getTermsBySession, { schoolId: ids.branch, sessionId: ids.rows[0].sessionId })).rejects.toThrow();
  });

  it("denies a branch without membership and does not grant teacher admin selectors", async () => {
    const { t, ids } = await setup();
    const admin = t.withIdentity({ subject: "selector-admin", tokenIdentifier: "selector-admin" });
    const teacher = t.withIdentity({ subject: "selector-teacher", tokenIdentifier: "selector-teacher" });
    await expect(admin.query(selectors.getAdminSessions, { schoolId: ids.foreign })).rejects.toThrow();
    await expect(admin.query(selectors.getTermsBySession, { schoolId: ids.foreign, sessionId: ids.rows[2].sessionId })).rejects.toThrow();
    await expect(admin.query(selectors.getAllClasses, { schoolId: ids.foreign })).rejects.toThrow();
    await expect(teacher.query(selectors.getAdminSessions, { schoolId: ids.branch })).rejects.toThrow();
    await expect(teacher.query(selectors.getTermsBySession, { schoolId: ids.branch, sessionId: ids.rows[1].sessionId })).rejects.toThrow();
    await expect(teacher.query(selectors.getAllClasses, { schoolId: ids.branch })).rejects.toThrow();
  });
});
