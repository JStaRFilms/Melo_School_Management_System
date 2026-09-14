import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "../../../_generated/api";
import schema from "../../../schema";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));

async function fixture(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Email School", slug: "email-school", status: "active", createdAt: 1, updatedAt: 1 });
    const personId = await ctx.db.insert("persons", { email: "old@example.test", name: "School Admin", status: "active", createdAt: 1, updatedAt: 1 });
    const userId = await ctx.db.insert("users", { schoolId, personId, authId: "auth-admin", name: "School Admin", email: "old@example.test", role: "admin", isSchoolAdmin: true, isArchived: false, createdAt: 1, updatedAt: 1 });
    return { schoolId, personId, userId };
  });
}

it("rejects unauthorised school listing and synchronises the canonical records with an audit event", async () => {
  const t = convexTest(schema, modules);
  const ids = await fixture(t);
  await expect(t.query(api.functions.platform.index.listSchools, {})).rejects.toThrow("Unauthorized");
  await t.mutation(internal.functions.platform.index.updateSchoolAdminEmailInternal, { schoolId: ids.schoolId, userId: ids.userId, expectedEmail: "old@example.test", newEmail: "new@example.test", actorEmail: "operator@example.test" });
  const state = await t.run(async (ctx) => ({ user: await ctx.db.get(ids.userId), person: await ctx.db.get(ids.personId), audit: await ctx.db.query("auditEvents").withIndex("by_school", (q) => q.eq("schoolId", ids.schoolId)).first() }));
  expect(state.user?.email).toBe("new@example.test");
  expect(state.person?.email).toBe("new@example.test");
  expect(state.audit).toMatchObject({ action: "school_admin_email_changed", outcome: "success" });
  expect(state.audit?.beforeSummary).not.toContain("old@example.test");
});

it("rejects a conflicting canonical email without changing the administrator", async () => {
  const t = convexTest(schema, modules);
  const ids = await fixture(t);
  await t.run(async (ctx) => {
    await ctx.db.insert("persons", { email: "taken@example.test", name: "Taken", status: "active", createdAt: 1, updatedAt: 1 });
  });
  await expect(t.mutation(internal.functions.platform.index.updateSchoolAdminEmailInternal, { schoolId: ids.schoolId, userId: ids.userId, expectedEmail: "old@example.test", newEmail: "taken@example.test", actorEmail: "operator@example.test" })).rejects.toThrow("already exists");
  await expect(t.run(async (ctx) => (await ctx.db.get(ids.userId))?.email)).resolves.toBe("old@example.test");
});
