"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { 
  RotateCcw, 
  Save, 
  ExternalLink, 
  ShieldAlert, 
  Info,
  Loader2,
  FileText,
  Users
} from "lucide-react";
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

  if (!hasSelection) {
    return <StateCard 
      icon={<Info className="text-slate-400" size={32} />} 
      title="Entry Protocol Required" 
      message="Choose a session, term, class, and student from the sidebar to begin administrative override." 
    />;
  }

  if (isLoading) {
    return <StateCard 
      icon={<Loader2 className="text-indigo-500 animate-spin" size={32} />} 
      title="Loading Records" 
      message="Retrieving report extras and bundle configurations from the database..." 
    />;
  }

  if (!hasStudents) {
    return <StateCard 
      icon={<Users size={32} className="text-slate-400" />} 
      title="No Students Found" 
      message="The selected class has no active students for this academic period." 
    />;
  }

  if (bundles.length === 0) {
    return <StateCard 
      icon={<ShieldAlert size={32} className="text-rose-500" />} 
      title="No Configuration Found" 
      message="No report-card extras bundle is assigned to this class. Setup the bundle in Exam Setup first." 
    />;
  }

  return (
    <div className="space-y-6">
      {/* Active Context Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 ring-1 ring-indigo-200/50">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-extrabold text-slate-900 tracking-tight leading-none">{entry?.studentName}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Override Active</p>
            </div>
          </div>
        </div>

        {reportCardHref && (
          <a 
            href={reportCardHref} 
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-indigo-200 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all duration-300"
          >
            Report <ExternalLink size={11} className="opacity-40" />
          </a>
        )}
      </div>

      <div className="space-y-6">
        {bundles.map((bundle) => (
          <AdminSurface key={bundle._id} intensity="medium" className="p-4 md:p-6 overflow-hidden">
            <div className="mb-6 border-b border-slate-100 pb-3">
              <h3 className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-indigo-600/80 mb-0.5">{bundle.name}</h3>
              {bundle.description && <p className="text-[11px] font-medium text-slate-500 max-w-xl">{bundle.description}</p>}
            </div>

            <div className="space-y-8">
              {bundle.sections.map((section) => (
                <div key={section.id} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 whitespace-nowrap">{section.label}</h4>
                    <span className="h-px flex-1 bg-slate-100/60" />
                  </div>
                  
                  <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-2">
                    {section.fields.map((field) => (
                      <div key={field.id} className="group flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3 px-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-focus-within:text-indigo-600 transition-colors">
                            {field.label}
                          </label>
                          {field.printable && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-slate-400">Printable</span>
                          )}
                        </div>
                        <ExtrasInput 
                          field={field} 
                          draft={draft[bundle._id]?.[field.id]} 
                          disabled={!field.canEdit || isSaving} 
                          onChange={(value) => { 
                            setDraft((current) => ({ ...current, [bundle._id]: { ...current[bundle._id], [field.id]: { ...current[bundle._id]?.[field.id], ...value } } })); 
                            setError(null); 
                            setSuccess(null); 
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </AdminSurface>
        ))}
      </div>

      {/* Global Actions Banner */}
      <div className="sticky bottom-6 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6 rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-md p-3 md:p-3.5 shadow-2xl shadow-slate-200/40">
        <div className="flex-1 min-w-0 overflow-hidden">
          {error ? <Banner tone="error" message={error} /> : 
           success ? <Banner tone="success" message={success} /> : 
           !hasEditableFields ? <Banner tone="info" message="Read-only workspace." /> :
           <p className="px-3 text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">
             Review and commit override data to persist changes
           </p>
          }
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button 
            type="button" 
            onClick={() => { if(window.confirm("Discard draft changes?")) setDraft(buildDraft(entry)); }} 
            disabled={isSaving} 
            className="flex h-9 md:h-10 flex-1 md:flex-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 md:px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={13} className="opacity-40" /> Reset
          </button>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={!hasEditableFields || isSaving} 
            className="flex h-9 md:h-10 flex-[2] md:flex-none items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 md:px-6 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all disabled:opacity-30 shadow-lg shadow-slate-900/20"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 
            {isSaving ? "Saving..." : "Commit Override"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtrasInput({ field, draft, disabled, onChange }: { field: ExtrasField; draft?: DraftValue; disabled: boolean; onChange: (value: Partial<DraftValue>) => void }) {
  const baseClassName = "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 placeholder:font-medium placeholder:text-slate-300";
  
  if (!field.canEdit) {
    return <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-400 cursor-not-allowed">{field.value.printValue ?? "---"}</div>;
  }
  
  if (field.type === "text") {
    return (
      <div className="space-y-1.5">
        <textarea 
          rows={2} 
          value={draft?.textValue ?? ""} 
          onChange={(event) => onChange({ textValue: event.target.value })} 
          disabled={disabled} 
          className={`${baseClassName} min-h-[60px] resize-none font-medium leading-relaxed`}
          placeholder={field.helperText || "Enter record..."}
        />
        {field.helperText && <p className="px-1 text-[9px] font-medium text-slate-400 italic">{field.helperText}</p>}
      </div>
    );
  }
  
  if (field.type === "number") {
    return <input type="number" value={draft?.numberValue ?? ""} onChange={(event) => onChange({ numberValue: event.target.value })} disabled={disabled} className={baseClassName} placeholder="0.00" />;
  }
  
  if (field.type === "boolean") {
    const options = [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" }
    ];
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = draft?.booleanValue === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ booleanValue: (isSelected ? "" : opt.value) as DraftValue["booleanValue"] })}
              className={`
                h-9 flex-1 min-w-[80px] rounded-lg border px-4 text-[11px] font-black uppercase tracking-widest transition-all
                ${isSelected 
                  ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200" 
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300"
                }
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {field.scaleOptions.map((option) => {
        const isSelected = draft?.scaleOptionId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ scaleOptionId: isSelected ? "" : option.id })}
            className={`
              h-9 px-4 rounded-lg border text-[11px] font-black uppercase tracking-widest transition-all
              ${isSelected 
                ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200" 
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 group-hover:border-slate-300"
              }
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function StateCard({ icon, title, message }: { icon?: React.ReactNode, title: string; message: string }) {
  return (
    <AdminSurface intensity="low" className="p-8 flex flex-col items-center text-center">
      {icon && <div className="mb-6">{icon}</div>}
      <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-900">{title}</h3>
      <p className="mt-2 text-xs font-medium text-slate-500 max-w-sm leading-relaxed">{message}</p>
    </AdminSurface>
  );
}

function Banner({ tone, message }: { tone: "error" | "success" | "info"; message: string }) {
  const styles = {
    error: "text-rose-600 bg-rose-50 border-rose-100",
    success: "text-emerald-600 bg-emerald-50 border-emerald-100",
    info: "text-indigo-600 bg-indigo-50 border-indigo-100"
  };
  
  return (
    <div className={`rounded-xl border px-3 py-2 flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest ${styles[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "error" ? "bg-rose-500" : tone === "success" ? "bg-emerald-500" : "bg-indigo-500"}`} />
      {message}
    </div>
  );
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
