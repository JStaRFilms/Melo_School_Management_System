"use client";

import { useState } from "react";
import type { ReportCardSheetData } from "@school/shared";

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "text-emerald-700";
    case "B":
      return "text-blue-700";
    case "C":
      return "text-amber-700";
    case "D":
      return "text-orange-700";
    case "E":
    case "F":
      return "text-rose-700";
    default:
      return "text-slate-500";
  }
}

function fmtScore(v: number | null) {
  if (v === null) return "-";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function isIncompleteCumulativeResult(
  result: ReportCardSheetData["results"][number]
) {
  return (
    result.calculationMode === "cumulative_annual" &&
    result.isCumulativeComplete === false
  );
}

function gradeDisplay(result: ReportCardSheetData["results"][number]) {
  return isIncompleteCumulativeResult(result) ? "—" : result.gradeLetter;
}

export function ResultsSummary({
  reportCard,
}: {
  reportCard: ReportCardSheetData;
}) {
  const ac = reportCard.assessmentConfig;
  const { results, summary } = reportCard;
  const [isExpanded, setIsExpanded] = useState(false);
  const isCumulativeAnnual = reportCard.resultCalculationMode === "cumulative_annual";

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group">
      {/* ---- Accordion pill ---- */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 cursor-pointer flex items-center justify-between outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-900 transition-colors border-none"
      >
        <div className="flex items-center gap-4">
          <svg
            className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : "rotate-0"}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">
            Results
          </span>
        </div>
        <div className="text-[11px] font-semibold text-slate-900">
          {isCumulativeAnnual ? "Sheet Avg:" : "Avg:"}{" "}
          <span className="font-bold">
            {summary.averageScore !== null
              ? Number(summary.averageScore).toFixed(1)
              : "-"}
          </span>{" "}
          &nbsp;&nbsp; {isCumulativeAnnual ? "Sheet Total:" : "Total:"}{" "}
          <span className="font-bold">
            {summary.totalScore.toFixed(1)}
          </span>
        </div>
      </button>

      {/* ---- Scrollable table (Collapsible) ---- */}
      {isExpanded ? (
        <div className="border-t border-slate-100 bg-white">
          {isCumulativeAnnual ? (
            <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-[11px] font-semibold text-emerald-900">
              Annual cumulative view: 1st + 2nd + 3rd term totals determine the annual average.
            </div>
          ) : null}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-bold uppercase tracking-wide text-slate-500">
                    Subject
                  </th>
                  {isCumulativeAnnual ? (
                    <>
                      <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-400">
                        1st Term
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-400">
                        2nd Term
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-400">
                        3rd Term
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-900">
                        Annual Avg
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-400">
                        CA1
                        <span className="hidden sm:inline"> ({ac.ca1Max})</span>
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-400">
                        CA2
                        <span className="hidden sm:inline"> ({ac.ca2Max})</span>
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-400">
                        CA3
                        <span className="hidden sm:inline"> ({ac.ca3Max})</span>
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-400">
                        Exam
                        <span className="hidden sm:inline"> ({ac.examMax})</span>
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-900">
                        Total
                      </th>
                    </>
                  )}
                  <th className="px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-900">
                    Grd
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={r.subjectId}
                    className={
                      !r.isRecorded
                        ? "bg-amber-50/60"
                        : i % 2 === 0
                          ? "bg-white"
                          : "bg-slate-50/50"
                    }
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-semibold text-slate-800 flex items-center gap-2">
                      {r.subjectName}
                      {isCumulativeAnnual &&
                        (r.calculationMode === "cumulative_annual" && r.missingHistoricalTerms && r.missingHistoricalTerms.length > 0 ? (
                          <span className="min-w-fit rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 uppercase tracking-wider">
                            Incomplete
                          </span>
                        ) : r.calculationMode !== "cumulative_annual" ? (
                          <span className="min-w-fit rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            Standalone
                          </span>
                        ) : null)}
                    </td>
                    {isCumulativeAnnual ? (
                      <>
                        <td className="px-2 py-2 text-center tabular-nums text-slate-600">
                          {r.calculationMode === "cumulative_annual" ? fmtScore(r.firstTermTotal ?? null) : "-"}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-slate-600">
                          {r.calculationMode === "cumulative_annual" ? fmtScore(r.secondTermTotal ?? null) : "-"}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-slate-600">
                          {r.calculationMode === "cumulative_annual" ? fmtScore(r.currentTermTotal ?? null) : fmtScore(r.total)}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums font-bold text-slate-900">
                          {r.calculationMode === "cumulative_annual" ? fmtScore(r.annualAverage ?? null) : fmtScore(r.total)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-2 text-center tabular-nums text-slate-600">
                          {fmtScore(r.ca1)}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-slate-600">
                          {fmtScore(r.ca2)}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-slate-600">
                          {fmtScore(r.ca3)}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-slate-600">
                          {fmtScore(r.examScore)}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums font-bold text-slate-900">
                          {fmtScore(r.total)}
                        </td>
                      </>
                    )}
                    <td
                      className={`px-2 py-2 text-center font-bold ${isIncompleteCumulativeResult(r) ? "text-slate-400" : gradeColor(r.gradeLetter)}`}
                    >
                      {gradeDisplay(r)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* ---- Footer: recorded count ---- */}
          {summary.pendingSubjects > 0 ? (
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 text-[11px] font-bold tracking-widest uppercase text-amber-600">
              {summary.pendingSubjects} subject
              {summary.pendingSubjects === 1 ? "" : "s"} not yet recorded
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
