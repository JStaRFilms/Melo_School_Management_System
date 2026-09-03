"use client";

import React from "react";
import { ShieldAlert, ArrowLeft, Building2 } from "lucide-react";

export interface AuthoritativeForbiddenViewProps {
  moduleTitle: string;
  missingCapability: string;
  userName: string;
  userTitle?: string | null;
  branchName: string;
  branchId: string;
  onReturnToDashboard: () => void;
  onSwitchBranch?: () => void;
  canSwitchBranch?: boolean;
}

/**
 * Authoritative 403 Forbidden Access Denial View (D-04 §2.2).
 * Rendered when a user navigates to an operational module without holding
 * the required capability in their active branch context.
 */
export function AuthoritativeForbiddenView({
  moduleTitle,
  missingCapability,
  userName,
  userTitle,
  branchName,
  branchId,
  onReturnToDashboard,
  onSwitchBranch,
  canSwitchBranch = false,
}: AuthoritativeForbiddenViewProps) {
  return (
    <div
      role="alert"
      aria-labelledby="forbidden-title"
      className="min-h-[70vh] flex items-center justify-center p-4 md:p-8"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-center">
        {/* Security Shield Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 mb-5">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>

        {/* Title & Context */}
        <h1
          id="forbidden-title"
          className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900"
        >
          403 Forbidden · Access Denied
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          You do not possess the required administrative capability to access{" "}
          <strong className="text-slate-900">{moduleTitle}</strong> in{" "}
          <span className="font-semibold text-slate-800">{branchName}</span>.
        </p>

        {/* Diagnostic Metadata Container */}
        <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200/80 p-4 text-left font-mono text-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-slate-500 font-sans">Required Capability:</span>
            <span className="font-bold text-amber-800 bg-amber-100/60 px-2 py-0.5 rounded text-[11px] break-all">
              {missingCapability}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-slate-500 font-sans">Active User:</span>
            <span className="text-slate-800 font-semibold">
              {userName} {userTitle ? `(${userTitle})` : ""}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-slate-500 font-sans">Branch Context:</span>
            <span className="text-slate-800">
              {branchName}{" "}
              <span className="text-slate-400">[{branchId}]</span>
            </span>
          </div>
        </div>

        {/* Actionable Remedy Note */}
        <div className="mt-6 text-xs text-slate-500 text-left border-l-2 border-slate-300 pl-3 leading-relaxed">
          <strong>Resolution Pathway:</strong> Contact your School Proprietor or
          operational Principal. If you operate across multiple campuses, verify
          that your active branch context corresponds to your assigned role.
        </div>

        {/* Recovery Action Buttons */}
        <div className="mt-8 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReturnToDashboard}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Dashboard
          </button>
          {canSwitchBranch && onSwitchBranch && (
            <button
              type="button"
              onClick={onSwitchBranch}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              <Building2 className="h-4 w-4" />
              Switch Active Branch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
