import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { snapshotInvoicePaymentInstructionsHelper } from "./academic/bankAccounts";
import {
  billingContractError,
  buildSelectableInvoiceFingerprint,
  computeBillingInvoiceTotal,
  deriveBillingInvoiceStatus,
  generateBillingInvoiceNumber,
  invoiceHasOptionalSelectionRows,
  MAX_SELECTABLE_BILLING_ITEMS,
  MAX_STUDENT_INVOICE_HISTORY,
  normalizeBillingAmount,
  normalizeBillingText,
  normalizeSelectableRequestKey,
  normalizeSelectableSelections,
  redistributeBillingInstallments,
} from "./billingShared";

type BillingCtx = QueryCtx | MutationCtx;
type BillingCategory = Doc<"selectableBillingItems">["category"];
type Selection = { itemId: Id<"selectableBillingItems">; quantity: number };

export function selectableCollectionItemProjection(item: Doc<"selectableBillingItems">) {
  return {
    _id: item._id,
    label: item.label,
    description: item.description ?? null,
    unitAmount: item.unitAmount,
    category: item.category,
    order: item.order,
    isActive: item.isActive,
  };
}

export async function selectableCollectionProjection(
  ctx: BillingCtx,
  collection: Doc<"selectableBillingCollections">,
) {
  const items = await ctx.db
    .query("selectableBillingItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .take(MAX_SELECTABLE_BILLING_ITEMS + 1);
  if (items.length > MAX_SELECTABLE_BILLING_ITEMS) {
    throw billingContractError("VALIDATION_FAILED", "Collection item count exceeds supported bounds");
  }

  const targetClasses = await Promise.all(collection.targetClassIds.map((classId) => ctx.db.get(classId)));
  return {
    _id: collection._id,
    schoolId: collection.schoolId,
    bankAccountId: collection.bankAccountId ?? null,
    name: collection.name,
    description: collection.description ?? null,
    currency: collection.currency,
    targetClassIds: collection.targetClassIds,
    targetClasses: targetClasses
      .filter((classDoc): classDoc is Doc<"classes"> => Boolean(classDoc && classDoc.schoolId === collection.schoolId))
      .map((classDoc) => ({ _id: classDoc._id, name: classDoc.name })),
    isActive: collection.isActive,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    items: items
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
      .map(selectableCollectionItemProjection),
  };
}

export async function findCollectionInvoiceRequest(args: {
  ctx: BillingCtx;
  studentId: Id<"students">;
  requestKey: string;
  fingerprint: string;
}) {
  const history = await args.ctx.db
    .query("studentInvoices")
    .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
    .take(MAX_STUDENT_INVOICE_HISTORY + 1);
  if (history.length > MAX_STUDENT_INVOICE_HISTORY) {
    throw billingContractError(
      "VALIDATION_FAILED",
      "Student invoice history exceeds supported bounds and needs review",
    );
  }
  const requestInvoice = history.find((invoice) => invoice.creationRequestKey === args.requestKey);
  if (requestInvoice && requestInvoice.creationRequestFingerprint !== args.fingerprint) {
    throw billingContractError(
      "IDEMPOTENCY_CONFLICT",
      "This request key was already used for a different invoice request",
    );
  }
  return { history, requestInvoice: requestInvoice ?? null };
}

export function buildCollectionInvoiceRequest(args: {
  actorKind: "parent" | "admin";
  actorUserId: Id<"users">;
  schoolId: Id<"schools">;
  studentId: Id<"students">;
  collectionId: Id<"selectableBillingCollections">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  requestedDueDate?: number;
  requestKey: string;
  selections: Selection[];
}) {
  const requestKey = normalizeSelectableRequestKey(args.requestKey);
  const selections = normalizeSelectableSelections(args.selections);
  const fingerprint = buildSelectableInvoiceFingerprint({
    actorKind: args.actorKind,
    actorUserId: String(args.actorUserId),
    schoolId: String(args.schoolId),
    studentId: String(args.studentId),
    collectionId: String(args.collectionId),
    sessionId: String(args.sessionId),
    termId: String(args.termId),
    requestedDueDate: args.requestedDueDate ?? null,
    selections: selections.map((selection) => ({
      itemId: String(selection.itemId),
      quantity: selection.quantity,
    })),
  });
  return { requestKey, selections, fingerprint };
}

export async function validateSelectableInvoiceContext(args: {
  ctx: BillingCtx;
  schoolId: Id<"schools">;
  studentId: Id<"students">;
  collectionId: Id<"selectableBillingCollections">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  selections: Selection[];
  bankAccountId?: Id<"schoolBankAccounts">;
}) {
  const [student, collection, session, term] = await Promise.all([
    args.ctx.db.get(args.studentId),
    args.ctx.db.get(args.collectionId),
    args.ctx.db.get(args.sessionId),
    args.ctx.db.get(args.termId),
  ]);
  if (!student || student.schoolId !== args.schoolId) {
    throw billingContractError("NOT_FOUND", "Student not found");
  }
  if (student.isArchived || student.enrollmentStatus !== "active") {
    throw billingContractError("VALIDATION_FAILED", "Student enrollment is not active");
  }
  const classDoc = await args.ctx.db.get(student.classId);
  if (!classDoc || classDoc.schoolId !== args.schoolId || classDoc.isArchived) {
    throw billingContractError("NOT_FOUND", "Student class not found");
  }
  if (!collection || collection.schoolId !== args.schoolId) {
    throw billingContractError("NOT_FOUND", "Selectable billing collection not found");
  }
  if (!collection.isActive) {
    throw billingContractError("VALIDATION_FAILED", "Selectable billing collection is inactive");
  }
  if (!collection.targetClassIds.some((classId) => classId === student.classId)) {
    throw billingContractError("VALIDATION_FAILED", "Student class is not eligible for this collection");
  }
  if (!session || session.schoolId !== args.schoolId || session.isArchived) {
    throw billingContractError("NOT_FOUND", "Academic session not found");
  }
  if (!term || term.schoolId !== args.schoolId || term.isArchived || term.sessionId !== session._id) {
    throw billingContractError("NOT_FOUND", "Academic term not found in the selected session");
  }

  const selectedItems = await Promise.all(args.selections.map((selection) => args.ctx.db.get(selection.itemId)));
  const snapshots = selectedItems.map((item, index) => {
    const selection = args.selections[index];
    if (
      !item ||
      item.schoolId !== args.schoolId ||
      item.collectionId !== collection._id
    ) {
      throw billingContractError("NOT_FOUND", "Selectable billing item not found");
    }
    if (!item.isActive) {
      throw billingContractError("VALIDATION_FAILED", "A selected item is inactive");
    }
    const amount = normalizeBillingAmount(item.unitAmount * selection.quantity);
    if (!Number.isFinite(item.unitAmount) || item.unitAmount <= 0 || amount <= 0) {
      throw billingContractError("ZERO_VALUE_INVOICE", "Selected items must have a total greater than zero");
    }
    return {
      id: `collection-${String(item._id)}`,
      label: item.label,
      amount,
      category: item.category as BillingCategory,
      order: item.order,
      isOptional: true,
      isSelected: true,
      sourceSelectableItemId: item._id,
      unitAmount: item.unitAmount,
      quantity: selection.quantity,
    };
  }).sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));

  const total = computeBillingInvoiceTotal({ lineItems: snapshots });
  if (total.totalAmount <= 0) {
    throw billingContractError("ZERO_VALUE_INVOICE", "Selected items must have a total greater than zero");
  }

  const bankAccountId = args.bankAccountId ?? collection.bankAccountId;
  if (bankAccountId) {
    const bankAccount = await args.ctx.db.get(bankAccountId);
    if (
      !bankAccount ||
      bankAccount.schoolId !== args.schoolId ||
      bankAccount.status !== "active" ||
      bankAccount.currency !== collection.currency
    ) {
      throw billingContractError(
        "VALIDATION_FAILED",
        `Choose an active settlement account in ${collection.currency}, or use the school default`,
      );
    }
  }

  return { student, classDoc, collection, session, term, snapshots, total, bankAccountId };
}

export function findDuplicateCollectionInvoice(
  history: Doc<"studentInvoices">[],
  args: {
    collectionId: Id<"selectableBillingCollections">;
    sessionId: Id<"academicSessions">;
    termId: Id<"academicTerms">;
  },
) {
  return history.find((invoice) =>
    invoice.selectableCollectionId === args.collectionId &&
    invoice.sessionId === args.sessionId &&
    invoice.termId === args.termId &&
    invoice.status !== "cancelled"
  ) ?? null;
}

export async function createSelectableInvoiceRecord(args: {
  ctx: MutationCtx;
  school: Doc<"schools">;
  settings: Doc<"schoolBillingSettings"> | null;
  actorUserId: Id<"users">;
  requestKey: string;
  fingerprint: string;
  dueDate?: number;
  notes?: string;
  context: Awaited<ReturnType<typeof validateSelectableInvoiceContext>>;
}) {
  const issuedAt = Date.now();
  const dueDate = args.dueDate ?? issuedAt + Math.max(1, args.settings?.defaultDueDays ?? 14) * 86_400_000;
  const invoiceId = await args.ctx.db.insert("studentInvoices", {
    schoolId: args.school._id,
    selectableCollectionId: args.context.collection._id,
    studentId: args.context.student._id,
    classId: args.context.classDoc._id,
    sessionId: args.context.session._id,
    termId: args.context.term._id,
    invoiceNumber: "",
    feePlanNameSnapshot: args.context.collection.name,
    currency: args.context.collection.currency,
    lineItems: args.context.snapshots,
    installmentSchedule: [{
      id: "inst-1",
      label: "Full payment",
      dueAt: dueDate,
      amount: args.context.total.totalAmount,
      isPaid: false,
    }],
    subtotal: args.context.total.subtotal,
    waiverAmount: 0,
    discountAmount: 0,
    totalAmount: args.context.total.totalAmount,
    amountPaid: 0,
    balanceDue: args.context.total.totalAmount,
    status: deriveBillingInvoiceStatus({
      totalAmount: args.context.total.totalAmount,
      amountPaid: 0,
      dueDate,
      now: issuedAt,
    }),
    dueDate,
    issuedAt,
    issuedBy: args.actorUserId,
    ...(normalizeBillingText(args.notes) ? { notes: normalizeBillingText(args.notes) } : {}),
    creationRequestKey: args.requestKey,
    creationRequestFingerprint: args.fingerprint,
    createdAt: issuedAt,
    updatedAt: issuedAt,
  });
  await snapshotInvoicePaymentInstructionsHelper(args.ctx, invoiceId, args.context.bankAccountId);
  const prefix = normalizeBillingText(args.settings?.invoicePrefix) ?? args.school.slug.trim().toUpperCase();
  await args.ctx.db.patch("studentInvoices", invoiceId, {
    invoiceNumber: generateBillingInvoiceNumber({ prefix, invoiceId: String(invoiceId) }),
    updatedAt: Date.now(),
  });
  const invoice = await args.ctx.db.get("studentInvoices", invoiceId);
  if (!invoice) throw billingContractError("NOT_FOUND", "Invoice not found after creation");
  return invoice;
}

export async function updateOptionalInvoiceSelections(args: {
  ctx: MutationCtx;
  invoice: Doc<"studentInvoices">;
  expectedSelectionRevision: number;
  selections: Array<{ lineItemId: string; isSelected: boolean }>;
}) {
  if (!invoiceHasOptionalSelectionRows(args.invoice) || !args.invoice.feePlanId) {
    throw billingContractError("VALIDATION_FAILED", "Invoice does not have editable optional items");
  }
  const feePlan = await args.ctx.db.get(args.invoice.feePlanId);
  if (
    !feePlan ||
    feePlan.schoolId !== args.invoice.schoolId ||
    (feePlan.billingMode ?? "class_default") !== "class_default"
  ) {
    throw billingContractError("VALIDATION_FAILED", "Invoice fee-plan source is not editable");
  }
  const currentRevision = args.invoice.selectionRevision ?? 0;
  if (!Number.isInteger(args.expectedSelectionRevision) || args.expectedSelectionRevision !== currentRevision) {
    throw billingContractError(
      "SELECTION_CONFLICT",
      "Invoice choices changed in another session",
      { currentRevision },
    );
  }
  if (args.invoice.status === "cancelled") {
    throw billingContractError("SELECTION_LOCKED", "Invoice choices are locked", { reason: "cancelled" });
  }
  const allocation = await args.ctx.db
    .query("paymentAllocations")
    .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoice._id))
    .first();
  if (args.invoice.amountPaid > 0 || allocation) {
    throw billingContractError("SELECTION_LOCKED", "Invoice choices are locked after payment", { reason: "payment_recorded" });
  }
  if (args.invoice.status === "paid") {
    throw billingContractError("SELECTION_LOCKED", "Invoice choices are locked after payment", { reason: "payment_recorded" });
  }
  if (args.selections.length === 0 || args.selections.length > MAX_SELECTABLE_BILLING_ITEMS) {
    throw billingContractError("VALIDATION_FAILED", "Select at least one optional invoice item to update");
  }
  if (new Set(args.selections.map((selection) => selection.lineItemId)).size !== args.selections.length) {
    throw billingContractError("VALIDATION_FAILED", "Each invoice item may be updated only once");
  }
  const byId = new Map(args.invoice.lineItems.map((item) => [item.id, item]));
  for (const selection of args.selections) {
    const item = byId.get(selection.lineItemId);
    if (!item || item.isOptional !== true) {
      throw billingContractError("VALIDATION_FAILED", "Optional invoice item not found");
    }
  }
  let changed = false;
  const requested = new Map(args.selections.map((selection) => [selection.lineItemId, selection.isSelected]));
  const lineItems = args.invoice.lineItems.map((item) => {
    const next = requested.get(item.id);
    if (next === undefined) return item;
    if ((item.isSelected !== false) !== next) changed = true;
    return { ...item, isSelected: next };
  });
  if (!changed) return { invoice: args.invoice, changed: false };

  const total = computeBillingInvoiceTotal({
    lineItems,
    waiverAmount: args.invoice.waiverAmount,
    discountAmount: args.invoice.discountAmount,
  });
  if (total.totalAmount <= 0) {
    throw billingContractError("ZERO_VALUE_INVOICE", "Invoice choices cannot reduce the total to zero");
  }
  const balanceDue = normalizeBillingAmount(total.totalAmount - args.invoice.amountPaid);
  await args.ctx.db.patch("studentInvoices", args.invoice._id, {
    lineItems,
    subtotal: total.subtotal,
    waiverAmount: total.waiverAmount,
    discountAmount: total.discountAmount,
    totalAmount: total.totalAmount,
    balanceDue,
    status: deriveBillingInvoiceStatus({
      totalAmount: total.totalAmount,
      amountPaid: args.invoice.amountPaid,
      dueDate: args.invoice.dueDate,
    }),
    installmentSchedule: redistributeBillingInstallments(
      args.invoice.installmentSchedule,
      total.totalAmount,
      args.invoice.dueDate,
    ),
    selectionRevision: currentRevision + 1,
    updatedAt: Date.now(),
  });
  const invoice = await args.ctx.db.get("studentInvoices", args.invoice._id);
  if (!invoice) throw billingContractError("NOT_FOUND", "Invoice not found after update");
  return { invoice, changed: true };
}
