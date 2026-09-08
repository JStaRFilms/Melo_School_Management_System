"use client";

import { ShieldAlert, ArrowLeft, Building2 } from "lucide-react";

export interface AuthoritativeForbiddenViewProps {
  moduleTitle: string;
  missingCapability?: string;
  userName?: string;
  userTitle?: string | null;
  branchName?: string;
  branchId?: string;
  onReturnToDashboard: () => void;
  returnLabel?: string;
  onSwitchBranch?: () => void;
  canSwitchBranch?: boolean;
  state?: "forbidden" | "unauthenticated" | "suspended" | "reconciliation_required" | "module_disabled";
  message?: string;
}

const titles = {
  forbidden: "403 Forbidden · Access Denied",
  unauthenticated: "Sign in required",
  suspended: "Workspace suspended",
  reconciliation_required: "Workspace access needs review",
  module_disabled: "Module disabled",
};

/** No identity/branch diagnostics are invented when the server withholds them. */
export function AuthoritativeForbiddenView({
  moduleTitle, missingCapability, userName, userTitle, branchName, branchId,
  onReturnToDashboard, returnLabel = "Return to Dashboard", onSwitchBranch,
  canSwitchBranch = false, state = "forbidden", message,
}: AuthoritativeForbiddenViewProps) {
  return (
    <section role="alert" aria-labelledby="workspace-denial-title" className="flex min-h-[70vh] items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center sm:p-8">
        <ShieldAlert className="mx-auto mb-4 h-7 w-7 text-amber-700" aria-hidden="true" />
        <h1 id="workspace-denial-title" className="text-xl font-bold text-slate-900">{titles[state]}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {message ?? `You do not have the required authorization to access ${moduleTitle}${branchName ? ` in ${branchName}` : ""}.`}
        </p>
        {(missingCapability || userName || branchName) && (
          <dl className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-xs text-slate-700 break-words">
            {missingCapability && <div><dt className="font-semibold">Required capability</dt><dd>{missingCapability}</dd></div>}
            {userName && <div><dt className="font-semibold">Account</dt><dd>{userName}{userTitle ? ` (${userTitle})` : ""}</dd></div>}
            {branchName && <div><dt className="font-semibold">Branch</dt><dd>{branchName}{branchId ? ` [${branchId}]` : ""}</dd></div>}
          </dl>
        )}
        <p className="mt-5 text-xs leading-relaxed text-slate-500">Contact your school administrator to review access. Display titles do not grant permissions.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={onReturnToDashboard} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />{returnLabel}
          </button>
          {canSwitchBranch && onSwitchBranch && (
            <button type="button" onClick={onSwitchBranch} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2">
              <Building2 className="h-4 w-4" aria-hidden="true" />Switch Active Branch
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
