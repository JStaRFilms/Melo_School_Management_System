"use client";

import { BookOpenText, Layers3, Plus, Search, ChevronRight } from "lucide-react";
import { cn } from "@/utils";
import type { InstructionTemplateListItem, InstructionTemplateOutputType } from "../types";
import { instructionTemplateOutputTypeOptions } from "../utils";

interface TemplateListPanelProps {
  templates: InstructionTemplateListItem[];
  summary: {
    total: number;
    active: number;
    defaultCount: number;
    inactive: number;
  };
  selectedTemplateId: string | "new" | null;
  onSelectTemplate: (templateId: string | "new") => void;
  onCreateTemplate: () => void;
  outputType: InstructionTemplateOutputType;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOutputTypeChange: (outputType: InstructionTemplateOutputType) => void;
}

export function TemplateListPanel({
  templates,
  summary,
  selectedTemplateId,
  onSelectTemplate,
  onCreateTemplate,
  outputType,
  searchQuery,
  onSearchQueryChange,
  onOutputTypeChange,
}: TemplateListPanelProps) {
  return (
    <div className="flex h-full flex-col bg-white/40 backdrop-blur-md">
      <div className="sticky top-0 z-10 space-y-3 px-4 py-5 lg:px-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Catalog
            </h2>
            <p className="text-base font-black tracking-tight text-slate-900">
              {summary.total} {outputType.replace(/_/g, " ")}s
            </p>
          </div>
          <button
            onClick={onCreateTemplate}
            className="group flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-xl shadow-slate-950/20 transition-all hover:bg-slate-800 active:scale-95"
            title="New Template"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search catalog..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white/50 pl-9 pr-3 text-xs font-medium outline-none transition-all focus:bg-white focus:ring-4 focus:ring-slate-950/5"
          />
        </div>

        <div className="flex gap-1 rounded-xl bg-slate-100/50 p-1">
          {instructionTemplateOutputTypeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onOutputTypeChange(option.value)}
              className={cn(
                "flex-1 rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-widest transition-all",
                option.value === outputType
                  ? "bg-white text-slate-950 shadow-sm shadow-slate-950/5"
                  : "text-slate-500 hover:text-slate-950"
              )}
            >
              {option.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>


      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-6 lg:px-6 knowledge-scrollbar">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <BookOpenText className="h-8 w-8 text-slate-200" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Empty State
            </p>
          </div>
        ) : (
          templates.map((template) => (
            <TemplateListItemCard
              key={template._id}
              template={template}
              isSelected={selectedTemplateId === template._id}
              onSelect={() => onSelectTemplate(template._id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TemplateListItemCard({
  template,
  isSelected,
  onSelect,
}: {
  template: InstructionTemplateListItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300",
        isSelected
          ? "border-slate-950 bg-slate-950 text-white shadow-2xl shadow-slate-950/20"
          : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/40"
      )}
    >
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className={cn(
              "truncate text-sm font-black uppercase tracking-tight",
              isSelected ? "text-white" : "text-slate-900"
            )}>
              {template.title}
            </h3>
            <p className={cn(
              "truncate text-[10px] font-bold uppercase tracking-widest",
              isSelected ? "text-white/40" : "text-slate-400"
            )}>
              {template.applicabilityLabel}
            </p>
          </div>
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
            isSelected ? "bg-white/10 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600"
          )}>
            <ChevronRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5", isSelected ? "text-white" : "text-slate-300")} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest",
              isSelected ? "text-white/30" : "text-slate-300"
            )}>
              {template.sectionCount} Sections
            </span>
            <div className={cn("h-1 w-1 rounded-full", isSelected ? "bg-white/20" : "bg-slate-200")} />
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest",
              isSelected ? "text-white/30" : "text-slate-300"
            )}>
              {template.requiredSectionCount} Required
            </span>
          </div>

          <span className={cn(
            "rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-widest transition-colors",
            template.isActive
              ? isSelected ? "bg-emerald-400/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"
              : isSelected ? "bg-white/5 text-white/40" : "bg-slate-50 text-slate-400"
          )}>
            {template.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {isSelected && (
        <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
      )}
    </button>
  );
}
