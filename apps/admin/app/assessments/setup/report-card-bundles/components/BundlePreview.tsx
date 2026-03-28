"use client";

import type { BundleDraft, BundleFieldDraft, ScaleTemplateRecord } from "../types";
import {
  getBundlePreviewValue,
  getSectionInternalFields,
  getSectionPrintableFields,
} from "../utils";

interface BundlePreviewProps {
  draft: BundleDraft;
  scaleTemplates: ScaleTemplateRecord[];
}

export function BundlePreview({ draft, scaleTemplates }: BundlePreviewProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-1 border-b border-slate-100 pb-5">
        <h2 className="text-lg font-semibold text-slate-900">Live preview</h2>
        <p className="text-sm text-slate-500">Shows the current field order and which items land on the printed report card.</p>
      </div>

      <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="border-b border-slate-200 pb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Bundle preview</div>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{draft.name.trim() || "Untitled bundle"}</h3>
          {draft.description.trim() && <p className="mt-1 text-sm text-slate-500">{draft.description.trim()}</p>}
        </div>

        <div className="mt-5 space-y-5">
          {draft.sections.map((section) => (
            <div key={section.key} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {section.label.trim() || "Untitled section"}
                </div>
              </div>
              <PreviewSection
                fields={getSectionPrintableFields(section)}
                scaleTemplates={scaleTemplates}
                title="Printable fields"
              />
              <PreviewSection
                fields={getSectionInternalFields(section)}
                scaleTemplates={scaleTemplates}
                title="Internal-only fields"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreviewSection({
  fields,
  scaleTemplates,
  title,
}: {
  fields: BundleFieldDraft[];
  scaleTemplates: ScaleTemplateRecord[];
  title: string;
}) {
  return (
    <div className="mt-5 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</div>
      {fields.length > 0 ? (
        fields.map((field) => (
          <div key={field.key} className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">{field.label.trim() || "Untitled field"}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{field.type}</div>
              </div>
              <div className="text-sm font-medium text-slate-600">{getBundlePreviewValue(field, scaleTemplates)}</div>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
          No fields in this section.
        </div>
      )}
    </div>
  );
}
