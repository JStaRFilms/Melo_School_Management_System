import React from "react";
import { X, Database, Check } from "lucide-react";

export interface FeatureSignalItem {
  _id?: string;
  rawHeader: string;
  sampleValue?: string;
  detectedType: string;
  status: "new" | "reviewed" | "adopted";
}

export interface ColumnMappingDialogProps {
  signals: FeatureSignalItem[];
  onClose: () => void;
}

export function ColumnMappingDialog({ signals, onClose }: ColumnMappingDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Product Intelligence & Metadata Attic
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {signals.length} Unrecognized spreadsheet {signals.length === 1 ? "column" : "columns"} detected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-indigo-50/50 border-b border-indigo-100/60 p-4 text-xs text-indigo-900 leading-relaxed">
          The spreadsheet contains non-standard columns that aren't mapped to standard school schema fields. These are tracked here for auditing and future product custom fields without breaking current records.
        </div>

        {/* Signals List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {signals.map((signal, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:border-slate-200 transition-colors bg-white shadow-2xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {signal.rawHeader}
                  </span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {signal.detectedType}
                  </span>
                </div>
                {signal.sampleValue && (
                  <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                    Sample: <span className="text-slate-700 font-medium">{signal.sampleValue}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200">
                  <Check className="h-3 w-3 text-slate-400" />
                  Attic Saved
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
