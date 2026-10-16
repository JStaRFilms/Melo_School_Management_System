import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";

declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

const auth = vi.hoisted(() => ({
  deleteSessions: vi.fn(), deleteAccount: vi.fn(), deleteUser: vi.fn(),
  createUser: vi.fn().mockResolvedValue({ id: "replacement-auth" }),
}));
vi.mock("../../../betterAuth", () => ({
  createAuth: () => ({ $context: Promise.resolve({
    password: { config: { minPasswordLength: 8, maxPasswordLength: 128 }, hash: async () => "mock-hash" },
    internalAdapter: {
      findUserByEmail: async () => ({ user: { id: "retained-auth", email: "retained@example.test" }, accounts: [{ id: "retained-credential" }] }),
      ...auth, linkAccount: async () => undefined,
    },
  }) }),
}));
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]))
  .map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it.each(["retained@example.test", "changed@example.test"])("does not delete a canonical person's login without a legacy user row, person email %s", async personEmail => {
  vi.stubEnv("CONVEX_SITE_URL", "https://school.convex.site");
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    await ctx.db.insert("platformAdmins", { authId: "operator", authTokenIdentifier: "test|operator", email: "operator@example.test", name: "Operator", isActive: true, createdAt: 1, updatedAt: 1 });
    const schoolId = await ctx.db.insert("schools", { name: "Pending school", slug: "pending-school", status: "pending", createdAt: 1, updatedAt: 1 });
    const personId = await ctx.db.insert("persons", { name: "Retained Person", email: personEmail, authTokenIdentifier: "https://school.convex.site|retained-auth", identityReconciliationState: "resolved", status: "active", createdAt: 1, updatedAt: 1 });
    return { schoolId, personId };
  });
  const before = await t.run(ctx => ctx.db.get(ids.personId));
  const operator = t.withIdentity({ subject: "operator", tokenIdentifier: "test|operator", issuer: "https://deployment-auth.test" });
  await expect(operator.action(api.functions.platform.index.provisionSchoolAdmin, {
    schoolId: ids.schoolId, adminName: "New Admin", adminEmail: "retained@example.test", adminPassword: "Synthetic!123",
  })).rejects.toThrow("already exists");
  expect(auth.deleteSessions).not.toHaveBeenCalled();
  expect(auth.deleteAccount).not.toHaveBeenCalled();
  expect(auth.deleteUser).not.toHaveBeenCalled();
  expect(auth.createUser).not.toHaveBeenCalled();
  expect(await t.run(ctx => ctx.db.get(ids.personId))).toEqual(before);
});
