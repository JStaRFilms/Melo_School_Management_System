"use client";

import { useId, useState } from "react";

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
  currentBranch, availableBranches, onSelectBranch, disabled = false,
  disabledReason, className = "",
}: BranchSwitcherProps) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branches = availableBranches.filter(branch => branch.status === "active");
  const canSelect = !disabled && !pending && !!onSelectBranch && branches.length > 1 &&
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
            disabled={pending}
            onChange={event => {
              const target = branches.find(branch => branch.schoolId === event.target.value);
              if (!target || target.schoolId === currentBranch.schoolId || !onSelectBranch) return;
              setPending(true);
              setError(null);
              void Promise.resolve(onSelectBranch(target))
                .catch(() => setError("Branch switch failed. Your current workspace remains open."))
                .finally(() => setPending(false));
            }}
          >
            {branches.map(branch => <option key={branch.schoolId} value={branch.schoolId}>{branch.name}</option>)}
          </select>
        </>
      ) : (
        <p className="break-words text-xs font-semibold text-slate-700">Active branch: {currentBranch.name}</p>
      )}
      {pending && <p role="status" className="mt-1 text-xs text-slate-600">Checking target branch…</p>}
      {error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
      {disabledReason && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">{disabledReason}</p>}
    </div>
  );
}
