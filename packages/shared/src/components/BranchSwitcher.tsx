"use client";

import { useId, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";

export interface BranchSummary {
  schoolId: string;
  name: string;
  slug: string;
  isHeadquarters: boolean;
  status: "active" | "suspended";
  membershipRoleTitle?: string | null;
  groupName?: string | null;
  groupSlug?: string | null;
}

export interface BranchSwitcherProps {
  currentBranch: BranchSummary;
  /** Only server-validated branches. Group linkage alone is not authorization. */
  availableBranches: BranchSummary[];
  onSelectBranch?: (targetBranch: BranchSummary) => boolean | void | Promise<boolean | void>;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

export function BranchSwitcher({
  currentBranch,
  availableBranches,
  onSelectBranch,
  disabled = false,
  className = "",
}: BranchSwitcherProps) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branches = availableBranches.filter(branch => branch.status === "active");

  const canSelect =
    !disabled &&
    !!onSelectBranch &&
    branches.length > 1 &&
    branches.some(branch => branch.schoolId === currentBranch.schoolId);

  // If there are no other active branches to switch to, or if switching is disabled on this route,
  // do not render any switcher or disclaimer clutter.
  if (!canSelect) {
    return null;
  }

  return (
    <div className={`relative flex items-center min-w-0 ${className}`}>
      <label htmlFor={id} className="sr-only">
        Active branch
      </label>
      <div className="relative flex items-center">
        <Building2 className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
        <select
          id={id}
          aria-label="Active branch"
          value={currentBranch.schoolId}
          disabled={pending}
          className="h-8 max-w-[210px] truncate rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-7 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer appearance-none shadow-2xs"
          onChange={event => {
            const target = branches.find(branch => branch.schoolId === event.target.value);
            if (!target || target.schoolId === currentBranch.schoolId || !onSelectBranch) return;
            setPending(true);
            setError(null);
            void Promise.resolve(onSelectBranch(target))
              .catch(() => setError("Branch switch failed."))
              .finally(() => setPending(false));
          }}
        >
          {branches.map(branch => (
            <option key={branch.schoolId} value={branch.schoolId}>
              {branch.name} {branch.isHeadquarters ? "(HQ)" : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-slate-400" />
      </div>
      {pending && <span role="status" className="ml-1.5 text-[10px] text-slate-500 font-medium animate-pulse">Switching…</span>}
      {error && <span role="alert" className="ml-1.5 text-[10px] text-rose-600 font-medium">{error}</span>}
    </div>
  );
}
