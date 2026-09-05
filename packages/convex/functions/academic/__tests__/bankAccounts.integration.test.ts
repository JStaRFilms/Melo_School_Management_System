import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]),
  ).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);
const bank = api.functions.academic.bankAccounts;
const fields = {
  bankName: "Synthetic Bank",
  accountName: "Synthetic School",
  accountNumber: "1234567890",
  currency: "NGN",
  isDefault: false,
  confirmation: "CONFIRM",
};
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Synthetic",
      slug: "synthetic",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const personId = await ctx.db.insert("persons", {
      name: "Owner",
      email: "owner@example.test",
      authTokenIdentifier: "test|owner",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const userId = await ctx.db.insert("users", {
      schoolId,
      personId,
      authId: "owner",
      authTokenIdentifier: "test|owner",
      name: "Owner",
      email: "owner@example.test",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("branchMemberships", {
      schoolId,
      personId,
      legacyUserId: userId,
      isDefaultBranch: true,
      status: "active",
      joinedAt: 1,
      updatedAt: 1,
    });
    const groupId = await ctx.db.insert("schoolGroups", {
      name: "Group",
      slug: "group",
      proprietorPersonId: personId,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("schoolGroupBranches", {
      schoolId,
      groupId,
      isHeadquarters: true,
      linkedAt: 1,
    });
    return { schoolId };
  });
  return {
    t,
    viewer: t.withIdentity({
      subject: "owner",
      issuer: "test",
      tokenIdentifier: "test|owner",
    }),
    ...ids,
  };
}
it("denies unauthenticated metadata, masks summaries and requires confirmation", async () => {
  const { t, viewer, schoolId } = await fixture();
  await expect(t.query(bank.listBankAccounts, { schoolId })).rejects.toThrow();
  await expect(
    viewer.mutation(bank.addBankAccount, {
      schoolId,
      ...fields,
      confirmation: "",
    }),
  ).rejects.toThrow("CONFIRM");
  const id = await viewer.mutation(bank.addBankAccount, {
    schoolId,
    ...fields,
  });
  expect(await viewer.query(bank.listBankAccounts, { schoolId })).toMatchObject(
    [{ accountNumber: "***-****-7890", isDefault: true, isMasked: true }],
  );
  expect(
    await viewer.query(bank.getBankAccount, { schoolId, bankAccountId: id }),
  ).toMatchObject({ accountNumber: fields.accountNumber });
  const events = await t.run((ctx) => ctx.db.query("auditEvents").collect());
  expect(JSON.stringify(events)).not.toContain(fields.accountNumber);
  expect(events[0].retentionClass).toBe("permanent_statutory");
  expect(
    await t.run((ctx) => ctx.db.query("auditAlerts").collect()),
  ).toHaveLength(1);
});
it("requires explicit active replacement for default archive and never deletes historical accounts", async () => {
  const { t, viewer, schoolId } = await fixture();
  const first = await viewer.mutation(bank.addBankAccount, {
    schoolId,
    ...fields,
  });
  const second = await viewer.mutation(bank.addBankAccount, {
    schoolId,
    ...fields,
    accountNumber: "9999999999",
  });
  await expect(
    viewer.mutation(bank.archiveBankAccount, {
      schoolId,
      bankAccountId: first,
      confirmation: "CONFIRM",
    }),
  ).rejects.toThrow("replacement");
  await viewer.mutation(bank.archiveBankAccount, {
    schoolId,
    bankAccountId: first,
    replacementId: second,
    confirmation: "CONFIRM",
  });
  expect(await t.run((ctx) => ctx.db.get(first))).toMatchObject({
    status: "archived",
    isDefault: false,
  });
  expect(await t.run((ctx) => ctx.db.get(second))).toMatchObject({
    status: "active",
    isDefault: true,
  });
  await expect(
    viewer.mutation(bank.setPrimaryBankAccount, {
      schoolId,
      bankAccountId: first,
      confirmation: "CONFIRM",
    }),
  ).rejects.toThrow("Active account");
});
it("edits international metadata with optimistic conflicts and masked audit", async () => {
  const { viewer, schoolId, t } = await fixture();
  const id = await viewer.mutation(bank.addBankAccount, {
    schoolId,
    ...fields,
  });
  const current = await viewer.query(bank.getBankAccount, {
    schoolId,
    bankAccountId: id,
  });
  const change = {
    schoolId,
    bankAccountId: id,
    bankName: fields.bankName,
    accountName: fields.accountName,
    accountNumber: "5555555555",
    currency: "NGN",
    iban: "SYNTHETIC-IBAN",
    swift: "SYNTHBIC",
    expectedUpdatedAt: current.updatedAt,
    confirmation: "CONFIRM",
  };
  await viewer.mutation(bank.editBankAccount, change);
  await expect(viewer.mutation(bank.editBankAccount, change)).rejects.toThrow(
    "changed",
  );
  expect(
    JSON.stringify(await t.run((ctx) => ctx.db.query("auditEvents").collect())),
  ).not.toContain("5555555555");
});
