import React, { useState } from "react";
import { Search, AlertCircle, CheckCircle2 } from "lucide-react";
import type { StagedStudentRow } from "./RosterReviewTab";

type StagedGradeRow = StagedStudentRow;

export interface ResultsReviewTabProps {
  records: StagedGradeRow[];
  onPatchField: (recordId: string, patch: Record<string, unknown>) => Promise<void>;
  onReview: (record: StagedStudentRow) => void;
}

export function ResultsReviewTab({ records, onPatchField, onReview }: ResultsReviewTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const gradeRecords = records.filter((record) => record.entityType === "grade_record");

  const filtered = gradeRecords.filter((rec) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const name = `${rec.parsedData.firstName} ${rec.parsedData.lastName}`.toLowerCase();
    const subj = rec.parsedData.subjectName?.toLowerCase() || "";
    const cls = rec.parsedData.className.toLowerCase();
    return name.includes(term) || subj.includes(term) || cls.includes(term);
  });

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student, class, or subject..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9.5 pr-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <span className="text-xs font-bold text-slate-500">
          {gradeRecords.length} Staged Academic {gradeRecords.length === 1 ? "Record" : "Records"}
        </span>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3.5 w-16">Row</th>
              <th className="px-4 py-3.5 min-w-[180px]">Student</th>
              <th className="px-4 py-3.5 min-w-[120px]">Class</th>
              <th className="px-4 py-3.5 min-w-[160px]">Subject</th>
              <th className="px-4 py-3.5 w-24">CA1 (20)</th>
              <th className="px-4 py-3.5 w-24">CA2 (20)</th>
              <th className="px-4 py-3.5 w-24">Exam (60)</th>
              <th className="px-4 py-3.5 w-24">Total</th>
              <th className="px-4 py-3.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-xs text-slate-400">
                  {gradeRecords.length === 0
                    ? "No academic score rows in this spreadsheet."
                    : "No records match search."}
                </td>
              </tr>
            ) : (
              filtered.map((rec) => {
                const ca1 = rec.parsedData.ca1 ?? 0;
                const ca2 = rec.parsedData.ca2 ?? 0;
                const exam = rec.parsedData.exam ?? 0;
                const total = ca1 + ca2 + exam;

                return (
                  <tr key={rec._id} className="hover:bg-slate-50/60 transition-colors text-xs">
                    <td className="px-4 py-3 font-mono text-slate-400">#{rec.rowNumber}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {rec.parsedData.firstName} {rec.parsedData.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{rec.parsedData.className}</td>
                    <td className="px-4 py-3 font-medium text-indigo-900">
                      <input
                        type="text"
                        defaultValue={rec.parsedData.subjectName || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (rec.parsedData.subjectName || "")) {
                            onPatchField(rec._id, { subjectName: e.target.value });
                          }
                        }}
                        className="w-36 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-semibold text-indigo-700 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        defaultValue={rec.parsedData.ca1 ?? ""}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) onPatchField(rec._id, { ca1: val });
                        }}
                        className="w-16 rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1 font-mono text-center font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        defaultValue={rec.parsedData.ca2 ?? ""}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) onPatchField(rec._id, { ca2: val });
                        }}
                        className="w-16 rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1 font-mono text-center font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        defaultValue={rec.parsedData.exam ?? ""}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) onPatchField(rec._id, { exam: val });
                        }}
                        className="w-16 rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1 font-mono text-center font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-extrabold text-slate-900">
                      {total}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => onReview(rec)} className="mr-2 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700">
                        {rec.reviewStatus === "approved" ? "Edit review" : "Review row"}
                      </button>
                      {rec.reviewStatus === "approved" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" />{rec.commitOutcome ?? "Reviewed"}</span>
                      ) : rec.validationStatus === "error" ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200"
                          title={rec.validationErrors.join(", ")}
                        >
                          <AlertCircle className="h-3 w-3" />
                          Invalid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Valid
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
