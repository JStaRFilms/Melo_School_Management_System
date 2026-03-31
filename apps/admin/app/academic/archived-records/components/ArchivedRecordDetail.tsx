"use client";

import { History, CornerDownRight, X } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import type { ArchivedRecordItem } from "./types";

interface ArchivedRecordDetailProps {
  record: ArchivedRecordItem;
  onRestore: () => void;
  onClose: () => void;
  isRestoring: boolean;
  variant?: "default" | "sheet";
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function ArchivedRecordDetail({
  record,
  onRestore,
  onClose,
  isRestoring,
  variant = "default",
}: ArchivedRecordDetailProps) {
  const isSheet = variant === "sheet";

  return (
    <div className={`space-y-6 ${!isSheet ? "animate-in slide-in-from-right-4 duration-300" : ""}`}>
      {!isSheet && (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              Record Protocol
            </p>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Archived {record.typeLabel}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>
      )}

      <AdminSurface intensity="low" className={`${isSheet ? "border-0 shadow-none ring-0 bg-slate-50/50" : "p-5"} space-y-4 rounded-2xl`}>
        <div className={isSheet ? "p-0" : ""}>
          <h4 className="text-lg font-bold text-slate-900 leading-tight">{record.name}</h4>
          <p className="text-xs font-medium text-slate-400 mt-0.5 uppercase tracking-wider">{record.subtitle}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Archived On</p>
            <p className="text-xs font-bold text-slate-700">{formatDateTime(record.archivedAt)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">By</p>
            <p className="text-xs font-bold text-slate-700">{record.archivedByName ?? "System"}</p>
          </div>
        </div>
      </AdminSurface>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
            <History size={10} />
            Context Note
          </div>
          <p className="text-xs font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            {record.statusNote}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
            <CornerDownRight size={10} />
            Details
          </div>
          <div className="space-y-2 px-1">
            {record.detailFields.map((field, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</span>
                <span className="text-xs font-bold text-slate-800">{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={onRestore}
          disabled={isRestoring}
          className="w-full h-12 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-lg shadow-slate-950/20 hover:bg-slate-800 transition-all disabled:opacity-50 ring-offset-2 focus:ring-2 focus:ring-slate-950"
        >
          {isRestoring ? "Restoring..." : "Restore Record"}
        </button>
        <p className="mt-3 text-[10px] text-center text-slate-400 font-medium px-4">
          Restoration will return this entry to active academic setup.
        </p>
      </div>
    </div>
  );
}
