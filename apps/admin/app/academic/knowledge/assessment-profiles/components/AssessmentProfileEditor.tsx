"use client";

import { Hash, Settings2, Info, CheckCircle2, AlertCircle, Minus, Plus, Target, ShieldCheck } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { cn } from "@/utils";
import type { AssessmentProfileDraft, QuestionMix, QuestionStyle } from "../types";
import { getQuestionMixForStyle, mixFields, mixTotal } from "../utils";

interface AssessmentProfileEditorProps {
  draft: AssessmentProfileDraft;
  onChange: (patch: Partial<AssessmentProfileDraft>) => void;
}

export function AssessmentProfileEditor({
  draft,
  onChange,
}: AssessmentProfileEditorProps) {
  const updateMix = (key: keyof QuestionMix, value: number) => {
    const questionMix = { ...draft.questionMix, [key]: Math.max(0, Math.min(60, value)) };
    onChange({ questionMix, totalQuestions: mixTotal(questionMix) });
  };

  const updateQuestionStyle = (questionStyle: QuestionStyle) => {
    const questionMix = getQuestionMixForStyle(questionStyle);
    onChange({ questionStyle, questionMix, totalQuestions: mixTotal(questionMix) });
  };

  const updateActiveStatus = (isActive: boolean) => {
    onChange({ isActive, ...(isActive ? {} : { isDefault: false }) });
  };

  const objectiveCount = (draft.questionMix.multiple_choice || 0) + (draft.questionMix.true_false || 0) + (draft.questionMix.fill_in_the_blank || 0);
  const subjectiveCount = (draft.questionMix.short_answer || 0) + (draft.questionMix.essay || 0);
  const objectivePercent = draft.totalQuestions > 0 ? (objectiveCount / draft.totalQuestions) * 100 : 0;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Identity Section */}
          <section className="space-y-4">
             <div className="flex items-center gap-2 px-1">
                <Info className="h-3.5 w-3.5 text-slate-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Profile Identity</h3>
             </div>
             
             <AdminSurface intensity="low" className="p-6 relative overflow-hidden">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Profile Identifier</label>
                    <input
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/30 px-5 text-sm font-black text-slate-950 outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-200"
                      onChange={(e) => onChange({ name: e.target.value })}
                      placeholder="e.g. Science Default Mixed"
                      value={draft.name}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Internal Protocol Details</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-2xl border border-slate-200 bg-slate-50/30 p-5 text-sm font-medium text-slate-600 outline-none transition-all focus:border-slate-950 focus:bg-white resize-none placeholder:text-slate-200"
                      onChange={(e) => onChange({ description: e.target.value })}
                      placeholder="Explain the intended use case for this profile..."
                      value={draft.description ?? ""}
                    />
                  </div>
                </div>
             </AdminSurface>
          </section>

          {/* Question Mix Section */}
          <section className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                   <Settings2 className="h-3.5 w-3.5 text-slate-400" />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Generation Mixer</h3>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Obj: {objectiveCount}</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Subj: {subjectiveCount}</span>
                   </div>
                </div>
             </div>
             
             <AdminSurface intensity="low" className="p-6 space-y-8">
                <div className="space-y-2">
                   <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-950">Logic Balance</span>
                      <span className="text-[10px] font-black text-slate-400">{draft.totalQuestions} Total Questions</span>
                   </div>
                   <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner border border-slate-200/50">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(59,130,246,0.3)]" 
                        style={{ width: `${objectivePercent}%` }} 
                      />
                      <div 
                        className="h-full bg-amber-500 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(245,158,11,0.3)]" 
                        style={{ width: `${100 - objectivePercent}%` }} 
                      />
                   </div>
                </div>

                <div className="grid gap-3">
                  {mixFields.map((field) => (
                    <QuantityRow
                      key={field.key}
                      label={field.label}
                      value={draft.questionMix[field.key]}
                      onChange={(val) => updateMix(field.key, val)}
                      isSubjective={field.key === "short_answer" || field.key === "essay"}
                    />
                  ))}
                </div>
             </AdminSurface>
          </section>
        </div>

        {/* Deployment Sidebar */}
        <aside className="space-y-8">
          <section className="space-y-4">
             <div className="flex items-center gap-2 px-1">
                <Target className="h-3.5 w-3.5 text-slate-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Global Strategy</h3>
             </div>
             
             <AdminSurface intensity="low" className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Core Logic Variant</label>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 appearance-none cursor-pointer"
                    onChange={(e) => updateQuestionStyle(e.target.value as QuestionStyle)}
                    value={draft.questionStyle}
                  >
                    <option value="balanced">Balanced Distribution</option>
                    <option value="mixed_open_ended">Mixed Open-ended</option>
                    <option value="open_ended_heavy">Critical Thinking Heavy</option>
                    <option value="objective_heavy">Objective Assessment</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <ToggleRow
                    label="Teacher Overrides"
                    description="Allow manual Q mix tuning"
                    active={draft.allowTeacherOverrides}
                    onClick={() => onChange({ allowTeacherOverrides: !draft.allowTeacherOverrides })}
                  />
                  <ToggleRow
                    label="School Default"
                    description={draft.isActive ? "Default for new sessions" : "Archived profiles cannot be defaults"}
                    active={draft.isDefault}
                    onClick={() => onChange({ isDefault: draft.isActive ? !draft.isDefault : false })}
                  />
                  <ToggleRow
                    label={draft.isActive ? "Active Profile" : "Archived Profile"}
                    description={draft.isActive ? "Available in generator" : "Hidden from teacher generator"}
                    active={draft.isActive}
                    onClick={() => updateActiveStatus(!draft.isActive)}
                  />
                </div>
             </AdminSurface>
          </section>

          {/* Shrunk Audit Notice */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3 transition-all hover:bg-white hover:border-slate-200 group">
             <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 mt-0.5 transition-colors group-hover:text-blue-500" />
             <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-950">Synchronization Protocol</p>
                <p className="text-[10px] font-bold text-slate-500 leading-normal">
                   Changes affect future assessment drafts after saving. Archived profiles are kept for history but hidden from teachers.
                </p>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuantityRow({ label, value, onChange, isSubjective }: { label: string; value: number; onChange: (v: number) => void; isSubjective?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 group border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-3">
         <div className={cn(
           "h-1 w-1 rounded-full",
           value > 0 
            ? isSubjective ? "bg-amber-400" : "bg-blue-500"
            : "bg-slate-200"
         )} />
         <span className={cn(
           "text-[10px] font-black uppercase tracking-widest transition-colors",
           value > 0 ? "text-slate-900" : "text-slate-400 group-hover:text-slate-500"
         )}>
           {label}
         </span>
      </div>
      
      <div className="flex items-center bg-slate-50/50 border border-slate-100 rounded-xl p-0.5 transition-all group-hover:bg-white group-hover:border-slate-200">
         <button
           onClick={() => onChange(value - 1)}
           disabled={value <= 0}
           className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:opacity-0 transition-all"
         >
           <Minus className="h-3 w-3" />
         </button>
         
         <div className="w-10 text-center">
            <span className={cn(
              "font-display text-xs font-black tabular-nums",
              value > 0 ? "text-slate-950" : "text-slate-300"
            )}>
              {value}
            </span>
         </div>
         
         <button
           onClick={() => onChange(value + 1)}
           className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-950 transition-all border border-transparent hover:border-slate-100 hover:shadow-sm"
         >
           <Plus className="h-3 w-3" />
         </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, active, onClick }: { label: string; description: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-xl p-3 text-left transition-all border border-transparent",
        active ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10" : "hover:bg-slate-50 text-slate-600"
      )}
    >
      <div className="min-w-0">
         <p className="text-[10px] font-black uppercase tracking-widest truncate">{label}</p>
         <p className={cn(
           "text-[8px] font-bold uppercase tracking-tighter truncate opacity-40",
           active ? "text-white" : "text-slate-400"
         )}>
           {description}
         </p>
      </div>
      <div className={cn(
        "h-1.5 w-1.5 rounded-full shrink-0 ml-4",
        active ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" : "bg-slate-200"
      )} />
    </button>
  );
}
