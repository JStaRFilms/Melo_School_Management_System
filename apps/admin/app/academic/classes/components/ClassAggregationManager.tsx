"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";

type ClassOffering = {
  _id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
};

type AggregationRecord = {
  _id: string;
  classId: string;
  umbrellaSubjectId: string;
  umbrellaSubjectName: string;
  strategy: "fixed_contribution" | "raw_combined_normalized";
  reportDisplayMode: "umbrella_only" | "umbrella_with_breakdown";
  components: Array<{
    _id: string;
    componentSubjectId: string;
    componentSubjectName: string;
    order: number;
    contributionMax?: number;
    rawMaxOverride?: number;
    includeCA: boolean;
    includeExam: boolean;
  }>;
};

export function ClassAggregationManager({
  classId,
  offerings,
}: {
  classId: string;
  offerings: ClassOffering[] | undefined;
}) {
  const aggregations = useQuery(
    "functions/academic/subjectAggregations:getClassSubjectAggregations" as never,
    classId ? ({ classId } as never) : ("skip" as never)
  ) as AggregationRecord[] | undefined;
  const saveAggregation = useMutation(
    "functions/academic/subjectAggregations:saveClassSubjectAggregation" as never
  );
  const removeAggregation = useMutation(
    "functions/academic/subjectAggregations:removeClassSubjectAggregation" as never
  );

  const [editingAggregationId, setEditingAggregationId] = useState<string | null>(
    null
  );
  const [umbrellaSubjectId, setUmbrellaSubjectId] = useState("");
  const [strategy, setStrategy] = useState<
    "fixed_contribution" | "raw_combined_normalized"
  >("fixed_contribution");
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [componentContributions, setComponentContributions] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditingAggregationId(null);
    setUmbrellaSubjectId("");
    setStrategy("fixed_contribution");
    setSelectedComponentIds([]);
    setComponentContributions({});
    setError(null);
    setSuccessMessage(null);
  }, [classId]);

  const availableSubjects = offerings ?? [];
  const componentContributionTotal = useMemo(
    () =>
      selectedComponentIds.reduce((sum, subjectId) => {
        const numeric = Number(componentContributions[subjectId] ?? 0);
        return sum + (Number.isFinite(numeric) ? numeric : 0);
      }, 0),
    [componentContributions, selectedComponentIds]
  );

  const resetForm = () => {
    setEditingAggregationId(null);
    setUmbrellaSubjectId("");
    setStrategy("fixed_contribution");
    setSelectedComponentIds([]);
    setComponentContributions({});
  };

  const beginEdit = (aggregation: AggregationRecord) => {
    setEditingAggregationId(aggregation._id);
    setUmbrellaSubjectId(aggregation.umbrellaSubjectId);
    setStrategy(aggregation.strategy);
    setSelectedComponentIds(
      aggregation.components.map((component) => component.componentSubjectId)
    );
    setComponentContributions(
      Object.fromEntries(
        aggregation.components.map((component) => [
          component.componentSubjectId,
          String(component.contributionMax ?? ""),
        ])
      )
    );
    setError(null);
    setSuccessMessage(null);
  };

  const toggleComponent = (subjectId: string) => {
    setSelectedComponentIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId]
    );
  };

  const handleSave = async () => {
    if (!classId || !umbrellaSubjectId || selectedComponentIds.length === 0) {
      setError("Pick an umbrella subject and at least one component subject.");
      return;
    }

    if (strategy === "fixed_contribution" && componentContributionTotal !== 100) {
      setError("Fixed contribution totals must add up to 100.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await saveAggregation({
        ...(editingAggregationId ? { aggregationId: editingAggregationId } : {}),
        classId,
        umbrellaSubjectId,
        strategy,
        components: selectedComponentIds.map((subjectId) => ({
          componentSubjectId: subjectId,
          ...(strategy === "fixed_contribution"
            ? {
                contributionMax: Number(componentContributions[subjectId] ?? 0),
              }
            : {}),
        })),
      } as never);
      setSuccessMessage(
        editingAggregationId
          ? "Aggregation updated for this class."
          : "Aggregation saved for this class."
      );
      resetForm();
    } catch (err) {
      setError(
        getUserFacingErrorMessage(err, "Failed to save subject aggregation")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (aggregationId: string) => {
    if (!window.confirm("Remove this class aggregation?")) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await removeAggregation({ aggregationId } as never);
      if (editingAggregationId === aggregationId) {
        resetForm();
      }
      setSuccessMessage("Aggregation removed.");
    } catch (err) {
      setError(
        getUserFacingErrorMessage(err, "Failed to remove subject aggregation")
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (offerings === undefined) {
    return (
      <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-white p-4 text-sm text-[#64748b]">
        Loading class offerings...
      </div>
    );
  }

  if (offerings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-white p-4 text-sm text-[#64748b]">
        Save class offerings first before configuring aggregated subjects.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <div>
        <p className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
          Subject Aggregation
        </p>
        <p className="mt-1 text-[11px] font-medium text-[#64748b]">
          Create derived umbrella subjects for this class. Component subjects stay
          editable in exam entry, while report cards show only the normalized
          umbrella score.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {aggregations && aggregations.length > 0 ? (
        <div className="space-y-2">
          {aggregations.map((aggregation) => (
            <div
              key={aggregation._id}
              className="rounded-lg border border-white bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#0f172a]">
                    {aggregation.umbrellaSubjectName}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">
                    {aggregation.strategy === "fixed_contribution"
                      ? "Fixed contribution"
                      : "Raw combined normalized"}
                  </p>
                  <p className="mt-1 text-xs text-[#64748b]">
                    {aggregation.components
                      .map((component) => component.componentSubjectName)
                      .join(", ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => beginEdit(aggregation)}
                    className="rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#475569]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove(aggregation._id)}
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-white bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
              Umbrella Subject
            </label>
            <select
              value={umbrellaSubjectId}
              onChange={(event) => setUmbrellaSubjectId(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a]"
            >
              <option value="">Select umbrella subject</option>
              {availableSubjects.map((subject) => (
                <option key={subject.subjectId} value={subject.subjectId}>
                  {subject.subjectName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
              Combination Rule
            </label>
            <select
              value={strategy}
              onChange={(event) =>
                setStrategy(
                  event.target.value as
                    | "fixed_contribution"
                    | "raw_combined_normalized"
                )
              }
              className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a]"
            >
              <option value="fixed_contribution">Fixed contribution</option>
              <option value="raw_combined_normalized">
                Raw combined normalized
              </option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
            Component Subjects
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {availableSubjects
              .filter((subject) => subject.subjectId !== umbrellaSubjectId)
              .map((subject) => {
                const selected = selectedComponentIds.includes(subject.subjectId);
                return (
                  <label
                    key={subject.subjectId}
                    className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#0f172a]">
                        {subject.subjectName}
                      </span>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleComponent(subject.subjectId)}
                      />
                    </div>
                    {selected && strategy === "fixed_contribution" ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={componentContributions[subject.subjectId] ?? ""}
                        onChange={(event) =>
                          setComponentContributions((current) => ({
                            ...current,
                            [subject.subjectId]: event.target.value,
                          }))
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm font-bold text-[#0f172a]"
                        placeholder="Contribution out of 100"
                      />
                    ) : null}
                  </label>
                );
              })}
          </div>
          {strategy === "fixed_contribution" ? (
            <p className="text-xs font-semibold text-[#64748b]">
              Contribution total: {componentContributionTotal} / 100
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-lg bg-[#4f46e5] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-50"
          >
            {isSaving ? "Saving..." : editingAggregationId ? "Update" : "Save"}
          </button>
          {editingAggregationId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#475569]"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
