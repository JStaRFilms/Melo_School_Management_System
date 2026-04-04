"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { getUserFacingErrorMessage } from "@school/shared";
import { Loader2, Search, Link2, CheckCircle2, Circle } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
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
const FILTER_OPTIONS = [
  ["all", "All"],
  ["assigned", "Assigned"],
  ["unassigned", "Empty"],
  ["selected-bundle", "Selected"],
] as const;

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
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned" | "selected-bundle">("all");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, ClassAssignmentRecord>>(initialAssignments);
  const [workingClassIds, setWorkingClassIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAssignmentMap(initialAssignments);
  }, [initialAssignments]);

  const applyAssignment = useCallback(
    async (classId: string, bundleIds: string[]) => {
      setError(null);
      setWorkingClassIds((current) => Array.from(new Set([...current, classId])));
      const previous = assignmentMap[classId] ?? { classId, bundleAssignments: [] };
      const nextAssignment = {
        classId,
        bundleAssignments: bundleIds.map((bundleId, index) => ({
          bundleId,
          bundleName: bundles.find((bundle) => bundle._id === bundleId)?.name ?? "Unknown bundle",
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
        setError(getUserFacingErrorMessage(issue, "Failed to update class assignment"));
      } finally {
        setWorkingClassIds((current) => current.filter((entry) => entry !== classId));
      }
    },
    [assignmentMap, bundles, onSetClassBundles]
  );

  const filteredClasses = useMemo(() => {
    return classes.filter((classItem) => {
      const matchesSearch = classItem.name.toLowerCase().includes(search.trim().toLowerCase());
      if (!matchesSearch) return false;

      const assignedBundleIds =
        assignmentMap[classItem.id]?.bundleAssignments.map((entry) => entry.bundleId) ?? [];
      if (filter === "assigned") return assignedBundleIds.length > 0;
      if (filter === "unassigned") return assignedBundleIds.length === 0;
      if (filter === "selected-bundle") return selectedBundleId ? assignedBundleIds.includes(selectedBundleId) : false;
      return true;
    });
  }, [assignmentMap, classes, filter, search, selectedBundleId]);

  const handleBulkApply = useCallback(
    async (includeSelected: boolean) => {
      if (!selectedBundleId) return;
      for (const classId of selectedClassIds) {
        const nextIds = buildNextAssignedBundleIds(
          assignmentMap[classId],
          selectedBundleId,
          includeSelected
        );
        await applyAssignment(classId, nextIds);
      }
    },
    [applyAssignment, assignmentMap, selectedBundleId, selectedClassIds]
  );

  return (
    <AdminSurface intensity="none" className="p-4 sm:p-6 space-y-6 border-slate-200 shadow-sm bg-white rounded-2xl animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between border-b border-slate-50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Link2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Distribution Engine</h2>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-tight">Deploy blueprints to class instances</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-950 transition-colors" />
          <input
            className="w-full h-10 rounded-xl border border-slate-100 bg-slate-50/50 pl-10 pr-4 text-xs font-bold uppercase tracking-widest outline-none transition focus:border-slate-300 focus:bg-white"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter Classes..."
            value={search}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value as typeof filter)}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                filter === value ? "bg-slate-900 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {selectedClassIds.length > 0 && (
        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">
            {selectedClassIds.length} Nodes Locked
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedClassIds([])}
              className="px-2 py-1 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={() => handleBulkApply(true)}
              className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
            >
              Deploy Selected
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[700px] overflow-y-auto custom-scrollbar pr-2 pb-10">
        {filteredClasses.map((classItem) => {
          const assignment = assignmentMap[classItem.id];
          const assignedBundleIds = assignment?.bundleAssignments.map((entry) => entry.bundleId) ?? [];
          const assignedBundleNames =
            assignment?.bundleAssignments
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((entry) => entry.bundleName) ?? [];
          const isWorking = workingClassIds.includes(classItem.id);
          const isSelected = selectedClassIds.includes(classItem.id);

          return (
            <div
              key={classItem.id}
              className={`group relative flex flex-col gap-3 p-4 rounded-xl border transition-all ${
                isSelected ? "border-indigo-200 bg-indigo-50/30" : "border-slate-50 bg-slate-50/10 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedClassIds(prev => isSelected ? prev.filter(id => id !== classItem.id) : [...prev, classItem.id])}
                  className="flex items-center gap-3 text-left"
                >
                  {isSelected ? <CheckCircle2 className="w-4 h-4 text-indigo-600" /> : <Circle className="w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-colors" />}
                  <div className="space-y-0.5">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-900">{classItem.name}</div>
                    <div className="text-xs font-bold text-slate-400 truncate max-w-[200px]">
                      {assignedBundleNames.length > 0 ? assignedBundleNames.join(" • ") : "Void Stack"}
                    </div>
                  </div>
                </button>
                {isWorking && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100/50">
                {bundles.map((bundle) => {
                  const isChecked = assignedBundleIds.includes(bundle._id);
                  return (
                    <button
                      key={bundle._id}
                      disabled={isWorking}
                      onClick={() => {
                        const nextIds = isChecked
                          ? assignedBundleIds.filter(id => id !== bundle._id)
                          : [...assignedBundleIds, bundle._id];
                        void applyAssignment(classItem.id, Array.from(new Set(nextIds)));
                      }}
                      className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded transition-all ${
                        isChecked 
                          ? "bg-slate-900 text-white" 
                          : "bg-white text-slate-400 border border-slate-100 hover:border-slate-200 hover:text-slate-600"
                      }`}
                    >
                      {bundle.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredClasses.length === 0 && (
          <div className="py-10 text-center border border-dashed border-slate-100 rounded-2xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No instances found</p>
          </div>
        )}
      </div>
    </AdminSurface>
  );
});
