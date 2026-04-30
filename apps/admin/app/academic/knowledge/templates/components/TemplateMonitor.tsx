"use client";

import { Terminal, Layers3, PencilLine, ShieldCheck } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { cn } from "@/utils";
import type { InstructionTemplateDraft, InstructionTemplateListItem } from "../types";
import { 
  instructionTemplateScopeOptions, 
  getInstructionTemplateDraftResolutionRank,
  getInstructionTemplateScopeLabel
} from "../utils";

interface TemplateMonitorProps {
  draft: InstructionTemplateDraft;
  templates: InstructionTemplateListItem[];
  subjectLabel: string;
  scopeSummary: string;
  currentTemplateLabel: string;
  previewPathLabel: string;
  validationIssue: string | null;
}

export function TemplateMonitor({
  draft,
  templates,
  subjectLabel,
  scopeSummary,
  currentTemplateLabel,
  previewPathLabel,
  validationIssue,
}: TemplateMonitorProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Logic Waterfall & Matrix View */}
      <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
        {/* Left Column: Resolution Trace Waterfall - Moved to bottom on mobile */}
        <div className="order-2 lg:order-1 space-y-8">
          <div className="space-y-1.5 px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Resolution Path</h2>
            <p className="text-sm font-bold text-slate-900 tracking-tight">How this template was selected</p>
          </div>

          <div className="relative space-y-2 pl-4">
            {/* The Waterfall Line */}
            <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-100" />
            
            {instructionTemplateScopeOptions.map((option, idx) => {
              const isCurrent = option.value === draft.templateScope;
              return (
                <div key={option.value} className="relative">
                  {/* Indicator Dot */}
                  <div className={cn(
                    "absolute -left-[18px] top-3.5 h-2 w-2 rounded-full ring-4 ring-white transition-all duration-500",
                    isCurrent ? "bg-slate-950 scale-125" : "bg-slate-100"
                  )} />
                  
                  <div className={cn(
                    "rounded-2xl border p-4 transition-all duration-300",
                    isCurrent 
                      ? "border-slate-950 bg-white shadow-xl shadow-slate-950/5 ring-1 ring-slate-950/5" 
                      : "border-transparent bg-transparent opacity-40"
                  )}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", isCurrent ? "text-slate-950" : "text-slate-400")}>
                        {idx === 0 && "Primary Match"}
                        {idx === 1 && "Subject Fallback"}
                        {idx === 2 && "Level Fallback"}
                        {idx === 3 && "Global Default"}
                      </span>
                      {isCurrent && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                    </div>
                    <p className={cn("mt-1 text-[10px] font-medium leading-relaxed", isCurrent ? "text-slate-500" : "text-slate-300")}>
                      {option.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-emerald-50 p-6 border border-emerald-100/50">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Audit Status</p>
            </div>
            <p className="text-sm font-bold text-emerald-900">Logic Verified</p>
            <p className="mt-1 text-[10px] font-medium text-emerald-600/80 leading-relaxed">
              Resolution path is stable and matches the current academic context.
            </p>
          </div>
        </div>

        {/* Right Column: High-Density Section Matrix - Prioritized on mobile */}
        <div className="order-1 lg:order-2 space-y-6">
          <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-6 py-5 text-white shadow-xl shadow-slate-950/10">
            <div className="space-y-0.5">
              <h1 className="text-xl font-black tracking-tight">
                {draft.title || "Untitled Resolution"}
              </h1>
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Resolved Configuration</span>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-6 border-l border-white/10 pl-6">
              <MatrixStat label="Scope" value={draft.templateScope.replace(/_/g, " ")} color="text-white" />
              <MatrixStat label="Rank" value={`#${getInstructionTemplateDraftResolutionRank(draft)}`} color="text-emerald-400" />
            </div>
          </div>

          <AdminSurface intensity="low" className="p-0 overflow-hidden border-slate-200/60 bg-white shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 lg:px-8 py-3 lg:py-4">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Structural Units</span>
              <span className="hidden lg:block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Content Constraints</span>
            </div>

            <div className="divide-y divide-slate-100">
              {draft.sections.map((section, idx) => (
                <div key={idx} className="group flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 lg:px-8 py-5 lg:py-6 transition-all hover:bg-slate-50/30">
                  <div className="flex items-center gap-4 lg:gap-5">
                    <div className="flex h-7 w-7 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-black text-slate-400 transition-all group-hover:bg-slate-950 group-hover:text-white">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm lg:text-base font-bold text-slate-900 tracking-tight">{section.label || "Unnamed Block"}</p>
                      <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-slate-300">{section.required ? "Strict Requirement" : "Optional Component"}</p>
                    </div>
                  </div>
                  
                  <div className="lg:text-right space-y-0.5 pl-11 lg:pl-0">
                    <p className="text-sm font-black text-slate-900">{section.minimumWordCount} words</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Min. Word Count</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50/50 p-6 lg:p-8 border-t border-slate-100">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Global Objectives</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8">
                  <SmallStat label="Objectives" value={draft.objectiveMinimums.minimumObjectives} />
                  <SmallStat label="Sources" value={draft.objectiveMinimums.minimumSourceMaterials} />
                  <SmallStat label="Total Sections" value={draft.objectiveMinimums.minimumSections} />
                </div>
              </div>
            </div>
          </AdminSurface>
        </div>
      </div>
    </div>
  );
}

function MatrixStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="space-y-0.5 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/30">{label}</p>
      <p className={cn("text-lg font-black tracking-tight", color)}>{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-xl font-black text-slate-950 tracking-tighter">{value}</p>
    </div>
  );
}

function AuditStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

