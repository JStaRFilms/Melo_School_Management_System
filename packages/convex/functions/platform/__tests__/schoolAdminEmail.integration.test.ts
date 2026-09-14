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

it("rejects unauthorised school listing and synchronises a reserved update with an audit event", async () => {
  const t = convexTest(schema, modules);
  const ids = await fixture(t);
  await expect(t.query(api.functions.platform.index.listSchools, {})).rejects.toThrow("Unauthorized");
  const reservationId = await t.mutation(
    internal.functions.platform.index.reserveSchoolAdminEmailUpdateInternal,
    { schoolId: ids.schoolId, userId: ids.userId, expectedEmail: "old@example.test", newEmail: "new@example.test", actorEmail: "operator@example.test" },
  );
  await t.mutation(
    internal.functions.platform.index.finalizeSchoolAdminEmailUpdateInternal,
    { reservationId },
  );
  const state = await t.run(async (ctx) => ({
    user: await ctx.db.get(ids.userId),
    person: await ctx.db.get(ids.personId),
    audit: await ctx.db.query("auditEvents").withIndex("by_school", (q) => q.eq("schoolId", ids.schoolId)).first(),
    reservation: await ctx.db.query("schoolAdminEmailUpdateReservations").withIndex("by_user", (q) => q.eq("userId", ids.userId)).first(),
  }));
  expect(state.user?.email).toBe("new@example.test");
  expect(state.person?.email).toBe("new@example.test");
  expect(state.audit).toMatchObject({ action: "school_admin_email_changed", outcome: "success" });
  expect(state.audit?.beforeSummary).not.toContain("old@example.test");
  expect(state.reservation).toBeNull();
});

it("rejects concurrent and stale operators before another external auth mutation can start", async () => {
  const t = convexTest(schema, modules);
  const ids = await fixture(t);
  const attempts = [
    { newEmail: "first@example.test", actorEmail: "first-operator@example.test" },
    { newEmail: "second@example.test", actorEmail: "second-operator@example.test" },
  ];
  const outcomes = await Promise.allSettled(attempts.map((attempt) =>
    t.mutation(
      internal.functions.platform.index.reserveSchoolAdminEmailUpdateInternal,
      { schoolId: ids.schoolId, userId: ids.userId, expectedEmail: "old@example.test", ...attempt },
    ),
  ));
  const successfulAttempts = outcomes.flatMap((outcome, index) =>
    outcome.status === "fulfilled"
      ? [{ reservationId: outcome.value, newEmail: attempts[index]?.newEmail }]
      : [],
  );
  const failedAttempts = outcomes.filter((outcome) => outcome.status === "rejected");
  expect(successfulAttempts).toHaveLength(1);
  expect(failedAttempts).toHaveLength(1);
  expect(failedAttempts[0]).toMatchObject({ reason: expect.objectContaining({ message: expect.stringContaining("already in progress") }) });

  const [successfulAttempt] = successfulAttempts;
  if (!successfulAttempt?.newEmail) throw new Error("One reservation should have succeeded");
  await t.mutation(
    internal.functions.platform.index.finalizeSchoolAdminEmailUpdateInternal,
    { reservationId: successfulAttempt.reservationId },
  );
  const staleAttempt = attempts.find((attempt) => attempt.newEmail !== successfulAttempt.newEmail);
  if (!staleAttempt) throw new Error("One stale attempt should remain");
  await expect(t.mutation(
    internal.functions.platform.index.reserveSchoolAdminEmailUpdateInternal,
    { schoolId: ids.schoolId, userId: ids.userId, expectedEmail: "old@example.test", ...staleAttempt },
  )).rejects.toThrow("identity changed");

  await expect(t.run(async (ctx) => (await ctx.db.get(ids.userId))?.email)).resolves.toBe(successfulAttempt.newEmail);
});

it("rejects a conflicting canonical email before reserving the administrator", async () => {
  const t = convexTest(schema, modules);
  const ids = await fixture(t);
  await t.run(async (ctx) => {
    await ctx.db.insert("persons", { email: "taken@example.test", name: "Taken", status: "active", createdAt: 1, updatedAt: 1 });
  });
  await expect(t.mutation(
    internal.functions.platform.index.reserveSchoolAdminEmailUpdateInternal,
    { schoolId: ids.schoolId, userId: ids.userId, expectedEmail: "old@example.test", newEmail: "taken@example.test", actorEmail: "operator@example.test" },
  )).rejects.toThrow("already exists");
  const state = await t.run(async (ctx) => ({
    email: (await ctx.db.get(ids.userId))?.email,
    reservation: await ctx.db.query("schoolAdminEmailUpdateReservations").withIndex("by_user", (q) => q.eq("userId", ids.userId)).first(),
  }));
  expect(state.email).toBe("old@example.test");
  expect(state.reservation).toBeNull();
});
