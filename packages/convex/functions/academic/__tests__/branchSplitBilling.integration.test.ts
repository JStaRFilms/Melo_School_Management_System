import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../../../_generated/api";
import schema from "../../../schema";
import { ALL_DUPLICATION_TABLES } from "../branchSplitV2";

declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);

describe("branch split billing duplication", () => {
  it("duplicates bank accounts before remapping fee-plan and collection bank references", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const now = Date.now();
      const sourceSchoolId = await ctx.db.insert("schools", {
        name: "Source School",
        slug: "branch-source",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const targetSchoolId = await ctx.db.insert("schools", {
        name: "Target School",
        slug: "branch-target",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const sourceUserId = await ctx.db.insert("users", {
        schoolId: sourceSchoolId,
        authId: "branch-source-admin",
        name: "Source Admin",
        email: "source-admin@branch.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      const targetUserId = await ctx.db.insert("users", {
        schoolId: targetSchoolId,
        authId: "branch-target-admin",
        name: "Target Admin",
        email: "target-admin@branch.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      const sourceClassId = await ctx.db.insert("classes", {
        schoolId: sourceSchoolId,
        name: "Primary 4",
        gradeName: "Primary 4",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const targetClassId = await ctx.db.insert("classes", {
        schoolId: targetSchoolId,
        name: "Primary 4",
        gradeName: "Primary 4",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const sourceBankAccountId = await ctx.db.insert("schoolBankAccounts", {
        schoolId: sourceSchoolId,
        bankName: "Source Bank",
        accountNumber: "0123456789",
        accountName: "Source School",
        currency: "NGN",
        isDefault: true,
        status: "active",
        createdAt: now,
        updatedAt: now,
        updatedBy: sourceUserId,
      });
      await ctx.db.insert("feePlans", {
        schoolId: sourceSchoolId,
        bankAccountId: sourceBankAccountId,
        name: "Term fees",
        currency: "NGN",
        billingMode: "class_default",
        targetClassIds: [sourceClassId],
        lineItems: [{ id: "tuition", label: "Tuition", amount: 1000, category: "tuition", order: 0 }],
        installmentPolicy: { enabled: false, installmentCount: 1, intervalDays: 0, firstDueDays: 14 },
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: sourceUserId,
        updatedBy: sourceUserId,
      });
      await ctx.db.insert("selectableBillingCollections", {
        schoolId: sourceSchoolId,
        bankAccountId: sourceBankAccountId,
        name: "Book collection",
        currency: "NGN",
        targetClassIds: [sourceClassId],
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: sourceUserId,
        updatedBy: sourceUserId,
      });
      const stateId = await ctx.db.insert("migrationState", {
        phase: "duplication",
        sourceSchoolId,
        targetSchoolId,
        currentTable: "schoolBankAccounts",
        idMaps: JSON.stringify({
          users: { [String(sourceUserId)]: String(targetUserId) },
          classes: { [String(sourceClassId)]: String(targetClassId) },
        }),
        tablesCompleted: [],
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      return { sourceSchoolId, targetSchoolId, sourceBankAccountId, stateId };
    });

    const bankIndex = ALL_DUPLICATION_TABLES.indexOf("schoolBankAccounts");
    const feePlanIndex = ALL_DUPLICATION_TABLES.indexOf("feePlans");
    const collectionIndex = ALL_DUPLICATION_TABLES.indexOf("selectableBillingCollections");
    expect(bankIndex).toBeLessThan(feePlanIndex);
    expect(feePlanIndex).toBeLessThan(collectionIndex);

    for (let batch = bankIndex; batch <= collectionIndex; batch += 1) {
      await t.mutation(internal.functions.academic.branchSplitV2.duplicateBatch, {
        stateId: fixture.stateId,
      });
    }

    const duplicated = await t.run(async (ctx) => {
      const targetBanks = await ctx.db
        .query("schoolBankAccounts")
        .withIndex("by_school", (q) => q.eq("schoolId", fixture.targetSchoolId))
        .collect();
      const targetPlans = await ctx.db
        .query("feePlans")
        .withIndex("by_school", (q) => q.eq("schoolId", fixture.targetSchoolId))
        .collect();
      const targetCollections = await ctx.db
        .query("selectableBillingCollections")
        .withIndex("by_school", (q) => q.eq("schoolId", fixture.targetSchoolId))
        .collect();
      return { targetBanks, targetPlans, targetCollections };
    });

    expect(duplicated.targetBanks).toHaveLength(1);
    expect(duplicated.targetBanks[0]._id).not.toBe(fixture.sourceBankAccountId);
    expect(duplicated.targetPlans).toHaveLength(1);
    expect(duplicated.targetCollections).toHaveLength(1);
    expect(duplicated.targetPlans[0].bankAccountId).toBe(duplicated.targetBanks[0]._id);
    expect(duplicated.targetCollections[0].bankAccountId).toBe(duplicated.targetBanks[0]._id);
  });
});
