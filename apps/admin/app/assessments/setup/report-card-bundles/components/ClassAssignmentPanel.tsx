"use client";

import { AdminSurface } from "@/components/ui/AdminSurface";
import { getUserFacingErrorMessage } from "@school/shared";
import { 
  CheckCircle2, 
  Circle, 
  GraduationCap, 
  Loader2, 
  Search, 
  ShieldCheck, 
  Sparkles,
  Check,
  X,
  Plus
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { BundleRecord, ClassAssignmentRecord, ClassSummary } from "../types";
import { buildNextAssignedBundleIds } from "../utils";

interface ClassAssignmentPanelProps {
  bundles: BundleRecord[];
  classes: ClassSummary[];
  initialAssignments?: Record<string, ClassAssignmentRecord>;
  selectedBundleId: string | null;
  onSetClassBundles?: (classId: string, bundleIds: string[]) => Promise<void>;
}

const EMPTY_ASSIGNMENTS: Record<string, ClassAssignmentRecord> = {};

export function StaticClassAssignmentPanel(props: ClassAssignmentPanelProps) {
  return <ClassAssignmentPanelContent {...props} />;
}

export function LiveClassAssignmentPanel(props: ClassAssignmentPanelProps) {
  return <ClassAssignmentPanelContent {...props} />;
}

const ClassAssignmentPanelContent = memo(function ClassAssignmentPanelContent({
  bundles,
  classes,
  initialAssignments = EMPTY_ASSIGNMENTS,
  selectedBundleId,
  onSetClassBundles,
}: ClassAssignmentPanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned_this" | "assigned_other" | "unassigned">("all");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, ClassAssignmentRecord>>(initialAssignments);
  const [workingClassIds, setWorkingClassIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setAssignmentMap(initialAssignments);
  }, [initialAssignments]);

  const activeBundle = useMemo(
    () => bundles.find((b) => b._id === selectedBundleId) ?? null,
    [bundles, selectedBundleId]
  );

  const applyAssignment = useCallback(
    async (classId: string, bundleIds: string[]) => {
      setWorkingClassIds((current) => Array.from(new Set([...current, classId])));
      const previous = assignmentMap[classId] ?? { classId, bundleAssignments: [] };
      const nextAssignment = {
        classId,
        bundleAssignments: bundleIds.map((bundleId, index) => ({
          bundleId,
          bundleName: bundles.find((bundle) => bundle._id === bundleId)?.name ?? "Add-on",
          order: index,
        })),
      };

      setAssignmentMap((current) => ({ ...current, [classId]: nextAssignment }));

      try {
        if (!onSetClassBundles) {
          throw new Error("Assignment handler is not available");
        }
        await onSetClassBundles(classId, bundleIds);
      } catch (issue) {
        setAssignmentMap((current) => ({ ...current, [classId]: previous }));
        setErrorMessage(getUserFacingErrorMessage(issue, "Failed to update class assignment"));
      } finally {
        setWorkingClassIds((current) => current.filter((entry) => entry !== classId));
      }
    },
    [assignmentMap, bundles, onSetClassBundles]
  );

  const handleToggleThisBundle = useCallback(
    (classId: string) => {
      if (!selectedBundleId) return;
      const currentIds = assignmentMap[classId]?.bundleAssignments.map((e) => e.bundleId) ?? [];
      const isAssigned = currentIds.includes(selectedBundleId);
      const nextIds = isAssigned
        ? currentIds.filter((id) => id !== selectedBundleId)
        : [...currentIds, selectedBundleId];
      void applyAssignment(classId, Array.from(new Set(nextIds)));
    },
    [applyAssignment, assignmentMap, selectedBundleId]
  );

  const handleToggleSelect = useCallback((classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  }, []);

  const handleSelectAllFiltered = useCallback((classIds: string[]) => {
    setSelectedClassIds((prev) => {
      const allSelected = classIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !classIds.includes(id));
      }
      return Array.from(new Set([...prev, ...classIds]));
    });
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    let assignedThis = 0;
    let assignedOther = 0;
    let unassigned = 0;

    classes.forEach((c) => {
      const assignedIds = assignmentMap[c.id]?.bundleAssignments.map((e) => e.bundleId) ?? [];
      if (selectedBundleId && assignedIds.includes(selectedBundleId)) {
        assignedThis++;
      } else if (assignedIds.length > 0) {
        assignedOther++;
      } else {
        unassigned++;
      }
    });

    return { assignedThis, assignedOther, unassigned, total: classes.length };
  }, [assignmentMap, classes, selectedBundleId]);

  const filteredClasses = useMemo(() => {
    return classes.filter((classItem) => {
      const matchesSearch = classItem.name.toLowerCase().includes(search.trim().toLowerCase());
      if (!matchesSearch) return false;

      const assignedBundleIds =
        assignmentMap[classItem.id]?.bundleAssignments.map((entry) => entry.bundleId) ?? [];
      const isThisAssigned = selectedBundleId ? assignedBundleIds.includes(selectedBundleId) : false;

      if (filter === "assigned_this") return isThisAssigned;
      if (filter === "assigned_other") return !isThisAssigned && assignedBundleIds.length > 0;
      if (filter === "unassigned") return assignedBundleIds.length === 0;
      return true;
    });
  }, [assignmentMap, classes, filter, search, selectedBundleId]);

  const handleBulkApply = useCallback(
    async (assignToSelected: boolean) => {
      if (!selectedBundleId) return;
      for (const classId of selectedClassIds) {
        const nextIds = buildNextAssignedBundleIds(
          assignmentMap[classId],
          selectedBundleId,
          assignToSelected
        );
        await applyAssignment(classId, nextIds);
      }
      setSelectedClassIds([]);
    },
    [applyAssignment, assignmentMap, selectedBundleId, selectedClassIds]
  );

  return (
    <div className="space-y-6">
      {/* Header Overview Card */}
      <AdminSurface intensity="low" className="p-5 sm:p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                Active Add-on
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {activeBundle?.name || "Untitled Add-on"}
              </h2>
            </div>
            <p className="text-xs font-medium text-slate-500">
              Select which classes should have this report add-on (traits, skills, and metrics) printed on their terminal report cards.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{stats.assignedThis} of {stats.total} Classes Assigned</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search classes..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs font-medium text-slate-800 outline-none transition focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
            {[
              { id: "all", label: `All (${stats.total})` },
              { id: "assigned_this", label: `This Add-on (${stats.assignedThis})` },
              { id: "assigned_other", label: `Other Add-ons (${stats.assignedOther})` },
              { id: "unassigned", label: `Unassigned (${stats.unassigned})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${
                  filter === tab.id
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </AdminSurface>

      {/* Batch Actions Bar */}
      {selectedClassIds.length > 0 && (
        <div className="p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
              {selectedClassIds.length}
            </span>
            <span className="text-xs font-bold text-indigo-950">
              {selectedClassIds.length === 1 ? "Class selected" : "Classes selected"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedClassIds([])}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleBulkApply(false)}
              className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-xs font-bold text-rose-700 transition-colors"
            >
              Remove from Selected
            </button>
            <button
              type="button"
              onClick={() => handleBulkApply(true)}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Assign to Selected</span>
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)}>
            <X className="w-4 h-4 text-rose-500" />
          </button>
        </div>
      )}

      {/* Class Allocation Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAllFiltered(filteredClasses.map((c) => c.id))}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
            >
              {filteredClasses.length > 0 &&
              filteredClasses.every((c) => selectedClassIds.includes(c.id)) ? (
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300" />
              )}
              <span>Select All Visible ({filteredClasses.length})</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredClasses.map((classItem) => {
            const assignment = assignmentMap[classItem.id];
            const assignedBundleIds = assignment?.bundleAssignments.map((e) => e.bundleId) ?? [];
            const isAssignedToThis = selectedBundleId ? assignedBundleIds.includes(selectedBundleId) : false;
            const isSelected = selectedClassIds.includes(classItem.id);
            const isWorking = workingClassIds.includes(classItem.id);

            const otherBundleNames = assignment?.bundleAssignments
              .filter((e) => e.bundleId !== selectedBundleId)
              .map((e) => e.bundleName) ?? [];

            return (
              <div
                key={classItem.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isAssignedToThis
                    ? "bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-500/10"
                    : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                } ${isSelected ? "ring-2 ring-indigo-600" : ""}`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(classItem.id)}
                      className="flex items-center gap-2.5 text-left group"
                    >
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                      )}
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {classItem.name}
                        </h4>
                        <span className="text-[10px] font-medium text-slate-400 block">
                          Academic Class Arm
                        </span>
                      </div>
                    </button>

                    {isWorking && (
                      <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin shrink-0" />
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {isAssignedToThis ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Active on Report Card</span>
                      </span>
                    ) : otherBundleNames.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-medium text-amber-800">
                        Has {otherBundleNames.join(", ")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium text-slate-500">
                        No Add-on Assigned
                      </span>
                    )}
                  </div>
                </div>

                {/* 1-Click Action Button */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => handleToggleThisBundle(classItem.id)}
                    className={`w-full h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                      isAssignedToThis
                        ? "bg-emerald-50 hover:bg-rose-50 text-emerald-800 hover:text-rose-700 border border-emerald-200 hover:border-rose-200"
                        : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                    }`}
                  >
                    {isAssignedToThis ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Assigned (Click to Remove)</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Assign to Class</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredClasses.length === 0 && (
          <div className="py-16 text-center bg-white border border-slate-200/80 rounded-2xl space-y-2">
            <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No classes found</p>
            <p className="text-xs text-slate-400">
              {search ? "No classes match your search query." : "No classes are registered in this academic system."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
