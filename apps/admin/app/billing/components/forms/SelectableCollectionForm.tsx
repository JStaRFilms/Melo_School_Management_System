import { getUserFacingErrorMessage } from "@school/shared";
import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  hasSelectableCollectionErrors,
  validateSelectableCollection,
  type SelectableCollectionErrors,
} from "../../selectable-items-validation";
import type {
  BillingLineItemCategory,
  ClassOption,
  SelectableBillingCollection,
  SelectableCollectionDraft,
} from "../../types";
import { BankAccountSelection } from "../BankAccountSelection";

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900 disabled:bg-slate-100";
const categories: Array<{ value: BillingLineItemCategory; label: string }> = [
  { value: "tuition", label: "Tuition" },
  { value: "boarding", label: "Boarding" },
  { value: "transport", label: "Transport" },
  { value: "exam", label: "Exam" },
  { value: "activity", label: "Activity" },
  { value: "other", label: "Other" },
];

function initialDraft(currency: string): SelectableCollectionDraft {
  return {
    name: "",
    description: "",
    currency,
    bankAccountId: "",
    targetClassIds: [],
    items: [{ draftId: crypto.randomUUID(), label: "", description: "", unitAmount: "", category: "other" }],
  };
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: unknown }).data;
  return data && typeof data === "object" && "code" in data && typeof data.code === "string" ? data.code : null;
}

interface SelectableCollectionFormProps {
  classes: ClassOption[];
  defaultCurrency: string;
  createCollection: (args: {
    bankAccountId?: string;
    name: string;
    description?: string;
    currency: string;
    targetClassIds: string[];
    items: Array<{ label: string; description?: string; unitAmount: number; category: BillingLineItemCategory }>;
  }) => Promise<SelectableBillingCollection>;
  onCreated: (collection: SelectableBillingCollection) => void;
  onForbidden: () => void;
}

export function SelectableCollectionForm({ classes, defaultCurrency, createCollection, onCreated, onForbidden }: SelectableCollectionFormProps) {
  const [draft, setDraft] = useState(() => initialDraft(defaultCurrency));
  const [errors, setErrors] = useState<SelectableCollectionErrors>({ itemLabels: {}, itemAmounts: {} });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nextItemRef = useRef<HTMLInputElement>(null);

  const updateItem = (draftId: string, updates: Partial<SelectableCollectionDraft["items"][number]>) => {
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.draftId === draftId ? { ...item, ...updates } : item) }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateSelectableCollection(draft);
    setErrors(nextErrors);
    setSubmitError("");
    if (hasSelectableCollectionErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      const collection = await createCollection({
        ...(draft.bankAccountId ? { bankAccountId: draft.bankAccountId } : {}),
        name: draft.name.trim(),
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
        currency: draft.currency,
        targetClassIds: draft.targetClassIds,
        items: draft.items.map((item) => ({
          label: item.label.trim(),
          ...(item.description.trim() ? { description: item.description.trim() } : {}),
          unitAmount: Number(item.unitAmount),
          category: item.category,
        })),
      });
      onCreated(collection);
    } catch (error) {
      const code = errorCode(error);
      if (code === "FORBIDDEN") {
        onForbidden();
        return;
      }
      setSubmitError(code === "NOT_FOUND"
        ? "A selected class or account is no longer available. Review the fields and try again."
        : code === "VALIDATION_FAILED"
          ? getUserFacingErrorMessage(error, "Review the highlighted fields and try again.")
          : "Collection was not created. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const errorCount = [errors.name, errors.targetClassIds, errors.items].filter(Boolean).length +
    Object.keys(errors.itemLabels).length + Object.keys(errors.itemAmounts).length;

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={submitting}>
      {submitError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{submitError}</div> : null}
      {!submitError && errorCount > 1 ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Review the {errorCount} highlighted fields below.</div> : null}
      <div className="space-y-1.5">
        <label htmlFor="collection-name" className="text-xs font-bold text-slate-700">Collection name *</label>
        <input id="collection-name" autoFocus value={draft.name} disabled={submitting} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} placeholder="e.g. Primary books" aria-invalid={Boolean(errors.name)} />
        {errors.name ? <p className="text-xs text-rose-700">{errors.name}</p> : null}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="collection-description" className="text-xs font-bold text-slate-700">Description</label>
        <textarea id="collection-description" value={draft.description} disabled={submitting} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-900" placeholder="What this collection is for" />
      </div>
      <fieldset disabled={submitting} className="space-y-2">
        <legend className="text-xs font-bold text-slate-700">Eligible classes *</legend>
        <p className="text-xs leading-5 text-slate-500">Students in these classes may view or receive these items. No invoice is created until items are selected.</p>
        <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
          {classes.map((classOption) => {
            const selected = draft.targetClassIds.includes(classOption._id);
            return <button key={classOption._id} type="button" onClick={() => setDraft({ ...draft, targetClassIds: selected ? draft.targetClassIds.filter((id) => id !== classOption._id) : [...draft.targetClassIds, classOption._id] })} aria-pressed={selected} className={`min-h-9 rounded-lg border px-3 text-xs font-bold ${selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{classOption.name}</button>;
          })}
        </div>
        <p className="text-xs text-slate-500">{draft.targetClassIds.length} selected</p>
        {errors.targetClassIds ? <p className="text-xs text-rose-700">{errors.targetClassIds}</p> : null}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="collection-currency" className="text-xs font-bold text-slate-700">Currency *</label>
          <select id="collection-currency" value={draft.currency} disabled={submitting} onChange={(event) => setDraft({ ...draft, currency: event.target.value })} className={inputClass}>
            {[defaultCurrency, "NGN", "USD", "GBP"].filter((value, index, values) => values.indexOf(value) === index).map((currency) => <option key={currency}>{currency}</option>)}
          </select>
        </div>
        <BankAccountSelection value={draft.bankAccountId} onChange={(bankAccountId) => setDraft({ ...draft, bankAccountId })} label="Settlement account" helperText="Optional. The school default is used when no account is selected." />
      </div>
      <fieldset disabled={submitting} className="space-y-3">
        <legend className="text-xs font-bold text-slate-700">Items *</legend>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => {
            setDraft((current) => ({ ...current, items: [...current.items, { draftId: crypto.randomUUID(), label: "", description: "", unitAmount: "", category: "other" }] }));
            window.setTimeout(() => nextItemRef.current?.focus(), 0);
          }} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-slate-900"><Plus className="h-4 w-4" /> Add another item</button>
        </div>
        {errors.items ? <p className="text-xs text-rose-700">{errors.items}</p> : null}
        {draft.items.map((item, index) => (
          <div key={item.draftId} className="relative grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
            <button type="button" aria-label={`Remove ${item.label || `item ${index + 1}`}`} disabled={draft.items.length === 1} onClick={() => setDraft({ ...draft, items: draft.items.filter((row) => row.draftId !== item.draftId) })} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
            <div className="space-y-1 sm:pr-9"><label htmlFor={`item-name-${item.draftId}`} className="text-xs font-bold text-slate-700">Item name *</label><input ref={index === draft.items.length - 1 ? nextItemRef : undefined} id={`item-name-${item.draftId}`} value={item.label} onChange={(event) => updateItem(item.draftId, { label: event.target.value })} className={inputClass} aria-invalid={Boolean(errors.itemLabels[item.draftId])} />{errors.itemLabels[item.draftId] ? <p className="text-xs text-rose-700">{errors.itemLabels[item.draftId]}</p> : null}</div>
            <div className="space-y-1"><label htmlFor={`item-description-${item.draftId}`} className="text-xs font-bold text-slate-700">Description</label><input id={`item-description-${item.draftId}`} value={item.description} onChange={(event) => updateItem(item.draftId, { description: event.target.value })} className={inputClass} /></div>
            <div className="space-y-1"><label htmlFor={`item-category-${item.draftId}`} className="text-xs font-bold text-slate-700">Category *</label><select id={`item-category-${item.draftId}`} value={item.category} onChange={(event) => updateItem(item.draftId, { category: event.target.value as BillingLineItemCategory })} className={inputClass}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
            <div className="space-y-1"><label htmlFor={`item-price-${item.draftId}`} className="text-xs font-bold text-slate-700">Unit price *</label><input id={`item-price-${item.draftId}`} inputMode="decimal" value={item.unitAmount} onChange={(event) => updateItem(item.draftId, { unitAmount: event.target.value.replace(/[^0-9.]/g, "") })} className={inputClass} aria-invalid={Boolean(errors.itemAmounts[item.draftId])} />{errors.itemAmounts[item.draftId] ? <p className="text-xs text-rose-700">{errors.itemAmounts[item.draftId]}</p> : null}</div>
          </div>
        ))}
      </fieldset>
      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-1 pt-4">
        <p className="text-xs text-slate-500">{draft.items.length} items · {draft.targetClassIds.length} eligible classes</p>
        <button type="submit" disabled={submitting} className="h-11 rounded-xl bg-slate-950 px-5 text-xs font-bold text-white disabled:opacity-50">{submitting ? "Creating collection..." : "Create collection"}</button>
      </div>
    </form>
  );
}
