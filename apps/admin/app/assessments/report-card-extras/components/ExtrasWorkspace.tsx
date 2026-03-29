"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExtrasBundleValueInput, ExtrasEntry, ExtrasField } from "./types";

type DraftValue = {
  textValue: string;
  numberValue: string;
  booleanValue: "" | "true" | "false";
  scaleOptionId: string;
};

export function ExtrasWorkspace({
  entry,
  isLoading,
  hasSelection,
  hasStudents,
  onSave,
  reportCardHref,
}: {
  entry?: ExtrasEntry;
  isLoading: boolean;
  hasSelection: boolean;
  hasStudents: boolean;
  onSave: (bundleValues: ExtrasBundleValueInput[]) => Promise<void>;
  reportCardHref?: string;
}) {
  const [draft, setDraft] = useState<Record<string, Record<string, DraftValue>>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(buildDraft(entry));
    setError(null);
    setSuccess(null);
  }, [entry]);

  const bundles = useMemo(() => entry?.bundles ?? [], [entry]);
  const canEdit = entry?.canEdit ?? false;
  const hasEditableFields = useMemo(
    () =>
      bundles.some((bundle) =>
        bundle.sections.some((section) =>
          section.fields.some((field) => field.canEdit)
        )
      ),
    [bundles]
  );
  const savePayload = useMemo(
    () =>
      bundles.map((bundle) => ({
        bundleId: bundle._id,
        values: bundle.sections.flatMap((section) =>
          section.fields.map((field) => ({
            fieldId: field.id,
            textValue:
              field.type === "text" ? draft[bundle._id]?.[field.id]?.textValue || null : null,
            numberValue:
              field.type === "number"
                ? parseNumber(draft[bundle._id]?.[field.id]?.numberValue ?? "")
                : null,
            booleanValue:
              field.type === "boolean"
                ? parseBoolean(draft[bundle._id]?.[field.id]?.booleanValue ?? "")
                : null,
            scaleOptionId:
              field.type === "scale" ? draft[bundle._id]?.[field.id]?.scaleOptionId || null : null,
          }))
        ),
      })),
    [bundles, draft]
  );

  const handleSave = async () => {
    if (bundles.length === 0 || !hasEditableFields) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await onSave(savePayload);
      setSuccess("Report extras saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save report extras.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Report Card Extras</p>
            <h1 className="mt-1 text-xl font-extrabold text-slate-900">Admin Extras Override</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Use the same session, term, class, and student flow as teachers, with admin override available when extras need intervention.</p>
          </div>
          {reportCardHref ? <a href={reportCardHref} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800">Open report card</a> : null}
        </div>
      </div>

      {!hasSelection ? <StateCard title="Select a full context" message="Choose a session, term, class, and student before entering report extras." /> : isLoading ? <StateCard title="Loading extras" message="Preparing the extras workspace for the selected student." /> : !hasStudents ? <StateCard title="No students found" message="This class has no students available for the selected session and term." /> : bundles.length === 0 ? <StateCard title="No extras bundle assigned" message="No report-card extras bundle is assigned to this class yet, so there is nothing to enter." /> : (
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{entry?.studentName}</h2>
                <p className="mt-1 text-sm text-slate-600">Admin override is available across all bundles assigned to this class.</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Admin override is active for this extras entry.</div>
            </div>
          </div>

          {bundles.map((bundle) => (
            <section key={bundle._id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-extrabold text-slate-900">{bundle.name}</h2>
                {bundle.description ? <p className="mt-1 text-sm text-slate-600">{bundle.description}</p> : null}
              </div>

              <div className="mt-5 space-y-5">
                {bundle.sections.map((section) => (
                  <div key={section.id} className="space-y-3">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-500">{section.label}</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {section.fields.map((field) => (
                        <label key={field.id} className="block rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                          <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-slate-900"><span>{field.label}</span>{field.printable ? <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-700">Printable</span> : null}</span>
                          {field.helperText ? <span className="mb-2 block text-xs text-slate-500">{field.helperText}</span> : null}
                          <ExtrasInput field={field} draft={draft[bundle._id]?.[field.id]} disabled={!field.canEdit || isSaving} onChange={(value) => { setDraft((current) => ({ ...current, [bundle._id]: { ...current[bundle._id], [field.id]: { ...current[bundle._id]?.[field.id], ...value } } })); setError(null); setSuccess(null); }} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {error ? <Banner tone="error" message={error} /> : null}
          {success ? <Banner tone="success" message={success} /> : null}
          {!hasEditableFields ? <Banner tone="success" message="These fields are system-managed or read-only in this workspace." /> : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => setDraft(buildDraft(entry))} disabled={isSaving} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 disabled:opacity-60">Reset</button>
            <button type="button" onClick={handleSave} disabled={!hasEditableFields || isSaving} className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Saving..." : "Save extras"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExtrasInput({ field, draft, disabled, onChange }: { field: ExtrasField; draft?: DraftValue; disabled: boolean; onChange: (value: Partial<DraftValue>) => void }) {
  const className = "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60";
  if (!field.canEdit) return <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">{field.value.printValue ?? "Not set"}</div>;
  if (field.type === "text") return <textarea rows={4} value={draft?.textValue ?? ""} onChange={(event) => onChange({ textValue: event.target.value })} disabled={disabled} className={className} />;
  if (field.type === "number") return <input type="number" value={draft?.numberValue ?? ""} onChange={(event) => onChange({ numberValue: event.target.value })} disabled={disabled} className={className} />;
  if (field.type === "boolean") return <select value={draft?.booleanValue ?? ""} onChange={(event) => onChange({ booleanValue: event.target.value as DraftValue["booleanValue"] })} disabled={disabled} className={`${className} h-11 py-0`}><option value="">Not set</option><option value="true">Yes</option><option value="false">No</option></select>;
  return <select value={draft?.scaleOptionId ?? ""} onChange={(event) => onChange({ scaleOptionId: event.target.value })} disabled={disabled} className={`${className} h-11 py-0`}><option value="">Select option</option>{field.scaleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>;
}

function StateCard({ title, message }: { title: string; message: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-lg font-extrabold text-slate-900">{title}</p><p className="mt-2 text-sm text-slate-600">{message}</p></div>;
}

function Banner({ tone, message }: { tone: "error" | "success"; message: string }) {
  return <div className={`rounded-2xl px-4 py-3 text-sm ${tone === "error" ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div>;
}

function buildDraft(entry?: ExtrasEntry) {
  const nextDraft: Record<string, Record<string, DraftValue>> = {};
  for (const bundle of entry?.bundles ?? []) {
    nextDraft[bundle._id] = {};
    for (const section of bundle.sections) {
      for (const field of section.fields) {
        nextDraft[bundle._id][field.id] = {
          textValue: field.value.textValue ?? "",
          numberValue: field.value.numberValue === null ? "" : String(field.value.numberValue),
          booleanValue: field.value.booleanValue === null ? "" : field.value.booleanValue ? "true" : "false",
          scaleOptionId: field.value.scaleOptionId ?? "",
        };
      }
    }
  }
  return nextDraft;
}

function parseNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseBoolean(value: DraftValue["booleanValue"]) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}
