"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Building2, ChevronDown, Check, Search, X } from "lucide-react";

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
  availableBranches: BranchSummary[];
  onSelectBranch: (targetBranch: BranchSummary) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Active Branch Switcher Component (D-04 §3.1).
 * Resides in the workspace header navbar to provide zero-trust tenant boundary awareness
 * and rapid switching for multi-branch staff and proprietors.
 */
export function BranchSwitcher({
  currentBranch,
  availableBranches,
  onSelectBranch,
  disabled = false,
  className = "",
}: BranchSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation: Escape closes dropdown
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setFilterQuery("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredBranches = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return availableBranches;
    return availableBranches.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.slug.toLowerCase().includes(query) ||
        (b.membershipRoleTitle &&
          b.membershipRoleTitle.toLowerCase().includes(query))
    );
  }, [availableBranches, filterQuery]);

  const groupDisplayName =
    currentBranch.groupName?.trim() || "School Group Campuses";

  const handleSelect = (branch: BranchSummary) => {
    if (branch.schoolId === currentBranch.schoolId) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);
    onSelectBranch(branch);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
    >
      {/* Switcher Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current branch: ${currentBranch.name}. Click to switch branch.`}
        className={`group flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-2.5 pr-2 transition-all hover:border-slate-300 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-200/80">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
        </div>

        <div className="flex items-center gap-1.5 text-left leading-none max-w-[150px] sm:max-w-[200px] truncate">
          <span className="truncate text-xs font-bold text-slate-900">
            {currentBranch.name}
          </span>
          {currentBranch.isHeadquarters && (
            <span className="shrink-0 rounded bg-amber-100 px-1 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-amber-800 border border-amber-200/60">
              HQ
            </span>
          )}
        </div>

        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-slate-700" : "group-hover:text-slate-600"
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Available School Branches"
          className="absolute left-0 mt-2 w-72 sm:w-80 origin-top-left rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Group Header */}
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              School Group Branches
            </p>
            <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
              {groupDisplayName}
            </p>
          </div>

          {/* Search Filter Input */}
          <div className="relative p-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter branches..."
                className="w-full h-8 pl-8 pr-7 text-xs rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors placeholder:text-slate-400"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery("")}
                  className="absolute right-2 p-0.5 rounded text-slate-400 hover:text-slate-600"
                  aria-label="Clear filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Branch Items List */}
          <div className="max-h-60 overflow-y-auto px-1 py-1 space-y-0.5 custom-scrollbar">
            {filteredBranches.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-500">
                No matching branches found
              </div>
            ) : (
              filteredBranches.map((branch) => {
                const isCurrent = branch.schoolId === currentBranch.schoolId;
                const isSuspended = branch.status === "suspended";

                return (
                  <button
                    key={branch.schoolId}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    onClick={() => handleSelect(branch)}
                    className={`w-full flex items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? "bg-slate-100/90 text-slate-950 font-bold"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    {/* Active Checkmark or Spacer */}
                    <div className="flex h-5 w-4 items-center justify-center shrink-0 mt-0.5">
                      {isCurrent && (
                        <Check className="h-3.5 w-3.5 text-slate-900" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate text-xs font-semibold">
                          {branch.name}
                        </span>
                        {branch.isHeadquarters && (
                          <span className="shrink-0 rounded bg-amber-100 px-1 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-amber-800 border border-amber-200/60">
                            HQ
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-tight">
                        {isSuspended ? (
                          <span className="font-semibold text-rose-600">
                            Suspended
                          </span>
                        ) : (
                          <span
                            className={
                              isCurrent
                                ? "text-slate-600"
                                : "text-slate-400"
                            }
                          >
                            {isCurrent ? "Active" : "Available"}
                          </span>
                        )}
                        <span className="text-slate-300">·</span>
                        <span className="truncate text-slate-500">
                          {branch.membershipRoleTitle || "Member"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
