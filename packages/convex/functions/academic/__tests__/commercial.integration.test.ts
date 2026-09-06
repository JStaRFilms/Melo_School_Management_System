import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
import {
  priceSnapshot,
  validateRate,
  type CommercialRate,
} from "../../foundation/commercialContract";
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]),
  ).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);
const commercial = api.functions.academic.commercial;
const privateApi = internal.functions.academic.commercial;
const day = 86400000;
const today = Math.floor(Date.now() / day) * day;
const rate: CommercialRate = {
  currency: "NGN",
  perStudentMinor: 100000,
  setupMinor: 3000000,
  minimumMinor: 0,
  discountBps: 0,
  bands: [],
  cadence: "termly",
  proration: "none",
};
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Synthetic",
      slug: "commercial-test",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const otherSchoolId = await ctx.db.insert("schools", {
      name: "Other",
      slug: "other-commercial",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("platformAdmins", {
      authId: "platform",
      authTokenIdentifier: "test|platform",
      name: "Platform",
      email: "platform@example.test",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const personId = await ctx.db.insert("persons", {
      name: "Finance",
      email: "finance@example.test",
      authTokenIdentifier: "test|finance",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const userId = await ctx.db.insert("users", {
      schoolId,
      personId,
      authId: "finance",
      authTokenIdentifier: "test|finance",
      name: "Finance",
      email: "finance@example.test",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    });
    const membershipId = await ctx.db.insert("branchMemberships", {
      schoolId,
      personId,
      legacyUserId: userId,
      isDefaultBranch: true,
      status: "active",
      joinedAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("membershipDirectGrants", {
      membershipId,
      capability: "finance.reports.view",
      grantedAt: 1,
    });
    await ctx.db.insert("membershipDirectRestrictions", {
      membershipId,
      capability: "finance.settlements.view",
      restrictedAt: 1,
    });
    const groupId = await ctx.db.insert("schoolGroups", {
      name: "Synthetic group",
      slug: "synthetic-commercial-group",
      proprietorPersonId: personId,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId,
      isHeadquarters: true,
      linkedAt: 1,
    });
    await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId: otherSchoolId,
      isHeadquarters: false,
      linkedAt: 1,
    });
    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "Class",
      level: "1",
      createdAt: 1,
      updatedAt: 1,
    });
    const studentUserId = await ctx.db.insert("users", {
      schoolId,
      authId: "synthetic-student",
      name: "Student",
      email: "student@example.test",
      role: "student",
      createdAt: 1,
      updatedAt: 1,
    });
    const base = {
      schoolId,
      classId,
      userId: studentUserId,
      createdAt: 1,
      updatedAt: 1,
    };
    const studentId = await ctx.db.insert("students", {
      ...base,
      admissionNumber: "1",
      enrollmentStatus: "active",
    });
    await ctx.db.insert("students", {
      ...base,
      admissionNumber: "duplicate",
      enrollmentStatus: "active",
    });
    await ctx.db.insert("students", {
      ...base,
      admissionNumber: "archived",
      enrollmentStatus: "active",
      isArchived: true,
    });
    await ctx.db.insert("students", {
      ...base,
      admissionNumber: "graduate",
      enrollmentStatus: "graduated",
    });
    await ctx.db.insert("students", { ...base, admissionNumber: "unknown" });
    await ctx.db.insert("students", {
      ...base,
      admissionNumber: "transferred",
      enrollmentStatus: "transferred_out",
    });
    return { schoolId, otherSchoolId, membershipId, studentId, groupId };
  });
  const platform = t.withIdentity({
    subject: "platform",
    issuer: "test",
    tokenIdentifier: "test|platform",
  });
  const finance = t.withIdentity({
    subject: "finance",
    issuer: "test",
    tokenIdentifier: "test|finance",
  });
  const publishArgs = {
    journalSchoolId: ids.schoolId,
    confirmation: "CONFIRM",
    code: "core_basic",
    name: "Core / Basic",
    expectedVersion: 0,
    effectiveFrom: today - 100 * day,
    rate,
  };
  const rateVersionId = await platform.mutation(
    commercial.publishRateVersion,
    publishArgs,
  );
  const contractArgs = {
    schoolId: ids.schoolId,
    confirmation: "CONFIRM",
    rateVersionId,
    effectiveFrom: today - 30 * day,
    effectiveTo: today + 400 * day,
    setupHandling: "charge_once" as const,
    setupReason: "Approved initial setup",
  };
  const contractId = await platform.mutation(
    commercial.createContract,
    contractArgs,
  );
  const invoiceArgs = {
    schoolId: ids.schoolId,
    contractId,
    confirmation: "CONFIRM",
    periodLabel: "Current term",
    periodStart: today - 10 * day,
    periodEnd: today + 30 * day,
    expectedStudentCount: 1,
    expectedTotalMinor: 3100000,
  };
  return {
    ...ids,
    t,
    platform,
    finance,
    publishArgs,
    contractArgs,
    invoiceArgs,
    rateVersionId,
    contractId,
  };
}
it("requires Platform-only confirmed writes, delegated school reads and separate settlement permission", async () => {
  const f = await fixture();
  await expect(
    f.finance.mutation(commercial.publishRateVersion, f.publishArgs),
  ).rejects.toThrow("Platform");
  await expect(
    f.finance.mutation(commercial.createContract, f.contractArgs),
  ).rejects.toThrow("Platform");
  await expect(
    f.finance.mutation(commercial.issueSubscriptionInvoice, f.invoiceArgs),
  ).rejects.toThrow("Platform");
  await expect(
    f.platform.mutation(commercial.issueSubscriptionInvoice, {
      ...f.invoiceArgs,
      confirmation: "",
    }),
  ).rejects.toThrow("CONFIRM");
  expect(
    (
      await f.finance.query(commercial.getCommercialWorkspace, {
        schoolId: f.schoolId,
      })
    ).contracts,
  ).toHaveLength(1);
  await expect(
    f.finance.query(commercial.getCommercialWorkspace, {
      schoolId: f.otherSchoolId,
    }),
  ).rejects.toThrow();
  await expect(
    f.t.query(commercial.getCommercialWorkspace, { schoolId: f.schoolId }),
  ).rejects.toThrow();
  await expect(
    f.t.query(commercial.getSettlementLedger, { schoolId: f.schoolId }),
  ).rejects.toThrow();
  await f.t.run((ctx) => ctx.db.patch(f.membershipId, { status: "suspended" }));
  await expect(
    f.finance.query(commercial.getCommercialWorkspace, {
      schoolId: f.schoolId,
    }),
  ).rejects.toThrow();
});
it("keeps version/effective dates, contracts and issued snapshots immutable; invoices exclude inactive and duplicate students", async () => {
  const f = await fixture();
  await expect(
    f.platform.mutation(commercial.publishRateVersion, f.publishArgs),
  ).rejects.toThrow("conflict");
  await expect(
    f.platform.mutation(commercial.publishRateVersion, {
      ...f.publishArgs,
      expectedVersion: 1,
      effectiveFrom: today,
    }),
  ).rejects.toThrow("future");
  await expect(
    f.platform.mutation(commercial.createContract, f.contractArgs),
  ).rejects.toThrow("overlap");
  const id = await f.platform.mutation(
    commercial.issueSubscriptionInvoice,
    f.invoiceArgs,
  );
  const original = await f.t.run((ctx) => ctx.db.get(id));
  expect(original).toMatchObject({
    totalMinor: 3100000,
    studentCount: 1,
    excludedCount: 5,
    setupMinor: 3000000,
    discountMinor: 0,
    chargeClass: "saas_subscription",
  });
  await expect(
    f.platform.mutation(commercial.issueSubscriptionInvoice, f.invoiceArgs),
  ).rejects.toThrow("already covers");
  await f.platform.mutation(commercial.publishRateVersion, {
    ...f.publishArgs,
    expectedVersion: 1,
    effectiveFrom: today + day,
    rate: { ...rate, perStudentMinor: 900000 },
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.studentId, { enrollmentStatus: "withdrawn" }),
  );
  expect(await f.t.run((ctx) => ctx.db.get(id))).toEqual(original);
  expect(
    await f.t.run((ctx) =>
      ctx.db.query("subscriptionInvoiceStudents").collect(),
    ),
  ).toHaveLength(1);
  expect(
    await f.t.run((ctx) => ctx.db.query("settlementLedgers").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("studentInvoices").collect()),
  ).toHaveLength(0);
  const events = await f.t.run((ctx) => ctx.db.query("auditEvents").collect());
  expect(
    events.every(
      (e) =>
        e.retentionClass === "permanent_statutory" && e.actorPlatformAdminId,
    ),
  ).toBe(true);
});
it("fails stale review, rejects future/past periods, charges setup once and prorates explicitly", async () => {
  const f = await fixture();
  await expect(
    f.platform.mutation(commercial.issueSubscriptionInvoice, {
      ...f.invoiceArgs,
      expectedTotalMinor: 1,
    }),
  ).rejects.toThrow("preview changed");
  await expect(
    f.platform.mutation(commercial.issueSubscriptionInvoice, {
      ...f.invoiceArgs,
      periodStart: today + day,
      periodEnd: today + 2 * day,
    }),
  ).rejects.toThrow("currently effective");
  await expect(
    f.platform.mutation(commercial.issueSubscriptionInvoice, {
      ...f.invoiceArgs,
      periodStart: today - 2 * day,
      periodEnd: today - day,
    }),
  ).rejects.toThrow("currently effective");
  await f.platform.mutation(commercial.issueSubscriptionInvoice, f.invoiceArgs);
  // A prior recorded setup must not be repeated by any later contract or currency.
  const newContractId = await f.platform.mutation(commercial.createContract, {
    ...f.contractArgs,
    schoolId: f.otherSchoolId,
    effectiveFrom: today,
    effectiveTo: today + 10 * day,
    overrideRate: { ...rate, proration: "daily", minimumMinor: 100000 },
    overrideReason: "Approved daily minimum",
    setupHandling: "waived",
  });
  const id = await f.platform.mutation(commercial.issueSubscriptionInvoice, {
    ...f.invoiceArgs,
    schoolId: f.otherSchoolId,
    contractId: newContractId,
    periodStart: today - 10 * day,
    periodEnd: today + 10 * day,
    expectedStudentCount: 0,
    expectedTotalMinor: 50000,
  });
  expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
    prorationNumerator: 10,
    prorationDenominator: 20,
    totalMinor: 50000,
    setupMinor: 0,
  });
  const clock = vi.spyOn(Date, "now").mockReturnValue(today + 40 * day);
  try {
    const secondId = await f.platform.mutation(
      commercial.issueSubscriptionInvoice,
      {
        ...f.invoiceArgs,
        periodStart: today + 30 * day,
        periodEnd: today + 60 * day,
        expectedTotalMinor: 100000,
      },
    );
    expect(await f.t.run((ctx) => ctx.db.get(secondId))).toMatchObject({
      setupMinor: 0,
      totalMinor: 100000,
    });
  } finally {
    clock.mockRestore();
  }
});
it("keeps evidence-backed refund/dispute/adjustment legs separate and idempotent without changing payout", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    ctx.db.insert("membershipDirectGrants", {
      membershipId: f.membershipId,
      capability: "finance.settlements.view",
      grantedAt: 1,
    }),
  );
  const settlement = await f.t.mutation(
    privateApi.recordSettlementTransaction,
    {
      schoolId: f.schoolId,
      transactionRef: "synthetic-ref",
      routingMode: "mode_a_direct",
      grossAmountKobo: 10000,
      paystackFeeKobo: 100,
    },
  );
  if (!settlement.record) throw new Error("Missing settlement");
  const legArgs = {
    schoolId: f.schoolId,
    settlementId: settlement.record._id,
    kind: "refund" as const,
    amountMinor: -1000,
    evidenceReference: "synthetic-refund",
  };
  const leg = await f.t.mutation(privateApi.recordSettlementLeg, legArgs);
  expect(await f.t.mutation(privateApi.recordSettlementLeg, legArgs)).toBe(leg);
  await expect(
    f.t.mutation(privateApi.recordSettlementLeg, {
      ...legArgs,
      amountMinor: -2000,
    }),
  ).rejects.toThrow("Conflicting");
  await expect(
    f.t.mutation(privateApi.recordSettlementLeg, {
      ...legArgs,
      schoolId: f.otherSchoolId,
    }),
  ).rejects.toThrow();
  await f.t.run((ctx) =>
    ctx.db.insert("paymentMandates", {
      schoolId: f.schoolId,
      customerEmail: "private-mandate@example.test",
      authorizationCode: "synthetic-provider-secret",
      last4: "1234",
      expMonth: "01",
      expYear: "2030",
      cardBrand: "synthetic",
      bankName: "synthetic",
      consentGiven: true,
      consentTimestamp: 1,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const workspace = await f.finance.query(commercial.getCommercialWorkspace, {
    schoolId: f.schoolId,
  });
  expect(workspace.mandates).toMatchObject([
    {
      recordedStatus: "active",
      activation: "unavailable",
      consentRecorded: true,
    },
  ]);
  expect(JSON.stringify(workspace)).not.toContain("synthetic-provider-secret");
  expect(JSON.stringify(workspace)).not.toContain(
    "private-mandate@example.test",
  );
  const rows = await f.finance.query(commercial.getSettlementLedger, {
    schoolId: f.schoolId,
  });
  expect(rows[0]).toMatchObject({
    netPayoutKobo: 9900,
    platformFeeKobo: 0,
    clearingCycle: "unavailable",
    legs: [{ amountMinor: -1000 }],
  });
  expect(
    (
      await f.finance.query(commercial.getCommercialWorkspace, {
        schoolId: f.schoolId,
      })
    ).gates,
  ).toMatchObject({
    purchase: "unavailable",
    recurringMandate: "unavailable",
    merchantConnection: "unverified",
  });
});
it("records proprietor catalog choice, paginates history, aggregates currencies and appends idempotent corrections", async () => {
  const f = await fixture();
  const choiceArgs = {
    schoolId: f.schoolId,
    rateVersionId: f.rateVersionId,
    requestedCadence: "termly" as const,
    requestedStart: today + day,
    reason: "Preferred configured term option",
    confirmation: "REQUEST",
  };
  const choice = await f.finance.mutation(
    commercial.requestContractChoice,
    choiceArgs,
  );
  expect(
    await f.finance.mutation(commercial.requestContractChoice, choiceArgs),
  ).toBe(choice);
  await expect(
    f.platform.mutation(commercial.requestContractChoice, choiceArgs),
  ).rejects.toThrow("proprietor");
  const invoiceId = await f.platform.mutation(
    commercial.issueSubscriptionInvoice,
    f.invoiceArgs,
  );
  const correctionArgs = {
    schoolId: f.schoolId,
    invoiceId,
    idempotencyKey: "credit-1",
    kind: "credit" as const,
    amountMinor: -100000,
    reason: "Reviewed catalog correction",
    confirmation: "CONFIRM",
  };
  const correction = await f.platform.mutation(
    commercial.appendInvoiceCorrection,
    correctionArgs,
  );
  expect(
    await f.platform.mutation(
      commercial.appendInvoiceCorrection,
      correctionArgs,
    ),
  ).toBe(correction);
  await expect(
    f.platform.mutation(commercial.appendInvoiceCorrection, {
      ...correctionArgs,
      amountMinor: -2,
    }),
  ).rejects.toThrow("Conflicting");
  await expect(
    f.finance.mutation(commercial.appendInvoiceCorrection, correctionArgs),
  ).rejects.toThrow("Platform");
  const page = await f.finance.query(
    commercial.listSubscriptionInvoiceHistory,
    { schoolId: f.schoolId, paginationOpts: { numItems: 1, cursor: null } },
  );
  expect(page.page).toHaveLength(1);
  const summary = await f.finance.query(commercial.getGroupCommercialSummary, {
    groupId: f.groupId,
  });
  expect(summary).toMatchObject({
    scope: "proprietor",
    currencies: {
      NGN: {
        originalMinor: 3100000,
        correctionsMinor: -100000,
        effectiveMinor: 3000000,
        invoiceCount: 1,
      },
    },
  });
  expect(summary.basis).toContain("no school-fee, usage or settlement rows");
});

it("validates rates and computes explicit volume/minimum/discount/proration without hidden fees", () => {
  expect(() => validateRate({ ...rate, discountBps: 10001 })).toThrow();
  expect(() => validateRate({ ...rate, setupMinor: NaN })).toThrow();
  expect(() =>
    validateRate({
      ...rate,
      bands: [
        { fromStudents: 10, perStudentMinor: 900 },
        { fromStudents: 5, perStudentMinor: 800 },
      ],
    }),
  ).toThrow();
  expect(
    priceSnapshot(
      {
        ...rate,
        perStudentMinor: 1000,
        minimumMinor: 20000,
        bands: [{ fromStudents: 10, perStudentMinor: 900 }],
        discountBps: 1000,
      },
      10,
      1,
      2,
      false,
    ),
  ).toMatchObject({
    unitMinor: 900,
    subtotalMinor: 20000,
    proratedMinor: 10000,
    discountMinor: 1000,
    totalMinor: 9000,
  });
});
