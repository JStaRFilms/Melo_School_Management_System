import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../**/*.ts", "!../**/*.test.ts"])).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);
const adminIdentity = {
  subject: "selectable-admin",
  tokenIdentifier: "https://auth.school.test|selectable-admin",
};
const parentIdentity = {
  subject: "selectable-parent",
  tokenIdentifier: "https://auth.school.test|selectable-parent",
};

async function setupFixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", {
      name: "Selectable School",
      slug: "selectable-school",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const adminId = await ctx.db.insert("users", {
      schoolId,
      authId: adminIdentity.subject,
      authTokenIdentifier: adminIdentity.tokenIdentifier,
      name: "Billing Admin",
      email: "admin@selectable.test",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });
    const parentPersonId = await ctx.db.insert("persons", {
      authTokenIdentifier: parentIdentity.tokenIdentifier,
      name: "Linked Parent",
      email: "parent@selectable.test",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });
    const parentId = await ctx.db.insert("users", {
      schoolId,
      personId: parentPersonId,
      authId: parentIdentity.subject,
      authTokenIdentifier: parentIdentity.tokenIdentifier,
      name: "Linked Parent",
      email: "parent@selectable.test",
      role: "parent",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("branchMemberships", {
      schoolId,
      personId: parentPersonId,
      legacyUserId: parentId,
      isDefaultBranch: true,
      status: "active",
      joinedAt: now,
      updatedAt: now,
    });
    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "Primary 2",
      gradeName: "Primary 2",
      level: "Primary",
      createdAt: now,
      updatedAt: now,
    });
    const otherClassId = await ctx.db.insert("classes", {
      schoolId,
      name: "Primary 3",
      gradeName: "Primary 3",
      level: "Primary",
      createdAt: now,
      updatedAt: now,
    });
    const familyId = await ctx.db.insert("families", {
      schoolId,
      name: "Selectable Family",
      createdAt: now,
      updatedAt: now,
      createdBy: adminId,
      updatedBy: adminId,
    });
    await ctx.db.insert("familyMembers", {
      schoolId,
      familyId,
      parentUserId: parentId,
      relationship: "guardian",
      isPrimaryContact: true,
      createdAt: now,
      updatedAt: now,
      createdBy: adminId,
      updatedBy: adminId,
    });
    const studentIds = [];
    for (const [index, name] of ["Amara", "Kelechi"].entries()) {
      const userId = await ctx.db.insert("users", {
        schoolId,
        authId: `selectable-student-${index}`,
        authTokenIdentifier: `https://auth.school.test|selectable-student-${index}`,
        name,
        email: `${name.toLowerCase()}@selectable.test`,
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      studentIds.push(await ctx.db.insert("students", {
        schoolId,
        classId,
        userId,
        familyId,
        admissionNumber: `SEL-${index + 1}`,
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      }));
      if (index === 0) {
        const personId = await ctx.db.insert("persons", {
          authTokenIdentifier: `https://auth.school.test|selectable-student-${index}`,
          name,
          email: `${name.toLowerCase()}@selectable.test`,
          status: "active",
          primarySchoolId: schoolId,
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.patch(userId, { personId });
        await ctx.db.insert("branchMemberships", {
          schoolId,
          personId,
          legacyUserId: userId,
          isDefaultBranch: true,
          status: "active",
          joinedAt: now,
          updatedAt: now,
        });
      }
    }
    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId,
      name: "2026/2027",
      startDate: now,
      endDate: now + 365 * 86_400_000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const termId = await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId,
      name: "First Term",
      startDate: now,
      endDate: now + 90 * 86_400_000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const bankAccountId = await ctx.db.insert("schoolBankAccounts", {
      schoolId,
      bankName: "School Bank",
      accountNumber: "0123456789",
      accountName: "Selectable School",
      currency: "NGN",
      isDefault: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
      updatedBy: adminId,
    });
    await ctx.db.insert("schoolBillingSettings", {
      schoolId,
      invoicePrefix: "SEL",
      defaultCurrency: "NGN",
      defaultDueDays: 21,
      preferredProvider: "manual",
      paymentProviderMode: "test",
      allowManualPayments: true,
      allowOnlinePayments: false,
      createdAt: now,
      updatedAt: now,
      updatedBy: adminId,
    });
    return {
      schoolId,
      adminId,
      parentId,
      classId,
      otherClassId,
      studentIds,
      sessionId,
      termId,
      bankAccountId,
    };
  });
  return { t, ids };
}

async function createCollection(
  t: Awaited<ReturnType<typeof setupFixture>>["t"],
  ids: Awaited<ReturnType<typeof setupFixture>>["ids"],
) {
  return await t.withIdentity(adminIdentity).mutation(api.functions.billing.createSelectableBillingCollection, {
    name: "Primary books",
    description: "Workbooks",
    currency: "NGN",
    bankAccountId: ids.bankAccountId,
    targetClassIds: [ids.classId],
    items: [
      { label: "Mathematics workbook", unitAmount: 4500, category: "other" },
      { label: "Reading anthology", unitAmount: 3000, category: "other" },
    ],
  });
}

describe("selectable billing contracts", () => {
  it("lists eligible catalog rows without creating debt, then creates one immutable positive Parent invoice", async () => {
    const { t, ids } = await setupFixture();
    const collection = await createCollection(t, ids);
    const parent = t.withIdentity(parentIdentity);

    const eligible = await parent.query(api.functions.portal.listEligibleSelectableBillingCollections, {
      studentId: ids.studentIds[0],
      sessionId: ids.sessionId,
      termId: ids.termId,
    });
    expect(eligible.collections).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("studentInvoices").withIndex("by_student", (q) => q.eq("studentId", ids.studentIds[0])).collect())).toEqual([]);

    await expect(parent.mutation(api.functions.portal.createSelectableInvoice, {
      requestKey: "parent-empty-request",
      studentId: ids.studentIds[0],
      collectionId: collection._id,
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections: [],
    })).rejects.toThrow(/Select between 1 and 100 items/);
    for (const quantity of [0, -1, 1.5, 10000]) {
      await expect(parent.mutation(api.functions.portal.createSelectableInvoice, {
        requestKey: `bad-quantity-${quantity}`,
        studentId: ids.studentIds[0],
        collectionId: collection._id,
        sessionId: ids.sessionId,
        termId: ids.termId,
        selections: [{ itemId: collection.items[0]._id, quantity }],
      })).rejects.toThrow(/whole number from 1 to 9999/);
    }
    await expect(parent.mutation(api.functions.portal.createSelectableInvoice, {
      requestKey: "duplicate-item-request",
      studentId: ids.studentIds[0],
      collectionId: collection._id,
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections: [
        { itemId: collection.items[0]._id, quantity: 1 },
        { itemId: collection.items[0]._id, quantity: 2 },
      ],
    })).rejects.toThrow(/only once/);

    const selections = [
      { itemId: collection.items[0]._id, quantity: 2 },
      { itemId: collection.items[1]._id, quantity: 1 },
    ];
    const created = await parent.mutation(api.functions.portal.createSelectableInvoice, {
      requestKey: "parent-order-0001",
      studentId: ids.studentIds[0],
      collectionId: collection._id,
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections,
    });
    expect(created.replayed).toBe(false);
    expect(created.invoice).toMatchObject({
      totalAmount: 12000,
      balanceDue: 12000,
      selectionRevision: null,
      canEditOptionalItems: false,
    });
    const collectionDashboard = await t.withIdentity(adminIdentity).query(
      api.functions.billing.getBillingDashboard,
      {},
    );
    expect(collectionDashboard.invoices[0].invoice).toMatchObject({
      _id: created.invoice.invoiceId,
      canEditOptionalItems: false,
      selectionLockReason: "not_editable",
    });
    await expect(parent.mutation(api.functions.portal.createSelectableInvoice, {
      requestKey: "parent-order-0002",
      studentId: ids.studentIds[0],
      collectionId: collection._id,
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections,
    })).rejects.toThrow(/already exists/);
    await expect(t.withIdentity({
      subject: "selectable-student-0",
      tokenIdentifier: "https://auth.school.test|selectable-student-0",
    }).query(api.functions.portal.listEligibleSelectableBillingCollections, {
      studentId: ids.studentIds[0],
      sessionId: ids.sessionId,
      termId: ids.termId,
    })).rejects.toThrow(/linked parent or guardian/);

    const stored = await t.run((ctx) => ctx.db.get(created.invoice.invoiceId));
    expect(stored).not.toHaveProperty("feePlanId");
    expect(stored).toMatchObject({
      selectableCollectionId: collection._id,
      subtotal: 12000,
      totalAmount: 12000,
      balanceDue: 12000,
      paymentInstructionsSnapshot: { bankAccountId: ids.bankAccountId },
      installmentSchedule: [{ label: "Full payment", amount: 12000 }],
    });
    expect(stored?.lineItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Mathematics workbook", unitAmount: 4500, quantity: 2, amount: 9000 }),
      expect.objectContaining({ label: "Reading anthology", unitAmount: 3000, quantity: 1, amount: 3000 }),
    ]));

    await t.run(async (ctx) => {
      await ctx.db.patch(collection._id, { name: "Renamed catalog", isActive: false });
      await ctx.db.patch(collection.items[0]._id, { label: "Renamed workbook", unitAmount: 9999, isActive: false });
    });
    expect((await t.run((ctx) => ctx.db.get(created.invoice.invoiceId)))?.lineItems).toEqual(stored?.lineItems);

    const replay = await parent.mutation(api.functions.portal.createSelectableInvoice, {
      requestKey: "parent-order-0001",
      studentId: ids.studentIds[0],
      collectionId: collection._id,
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections: [...selections].reverse(),
    });
    expect(replay).toMatchObject({ replayed: true, invoice: { invoiceId: created.invoice.invoiceId } });
  });

  it("keeps Admin batch issuance idempotent and separates created, replayed, and duplicate recipients", async () => {
    const { t, ids } = await setupFixture();
    const collection = await createCollection(t, ids);
    const admin = t.withIdentity(adminIdentity);
    const selection = [{ itemId: collection.items[0]._id, quantity: 1 }];

    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("studentInvoices", {
        schoolId: ids.schoolId,
        selectableCollectionId: collection._id,
        studentId: ids.studentIds[0],
        classId: ids.classId,
        sessionId: ids.sessionId,
        termId: ids.termId,
        invoiceNumber: "EXISTING",
        feePlanNameSnapshot: collection.name,
        currency: "NGN",
        lineItems: [{ id: "existing", label: "Existing", amount: 1, category: "other", order: 0, isOptional: true, isSelected: true }],
        installmentSchedule: [{ id: "inst-1", label: "Full payment", dueAt: now, amount: 1, isPaid: false }],
        subtotal: 1,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 1,
        amountPaid: 0,
        balanceDue: 1,
        status: "issued",
        dueDate: now,
        issuedAt: now,
        issuedBy: ids.adminId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const first = await admin.mutation(api.functions.billing.issueSelectableBillingItems, {
      requestKey: "admin-batch-0001",
      collectionId: collection._id,
      studentIds: ids.studentIds,
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections: selection,
    });
    expect(first.createdInvoices).toHaveLength(1);
    expect(first.replayedInvoices).toHaveLength(0);
    expect(first.skippedExistingStudentIds).toEqual([ids.studentIds[0]]);

    const retry = await admin.mutation(api.functions.billing.issueSelectableBillingItems, {
      requestKey: "admin-batch-0001",
      collectionId: collection._id,
      studentIds: ids.studentIds,
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections: selection,
    });
    expect(retry.createdInvoices).toHaveLength(0);
    expect(retry.replayedInvoices.map((invoice) => invoice._id)).toEqual([first.createdInvoices[0]._id]);
    expect(retry.skippedExistingStudentIds).toEqual([ids.studentIds[0]]);

    await expect(admin.mutation(api.functions.billing.issueSelectableBillingItems, {
      requestKey: "admin-batch-0001",
      collectionId: collection._id,
      studentIds: [ids.studentIds[1]],
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections: [{ itemId: collection.items[0]._id, quantity: 2 }],
    })).rejects.toThrow(/different invoice request/);
  });

  it("rejects a cross-tenant student before revealing colliding request-key history", async () => {
    const { t, ids } = await setupFixture();
    const collection = await createCollection(t, ids);
    const otherStudentId = await t.run(async (ctx) => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", {
        name: "Other School",
        slug: "other-request-school",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const userId = await ctx.db.insert("users", {
        schoolId,
        authId: "other-request-student",
        name: "Other Student",
        email: "student@other-request.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const adminId = await ctx.db.insert("users", {
        schoolId,
        authId: "other-request-admin",
        name: "Other Admin",
        email: "admin@other-request.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      const classId = await ctx.db.insert("classes", {
        schoolId,
        name: "Primary 2",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const studentId = await ctx.db.insert("students", {
        schoolId,
        classId,
        userId,
        admissionNumber: "OTHER-1",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });
      const sessionId = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "2026/2027",
        startDate: now,
        endDate: now + 365 * 86_400_000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const termId = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId,
        name: "First Term",
        startDate: now,
        endDate: now + 90 * 86_400_000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const otherCollectionId = await ctx.db.insert("selectableBillingCollections", {
        schoolId,
        name: "Other collection",
        currency: "NGN",
        targetClassIds: [classId],
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: adminId,
        updatedBy: adminId,
      });
      await ctx.db.insert("studentInvoices", {
        schoolId,
        selectableCollectionId: otherCollectionId,
        studentId,
        classId,
        sessionId,
        termId,
        invoiceNumber: "OTHER-REQUEST-1",
        feePlanNameSnapshot: "Other collection",
        currency: "NGN",
        lineItems: [{ id: "other-item", label: "Other item", amount: 1, category: "other", order: 0 }],
        installmentSchedule: [{ id: "inst-1", label: "Full payment", dueAt: now, amount: 1, isPaid: false }],
        subtotal: 1,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 1,
        amountPaid: 0,
        balanceDue: 1,
        status: "issued",
        dueDate: now,
        issuedAt: now,
        issuedBy: adminId,
        creationRequestKey: "cross-tenant-collision",
        creationRequestFingerprint: "private-other-tenant-fingerprint",
        createdAt: now,
        updatedAt: now,
      });
      return studentId;
    });

    await expect(t.withIdentity(adminIdentity).mutation(api.functions.billing.issueSelectableBillingItems, {
      requestKey: "cross-tenant-collision",
      collectionId: collection._id,
      studentIds: [otherStudentId],
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections: [{ itemId: collection.items[0]._id, quantity: 1 }],
    })).rejects.toThrow(/Student not found/);
  });

  it("starts parent-selectable fee-plan options unselected and enforces revisions plus permanent payment locks", async () => {
    const { t, ids } = await setupFixture();
    const admin = t.withIdentity(adminIdentity);
    const plan = await admin.mutation(api.functions.billing.createFeePlan, {
      name: "Term fees",
      billingMode: "class_default",
      targetClassIds: [ids.classId],
      optionalSelectionMode: "parent_selectable",
      lineItems: [
        { label: "Tuition", amount: 10000, category: "tuition" },
        { label: "Club", amount: 2500, category: "activity", isOptional: true },
      ],
    });
    expect(plan.lineItems[1]).toMatchObject({ isOptional: true, isSelected: false });
    const invoice = await admin.mutation(api.functions.billing.createInvoiceFromFeePlan, {
      feePlanId: plan._id,
      studentId: ids.studentIds[0],
      classId: ids.classId,
      sessionId: ids.sessionId,
      termId: ids.termId,
    });
    expect(invoice).toMatchObject({ subtotal: 10000, totalAmount: 10000, selectionRevision: 0 });
    const editableDashboard = await admin.query(api.functions.billing.getBillingDashboard, {});
    expect(editableDashboard.invoices[0].invoice).toMatchObject({
      _id: invoice._id,
      canEditOptionalItems: true,
      selectionLockReason: null,
    });

    const parent = t.withIdentity(parentIdentity);
    const updated = await parent.mutation(api.functions.portal.updateInvoiceOptionalSelections, {
      invoiceId: invoice._id,
      expectedSelectionRevision: 0,
      selections: [{ lineItemId: plan.lineItems[1].id, isSelected: true }],
    });
    expect(updated).toMatchObject({
      changed: true,
      invoice: { totalAmount: 12500, balanceDue: 12500, selectionRevision: 1 },
    });
    expect(updated.invoice.lineItems[1]).toMatchObject({ isSelected: true });
    expect((await t.run((ctx) => ctx.db.get(invoice._id)))?.installmentSchedule[0].amount).toBe(12500);

    await expect(admin.mutation(api.functions.billing.updateInvoiceOptionalSelections, {
      invoiceId: invoice._id,
      expectedSelectionRevision: 0,
      selections: [{ lineItemId: plan.lineItems[1].id, isSelected: false }],
    })).rejects.toThrow(/another session/);
    await expect(t.mutation(internal.functions.billing.recordBillingPaymentAttemptGeneratedInternal, {
      schoolId: ids.schoolId,
      invoiceId: invoice._id,
      provider: "paystack",
      reference: "STALE-CHECKOUT",
      expectedSelectionRevision: 0,
      expectedInvoiceBalance: 12500,
    })).rejects.toThrow(/changed before checkout/);
    await expect(t.mutation(internal.functions.billing.recordBillingPaymentAttemptGeneratedInternal, {
      schoolId: ids.schoolId,
      invoiceId: invoice._id,
      provider: "paystack",
      reference: "STALE-AMOUNT",
      amount: 10000,
      expectedSelectionRevision: 1,
      expectedInvoiceBalance: 12500,
    })).rejects.toThrow(/amount no longer matches/);

    await t.run(async (ctx) => {
      const now = Date.now();
      const paymentId = await ctx.db.insert("billingPayments", {
        schoolId: ids.schoolId,
        invoiceId: invoice._id,
        reference: "LOCK-ALLOCATION",
        provider: "manual",
        paymentMethod: "cash",
        amountReceived: 0,
        amountApplied: 0,
        unappliedAmount: 0,
        applicationStatus: "unapplied",
        status: "reversed",
        receivedAt: now,
        recordedBy: ids.adminId,
        reconciliationStatus: "unreconciled",
        reconciledBy: null,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("paymentAllocations", {
        schoolId: ids.schoolId,
        invoiceId: invoice._id,
        paymentId,
        amountApplied: 0,
        createdAt: now,
        createdBy: ids.adminId,
      });
    });
    await expect(parent.mutation(api.functions.portal.updateInvoiceOptionalSelections, {
      invoiceId: invoice._id,
      expectedSelectionRevision: 1,
      selections: [{ lineItemId: plan.lineItems[1].id, isSelected: false }],
    })).rejects.toThrow(/locked after payment/);
    const billingData = await parent.query(api.functions.portal.getBillingData, { studentId: ids.studentIds[0] });
    expect(billingData.invoices[0]).toMatchObject({
      selectionRevision: 1,
      canEditOptionalItems: false,
      selectionLockReason: "payment_recorded",
    });
    const allocationLockedDashboard = await admin.query(api.functions.billing.getBillingDashboard, {});
    expect(allocationLockedDashboard.invoices[0].invoice).toMatchObject({
      _id: invoice._id,
      amountPaid: 0,
      canEditOptionalItems: false,
      selectionLockReason: "payment_recorded",
    });
  });

  it("fails closed for wrong-class and cross-school identifiers", async () => {
    const { t, ids } = await setupFixture();
    const collection = await createCollection(t, ids);
    await t.run((ctx) => ctx.db.patch(ids.studentIds[0], { classId: ids.otherClassId }));
    await expect(t.withIdentity(parentIdentity).mutation(api.functions.portal.createSelectableInvoice, {
      requestKey: "wrong-class-0001",
      studentId: ids.studentIds[0],
      collectionId: collection._id,
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections: [{ itemId: collection.items[0]._id, quantity: 1 }],
    })).rejects.toThrow(/not eligible/);

    const otherSchoolItem = await t.run(async (ctx) => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-selectable", status: "active", createdAt: now, updatedAt: now });
      const collectionId = await ctx.db.insert("selectableBillingCollections", {
        schoolId,
        name: "Other collection",
        currency: "NGN",
        targetClassIds: [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ids.adminId,
        updatedBy: ids.adminId,
      });
      return await ctx.db.insert("selectableBillingItems", {
        schoolId,
        collectionId,
        label: "Other item",
        unitAmount: 10,
        category: "other",
        order: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ids.adminId,
        updatedBy: ids.adminId,
      });
    });
    await expect(t.withIdentity(adminIdentity).mutation(api.functions.billing.issueSelectableBillingItems, {
      requestKey: "cross-school-0001",
      collectionId: collection._id,
      studentIds: [ids.studentIds[1]],
      sessionId: ids.sessionId,
      termId: ids.termId,
      selections: [{ itemId: otherSchoolItem, quantity: 1 }],
    })).rejects.toThrow(/not found/);
  });
});
