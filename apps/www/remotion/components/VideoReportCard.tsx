import React from "react";
import { ReportCardPreview } from "../../../../packages/shared/src/components/ReportCardPreview";
import { mockReportCard } from "../data/mockReportCard";

export const VideoReportCard: React.FC = () => {
  return (
    <div className="grid h-full grid-cols-[280px_minmax(0,1fr)] gap-6">
      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-5">
          <div className="space-y-2">
            <h3 className="text-[22px] font-bold tracking-tight text-slate-900">
              Report Card Workbench
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                2025/2026 Session
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                First Term
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Selector label="Class" value="Grade 5 A" />
            <Selector label="Student" value="Sarah Sunday (GA/PRI/0051)" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Results
              </span>
              <span className="text-[11px] font-semibold text-slate-900">
                Avg <strong>88.3</strong>
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {mockReportCard.results.slice(0, 4).map((result, index: number) => (
                <div
                  key={result.subjectId}
                  className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                    index === 0 ? "bg-white shadow-sm" : "bg-slate-50"
                  }`}
                >
                  <span className="font-semibold text-slate-700">{result.subjectName}</span>
                  <span className="tabular-nums font-bold text-slate-900">{result.total}</span>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    {result.gradeLetter}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex items-start justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-[#eef2f7] px-4 py-4 shadow-inner">
        <div className="origin-top scale-[0.96]">
          <ReportCardPreview
            reportCard={mockReportCard}
            backHref="/results"
            hideToolbar
            previewScale={0.7}
          />
        </div>
      </div>
    </div>
  );
};

function Selector({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 shadow-sm">
      <span className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
