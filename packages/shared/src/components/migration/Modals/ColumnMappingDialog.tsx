import React from "react";
import { X, Sparkles, Database, Check } from "lucide-react";

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
              <Sparkles className="h-5 w-5" />
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
        <div className="bg-indigo-50/60 border-b border-indigo-100/80 p-5 text-xs text-indigo-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5">
            <Database className="h-4 w-4 text-indigo-600" />
            Deterministic column review
          </div>
          <p className="text-indigo-700 leading-relaxed">
            Unrecognized headers are listed without source values. Review row projections before approval; a header signal is not an AI mapping, database instruction, or guarantee that a field will be committed.
          </p>
        </div>

        {/* Signals Table */}
        <div className="max-h-[350px] overflow-y-auto p-6 space-y-3">
          {signals.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No unrecognized columns found. All spreadsheet headers map directly to the core schema!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {signals.map((sig, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {sig.rawHeader}
                    </span>
                    {sig.sampleValue && (
                      <span className="text-slate-500 block text-[11px]">
                        Sample: <span className="text-slate-700 font-medium font-mono">"{sig.sampleValue}"</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      {sig.detectedType}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      <Check className="h-3 w-3" />
                      Review signal
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
