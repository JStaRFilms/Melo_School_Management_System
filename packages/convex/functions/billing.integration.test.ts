import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../**/*.ts")).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);
const adminIdentity = {
  subject: "billing-regression-admin",
  tokenIdentifier: "https://auth.school.test|billing-regression-admin",
};

const lineItems = [{ label: "Tuition", amount: 5000, category: "tuition" as const }];

describe("billing registered functions", () => {
  it("allows universal class-default plans while rejecting class-targeted manual extras", async () => {
    const t = convexTest(schema, modules);
    const classId = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Billing School", slug: "billing-fee-plans", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@billing.test", role: "admin", createdAt: now, updatedAt: now });
      return await ctx.db.insert("classes", { schoolId, name: "Primary 1", gradeName: "Primary 1", level: "Primary", createdAt: now, updatedAt: now });
    });

    const universalPlan = await t.withIdentity(adminIdentity).mutation(api.functions.billing.createFeePlan, {
      name: "Universal Fees",
      billingMode: "class_default",
      lineItems,
    });
    expect(universalPlan).toMatchObject({ billingMode: "class_default", targetClassIds: [] });

    const targetedPlan = await t.withIdentity(adminIdentity).mutation(api.functions.billing.createFeePlan, {
      name: "Primary 1 Fees",
      billingMode: "class_default",
      targetClassIds: [classId],
      lineItems,
    });
    expect(targetedPlan).toMatchObject({ billingMode: "class_default", targetClassIds: [classId] });

    await expect(t.withIdentity(adminIdentity).mutation(api.functions.billing.createFeePlan, {
      name: "Invalid Manual Extra",
      billingMode: "manual_extra",
      targetClassIds: [classId],
      lineItems,
    })).rejects.toThrow(/Manual extra fee plans cannot target classes/);
  });
});
