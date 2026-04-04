"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { Sparkles, Trash2, Edit3, X, Info, ChevronDown, Save } from "lucide-react";

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
    setError(null);
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
      setError("Selection incomplete.");
      return;
    }

    if (strategy === "fixed_contribution" && componentContributionTotal !== 100) {
      setError("Check contributions (must sum to 100).");
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
          ? "Sync successful."
          : "Aggregation saved."
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
      <div className="py-6 flex items-center justify-center gap-3 animate-pulse">
        <Sparkles className="h-4 w-4 text-slate-200" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">Synchronizing...</span>
      </div>
    );
  }

  if (offerings.length === 0) {
    return (
      <AdminSurface intensity="medium" rounded="lg" className="p-8 text-center space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 mx-auto text-slate-200 ring-1 ring-slate-950/5">
          <Info className="h-6 w-6" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Inventory Empty</p>
        <p className="text-xs font-medium text-slate-300 leading-relaxed px-4">Initialize the subject catalog first to configure aggregated units.</p>
      </AdminSurface>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Aggregations List */}
      {aggregations && aggregations.length > 0 && (
        <div className="space-y-3">
           <div className="flex items-center gap-2 px-1">
             <div className="h-1.5 w-1.5 rounded-full bg-slate-950 animate-pulse" />
             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Current Rules</p>
           </div>
           {aggregations.map((aggregation) => (
             <AdminSurface 
               key={aggregation._id} 
               intensity={editingAggregationId === aggregation._id ? "high" : "medium"}
               rounded="lg" 
               className={`p-4 transition-all duration-300 ${editingAggregationId === aggregation._id ? "ring-2 ring-slate-950 bg-slate-950/5" : ""}`}
             >
               <div className="flex items-start justify-between gap-4">
                 <div className="space-y-1">
                   <div className="flex items-center gap-2">
                     <p className="text-sm font-bold text-slate-950 tracking-tight">{aggregation.umbrellaSubjectName}</p>
                     <p className="text-[8px] font-black tracking-widest text-slate-400 uppercase italic opacity-60">UMBRELLA</p>
                   </div>
                   <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                     {aggregation.strategy === "fixed_contribution" ? "Fixed Contribution Rule" : "Raw Combined Rule"}
                   </p>
                   <div className="flex flex-wrap gap-1.5 mt-2">
                     {aggregation.components.map(comp => (
                       <span key={comp._id} className="inline-flex items-center rounded-md bg-white border border-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 shadow-sm lowercase">
                         {comp.componentSubjectName}
                       </span>
                     ))}
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <button
                     onClick={() => beginEdit(aggregation)}
                     className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-950 hover:border-slate-950 transition-all hover:shadow-lg"
                   >
                     <Edit3 className="h-3.5 w-3.5" />
                   </button>
                   <button
                     onClick={() => handleRemove(aggregation._id)}
                     className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-400 hover:text-rose-600 hover:border-rose-300 transition-all"
                   >
                     <Trash2 className="h-3.5 w-3.5" />
                   </button>
                 </div>
               </div>
             </AdminSurface>
           ))}
        </div>
      )}

      {/* Editor Surface */}
      <AdminSurface intensity="high" rounded="xl" className="p-5 space-y-6 relative overflow-hidden border-2 border-slate-950/5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
           <div className="flex items-center gap-3">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white">
                <Sparkles className="h-4 w-4" />
             </div>
             <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-950">
                   {editingAggregationId ? "Modify Aggregation" : "Dynamic Unit Builder"}
                </h4>
             </div>
           </div>
           {editingAggregationId && (
             <button onClick={resetForm} className="text-slate-300 hover:text-slate-950 transition-colors">
               <X className="h-4 w-4" />
             </button>
           )}
        </div>

        {(error || successMessage) && (
          <div className={`p-3 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
            error ? "bg-rose-50 border-rose-100 text-rose-600" : "bg-emerald-50 border-emerald-100 text-emerald-600"
          }`}>
             {error || successMessage}
          </div>
        )}

        <div className="grid gap-5">
           <div className="space-y-1.5">
             <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-400 ml-1">Target Umbrella</p>
             <div className="relative">
               <select
                 value={umbrellaSubjectId}
                 onChange={(e) => setUmbrellaSubjectId(e.target.value)}
                 className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950"
               >
                 <option value="">Select subject index</option>
                 {availableSubjects.map((subject) => (
                   <option key={subject.subjectId} value={subject.subjectId}>
                     {subject.subjectName}
                   </option>
                 ))}
               </select>
               <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-300" />
             </div>
           </div>

           <div className="space-y-1.5">
             <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-400 ml-1">Combination Strategy</p>
             <div className="flex p-1 bg-slate-100 rounded-lg gap-1 border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setStrategy("fixed_contribution")}
                  className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                    strategy === "fixed_contribution" ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Fixed
                </button>
                <button
                  type="button"
                  onClick={() => setStrategy("raw_combined_normalized")}
                  className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                    strategy === "raw_combined_normalized" ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Raw Sync
                </button>
             </div>
           </div>

           <div className="space-y-3">
             <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-400 ml-1">Component Buffer</p>
                {strategy === "fixed_contribution" && (
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${componentContributionTotal === 100 ? "text-emerald-500" : "text-slate-400"}`}>
                    Sync: {componentContributionTotal}/100
                  </p>
                )}
             </div>
             <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar -mx-1 px-1">
                {availableSubjects
                  .filter((sub) => sub.subjectId !== umbrellaSubjectId)
                  .map((sub) => {
                    const isSelected = selectedComponentIds.includes(sub.subjectId);
                    return (
                      <div key={sub.subjectId} className="space-y-1.5">
                         <button
                           type="button"
                           onClick={() => toggleComponent(sub.subjectId)}
                           className={`h-9 w-full rounded-lg px-2 text-[10px] font-bold transition-all border text-left flex items-center justify-between group ${
                             isSelected ? "border-slate-950 bg-slate-950/5 text-slate-950" : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                           }`}
                         >
                            <span className="truncate">{sub.subjectName}</span>
                         </button>
                         {isSelected && strategy === "fixed_contribution" && (
                           <input
                             type="number"
                             value={componentContributions[sub.subjectId] ?? ""}
                             onChange={(e) => setComponentContributions(c => ({...c, [sub.subjectId]: e.target.value}))}
                             placeholder="Contrib %"
                             className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-950 outline-none focus:border-slate-950"
                           />
                         )}
                      </div>
                    );
                  })
                }
             </div>
           </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-white text-[11px] font-bold uppercase tracking-[0.2em] shadow-xl shadow-slate-950/20 transition-all hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="h-4 w-4 text-white/50" />
          {isSaving ? "Synchronizing..." : editingAggregationId ? "Sync Modification" : "Publish Aggregation"}
        </button>
      </AdminSurface>
    </div>
  );
}
