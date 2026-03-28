"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";
import { Loader2, Search } from "lucide-react";
import type { BundleRecord, ClassAssignmentRecord, ClassSummary } from "../types";
import { buildNextAssignedBundleIds } from "../utils";

interface ClassAssignmentPanelProps {
  bundles: BundleRecord[];
  classes: ClassSummary[];
  initialAssignments?: Record<string, ClassAssignmentRecord>;
  live?: boolean;
  selectedBundleId: string | null;
  onSetClassBundles?: (classId: string, bundleIds: string[]) => Promise<void>;
}

const EMPTY_ASSIGNMENTS: Record<string, ClassAssignmentRecord> = {};

export function StaticClassAssignmentPanel(props: ClassAssignmentPanelProps) {
  return <ClassAssignmentPanelContent {...props} />;
}

export function LiveClassAssignmentPanel(props: Omit<ClassAssignmentPanelProps, "live">) {
  return <ClassAssignmentPanelContent {...props} live />;
}

function ClassAssignmentPanelContent({
  bundles,
  classes,
  initialAssignments = EMPTY_ASSIGNMENTS,
  live = false,
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
      if (!matchesSearch) {
        return false;
      }

      const assignedBundleIds =
        assignmentMap[classItem.id]?.bundleAssignments.map((entry) => entry.bundleId) ?? [];
      if (filter === "assigned") {
        return assignedBundleIds.length > 0;
      }
      if (filter === "unassigned") {
        return assignedBundleIds.length === 0;
      }
      if (filter === "selected-bundle") {
        return selectedBundleId ? assignedBundleIds.includes(selectedBundleId) : false;
      }
      return true;
    });
  }, [assignmentMap, classes, filter, search, selectedBundleId]);

  const selectedVisibleCount = filteredClasses.filter((entry) => selectedClassIds.includes(entry.id)).length;

  const handleBulkApply = useCallback(
    async (includeSelected: boolean) => {
      if (!selectedBundleId) {
        return;
      }

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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {live &&
        classes.map((classItem) => (
          <LiveAssignmentObserver
            classId={classItem.id}
            key={classItem.id}
            onChange={(assignment) =>
              setAssignmentMap((current) => ({ ...current, [classItem.id]: assignment }))
            }
          />
        ))}

      <div className="space-y-1 border-b border-slate-100 pb-5">
        <h2 className="text-lg font-semibold text-slate-900">Class assignment</h2>
        <p className="text-sm text-slate-500">
          Attach the selected bundle in bulk, or toggle multiple bundles per class when schools need stacked extras.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search classes"
            value={search}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["assigned", "Assigned"],
            ["unassigned", "Unassigned"],
            ["selected-bundle", "Using selected"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={[
                "rounded-full px-3 py-2 text-sm font-medium transition",
                filter === value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
              onClick={() => setFilter(value as typeof filter)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span>{filteredClasses.length} classes shown</span>
        <span>{selectedVisibleCount} selected in view</span>
        <button
          className="font-medium text-slate-900"
          onClick={() => setSelectedClassIds(Array.from(new Set(filteredClasses.map((entry) => entry.id))))}
          type="button"
        >
          Select visible
        </button>
        <button className="font-medium text-slate-900" onClick={() => setSelectedClassIds([])} type="button">
          Clear selection
        </button>
        <button
          className="rounded-xl bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-40"
          disabled={!selectedBundleId || selectedClassIds.length === 0}
          onClick={() => void handleBulkApply(true)}
          type="button"
        >
          Add selected bundle
        </button>
        <button
          className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 disabled:opacity-40"
          disabled={!selectedBundleId || selectedClassIds.length === 0}
          onClick={() => void handleBulkApply(false)}
          type="button"
        >
          Remove selected bundle
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {filteredClasses.map((classItem) => {
          const assignment = assignmentMap[classItem.id];
          const assignedBundleIds = assignment?.bundleAssignments.map((entry) => entry.bundleId) ?? [];
          const assignedBundleNames =
            assignment?.bundleAssignments
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((entry) => entry.bundleName) ?? [];
          const isWorking = workingClassIds.includes(classItem.id);

          return (
            <div
              key={classItem.id}
              className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[auto_1fr]"
            >
              <label className="flex items-center gap-3">
                <input
                  checked={selectedClassIds.includes(classItem.id)}
                  className="h-4 w-4 rounded border-slate-300"
                  onChange={(event) => {
                    setSelectedClassIds((current) =>
                      event.target.checked
                        ? Array.from(new Set([...current, classItem.id]))
                        : current.filter((entry) => entry !== classItem.id)
                    );
                  }}
                  type="checkbox"
                />
                <div>
                  <div className="font-medium text-slate-900">{classItem.name}</div>
                  <div className="text-sm text-slate-500">
                    Current: {assignedBundleNames.length > 0 ? assignedBundleNames.join(", ") : "No bundles"}
                  </div>
                </div>
              </label>

              <div className="space-y-3">
                {selectedBundleId ? (
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      className="rounded-xl bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-40"
                      disabled={isWorking || assignedBundleIds.includes(selectedBundleId)}
                      onClick={() =>
                        void applyAssignment(
                          classItem.id,
                          buildNextAssignedBundleIds(assignment, selectedBundleId, true)
                        )
                      }
                      type="button"
                    >
                      Add selected bundle
                    </button>
                    <button
                      className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-700 disabled:opacity-40"
                      disabled={isWorking || !assignedBundleIds.includes(selectedBundleId)}
                      onClick={() =>
                        void applyAssignment(
                          classItem.id,
                          buildNextAssignedBundleIds(assignment, selectedBundleId, false)
                        )
                      }
                      type="button"
                    >
                      Remove selected bundle
                    </button>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {bundles.map((bundle) => {
                    const isChecked = assignedBundleIds.includes(bundle._id);
                    return (
                      <label
                        key={bundle._id}
                        className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${
                          isChecked
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          checked={isChecked}
                          className="h-4 w-4"
                          disabled={isWorking}
                          onChange={(event) => {
                            const nextIds = event.target.checked
                              ? [...assignedBundleIds, bundle._id]
                              : assignedBundleIds.filter((bundleId) => bundleId !== bundle._id);
                            void applyAssignment(classItem.id, Array.from(new Set(nextIds)));
                          }}
                          type="checkbox"
                        />
                        <span>{bundle.name}</span>
                      </label>
                    );
                  })}
                  {isWorking ? <Loader2 className="h-4 w-4 animate-spin self-center text-slate-400" /> : null}
                </div>
              </div>
            </div>
          );
        })}

        {filteredClasses.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            No classes match the current search and filter.
          </div>
        )}
      </div>
    </section>
  );
}

function LiveAssignmentObserver({
  classId,
  onChange,
}: {
  classId: string;
  onChange: (assignment: ClassAssignmentRecord) => void;
}) {
  const assignment = useQuery(
    "functions/academic/reportCardExtras:getClassReportCardExtraBundles" as never,
    { classId } as never
  ) as ClassAssignmentRecord | undefined;

  useEffect(() => {
    if (assignment) {
      onChange(assignment);
    }
  }, [assignment, onChange]);

  return null;
}
