"use client";

import { useId } from "react";

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
  onSelectBranch?: (targetBranch: BranchSummary) => void;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

export function BranchSwitcher({
  currentBranch, availableBranches, onSelectBranch, disabled = false,
  disabledReason, className = "",
}: BranchSwitcherProps) {
  const id = useId();
  const branches = availableBranches.filter(branch => branch.status === "active");
  const canSelect = !disabled && !!onSelectBranch && branches.length > 1 &&
    branches.some(branch => branch.schoolId === currentBranch.schoolId);
  return (
    <div className={`min-w-0 ${className}`}>
      {canSelect ? (
        <>
          <label htmlFor={id} className="text-xs font-semibold text-slate-700">Active branch</label>
          <select
            id={id}
            value={currentBranch.schoolId}
            className="mt-1 min-h-11 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2"
            onChange={event => {
              const target = branches.find(branch => branch.schoolId === event.target.value);
              if (target && target.schoolId !== currentBranch.schoolId) onSelectBranch?.(target);
            }}
          >
            {branches.map(branch => <option key={branch.schoolId} value={branch.schoolId}>{branch.name}</option>)}
          </select>
        </>
      ) : (
        <p className="break-words text-xs font-semibold text-slate-700">Active branch: {currentBranch.name}</p>
      )}
      {disabledReason && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">{disabledReason}</p>}
    </div>
  );
}
