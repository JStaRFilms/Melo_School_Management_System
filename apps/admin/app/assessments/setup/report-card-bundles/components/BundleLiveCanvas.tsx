"use client";

import { memo, useMemo } from "react";
import { 
  CheckCircle2, 
  Eye, 
  ShieldCheck, 
  GraduationCap, 
  Calendar, 
  Clock,
  Sparkles
} from "lucide-react";
import type { BundleDraft, BundleSectionDraft, ScaleTemplateRecord } from "../types";

interface BundleLiveCanvasProps {
  draft: BundleDraft;
  scaleTemplates: ScaleTemplateRecord[];
}

export const BundleLiveCanvas = memo(function BundleLiveCanvas({
  draft,
  scaleTemplates,
}: BundleLiveCanvasProps) {
  const scaleMap = useMemo(() => {
    const map: Record<string, ScaleTemplateRecord> = {};
    for (const scale of scaleTemplates) {
      map[scale._id] = scale;
    }
    return map;
  }, [scaleTemplates]);

  const totalFields = useMemo(
    () => draft.sections.reduce((acc, s) => acc + s.fields.length, 0),
    [draft.sections]
  );

  return (
    <div className="w-full space-y-4">
      {/* Simulated High-Fidelity A4 Report Card Sheet */}
      <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xl shadow-slate-900/5 space-y-5 transition-all text-slate-800">
        {/* School Crest & Report Header */}
        <div className="border-b-2 border-slate-900/10 pb-4 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-md shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 truncate">
                Melo Comprehensive Academy
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                Student Termly Assessment Report
              </p>
            </div>
          </div>

          {/* Sample Student Details Banner */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[10px] font-medium text-slate-600">
            <div>
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Student:</span>
              <span className="font-bold text-slate-900">Favour Adebayo</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Class:</span>
              <span className="font-bold text-slate-900">Primary 4B</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Session:</span>
              <span className="font-bold text-slate-900">2026/2027</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Term:</span>
              <span className="font-bold text-slate-900">First Term</span>
            </div>
          </div>
        </div>

        {/* Dynamic Bundle Name Header */}
        <div className="space-y-0.5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
            {draft.name.trim() || "Report Card Add-on Section"}
          </h4>
          {draft.description.trim() && (
            <p className="text-[10px] text-slate-400 leading-relaxed italic">
              {draft.description.trim()}
            </p>
          )}
        </div>

        {/* Dynamic Sections on the Sheet */}
        {draft.sections.length === 0 || totalFields === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed border-slate-100 bg-slate-50/50 space-y-2 p-4">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <p className="text-xs font-bold text-slate-700">No Traits or Fields Added</p>
            <p className="text-[11px] text-slate-400 max-w-[240px]">
              Add traits on the left or select a 1-click starter template to see the live sheet update.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {draft.sections.map((section, sIdx) => (
              <CanvasSection
                key={section.key}
                section={section}
                sectionIndex={sIdx}
                scaleMap={scaleMap}
              />
            ))}
          </div>
        )}

        {/* Sheet Footer */}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            Report Card Output
          </span>
          <span>Melo Portal</span>
        </div>
      </div>
    </div>
  );
});

interface CanvasSectionProps {
  section: BundleSectionDraft;
  sectionIndex: number;
  scaleMap: Record<string, ScaleTemplateRecord>;
}

const CanvasSection = memo(function CanvasSection({
  section,
  sectionIndex,
  scaleMap,
}: CanvasSectionProps) {
  const printableFields = section.fields.filter((f) => f.printable);
  const internalFields = section.fields.filter((f) => !f.printable);

  const scaleFields = printableFields.filter((f) => f.type === "scale");
  const otherPrintableFields = printableFields.filter((f) => f.type !== "scale");

  const firstScaleField = scaleFields[0];
  const activeScale = firstScaleField?.scaleTemplateId ? scaleMap[firstScaleField.scaleTemplateId] : null;
  const scaleOptions = activeScale?.options ?? [
    { id: "5", label: "Excellent", shortLabel: "5", order: 0 },
    { id: "4", label: "Good", shortLabel: "4", order: 1 },
    { id: "3", label: "Fair", shortLabel: "3", order: 2 },
    { id: "2", label: "Poor", shortLabel: "2", order: 3 },
    { id: "1", label: "Very Poor", shortLabel: "1", order: 4 },
  ];

  return (
    <div className="space-y-2.5">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
        <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
          {section.label.trim() || `Section ${sectionIndex + 1}`}
        </h5>
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
          {printableFields.length} Printed {internalFields.length > 0 && `• ${internalFields.length} Internal`}
        </span>
      </div>

      {/* Scale Ratings Matrix */}
      {scaleFields.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-500">
                <th className="p-2 text-left">Trait / Characteristic</th>
                {scaleOptions.map((opt, optIdx) => (
                  <th key={opt.id ?? `opt-${optIdx}`} className="p-1.5 text-center w-8" title={opt.label}>
                    <span className="block font-black text-slate-800">{opt.shortLabel || opt.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-[11px]">
              {scaleFields.map((field, fIdx) => {
                const mockCheckedIndex = fIdx % scaleOptions.length === 0 ? 0 : (fIdx % 2);
                return (
                  <tr key={field.key} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2 font-bold text-slate-900 truncate max-w-[160px]">
                      {field.label.trim() || "Untitled Trait"}
                    </td>
                    {scaleOptions.map((opt, optIdx) => {
                      const isChecked = optIdx === mockCheckedIndex;
                      return (
                        <td key={opt.id ?? `cell-${optIdx}`} className="p-1.5 text-center">
                          <div className="flex items-center justify-center">
                            {isChecked ? (
                              <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                              </div>
                            ) : (
                              <div className="w-3 h-3 rounded-full border border-slate-200" />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Narrative & Metric Fields */}
      {otherPrintableFields.length > 0 && (
        <div className="grid gap-2">
          {otherPrintableFields.map((field) => (
            <div
              key={field.key}
              className="rounded-lg border border-slate-200 bg-slate-50/40 p-2.5 space-y-1"
            >
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                <span>{field.label.trim() || "Custom Field"}</span>
                {field.source === "system_term" && (
                  <span className="flex items-center gap-1 text-indigo-600">
                    <Calendar className="w-2.5 h-2.5" /> Term
                  </span>
                )}
                {field.source === "system_attendance" && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Clock className="w-2.5 h-2.5" /> Attendance
                  </span>
                )}
              </div>

              {field.type === "text" && (
                <div className="text-[11px] font-semibold text-slate-800 bg-white p-2 rounded border border-slate-100 italic">
                  {field.source === "system_term"
                    ? "28 Dec 2026 (Next Term Resumption)"
                    : "“A calm, obedient, and hardworking pupil. Keep up the good work.”"}
                </div>
              )}

              {field.type === "number" && (
                <div className="text-xs font-black text-slate-900 bg-white px-2.5 py-1.5 rounded border border-slate-100 flex items-center justify-between">
                  <span>62 / 65</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Days Recorded</span>
                </div>
              )}

              {field.type === "boolean" && (
                <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Yes (Completed)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Internal-only badge */}
      {internalFields.length > 0 && (
        <div className="rounded-md bg-amber-50/60 border border-amber-200/60 p-2 flex items-center justify-between text-[9px]">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-amber-600" />
            <span className="font-bold text-amber-900">
              {internalFields.length} Internal {internalFields.length === 1 ? "Field" : "Fields"}:
            </span>
            <span className="font-medium text-amber-800 truncate max-w-[120px]">
              {internalFields.map(f => f.label || "Untitled").join(", ")}
            </span>
          </div>
          <span className="font-bold uppercase tracking-wider text-amber-600">Hidden</span>
        </div>
      )}
    </div>
  );
});
