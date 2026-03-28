"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReportCardSheetData } from "@school/shared";

type ExtrasField = {
  id: string;
  label: string;
  type: "text" | "number" | "boolean" | "scale";
  printable: boolean;
  scaleOptions: Array<{
    id: string;
    label: string;
    shortLabel: string | null;
  }>;
  value: {
    textValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    scaleOptionId: string | null;
    printValue: string | null;
  };
};

type ExtrasSectionRecord = {
  id: string;
  label: string;
  fields: ExtrasField[];
};

type ExtrasBundleRecord = {
  _id: string;
  name: string;
  description: string | null;
  sections: ExtrasSectionRecord[];
};

type ExtrasEntry = {
  canEdit: boolean;
  bundles: ExtrasBundleRecord[];
};

type DraftValue = {
  textValue: string;
  numberValue: string;
  booleanValue: "" | "true" | "false";
  scaleOptionId: string;
};

type ExtrasBundleValueInput = {
  bundleId: string;
  values: Array<{
    fieldId: string;
    textValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    scaleOptionId: string | null;
  }>;
};

export function ExtrasSection({
  reportCard,
  entry,
  isLoading,
  onSave,
}: {
  reportCard?: ReportCardSheetData;
  entry?: ExtrasEntry;
  isLoading: boolean;
  onSave: (bundleValues: ExtrasBundleValueInput[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, Record<string, DraftValue>>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "saving" }
    | { type: "success"; message: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  useEffect(() => {
    setDraft(buildDraft(entry));
    setStatus({ type: "idle" });
  }, [entry]);

  const bundles = entry?.bundles ?? [];
  const canEdit = entry?.canEdit ?? false;
  const savePayload = useMemo<ExtrasBundleValueInput[]>(
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
    if (!canEdit || bundles.length === 0) {
      return;
    }

    setStatus({ type: "saving" });
    try {
      await onSave(savePayload);
      setStatus({ type: "success", message: "Extras saved." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save extras right now.",
      });
    }
  };

  if (isLoading && !entry) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 text-center text-sm text-slate-500">
        Loading extras...
      </div>
    );
  }

  if (!entry || bundles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 text-center text-sm text-slate-500">
        No report extras are assigned to this class yet.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 cursor-pointer flex items-center justify-between outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-900 transition-colors border-none"
      >
        <div className="flex items-center gap-4">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : "rotate-0"}`}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">
            Report Extras
          </span>
        </div>
        <div className="text-[11px] font-semibold text-slate-900 flex items-center gap-3">
          <span>{bundles.length} bundle{bundles.length === 1 ? "" : "s"}</span>
          {reportCard ? (
            <>
              <span className="text-slate-300 hidden sm:inline-block">|</span>
              <span className="hidden sm:inline-block">
                Student: <span className="font-bold text-slate-900">{reportCard.student.name}</span>
              </span>
            </>
          ) : null}
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-slate-100 bg-white">
          <div className="px-5">
            {bundles.map((bundle) => (
              <div key={bundle._id} className="pb-8">
                <div className="py-5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">{bundle.name}</h3>
                  {bundle.description ? (
                    <p className="mt-0.5 text-xs text-slate-500">{bundle.description}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 pt-6">
                  {bundle.sections.map((section) => (
                    <div key={section.id} className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {section.label}
                        </h4>
                      </div>

                      <div className="space-y-4">
                        {section.fields.map((field) => (
                          <div key={field.id} className="flex flex-col mb-1.5">
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                                {field.label}
                              </label>
                              {field.printable ? (
                                <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                                  Printable
                                </span>
                              ) : null}
                            </div>
                            <ExtrasInput
                              field={field}
                              draft={draft[bundle._id]?.[field.id]}
                              disabled={!canEdit || status.type === "saving"}
                              onChange={(value) =>
                                setDraft((current) => ({
                                  ...current,
                                  [bundle._id]: {
                                    ...current[bundle._id],
                                    [field.id]: {
                                      ...current[bundle._id]?.[field.id],
                                      ...value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold">
              {status.type === "success" ? (
                <span className="text-emerald-600">{status.message}</span>
              ) : status.type === "error" ? (
                <span className="text-rose-600">{status.message}</span>
              ) : !canEdit ? (
                <span className="text-amber-700">Only the form teacher can edit extras for this class.</span>
              ) : (
                <span className="text-slate-500">Unsaved changes will be lost if not saved.</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(buildDraft(entry));
                  setStatus({ type: "idle" });
                }}
                className="text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 px-3 py-1.5 transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canEdit || status.type === "saving"}
                className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-md transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status.type === "saving" ? "Saving..." : "Save Extras"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExtrasInput({
  field,
  draft,
  disabled,
  onChange,
}: {
  field: ExtrasField;
  draft?: DraftValue;
  disabled: boolean;
  onChange: (value: Partial<DraftValue>) => void;
}) {
  const inputClass =
    "w-full text-sm font-medium bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50";

  if (field.type === "text") {
    return (
      <input
        type="text"
        value={draft?.textValue ?? ""}
        onChange={(event) => onChange({ textValue: event.target.value })}
        disabled={disabled}
        className={inputClass}
        placeholder={`Enter ${field.label.toLowerCase()}...`}
      />
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        value={draft?.numberValue ?? ""}
        onChange={(event) => onChange({ numberValue: event.target.value })}
        disabled={disabled}
        className={inputClass}
      />
    );
  }

  if (field.type === "boolean") {
    const options = [
      { id: "true", label: "Yes" },
      { id: "false", label: "No" },
    ];
    return (
      <div className="flex w-full max-w-xs">
        {options.map((opt) => {
          const isSelected = draft?.booleanValue === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ booleanValue: opt.id as DraftValue["booleanValue"] })}
              className={`flex-1 h-9 flex items-center justify-center border text-[13px] font-semibold transition-all -ml-px first:ml-0 first:rounded-l-md last:rounded-r-md ${
                isSelected
                  ? "bg-slate-900 border-slate-900 text-white z-10"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:z-10 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Scale fields use the pill segmented controls
  return (
    <div className="flex w-full overflow-x-auto rounded-md custom-scrollbar pb-1">
      <div className="flex min-w-max">
        {field.scaleOptions.map((opt) => {
          const isSelected = draft?.scaleOptionId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ scaleOptionId: opt.id })}
              className={`min-w-[40px] px-3 h-9 flex items-center justify-center border text-[13px] font-semibold transition-all -ml-px first:ml-0 first:rounded-l-md last:rounded-r-md ${
                isSelected
                  ? "bg-slate-900 border-slate-900 text-white z-10"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:z-10 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              {opt.shortLabel || opt.label}
            </button>
          );
        })}
      </div>
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
          booleanValue:
            field.value.booleanValue === null ? "" : field.value.booleanValue ? "true" : "false",
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
