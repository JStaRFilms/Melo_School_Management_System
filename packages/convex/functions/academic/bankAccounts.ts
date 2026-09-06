import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { resolveActiveMembership } from "./auth";
import { getContextCapabilities, requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";
import {
  bankMetadata,
  invoicePaymentInstructions,
} from "../foundation/bankInstructions";

export function maskAccountNumber(number: string) {
  return number ? `***-****-${number.replace(/\s/g, "").slice(-4)}` : "";
}
const accountFields = {
  bankName: v.string(),
  accountName: v.string(),
  accountNumber: v.string(),
  currency: v.string(),
  sortCode: v.optional(v.string()),
  transferNote: v.optional(v.string()),
  ...bankMetadata,
};
function validateAccount(account: {
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  sortCode?: string;
  transferNote?: string;
  label?: string;
  branch?: string;
  iban?: string;
  swift?: string;
}) {
  for (const value of [
    account.bankName,
    account.accountName,
    account.accountNumber,
  ])
    if (!value.trim() || value.length > 160)
      throw new ConvexError(
        "Bank, account name and number require 1–160 characters",
      );
  if (!/^[A-Z]{3}$/.test(account.currency))
    throw new ConvexError("Currency must be a three-letter uppercase code");
  for (const value of [
    account.sortCode,
    account.transferNote,
    account.label,
    account.branch,
    account.iban,
    account.swift,
  ])
    if (value && value.length > 500)
      throw new ConvexError("Bank metadata is too long");
}
function confirm(confirmation: string | undefined) {
  if (confirmation !== "CONFIRM")
    throw new ConvexError("Type CONFIRM to approve this sensitive bank change");
}
async function auditBank(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  id: Id<"schoolBankAccounts">,
  action: string,
  before?: string,
  after?: string,
) {
  const actor = await requireCapability(
    ctx,
    schoolId,
    "finance.bank_details.manage",
  );
  await recordAuditEventHelper(ctx, {
    schoolId,
    actorKind: "user",
    actorPersonId: actor.personId,
    actorMembershipId: actor.membershipId,
    actorEmailSnapshot: actor.role ?? "staff",
    module: "finance",
    action: `bank_account.${action}`,
    targetType: "schoolBankAccounts",
    targetId: id,
    outcome: "success",
    safeSummary: `School-confirmed bank ${action}. Previous ${before ?? "none"}; new ${after ?? "none"}.`,
    alertTier: "tier1_critical",
    retentionClass: "permanent_statutory",
  });
}
async function accountsFor(ctx: MutationCtx, schoolId: Id<"schools">) {
  const accounts = await ctx.db
    .query("schoolBankAccounts")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .take(101);
  if (accounts.length > 100)
    throw new ConvexError(
      "Account limit exceeded; administrator review required",
    );
  return accounts;
}
export const listBankAccounts = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const actor = await resolveActiveMembership(ctx, args.schoolId);
    const capabilities = await getContextCapabilities(ctx, actor);
    if (
      ![
        "finance.reports.view",
        "finance.invoices.issue",
        "finance.bank_details.manage",
      ].some((cap) => capabilities.includes(cap))
    )
      throw new ConvexError("Bank summaries access denied");
    const accounts = await ctx.db
      .query("schoolBankAccounts")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(100);
    return accounts.map((account) => ({
      _id: account._id,
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: maskAccountNumber(account.accountNumber),
      currency: account.currency,
      label: account.label,
      isDefault: account.isDefault,
      status: account.status,
      isMasked: true,
    }));
  },
});
export const getBankAccount = query({
  args: {
    schoolId: v.id("schools"),
    bankAccountId: v.id("schoolBankAccounts"),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "finance.bank_details.manage");
    const account = await ctx.db.get(args.bankAccountId);
    if (!account || account.schoolId !== args.schoolId)
      throw new ConvexError("Account unavailable");
    return account;
  },
});
export const addBankAccount = mutation({
  args: {
    schoolId: v.id("schools"),
    ...accountFields,
    isDefault: v.boolean(),
    confirmation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(
      ctx,
      args.schoolId,
      "finance.bank_details.manage",
    );
    confirm(args.confirmation);
    validateAccount(args);
    const accounts = await accountsFor(ctx, args.schoolId);
    if (accounts.length >= 100) throw new ConvexError("Maximum 100 accounts");
    if (
      accounts.some(
        (a) =>
          a.status === "active" &&
          a.accountNumber === args.accountNumber &&
          a.bankName === args.bankName &&
          a.currency === args.currency,
      )
    )
      throw new ConvexError(
        "This active bank account already exists; review the existing account",
      );
    const isDefault =
      args.isDefault ||
      !accounts.some((a) => a.status === "active" && a.isDefault);
    if (isDefault)
      for (const account of accounts)
        if (account.isDefault)
          await ctx.db.patch(account._id, {
            isDefault: false,
            updatedAt: Date.now(),
          });
    const { confirmation: _confirmation, ...fields } = args;
    void _confirmation;
    const id = await ctx.db.insert("schoolBankAccounts", {
      ...fields,
      isDefault,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updatedBy: actor.userId,
    });
    await auditBank(
      ctx,
      args.schoolId,
      id,
      "add",
      undefined,
      maskAccountNumber(args.accountNumber),
    );
    return id;
  },
});
export const editBankAccount = mutation({
  args: {
    schoolId: v.id("schools"),
    bankAccountId: v.id("schoolBankAccounts"),
    ...accountFields,
    expectedUpdatedAt: v.number(),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "finance.bank_details.manage");
    confirm(args.confirmation);
    validateAccount(args);
    const account = await ctx.db.get(args.bankAccountId);
    if (
      !account ||
      account.schoolId !== args.schoolId ||
      account.status !== "active"
    )
      throw new ConvexError("Active account unavailable");
    if (account.updatedAt !== args.expectedUpdatedAt)
      throw new ConvexError("Account changed; reload and review again");
    const {
      schoolId,
      bankAccountId,
      confirmation: _confirmation,
      expectedUpdatedAt: _version,
      ...fields
    } = args;
    void _confirmation;
    void _version;
    await ctx.db.patch(account._id, {
      ...fields,
      updatedAt: Math.max(Date.now(), account.updatedAt + 1),
    });
    await auditBank(
      ctx,
      schoolId,
      bankAccountId,
      "edit",
      maskAccountNumber(account.accountNumber),
      maskAccountNumber(args.accountNumber),
    );
    return bankAccountId;
  },
});
export const setPrimaryBankAccount = mutation({
  args: {
    schoolId: v.id("schools"),
    bankAccountId: v.id("schoolBankAccounts"),
    confirmation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "finance.bank_details.manage");
    confirm(args.confirmation);
    const accounts = await accountsFor(ctx, args.schoolId);
    const selected = accounts.find(
      (a) => a._id === args.bankAccountId && a.status === "active",
    );
    if (!selected) throw new ConvexError("Active account unavailable");
    for (const account of accounts)
      if (account.isDefault !== (account._id === selected._id))
        await ctx.db.patch(account._id, {
          isDefault: account._id === selected._id,
          updatedAt: Date.now(),
        });
    await auditBank(
      ctx,
      args.schoolId,
      selected._id,
      "set_primary",
      undefined,
      maskAccountNumber(selected.accountNumber),
    );
    return { success: true };
  },
});
export const archiveBankAccount = mutation({
  args: {
    schoolId: v.id("schools"),
    bankAccountId: v.id("schoolBankAccounts"),
    replacementId: v.optional(v.id("schoolBankAccounts")),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "finance.bank_details.manage");
    confirm(args.confirmation);
    const accounts = await accountsFor(ctx, args.schoolId);
    const account = accounts.find((a) => a._id === args.bankAccountId);
    if (!account) throw new ConvexError("Account unavailable");
    if (account.status === "archived") return null;
    const remaining = accounts.filter(
      (a) => a._id !== account._id && a.status === "active",
    );
    if (account.isDefault && remaining.length) {
      const replacement = remaining.find((a) => a._id === args.replacementId);
      if (!replacement)
        throw new ConvexError(
          "Select an active replacement default before archiving",
        );
      for (const row of accounts)
        if (row._id !== account._id)
          await ctx.db.patch(row._id, {
            isDefault: row._id === replacement._id,
            updatedAt: Date.now(),
          });
    }
    await ctx.db.patch(account._id, {
      status: "archived",
      isDefault: false,
      updatedAt: Date.now(),
    });
    await auditBank(
      ctx,
      args.schoolId,
      account._id,
      "archive",
      maskAccountNumber(account.accountNumber),
    );
    return null;
  },
});

/** Only the invoice issuance transaction may call this helper; never repair old invoices from current accounts. */
export async function snapshotInvoicePaymentInstructionsHelper(
  ctx: MutationCtx,
  invoiceId: Id<"studentInvoices">,
  bankAccountId?: Id<"schoolBankAccounts">,
) {
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice) throw new ConvexError("Invoice not found");
  if (invoice.paymentInstructionsSnapshot)
    return invoice.paymentInstructionsSnapshot;
  if (invoice.balanceDue <= 0 || invoice.status === "waived") return null;
  if (!["issued", "overdue"].includes(invoice.status))
    throw new ConvexError("Invoice is not being issued");
  const account = bankAccountId
    ? await ctx.db.get(bankAccountId)
    : await ctx.db
        .query("schoolBankAccounts")
        .withIndex("by_school_and_default", (q) =>
          q.eq("schoolId", invoice.schoolId).eq("isDefault", true),
        )
        .unique();
  if (!account) {
    if (bankAccountId) throw new ConvexError("Selected account unavailable");
    return null;
  }
  if (
    account.schoolId !== invoice.schoolId ||
    account.status !== "active" ||
    account.currency !== invoice.currency
  )
    throw new ConvexError(
      "Select an active school account matching invoice currency",
    );
  const snapshot: NonNullable<
    Doc<"studentInvoices">["paymentInstructionsSnapshot"]
  > = {
    bankAccountId: account._id,
    bankName: account.bankName,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    currency: account.currency,
    sortCode: account.sortCode,
    transferNote: account.transferNote,
    label: account.label,
    branch: account.branch,
    iban: account.iban,
    swift: account.swift,
    snapshottedAt: Date.now(),
  };
  await ctx.db.patch(invoiceId, { paymentInstructionsSnapshot: snapshot });
  return snapshot;
}
/** Compatibility endpoint cannot manufacture historical snapshots. */
export const snapshotInvoicePaymentInstructions = internalMutation({
  args: { invoiceId: v.id("studentInvoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new ConvexError("Invoice not found");
    if (invoice.status === "draft" || invoice.status === "cancelled")
      throw new ConvexError(
        "Payment instructions require payable issued invoices",
      );
    return invoice.paymentInstructionsSnapshot ?? null;
  },
});
export const getInvoicePaymentView = query({
  args: { invoiceId: v.id("studentInvoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new ConvexError("Invoice not found");
    await requireCapability(ctx, invoice.schoolId, "finance.reports.view");
    const instructions = invoicePaymentInstructions(invoice);
    return {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      showPaymentInstructions: instructions !== null,
      paymentInstructions: instructions,
    };
  },
});
export const getInvoiceReceipt = query({
  args: { invoiceId: v.id("studentInvoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new ConvexError("Invoice not found");
    await requireCapability(ctx, invoice.schoolId, "finance.reports.view");
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
