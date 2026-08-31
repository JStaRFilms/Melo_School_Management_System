import React from "react";
import { X, AlertTriangle, UserCheck, Users, CopyMinus, UserPlus } from "lucide-react";

export interface StagedRecordItem {
  _id: string;
  rowNumber: number;
  parsedData: {
    firstName: string;
    lastName: string;
    middleName?: string;
    admissionNumber?: string;
    gender: string;
    className: string;
    guardianName?: string;
    guardianPhone?: string;
    guardianEmail?: string;
    address?: string;
  };
  clashConfidence?: number;
  clashReason?: string;
  isResolved: boolean;
  resolutionAction?: "create_new" | "merge_existing" | "link_as_sibling" | "ignore";
}

export interface ClashResolutionModalProps {
  record: StagedRecordItem | null;
  candidateRecord?: StagedRecordItem | null;
  onClose: () => void;
  onResolve: (action: "create_new" | "merge_existing" | "link_as_sibling" | "ignore") => void;
  isResolving?: boolean;
}

export function ClashResolutionModal({
  record,
  candidateRecord,
  onClose,
  onResolve,
  isResolving,
}: ClashResolutionModalProps) {
  if (!record) return null;

  const currentFullName = [
    record.parsedData.firstName,
    record.parsedData.middleName,
    record.parsedData.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  const candidateFullName = candidateRecord
    ? [
        candidateRecord.parsedData.firstName,
        candidateRecord.parsedData.middleName,
        candidateRecord.parsedData.lastName,
      ]
        .filter(Boolean)
        .join(" ")
    : "Existing School Student Profile";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Duplicate & Name Clash Resolution
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Row #{record.rowNumber} • Match Confidence:{" "}
                <span className="font-bold text-amber-600">{record.clashConfidence ?? 0}%</span>
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

        {/* Reason Alert */}
        {record.clashReason && (
          <div className="bg-amber-50/60 border-b border-amber-100/80 px-6 py-2.5 text-xs text-amber-800 font-medium">
            <span className="font-bold">Detected Signal:</span> {record.clashReason}
          </div>
        )}

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 p-6 gap-6">
          {/* Staged Record */}
          <div className="space-y-3">
            <div className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              Import Row #{record.rowNumber}
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Name</span>
                <span className="font-bold text-slate-900 text-sm">{currentFullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Class</span>
                <span className="font-medium text-slate-800">{record.parsedData.className}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Gender</span>
                <span className="font-medium text-slate-800">{record.parsedData.gender}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Guardian Phone</span>
                <span className="font-mono text-slate-800">
                  {record.parsedData.guardianPhone || "Not Provided"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Admission No</span>
                <span className="font-mono text-slate-800">
                  {record.parsedData.admissionNumber || "Auto-Generate"}
                </span>
              </div>
            </div>
          </div>

          {/* Candidate Match */}
          <div className="space-y-3 pl-6">
            <div className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {candidateRecord ? `Matched Row #${candidateRecord.rowNumber}` : "Database Match"}
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Name</span>
                <span className="font-bold text-slate-900 text-sm">{candidateFullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Class</span>
                <span className="font-medium text-slate-800">
                  {candidateRecord?.parsedData.className || "Live Class"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Gender</span>
                <span className="font-medium text-slate-800">
                  {candidateRecord?.parsedData.gender || "Unspecified"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Guardian Phone</span>
                <span className="font-mono text-slate-800">
                  {candidateRecord?.parsedData.guardianPhone || record.parsedData.guardianPhone || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Admission No</span>
                <span className="font-mono text-slate-800">
                  {candidateRecord?.parsedData.admissionNumber || "Existing Student"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Selection */}
        <div className="border-t border-slate-100 bg-slate-50/70 p-6">
          <div className="text-xs font-bold text-slate-700 mb-3">Choose Resolution Action:</div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={isResolving}
              onClick={() => onResolve("create_new")}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-indigo-400 hover:bg-indigo-50/30 transition-all shadow-2xs group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Create New Student</div>
                <div className="text-[11px] text-slate-500">Treat as distinct individual</div>
              </div>
            </button>

            <button
              type="button"
              disabled={isResolving}
              onClick={() => onResolve("merge_existing")}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/30 transition-all shadow-2xs group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Merge with Existing</div>
                <div className="text-[11px] text-slate-500">Update existing profile</div>
              </div>
            </button>

            <button
              type="button"
              disabled={isResolving}
              onClick={() => onResolve("link_as_sibling")}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-amber-400 hover:bg-amber-50/30 transition-all shadow-2xs group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Link as Sibling</div>
                <div className="text-[11px] text-slate-500">Share household family</div>
              </div>
            </button>

            <button
              type="button"
              disabled={isResolving}
              onClick={() => onResolve("ignore")}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-rose-400 hover:bg-rose-50/30 transition-all shadow-2xs group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <CopyMinus className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Ignore Row</div>
                <div className="text-[11px] text-slate-500">Exclude from final merge</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
