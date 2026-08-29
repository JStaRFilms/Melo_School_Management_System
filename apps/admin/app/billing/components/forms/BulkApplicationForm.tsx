import { Users } from "lucide-react";
import React, { useMemo } from "react";
import type {
  BillingDashboardData,
  ClassOption,
  FeePlanApplicationDraft,
  SessionOption,
  TermOption,
} from "../../types";

interface BulkApplicationFormProps {
  draft: FeePlanApplicationDraft;
  onChange: (draft: FeePlanApplicationDraft) => void;
  onSubmit: (e: React.FormEvent) => void;
  classes: ClassOption[];
  sessions: SessionOption[];
  terms: TermOption[];
  feePlans: BillingDashboardData["feePlans"];
}

const labelCx = "text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 font-display";
const inputCx = "w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 outline-none transition-all placeholder:text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs";

export function BulkApplicationForm({ 
  draft, 
  onChange, 
  onSubmit, 
  classes, 
  sessions, 
  terms,
  feePlans 
}: BulkApplicationFormProps) {
  const selectedPlan = feePlans.find((p) => p._id === draft.feePlanId);

  const eligibleClasses = useMemo(() => {
    if (!selectedPlan || !selectedPlan.targetClassIds || selectedPlan.targetClassIds.length === 0) {
      return classes;
    }
    const targetSet = new Set(selectedPlan.targetClassIds.map(String));
    return classes.filter((c) => targetSet.has(String(c._id)));
  }, [classes, selectedPlan]);

  return (
    <form onSubmit={onSubmit} className="flex flex-col h-full space-y-4">
      <div className="space-y-4 flex-1">
        <div className="space-y-1">
          <p className={labelCx}>Bulk Distribution</p>
          <p className="text-xs text-slate-500 font-medium">Generate term invoices for every student in a class.</p>
        </div>

        <div className="space-y-3.5">
          <div className="space-y-1">
            <label className={labelCx}>Fee Plan *</label>
            <select
              value={draft.feePlanId}
              onChange={(e) => {
                const nextPlanId = e.target.value;
                const nextPlan = feePlans.find((p) => p._id === nextPlanId);
                const nextTargetClasses = nextPlan?.targetClassIds ?? [];
                const isCurrentClassValid = nextTargetClasses.length === 0 || nextTargetClasses.some((id) => String(id) === String(draft.classId));
                onChange({
                  ...draft,
                  feePlanId: nextPlanId,
                  classId: isCurrentClassValid ? draft.classId : "",
                });
              }}
              className={inputCx}
              required
            >
              <option value="">Select Fee Plan...</option>
              {feePlans.map((plan) => (
                <option key={plan._id} value={plan._id}>
                  {plan.name} {plan.targetClassIds && plan.targetClassIds.length > 0 ? `(${plan.targetClassIds.length} classes bundled)` : "(Universal)"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className={labelCx}>Target Class *</label>
              {selectedPlan?.targetClassIds && selectedPlan.targetClassIds.length > 0 && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {eligibleClasses.length} bundled classes
                </span>
              )}
            </div>
            <select
              value={draft.classId}
              onChange={(e) => onChange({ ...draft, classId: e.target.value })}
              className={inputCx}
              required
            >
              <option value="">
                {eligibleClasses.length === classes.length ? "Select Class..." : "Select from Bundled Classes..."}
              </option>
              {eligibleClasses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className={labelCx}>Session *</label>
              <select
                value={draft.sessionId}
                onChange={(e) => onChange({ ...draft, sessionId: e.target.value })}
                className={inputCx}
                required
              >
                <option value="">Select Session...</option>
                {sessions.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCx}>Term *</label>
              <select
                value={draft.termId}
                onChange={(e) => onChange({ ...draft, termId: e.target.value })}
                className={inputCx}
                disabled={!draft.sessionId}
                required
              >
                <option value="">Select Term...</option>
                {terms.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Warning callout */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 flex gap-2.5">
            <Users className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              This will generate individual invoices for <strong>every active student</strong> in the selected class.
            </p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md pt-3 pb-1 border-t border-slate-100 -mx-1 px-1 z-10">
        <button 
          type="submit" 
          disabled={!draft.feePlanId || !draft.classId || !draft.sessionId || !draft.termId}
          className="w-full h-11 bg-slate-950 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-md shadow-slate-950/10 cursor-pointer"
        >
          Distribute Invoices
        </button>
      </div>
    </form>
  );
}
