import React from "react";
import { Info, Users } from "lucide-react";
import type { 
  FeePlanApplicationDraft, 
  ClassOption, 
  SessionOption, 
  TermOption,
  BillingDashboardData
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

const labelCx = "text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600";
const inputCx = "w-full h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export function BulkApplicationForm({ 
  draft, 
  onChange, 
  onSubmit, 
  classes, 
  sessions, 
  terms,
  feePlans 
}: BulkApplicationFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="space-y-1">
        <p className={labelCx}>Bulk Distribution</p>
        <p className="text-[13px] text-slate-500 leading-relaxed">Generate invoices for every student in a class.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className={labelCx}>Fee Plan</label>
          <select
            value={draft.feePlanId}
            onChange={(e) => onChange({ ...draft, feePlanId: e.target.value })}
            className={inputCx}
          >
            <option value="">Select Fee Plan</option>
            {feePlans.map(plan => (
              <option key={plan._id} value={plan._id}>{plan.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={labelCx}>Target Class</label>
          <select
            value={draft.classId}
            onChange={(e) => onChange({ ...draft, classId: e.target.value })}
            className={inputCx}
          >
            <option value="">Select Class</option>
            {classes.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
           <div className="space-y-1.5">
              <label className={labelCx}>Session</label>
              <select
                value={draft.sessionId}
                onChange={(e) => onChange({ ...draft, sessionId: e.target.value })}
                className={inputCx}
              >
                <option value="">Select</option>
                {sessions.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className={labelCx}>Term</label>
              <select
                value={draft.termId}
                onChange={(e) => onChange({ ...draft, termId: e.target.value })}
                className={inputCx}
                disabled={!draft.sessionId}
              >
                <option value="">Select</option>
                {terms.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
           </div>
        </div>

        {/* Warning callout */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
           <Users className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
           <p className="text-[12px] text-amber-800 leading-relaxed font-medium">
             This will generate individual invoices for <strong>every enrolled student</strong> in the selected class.
           </p>
        </div>
      </div>

      <button 
        type="submit" 
        className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
      >
        Distribute Invoices
      </button>
    </form>
  );
}
