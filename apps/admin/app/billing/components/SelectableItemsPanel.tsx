import { PackageOpen, Plus, Send } from "lucide-react";
import type { SelectableBillingCollection } from "../types";

interface SelectableItemsPanelProps {
  collections: SelectableBillingCollection[] | undefined;
  includeInactive: boolean;
  canCreate: boolean;
  canIssue: boolean;
  onIncludeInactiveChange: (value: boolean) => void;
  onNewCollection: () => void;
  onIssue: (collectionId?: string) => void;
}

function eligibleClassSummary(collection: SelectableBillingCollection) {
  const names = collection.targetClasses.map((targetClass) => targetClass.name);
  return names.length > 3
    ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more`
    : names.join(", ");
}

export function SelectableItemsPanel({
  collections,
  includeInactive,
  canCreate,
  canIssue,
  onIncludeInactiveChange,
  onNewCollection,
  onIssue,
}: SelectableItemsPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-950/5 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-slate-950">Selectable items</h2>
          <p className="max-w-2xl text-sm text-slate-500">
            Create collections for items families may choose. Eligibility does not create an invoice.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canCreate ? (
            <button type="button" onClick={onNewCollection} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white hover:bg-slate-800">
              <Plus className="h-4 w-4" /> New collection
            </button>
          ) : null}
          {canIssue ? (
            <button type="button" onClick={() => onIssue()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 hover:border-slate-500">
              <Send className="h-4 w-4" /> Issue items
            </button>
          ) : null}
        </div>
      </div>

      <label className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-700">
        <input type="checkbox" checked={includeInactive} onChange={(event) => onIncludeInactiveChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        Show inactive
      </label>

      {collections === undefined ? (
        <div aria-label="Loading selectable collections" className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <PackageOpen className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-900">{canCreate ? "No selectable collections yet." : "No selectable collections are available."}</p>
          {canCreate ? <p className="mt-1 text-xs text-slate-500">Create a collection before issuing selected items.</p> : null}
          {canCreate ? <button type="button" onClick={onNewCollection} className="mt-4 text-xs font-bold text-slate-900 underline underline-offset-4">New collection</button> : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {collections.map((collection) => (
            <article key={collection._id} id={`collection-${collection._id}`} tabIndex={-1} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-slate-950">{collection.name}</h3>
                  {collection.description ? <p className="mt-1 text-xs leading-5 text-slate-500">{collection.description}</p> : null}
                </div>
                <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${collection.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {collection.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <dl className="mt-4 space-y-2 text-xs text-slate-600">
                <div><dt className="inline font-bold text-slate-800">Eligible: </dt><dd className="inline">{eligibleClassSummary(collection)}</dd></div>
                <div className="flex flex-wrap gap-x-2 text-slate-500">
                  <span>{collection.items.filter((item) => item.isActive).length} items</span><span aria-hidden="true">·</span><span>{collection.currency}</span><span aria-hidden="true">·</span><span>{collection.bankAccountId ? "Selected settlement account" : "School default account"}</span>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <time className="text-[10px] font-semibold uppercase tracking-wider text-slate-400" dateTime={new Date(collection.updatedAt).toISOString()}>
                  Updated {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(collection.updatedAt)}
                </time>
                {canIssue && collection.isActive ? <button type="button" onClick={() => onIssue(collection._id)} className="text-xs font-bold text-slate-900 hover:underline">Issue items</button> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
