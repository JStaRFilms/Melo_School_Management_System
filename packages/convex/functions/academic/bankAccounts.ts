import { mutation, query } from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import { resolveActiveMembership } from "./auth";
import {
  requireCapability,
  evaluateEffectiveCapabilities,
  normalizeCapability,
} from "./rbac";
import { recordAuditEventHelper } from "./audit";

/**
 * Formats bank account number with step-up masking (***-****-1234).
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber) return "";
  const cleaned = accountNumber.replace(/\s+/g, "");
  if (cleaned.length <= 4) {
    return `***-****-${cleaned}`;
  }
  const last4 = cleaned.slice(-4);
  return `***-****-${last4}`;
}

/**
 * List bank accounts for a school.
 * If user holds finance.bank.manage (or proprietor/admin), returns full account numbers.
 * Otherwise, masks account numbers to ***-****-1234.
 */
export const listBankAccounts = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    let isAuthorized = false;

    try {
      const authContext = await resolveActiveMembership(ctx, args.schoolId);
      if (authContext.isPlatformAdmin || authContext.role === "admin") {
        isAuthorized = true;
      } else if (authContext.membershipId) {
        const caps = await evaluateEffectiveCapabilities(
          ctx,
          authContext.membershipId
        );
        const normalized = caps.map(normalizeCapability);
        if (
          caps.includes("finance.bank.manage") ||
          caps.includes("finance.bank_details.manage") ||
          caps.includes("bank.manage") ||
          normalized.includes("finance.bank_details.manage")
        ) {
          isAuthorized = true;
        }
      }
    } catch {
      // Unauthenticated or not a branch member
      isAuthorized = false;
    }

    const accounts = await ctx.db
      .query("schoolBankAccounts")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    return accounts
      .filter((acc) => acc.status !== "archived")
      .map((acc) => ({
        _id: acc._id,
        bankName: acc.bankName,
        accountName: acc.accountName,
        accountNumber: isAuthorized
          ? acc.accountNumber
          : maskAccountNumber(acc.accountNumber),
        sortCode: acc.sortCode,
        currency: acc.currency,
        isDefault: acc.isDefault,
        status: acc.status,
        transferNote: acc.transferNote,
        isMasked: !isAuthorized,
      }));
  },
});

/**
 * Add a new school bank account.
 * Enforces finance.bank.manage capability and logs a Tier 1 Critical audit event.
 */
export const addBankAccount = mutation({
  args: {
    schoolId: v.id("schools"),
    bankName: v.string(),
    accountNumber: v.string(),
    accountName: v.string(),
    currency: v.string(),
    sortCode: v.optional(v.string()),
    transferNote: v.optional(v.string()),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const authContext = await requireCapability(
      ctx,
      args.schoolId,
      "finance.bank.manage"
    );

    const now = Date.now();

    // If setting as default, unset other defaults for this school
    if (args.isDefault) {
      const currentDefaults = await ctx.db
        .query("schoolBankAccounts")
        .withIndex("by_school_and_default", (q) =>
          q.eq("schoolId", args.schoolId).eq("isDefault", true)
        )
        .collect();

      for (const acc of currentDefaults) {
        await ctx.db.patch(acc._id, {
          isDefault: false,
          updatedAt: now,
        });
      }
    }

    const accountId = await ctx.db.insert("schoolBankAccounts", {
      schoolId: args.schoolId,
      bankName: args.bankName,
      accountNumber: args.accountNumber,
      accountName: args.accountName,
      sortCode: args.sortCode,
      currency: args.currency,
      isDefault: args.isDefault,
      status: "active",
      transferNote: args.transferNote,
      createdAt: now,
      updatedAt: now,
      updatedBy: authContext.userId,
    });

    // Tier 1 Critical Audit Event (MX-07)
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.role ?? "user@school",
      module: "finance",
      action: "bank_account.add",
      targetType: "schoolBankAccounts",
      targetId: accountId,
      outcome: "success",
      safeSummary: `Added bank account: ${args.bankName} (${maskAccountNumber(
        args.accountNumber
      )})`,
      alertTier: "tier1_critical",
    });

    return accountId;
  },
});

/**
 * Set the primary default bank account for a school.
 * Clears existing default and audits change with Tier 1 Critical alert.
 */
export const setPrimaryBankAccount = mutation({
  args: {
    schoolId: v.id("schools"),
    bankAccountId: v.id("schoolBankAccounts"),
  },
  handler: async (ctx, args) => {
    const authContext = await requireCapability(
      ctx,
      args.schoolId,
      "finance.bank.manage"
    );

    const account = await ctx.db.get(args.bankAccountId);
    if (!account || account.schoolId !== args.schoolId) {
      throw new ConvexError("Bank account not found for this school");
    }

    const now = Date.now();

    // Clear existing defaults
    const currentDefaults = await ctx.db
      .query("schoolBankAccounts")
      .withIndex("by_school_and_default", (q) =>
        q.eq("schoolId", args.schoolId).eq("isDefault", true)
      )
      .collect();

    for (const acc of currentDefaults) {
      if (acc._id !== args.bankAccountId) {
        await ctx.db.patch(acc._id, {
          isDefault: false,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.bankAccountId, {
      isDefault: true,
      updatedAt: now,
    });

    // Tier 1 Critical Audit Event
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.role ?? "user@school",
      module: "finance",
      action: "bank_account.set_primary",
      targetType: "schoolBankAccounts",
      targetId: args.bankAccountId,
      outcome: "success",
      safeSummary: `Set primary default bank account: ${
        account.bankName
      } (${maskAccountNumber(account.accountNumber)})`,
      alertTier: "tier1_critical",
    });

    return { success: true };
  },
});

/**
 * Snapshot payment instructions into invoice record at issue time.
 * IMMUTABLE: If instructions are already snapshotted, returns existing snapshot without modification.
 */
export const snapshotInvoicePaymentInstructions = mutation({
  args: {
    invoiceId: v.id("studentInvoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new ConvexError("Invoice not found");
    }
    await requireCapability(ctx, invoice.schoolId, "finance.invoices.issue");

    // IMMUTABILITY: An authorized caller can only read the first snapshot.
    if (invoice.paymentInstructionsSnapshot) {
      return invoice.paymentInstructionsSnapshot;
    }
    if (invoice.status !== "issued") {
      throw new ConvexError("Payment instructions can only be snapshotted for issued invoices");
    }

    const defaultAccount = await ctx.db
      .query("schoolBankAccounts")
      .withIndex("by_school_and_default", (q) =>
        q.eq("schoolId", invoice.schoolId).eq("isDefault", true)
      )
      .first();

    if (!defaultAccount || defaultAccount.status !== "active") {
      return null;
    }

    const snapshot = {
      bankAccountId: defaultAccount._id,
      bankName: defaultAccount.bankName,
      accountName: defaultAccount.accountName,
      accountNumber: defaultAccount.accountNumber,
      sortCode: defaultAccount.sortCode,
      currency: defaultAccount.currency,
      transferNote: defaultAccount.transferNote,
      snapshottedAt: Date.now(),
    };

    await ctx.db.patch(invoice._id, {
      paymentInstructionsSnapshot: snapshot,
      updatedAt: Date.now(),
    });

    return snapshot;
  },
});

/**
 * Query invoice payment view.
 * For issued/partially paid invoices: returns payment instructions.
 * For paid/settled invoices: suppresses payment instructions (D-04 §5.2.2).
 */
export const getInvoicePaymentView = query({
  args: {
    invoiceId: v.id("studentInvoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new ConvexError("Invoice not found");
    }
    await resolveActiveMembership(ctx, invoice.schoolId);

    const isSettled = invoice.status === "paid";

    if (isSettled) {
      return {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        showPaymentInstructions: false,
        paymentInstructions: null,
      };
    }

    return {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      showPaymentInstructions: true,
      paymentInstructions: invoice.paymentInstructionsSnapshot ?? null,
    };
  },
});

/**
 * Query receipt details.
 * Strictly suppresses payment instructions because payment is already complete (D-04 §5.2.2).
 */
export const getInvoiceReceipt = query({
  args: {
    invoiceId: v.id("studentInvoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new ConvexError("Invoice not found");
    }
    await resolveActiveMembership(ctx, invoice.schoolId);

    return {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      receiptIssuedAt: invoice.lastPaymentAt ?? invoice.updatedAt,
      showPaymentInstructions: false,
      paymentInstructions: null,
    };
  },
});
