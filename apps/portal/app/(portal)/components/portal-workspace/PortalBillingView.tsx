"use client";

import { InvoicePaymentInstructions, getUserFacingErrorMessage } from "@school/shared";
import { Check, ExternalLink, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PortalBillingData,
  PortalBillingInvoice,
  PortalEligibleBillingCollections,
  PortalWorkspaceData,
} from "@/portal-types";
import { formatDate, formatMoney } from "./format";

type CreateInvoice = (args: {
  requestKey: string;
  studentId: string;
  collectionId: string;
  sessionId: string;
  termId: string;
  selections: Array<{ itemId: string; quantity: number }>;
}) => Promise<{ invoice: PortalBillingInvoice; replayed: boolean }>;

type UpdateSelections = (args: {
  invoiceId: string;
  expectedSelectionRevision: number;
  selections: Array<{ lineItemId: string; isSelected: boolean }>;
}) => Promise<{ invoice: PortalBillingInvoice; changed: boolean }>;

interface PortalBillingViewProps {
  workspace: PortalWorkspaceData;
  billing: PortalBillingData | undefined;
  eligibleCollections: PortalEligibleBillingCollections | undefined;
  billingNotice: string | null;
  payingInvoiceId: string | null;
  createInvoice: CreateInvoice;
  updateSelections: UpdateSelections;
  onPayNow: (invoice: PortalBillingInvoice) => Promise<void>;
}

type ContractError = {
  code?: string;
  message?: string;
  existingInvoiceId?: string;
  reason?: "payment_recorded" | "cancelled";
};

function getContractError(error: unknown): ContractError {
  if (!error || typeof error !== "object") return {};
  const data = (error as { data?: unknown }).data;
  if (data && typeof data === "object") return data as ContractError;
  return {};
}

function makeRequestKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `portal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function PortalBillingView({
  workspace,
  billing,
  eligibleCollections,
  billingNotice,
  payingInvoiceId,
  createInvoice,
  updateSelections,
  onPayNow,
}: PortalBillingViewProps) {
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [reviewing, setReviewing] = useState(false);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [createdInvoices, setCreatedInvoices] = useState<PortalBillingInvoice[]>([]);
  const invoiceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previousCatalogSignature = useRef<string | null>(null);

  const selectedStudent = workspace.selectedStudent;
  const studentName = selectedStudent?.name ?? "your child";
  const studentFirstName = firstName(studentName);
  const canBrowse = workspace.viewer.role === "parent" && selectedStudent?.enrollmentState === "active";
  const activeCollection = eligibleCollections?.collections.find(
    (collection) => collection.collectionId === activeCollectionId,
  ) ?? null;

  const invoices = useMemo(() => {
    const queried = billing?.invoices ?? [];
    return [
      ...createdInvoices.filter(
        (created) =>
          created.studentId === workspace.selectedStudentId &&
          !queried.some((invoice) => invoice.invoiceId === created.invoiceId),
      ),
      ...queried,
    ];
  }, [billing?.invoices, createdInvoices, workspace.selectedStudentId]);

  useEffect(() => {
    setActiveCollectionId(null);
    setSelectedItems({});
    setReviewing(false);
    setRequestKey(null);
    setCatalogNotice(null);
    setAnnouncement(null);
    previousCatalogSignature.current = null;
  }, [workspace.selectedStudentId, workspace.selectedSessionId, workspace.selectedTermId]);

  useEffect(() => {
    if (!activeCollectionId || eligibleCollections === undefined) return;
    const collection = eligibleCollections.collections.find(
      (entry) => entry.collectionId === activeCollectionId,
    );
    if (!collection) {
      setActiveCollectionId(null);
      setSelectedItems({});
      setReviewing(false);
      setCatalogNotice(`This collection is no longer available for ${studentFirstName}.`);
      return;
    }

    const signature = JSON.stringify(
      collection.items.map((item) => [item.itemId, item.label, item.unitAmount]),
    );
    if (previousCatalogSignature.current && previousCatalogSignature.current !== signature) {
      const liveIds = new Set(collection.items.map((item) => item.itemId));
      setSelectedItems((current) =>
        Object.fromEntries(Object.entries(current).filter(([itemId]) => liveIds.has(itemId))),
      );
      setReviewing(false);
      setRequestKey(null);
      setCatalogNotice("Available items changed. Review the latest prices before continuing.");
    }
    previousCatalogSignature.current = signature;
  }, [activeCollectionId, eligibleCollections, studentFirstName]);

  if (billing === undefined) {
    return (
      <div className="animate-pulse space-y-6" aria-label="Loading billing">
        <div className="h-8 w-48 rounded bg-slate-100" />
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="h-48 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const summaryCurrency = invoices[0]?.currency ?? billing.settings.defaultCurrency;
  const selectedRows = activeCollection?.items
    .filter((item) => selectedItems[item.itemId] !== undefined)
    .map((item) => ({ ...item, quantity: selectedItems[item.itemId] })) ?? [];
  const selectionIsValid = selectedRows.length > 0 && selectedRows.every(
    (item) => Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 9999,
  );
  const estimatedTotal = selectedRows.reduce(
    (sum, item) => sum + item.unitAmount * item.quantity,
    0,
  );

  const closeChooser = () => {
    setActiveCollectionId(null);
    setSelectedItems({});
    setReviewing(false);
    setRequestKey(null);
    previousCatalogSignature.current = null;
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setRequestKey(null);
    setSelectedItems((current) => ({ ...current, [itemId]: quantity }));
  };

  const focusInvoice = (invoiceId: string) => {
    window.setTimeout(() => invoiceRefs.current[invoiceId]?.focus(), 0);
  };

  const submitOrder = async () => {
    if (
      !activeCollection ||
      !workspace.selectedStudentId ||
      !workspace.selectedSessionId ||
      !workspace.selectedTermId ||
      !selectionIsValid ||
      estimatedTotal <= 0
    ) return;

    const stableRequestKey = requestKey ?? makeRequestKey();
    setRequestKey(stableRequestKey);
    setCreating(true);
    setCatalogNotice(null);
    try {
      const result = await createInvoice({
        requestKey: stableRequestKey,
        studentId: workspace.selectedStudentId,
        collectionId: activeCollection.collectionId,
        sessionId: workspace.selectedSessionId,
        termId: workspace.selectedTermId,
        selections: selectedRows.map((item) => ({ itemId: item.itemId, quantity: item.quantity })),
      });
      setCreatedInvoices((current) => [
        result.invoice,
        ...current.filter((invoice) => invoice.invoiceId !== result.invoice.invoiceId),
      ]);
      closeChooser();
      setAnnouncement(
        result.replayed
          ? `Invoice ${result.invoice.invoiceNumber} was already created. We opened it below.`
          : `Invoice ${result.invoice.invoiceNumber} created. Balance due ${formatMoney(result.invoice.balanceDue, result.invoice.currency)}.`,
      );
      focusInvoice(result.invoice.invoiceId);
    } catch (error) {
      const contract = getContractError(error);
      if (contract.code === "DUPLICATE_INVOICE") {
        const existingInvoiceId = contract.existingInvoiceId ?? activeCollection.existingInvoiceId;
        closeChooser();
        setCatalogNotice("An invoice already exists for this collection and term.");
        if (existingInvoiceId) focusInvoice(existingInvoiceId);
      } else if (contract.code === "IDEMPOTENCY_CONFLICT") {
        setCatalogNotice("This retry no longer matches the original order. Open the existing invoice before trying again.");
      } else if (contract.code === "FORBIDDEN") {
        closeChooser();
        setCatalogNotice("Only a linked parent or guardian can create this invoice.");
      } else if (contract.code === "NOT_FOUND") {
        setReviewing(false);
        setRequestKey(null);
        setCatalogNotice("This collection or one of its items is no longer available.");
      } else if (contract.code === "ZERO_VALUE_INVOICE") {
        setReviewing(false);
        setCatalogNotice("Select items with a total greater than 0.");
      } else if (contract.code === "VALIDATION_FAILED") {
        setReviewing(false);
        setCatalogNotice(contract.message ?? "Review the selected items and quantities.");
      } else {
        setCatalogNotice("We could not confirm whether the invoice was created.");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Fees & payments</h2>
        <p className="mt-2 text-[15px] text-slate-600">
          {billing.studentSummary.outstandingBalance > 0 ? (
            <>
              {studentName} has <span className="font-bold text-amber-600">{formatMoney(billing.studentSummary.outstandingBalance, summaryCurrency)}</span>{" "}
              outstanding across {billing.studentSummary.invoiceCount} invoice{billing.studentSummary.invoiceCount !== 1 ? "s" : ""}.
            </>
          ) : (
            <>There is no outstanding invoice balance for {studentName}.</>
          )}
        </p>
      </div>

      {billingNotice && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{billingNotice}</div>}
      {catalogNotice && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{catalogNotice}</div>}
      <div aria-live="polite" className="sr-only">{announcement}</div>

      <section aria-labelledby="available-to-buy-heading" className="space-y-4">
        <div>
          <h3 id="available-to-buy-heading" className="text-base font-bold text-slate-900">Available to buy</h3>
          {canBrowse ? (
            <p className="mt-1 text-sm text-slate-600">Choose items for {studentFirstName}. Browsing these options does not add anything to your balance.</p>
          ) : workspace.viewer.role !== "parent" ? (
            <p className="mt-1 text-sm text-slate-600">Purchases can only be created by a linked parent or guardian.</p>
          ) : !selectedStudent ? (
            <p className="mt-1 text-sm text-slate-600">No student is linked to this portal account.</p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Purchases are unavailable because this is not an active enrollment.</p>
          )}
        </div>

        {canBrowse && eligibleCollections === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading available items">
            <div className="h-[88px] animate-pulse rounded-xl bg-slate-100" />
            <div className="h-[88px] animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : canBrowse && eligibleCollections?.collections.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {eligibleCollections.collections.map((collection) => {
              const isOpen = collection.collectionId === activeCollectionId;
              const prices = collection.items.map((item) => item.unitAmount);
              const minimumPrice = Math.min(...prices);
              const hasDifferentPrices = new Set(prices).size > 1;
              return (
                <div key={collection.collectionId} className={`rounded-xl border border-slate-200 bg-white ${isOpen ? "sm:col-span-2" : ""}`}>
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{collection.name}</h4>
                      {collection.description && <p className="mt-1 text-sm text-slate-500">{collection.description}</p>}
                      <p className="mt-1 text-xs text-slate-500">
                        {collection.items.length} item{collection.items.length === 1 ? "" : "s"}{hasDifferentPrices ? ` from ${formatMoney(minimumPrice, collection.currency)}` : ""}
                      </p>
                      {collection.existingInvoiceId && <p className="mt-1 text-xs font-medium text-slate-600">Already invoiced for this term.</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (collection.existingInvoiceId) {
                          focusInvoice(collection.existingInvoiceId);
                          return;
                        }
                        if (isOpen) closeChooser();
                        else {
                          setActiveCollectionId(collection.collectionId);
                          setSelectedItems({});
                          setReviewing(false);
                          setRequestKey(null);
                          setCatalogNotice(null);
                          previousCatalogSignature.current = JSON.stringify(collection.items.map((item) => [item.itemId, item.label, item.unitAmount]));
                        }
                      }}
                      disabled={!collection.canCreateInvoice && !collection.existingInvoiceId}
                      className="min-h-11 shrink-0 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary-contrast hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-focus disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {collection.existingInvoiceId ? "View invoice" : isOpen ? "Close" : "Choose items"}
                    </button>
                  </div>

                  {isOpen && !reviewing && (
                    <div className="border-t border-slate-200 p-4">
                      <p className="text-sm text-slate-600">Available for {studentFirstName} · {eligibleCollections.student.className}</p>
                      <p className="mt-1 text-xs text-slate-500">Selecting items below does not change your balance yet.</p>
                      <fieldset className="mt-4 space-y-3" disabled={creating}>
                        <legend className="sr-only">Items</legend>
                        {collection.items.map((item) => {
                          const quantity = selectedItems[item.itemId];
                          const selected = quantity !== undefined;
                          return (
                            <div key={item.itemId} className={`rounded-xl border p-3 ${selected ? "border-brand-primary bg-brand-primary-surface" : "border-slate-200"}`}>
                              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(event) => setSelectedItems((current) => {
                                    const next = { ...current };
                                    if (event.target.checked) next[item.itemId] = 1;
                                    else delete next[item.itemId];
                                    setRequestKey(null);
                                    return next;
                                  })}
                                  className="mt-1 h-5 w-5 accent-[var(--school-primary)]"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block font-semibold text-slate-900">{item.label}</span>
                                  {item.description && <span className="block text-sm text-slate-500">{item.description}</span>}
                                  <span className="mt-1 block text-sm text-slate-600">{formatMoney(item.unitAmount, collection.currency)} each</span>
                                </span>
                              </label>
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 pl-8">
                                <div className="flex items-center rounded-xl border border-slate-200 bg-white">
                                  <button type="button" aria-label={`Decrease ${item.label} quantity`} disabled={!selected || quantity <= 1} onClick={() => updateItemQuantity(item.itemId, quantity - 1)} className="flex h-11 w-11 items-center justify-center disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                                  <label className="sr-only" htmlFor={`quantity-${item.itemId}`}>Quantity for {item.label}</label>
                                  <input id={`quantity-${item.itemId}`} type="number" min={1} max={9999} step={1} disabled={!selected} value={quantity ?? 1} onChange={(event) => updateItemQuantity(item.itemId, Number(event.target.value))} className="h-11 w-16 border-x border-slate-200 text-center font-mono text-sm outline-none disabled:bg-slate-50" />
                                  <button type="button" aria-label={`Increase ${item.label} quantity`} disabled={!selected || quantity >= 9999} onClick={() => updateItemQuantity(item.itemId, quantity + 1)} className="flex h-11 w-11 items-center justify-center disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                                </div>
                                <span className="font-semibold tabular-nums text-slate-900">{selected ? formatMoney(item.unitAmount * quantity, collection.currency) : "Not selected"}</span>
                              </div>
                              {selected && (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) && <p className="mt-2 text-sm font-medium text-rose-700">Enter a whole-number quantity from 1 to 9999.</p>}
                            </div>
                          );
                        })}
                      </fieldset>
                      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div><p className="text-sm text-slate-500">Selected items {selectedRows.length}</p><p className="font-bold text-slate-900">Estimated total {formatMoney(estimatedTotal, collection.currency)}</p></div>
                        <button type="button" disabled={!selectionIsValid || estimatedTotal <= 0} onClick={() => setReviewing(true)} className="min-h-11 rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-brand-primary-contrast disabled:cursor-not-allowed disabled:opacity-50">Review order</button>
                      </div>
                      {!selectedRows.length && <p className="mt-2 text-sm text-slate-500">Select at least one item to continue.</p>}
                    </div>
                  )}

                  {isOpen && reviewing && (
                    <div className="border-t border-slate-200 p-4">
                      <h5 className="text-sm font-bold uppercase tracking-wide text-slate-900">Review order</h5>
                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-slate-500">For</dt><dd className="font-semibold text-slate-900">{studentName} · {eligibleCollections.student.className}</dd></div>
                        <div><dt className="text-slate-500">Collection</dt><dd className="font-semibold text-slate-900">{collection.name}</dd></div>
                        <div><dt className="text-slate-500">Period</dt><dd className="font-semibold text-slate-900">{workspace.activeSession?.name} · {workspace.activeTerm?.name}</dd></div>
                      </dl>
                      <div className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
                        {selectedRows.map((item) => <div key={item.itemId} className="flex justify-between gap-4 py-3 text-sm"><span>{item.label}<span className="block text-xs text-slate-500">{item.quantity} × {formatMoney(item.unitAmount, collection.currency)}</span></span><span className="font-semibold tabular-nums">{formatMoney(item.unitAmount * item.quantity, collection.currency)}</span></div>)}
                      </div>
                      <div className="mt-3 flex justify-between font-bold"><span>Estimated total</span><span className="tabular-nums">{formatMoney(estimatedTotal, collection.currency)}</span></div>
                      <p className="mt-4 text-sm text-slate-600">Confirming creates an invoice and adds this amount to your balance. Items in this order cannot be changed here after invoice creation. Contact the school if a correction is needed.</p>
                      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button type="button" disabled={creating} onClick={() => setReviewing(false)} className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 disabled:opacity-50">Back</button>
                        <button type="button" disabled={creating} onClick={() => void submitOrder()} className="min-h-11 rounded-xl bg-brand-primary px-5 text-sm font-semibold text-brand-primary-contrast disabled:opacity-60">{creating ? "Creating invoice..." : requestKey ? "Retry same order" : "Create invoice"}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : canBrowse ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">No additional items are available for this class and term.</p>
        ) : null}
      </section>

      <section aria-labelledby="invoices-heading" className="space-y-6">
        <h3 id="invoices-heading" className="text-base font-bold text-slate-900">Invoices</h3>
        {invoices.length > 0 ? invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.invoiceId}
            invoice={invoice}
            payingInvoiceId={payingInvoiceId}
            setRef={(node) => { invoiceRefs.current[invoice.invoiceId] = node; }}
            updateSelections={updateSelections}
            onInvoiceChanged={(next, message) => {
              setCreatedInvoices((current) => [next, ...current.filter((entry) => entry.invoiceId !== next.invoiceId)]);
              setAnnouncement(message);
            }}
            onPayNow={onPayNow}
          />
        )) : (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">No invoices for {studentName} right now.</div>
        )}
      </section>

      {billing.payments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">Payment history</h3>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 sm:hidden">
            {billing.payments.map((payment) => <div key={payment.paymentId} className="flex justify-between gap-4 p-4 text-sm"><div><p className="font-semibold text-slate-700">{payment.invoiceNumber}</p><p className="text-slate-500">{payment.provider ?? payment.paymentMethod} · {formatDate(payment.receivedAt)}</p></div><span className="font-bold text-emerald-600 tabular-nums">{formatMoney(payment.amountApplied, summaryCurrency)}</span></div>)}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 sm:block">
            <table className="w-full text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Invoice</th><th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Method</th><th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Date</th><th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{billing.payments.map((payment) => <tr key={payment.paymentId}><td className="px-4 py-3 font-medium text-slate-700">{payment.invoiceNumber}</td><td className="px-4 py-3 text-slate-500">{payment.provider ?? payment.paymentMethod}</td><td className="px-4 py-3 text-slate-500 tabular-nums">{formatDate(payment.receivedAt)}</td><td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">{formatMoney(payment.amountApplied, summaryCurrency)}</td></tr>)}</tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

function InvoiceCard({ invoice: initialInvoice, payingInvoiceId, setRef, updateSelections, onInvoiceChanged, onPayNow }: {
  invoice: PortalBillingInvoice;
  payingInvoiceId: string | null;
  setRef: (node: HTMLDivElement | null) => void;
  updateSelections: UpdateSelections;
  onInvoiceChanged: (invoice: PortalBillingInvoice, message: string) => void;
  onPayNow: (invoice: PortalBillingInvoice) => Promise<void>;
}) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const warningRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInvoice(initialInvoice);
    setDraft({});
  }, [initialInvoice]);

  const optionalRows = invoice.lineItems.filter((item) => item.isOptional);
  const dirty = optionalRows.some((item) => (draft[item.id] ?? item.isSelected) !== item.isSelected);
  const estimatedTotal = invoice.totalAmount + optionalRows.reduce((sum, item) => {
    const selected = draft[item.id] ?? item.isSelected;
    if (selected === item.isSelected) return sum;
    return sum + (selected ? item.amount : -item.amount);
  }, 0);
  const paymentPending = payingInvoiceId !== null;

  const save = async () => {
    if (!dirty || invoice.selectionRevision === null) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await updateSelections({
        invoiceId: invoice.invoiceId,
        expectedSelectionRevision: invoice.selectionRevision,
        selections: optionalRows.map((item) => ({ lineItemId: item.id, isSelected: draft[item.id] ?? item.isSelected })),
      });
      setInvoice(result.invoice);
      setDraft({});
      const message = result.changed
        ? `Invoice choices saved. New balance due ${formatMoney(result.invoice.balanceDue, result.invoice.currency)}.`
        : "No invoice choices changed.";
      setNotice(message);
      onInvoiceChanged(result.invoice, message);
    } catch (error) {
      const contract = getContractError(error);
      if (contract.code === "SELECTION_CONFLICT") {
        setDraft({});
        setNotice("Choices changed elsewhere. We refreshed this invoice. Review the latest total before saving.");
      } else if (contract.code === "SELECTION_LOCKED") {
        setDraft({});
        setInvoice((current) => ({
          ...current,
          canEditOptionalItems: false,
          selectionLockReason: contract.reason === "cancelled" ? "cancelled" : "payment_recorded",
        }));
        setNotice(
          contract.reason === "cancelled"
            ? "This invoice is cancelled. Choices cannot be changed."
            : "Choices are locked because a payment has been recorded.",
        );
      } else if (contract.code === "ZERO_VALUE_INVOICE") {
        setNotice("This selection would reduce the invoice total to zero. Keep at least the required charges.");
      } else if (contract.code === "FORBIDDEN") {
        setDraft({});
        setInvoice((current) => ({ ...current, canEditOptionalItems: false, selectionLockReason: "parent_required" }));
        setNotice("Only a linked parent or guardian can change optional items.");
      } else {
        setNotice(getUserFacingErrorMessage(error, "Invoice choices could not be saved."));
      }
      window.setTimeout(() => warningRef.current?.focus(), 0);
    } finally {
      setSaving(false);
    }
  };

  const lockCopy = invoice.selectionLockReason === "payment_recorded"
    ? "Choices are locked because a payment has been recorded."
    : invoice.selectionLockReason === "cancelled"
      ? "This invoice is cancelled. Choices cannot be changed."
      : invoice.selectionLockReason === "parent_required"
        ? "A linked parent or guardian can change optional items."
        : optionalRows.length > 0 && invoice.selectionLockReason === "not_editable"
          ? "These invoice items are fixed."
          : null;

  return (
    <div ref={setRef} tabIndex={-1} className="overflow-hidden rounded-xl border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-focus">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <div><h4 className="text-base font-bold text-slate-900">{invoice.feePlanName}</h4><p className="mt-0.5 text-xs text-slate-500">{invoice.invoiceNumber} · Due {formatDate(invoice.dueDate)}</p></div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${invoice.status === "paid" ? "bg-emerald-50 text-emerald-700" : invoice.status === "overdue" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{invoice.status}</span>
      </div>

      {notice && <div ref={warningRef} tabIndex={-1} role="alert" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900">{notice}</div>}
      {invoice.lineItems.length > 0 && <div className="divide-y divide-slate-100 px-5">{invoice.lineItems.map((item) => {
        const checked = draft[item.id] ?? item.isSelected;
        return <div key={item.id} className={`flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${item.isOptional && !checked ? "text-slate-400" : ""}`}>
          <div className="flex items-start gap-3">
            {item.isOptional && (invoice.canEditOptionalItems ? <input type="checkbox" aria-label={`Include ${item.label}`} checked={checked} disabled={saving || paymentPending} onChange={(event) => setDraft((current) => ({ ...current, [item.id]: event.target.checked }))} className="mt-0.5 h-5 w-5 accent-[var(--school-primary)]" /> : <span aria-label={item.isSelected ? "Included" : "Not included"} className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-slate-300">{item.isSelected && <Check className="h-3.5 w-3.5" />}</span>)}
            <span><span className="font-medium text-slate-700">{item.label}</span>{item.quantity !== 1 || item.unitAmount !== item.amount ? <span className="block text-xs text-slate-500">{item.quantity} × {formatMoney(item.unitAmount, invoice.currency)}</span> : null}</span>
          </div>
          <span className="pl-8 font-semibold tabular-nums text-slate-900 sm:pl-0"><span className="mr-2 text-xs font-normal text-slate-500">{item.isOptional ? checked ? "Optional" : "Not included" : ""}</span>{formatMoney(item.amount, invoice.currency)}</span>
        </div>;
      })}</div>}

      {dirty && <div className="border-t border-slate-200 bg-brand-primary-surface px-5 py-4"><div className="flex justify-between text-sm"><span className="text-slate-600">Estimated total after changes</span><span className="font-bold tabular-nums text-slate-900">{formatMoney(estimatedTotal, invoice.currency)}</span></div><div className="mt-1 flex justify-between text-sm"><span className="text-slate-500">Current saved total</span><span className="font-semibold tabular-nums text-slate-700">{formatMoney(invoice.totalAmount, invoice.currency)}</span></div><div className="mt-3 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setDraft({})} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold">Discard</button><button type="button" disabled={saving || paymentPending} onClick={() => void save()} className="min-h-11 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-brand-primary-contrast disabled:opacity-50">{saving ? "Saving choices..." : "Save choices"}</button></div></div>}
      {lockCopy && <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600">{lockCopy}</p>}

      <div className="space-y-2 border-t border-slate-200 bg-slate-50/50 px-5 py-4"><div className="flex justify-between text-sm"><span className="text-slate-500">Total</span><span className="font-bold tabular-nums text-slate-900">{formatMoney(invoice.totalAmount, invoice.currency)}</span></div>{invoice.amountPaid > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Paid</span><span className="font-semibold tabular-nums text-emerald-600">-{formatMoney(invoice.amountPaid, invoice.currency)}</span></div>}<div className="flex justify-between border-t border-dashed border-slate-200 pt-2 text-[15px]"><span className="font-semibold text-slate-700">Balance due</span><span className="font-bold tabular-nums text-slate-900">{formatMoney(invoice.balanceDue, invoice.currency)}</span></div></div>
      <InvoicePaymentInstructions instructions={invoice.paymentInstructions} reference={invoice.invoiceNumber} payable={invoice.balanceDue > 0 && ["issued", "overdue", "partially_paid"].includes(invoice.status)} />
      {invoice.canPayOnline && invoice.balanceDue > 0 && <div className="border-t border-slate-100 px-5 py-4"><button type="button" onClick={() => void onPayNow(invoice)} disabled={paymentPending || dirty || saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 text-sm font-semibold text-brand-primary-contrast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"><ExternalLink className="h-4 w-4" />{payingInvoiceId === invoice.invoiceId ? "Opening Paystack..." : `Pay ${formatMoney(invoice.balanceDue, invoice.currency)} now`}</button></div>}
    </div>
  );
}
