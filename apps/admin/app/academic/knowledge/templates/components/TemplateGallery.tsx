"use client";

import { useState } from "react";
import type { InstructionTemplateOutputType } from "../types";
import { INSTRUCTION_TEMPLATE_PRESETS, type InstructionTemplatePreset } from "../presets";

export function TemplateGallery({ outputType, onUse, onScratch, onBack, backLabel = "Back to saved" }: {
  outputType: InstructionTemplateOutputType;
  backLabel?: string;
  onUse: (preset: InstructionTemplatePreset) => void;
  onScratch: () => void;
  onBack: () => void;
}) {
  const [category, setCategory] = useState("Recommended");
  const [preview, setPreview] = useState<InstructionTemplatePreset | null>(null);
  const categories = ["Recommended", "Lesson Plans", "Student Notes", "Assignments"];
  const candidates = INSTRUCTION_TEMPLATE_PRESETS.filter((preset) =>
    category === "Recommended" ? preset.outputType === outputType : preset.category === category || (preset.category === "Recommended" &&
      (category === "Lesson Plans" && preset.outputType === "lesson_plan" || category === "Student Notes" && preset.outputType === "student_note" || category === "Assignments" && preset.outputType === "assignment"))
  );
  return (
    <section className="space-y-6" aria-label="Template Gallery">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Template Gallery</p><h2 className="text-2xl font-bold text-slate-950">Start with a template</h2><p className="text-sm text-slate-500">Review and customize a starter before saving it to your school.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={onBack} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold">{backLabel}</button><button type="button" onClick={onScratch} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold">Start From Scratch</button></div>
      </div>
      {preview ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold uppercase text-slate-400">{preview.outputType.replaceAll("_", " ")} · {preview.recommendedFor}</p>
          <h3 className="mt-2 text-xl font-bold text-slate-950">{preview.name}</h3><p className="mt-2 max-w-prose text-sm text-slate-600">{preview.description}</p>
          <ol className="mt-5 space-y-3">{preview.sections.map((section) => <li key={section.key} className="border-l-2 border-slate-200 pl-4"><p className="text-sm font-bold">{section.label} <span className="font-normal text-slate-500">{section.required ? "required" : "optional"}</span></p>{section.guidance && <p className="mt-1 max-w-prose text-xs text-slate-600">{section.guidance}</p>}</li>)}</ol>
          <p className="mt-5 text-xs text-slate-500">At least {preview.rules.minimumSources} sources and {preview.rules.minimumTotalSections} filled sections. Minimum objectives: {preview.rules.minimumObjectives}, checked when an objectives section exists.</p>
          <div className="mt-5 flex gap-2"><button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold">Back to gallery</button><button type="button" onClick={() => onUse(preview)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">Use Template</button></div>
        </div>
      ) : (
        <><div className="flex flex-wrap gap-2" role="group" aria-label="Starter categories">{categories.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)} className={`rounded-lg px-3 py-2 text-xs font-bold ${category === item ? "bg-slate-950 text-white" : "bg-white text-slate-600"}`}>{item}</button>)}</div>
          <div className="grid gap-4 xl:grid-cols-2">{candidates.map((preset) => <article key={preset.id} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase text-slate-500">{preset.outputType.replaceAll("_", " ")} · {preset.recommendedFor}</p><h3 className="mt-2 text-lg font-bold">{preset.name}</h3><p className="mt-2 text-sm text-slate-600">{preset.description}</p><p className="mt-3 text-xs text-slate-500">{preset.sections.length} sections · {preset.sections.slice(0, 4).map((section) => section.label).join(", ")}{preset.sections.length > 4 ? "…" : ""}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => setPreview(preset)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Preview</button><button type="button" onClick={() => onUse(preset)} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white">Use Template</button></div></article>)}</div></>
      )}
    </section>
  );
}
