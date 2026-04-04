"use client";

import { Monitor, Layout } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import type { BundleDraft, BundleFieldDraft, ScaleTemplateRecord } from "../types";
import { getBundlePreviewValue, getSectionInternalFields, getSectionPrintableFields } from "../utils";

interface BundlePreviewProps {
  draft: BundleDraft;
  scaleTemplates: ScaleTemplateRecord[];
}

export function BundlePreview({ draft, scaleTemplates }: BundlePreviewProps) {
  const version = (draft as BundleDraft & { version?: string | null }).version?.trim();

  return (
    <AdminSurface intensity="medium" className="p-4 sm:p-6 space-y-6 rounded-2xl animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between border-b border-slate-50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Monitor className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Virtual Output</h2>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-tight">Real-time compilation preview</p>
          </div>
        </div>
        <div className="px-2 py-1 bg-emerald-500/10 rounded text-[10px] font-black uppercase tracking-widest text-emerald-600 animate-pulse">
          Live Feed
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-2xl shadow-slate-900/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Active Blueprint</span>
              {version && (
                <div className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-bold uppercase tracking-widest text-white/60">
                  {version}
                </div>
              )}
            </div>
            <h3 className="text-xl font-black tracking-tight">{draft.name.trim() || "Unlabeled Asset"}</h3>
            {draft.description.trim() && (
              <p className="text-xs font-medium text-white/50 leading-relaxed max-w-sm line-clamp-2 italic">
                {draft.description.trim()}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {draft.sections.map((section) => (
            <div key={section.key} className="space-y-3">
              <div className="flex items-center gap-3 px-1">
                <Layout className="w-3 h-3 text-slate-300" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  {section.label.trim() || "Void Section"}
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <PreviewSection
                  fields={getSectionPrintableFields(section)}
                  scaleTemplates={scaleTemplates}
                  title="Export Buffer"
                  tone="success"
                />
                <PreviewSection
                  fields={getSectionInternalFields(section)}
                  scaleTemplates={scaleTemplates}
                  title="Internal Cache"
                  tone="warning"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminSurface>
  );
}

function PreviewSection({
  fields,
  scaleTemplates,
  title,
  tone,
}: {
  fields: BundleFieldDraft[];
  scaleTemplates: ScaleTemplateRecord[];
  title: string;
  tone: "success" | "warning";
}) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className={`w-1 h-1 rounded-full ${tone === "success" ? "bg-emerald-400" : "bg-amber-400"}`} />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">{title}</span>
      </div>
      {fields.map((field) => (
        <div
          key={field.key}
          className="group relative flex items-center justify-between gap-4 border border-slate-50 bg-slate-50/10 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-800">{field.label.trim() || "Unnamed Node"}</div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {field.type} • {field.source}
            </div>
          </div>
          <div className={`text-xs font-black uppercase tracking-widest ${tone === "success" ? "text-emerald-600" : "text-amber-600"}`}>
            {getBundlePreviewValue(field, scaleTemplates)}
          </div>
        </div>
      ))}
    </div>
  );
}
