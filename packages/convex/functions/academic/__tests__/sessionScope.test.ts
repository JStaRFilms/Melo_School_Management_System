import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { getActiveSession } from "../sessionScope";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));

describe("getActiveSession reject-multiples matrix (consolidation P7)", () => {
  it("returns null with zero active sessions", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run((ctx) =>
      ctx.db.insert("schools", { name: "S", slug: "p7-zero", status: "active", createdAt: 1, updatedAt: 1 }),
    );
    await expect(t.run((ctx) => getActiveSession(ctx, schoolId))).resolves.toBeNull();
  });

  it("returns the single unarchived active session", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "S", slug: "p7-one", status: "active", createdAt: 1, updatedAt: 1 });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      return { schoolId, sessionId };
    });
    const session = await t.run((ctx) => getActiveSession(ctx, ids.schoolId));
    expect(session?._id).toEqual(ids.sessionId);
  });

  it("returns null with two active sessions", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("schools", { name: "S", slug: "p7-two", status: "active", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("academicSessions", { schoolId: id, name: "A", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("academicSessions", { schoolId: id, name: "B", startDate: 3, endDate: 4, isActive: true, createdAt: 1, updatedAt: 1 });
      return id;
    });
    await expect(t.run((ctx) => getActiveSession(ctx, schoolId))).resolves.toBeNull();
  });

  it("excludes an archived single active row", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("schools", { name: "S", slug: "p7-arch", status: "active", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("academicSessions", { schoolId: id, name: "A", startDate: 1, endDate: 2, isActive: true, isArchived: true, createdAt: 1, updatedAt: 1 });
      return id;
    });
    await expect(t.run((ctx) => getActiveSession(ctx, schoolId))).resolves.toBeNull();
  });
});
