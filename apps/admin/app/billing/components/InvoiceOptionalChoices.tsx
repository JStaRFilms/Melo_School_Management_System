import { getUserFacingErrorMessage } from "@school/shared";
import { useEffect, useMemo, useState } from "react";
import type { BillingDashboardData } from "../types";
import { formatMoney } from "../utils";

type Invoice = BillingDashboardData["invoices"][number]["invoice"];

type UpdatedInvoice = Omit<Invoice, "canEditOptionalItems" | "selectionLockReason">;
type UpdateResult = { invoice: UpdatedInvoice; changed: boolean };

function contractData(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: unknown }).data;
  return data && typeof data === "object" ? data as { code?: string; reason?: string } : null;
}

export function invoiceHasManageableChoices(invoice: Invoice) {
  return invoice.canEditOptionalItems || invoice.selectionLockReason === "payment_recorded" || invoice.selectionLockReason === "cancelled";
}

interface InvoiceOptionalChoicesProps {
  invoice: Invoice;
  updateSelections: (args: {
    invoiceId: string;
    expectedSelectionRevision: number;
    selections: Array<{ lineItemId: string; isSelected: boolean }>;
  }) => Promise<UpdateResult>;
  onSaved: (invoice: Invoice) => void;
}

export function InvoiceOptionalChoices({ invoice: sourceInvoice, updateSelections, onSaved }: InvoiceOptionalChoicesProps) {
  const [invoice, setInvoice] = useState(sourceInvoice);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setInvoice(sourceInvoice);
    setSelected(Object.fromEntries(sourceInvoice.lineItems.filter((item) => item.isOptional).map((item) => [item.id, item.isSelected !== false])));
  }, [sourceInvoice]);

  const optionalItems = invoice.lineItems.filter((item) => item.isOptional);
  const locked = !invoice.canEditOptionalItems;
  const dirty = optionalItems.some((item) => selected[item.id] !== (item.isSelected !== false));
  const estimatedTotal = useMemo(() => {
    const subtotal = invoice.lineItems.reduce((sum, item) => {
      if (item.isOptional && !selected[item.id]) return sum;
      return sum + item.amount;
    }, 0);
    return Math.max(0, subtotal - invoice.waiverAmount - invoice.discountAmount);
  }, [invoice, selected]);

  const save = async () => {
    if (!dirty || locked) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await updateSelections({
        invoiceId: invoice._id,
        expectedSelectionRevision: invoice.selectionRevision ?? 0,
        selections: optionalItems.map((item) => ({ lineItemId: item.id, isSelected: selected[item.id] })),
      });
      const updatedInvoice: Invoice = {
        ...result.invoice,
        canEditOptionalItems: invoice.canEditOptionalItems,
        selectionLockReason: invoice.selectionLockReason,
      };
      setInvoice(updatedInvoice);
      setSelected(Object.fromEntries(updatedInvoice.lineItems.filter((item) => item.isOptional).map((item) => [item.id, item.isSelected !== false])));
      setMessage(result.changed ? `Invoice choices saved. New balance due ${formatMoney(result.invoice.balanceDue, result.invoice.currency)}.` : "No invoice choices changed.");
      onSaved(updatedInvoice);
    } catch (error) {
      const data = contractData(error);
      if (data?.code === "SELECTION_CONFLICT") {
        setSelected(Object.fromEntries(invoice.lineItems.filter((item) => item.isOptional).map((item) => [item.id, item.isSelected !== false])));
        setMessage("Choices changed in another session. We refreshed this invoice. Review it before saving again.");
      } else if (data?.code === "SELECTION_LOCKED") {
        setMessage(data.reason === "cancelled" ? "This invoice is cancelled. Choices cannot be changed." : "Choices are locked because a payment has been recorded. Use a billing adjustment for corrections.");
      } else if (data?.code === "ZERO_VALUE_INVOICE") {
        setMessage("This change would reduce the invoice total to zero. Keep at least the required charges.");
      } else {
        setMessage(getUserFacingErrorMessage(error, "Invoice choices were not saved. Try again."));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" aria-busy={saving}>
      {message ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div> : null}
      <div className="rounded-xl border border-slate-200">
        {invoice.lineItems.map((item) => (
          <label key={item.id} className={`flex min-h-12 items-center gap-3 border-b border-slate-100 px-3 last:border-0 ${item.isOptional && selected[item.id] === false ? "bg-slate-50 text-slate-500" : ""}`}>
            {item.isOptional ? <input type="checkbox" checked={selected[item.id] ?? (item.isSelected !== false)} disabled={locked || saving} onChange={(event) => setSelected({ ...selected, [item.id]: event.target.checked })} /> : <span className="h-4 w-4 rounded-full bg-slate-200" aria-label="Required" />}
            <span className="flex-1 text-sm"><span className="font-semibold">{item.label}</span>{item.isOptional ? <span className="ml-2 text-xs text-slate-400">{selected[item.id] === false ? "Not included" : "Optional"}</span> : null}</span>
            <span className="font-mono text-xs font-bold">{formatMoney(item.amount, invoice.currency)}</span>
          </label>
        ))}
      </div>
      {locked && invoice.selectionLockReason !== "not_editable" ? <p className="text-sm text-slate-600">{invoice.selectionLockReason === "cancelled" ? "This invoice is cancelled. Choices cannot be changed." : "Choices are locked because a payment has been recorded."}</p> : null}
      {!locked && dirty ? <div className="rounded-xl bg-slate-100 p-3 text-sm"><div className="flex justify-between gap-3"><span>Estimated total after changes</span><strong className="font-mono">{formatMoney(estimatedTotal, invoice.currency)}</strong></div><div className="mt-2 flex justify-between gap-3 text-slate-500"><span>Current saved total</span><span className="font-mono">{formatMoney(invoice.totalAmount, invoice.currency)}</span></div></div> : null}
      {!locked ? <div className="flex gap-2"><button type="button" disabled={!dirty || saving} onClick={() => setSelected(Object.fromEntries(optionalItems.map((item) => [item.id, item.isSelected !== false])))} className="h-11 flex-1 rounded-xl border border-slate-300 text-xs font-bold disabled:opacity-40">Discard</button><button type="button" disabled={!dirty || saving} onClick={() => void save()} className="h-11 flex-1 rounded-xl bg-slate-950 text-xs font-bold text-white disabled:opacity-40">{saving ? "Saving choices..." : "Save invoice choices"}</button></div> : null}
    </div>
  );
}
