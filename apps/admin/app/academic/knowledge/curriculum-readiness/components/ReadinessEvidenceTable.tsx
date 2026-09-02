import { Check, Minus } from "lucide-react";
import type { ReadinessRow, ReadinessStatus } from "./types";

const columns: Array<{ key: keyof ReadinessRow; label: string }> = [
  { key: "sourceStatus", label: "Source" },
  { key: "lessonPlanStatus", label: "Plan" },
  { key: "studentNoteStatus", label: "Note" },
  { key: "assignmentStatus", label: "Task" },
  { key: "assessmentStatus", label: "Assessment" },
  { key: "studentPublicationStatus", label: "Published" },
];

function hasEvidence(status: ReadinessStatus) {
  return !status.startsWith("no_");
}

function EvidenceCell({ status }: { status: ReadinessStatus }) {
  const prepared = hasEvidence(status);
  return (
    <span
      aria-label={prepared ? "Preparation evidence recorded" : "No preparation evidence recorded"}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
        prepared ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100 text-slate-300"
      }`}
    >
      {prepared ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Minus className="h-3 w-3" strokeWidth={2.5} />}
    </span>
  );
}

export function ReadinessEvidenceTable({ rows }: { rows: ReadinessRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 bg-slate-50/40">
        <h2 className="font-display text-sm font-bold text-slate-950 uppercase tracking-wide">Topic Evidence Matrix</h2>
        <p className="mt-0.5 text-xs text-slate-500">Live preparation coverage across instructional artifacts and assessments for this term.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 border-b border-slate-200/60">
            <tr>
              <th className="px-5 py-3">Topic Title</th>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-3 text-center">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {rows.map((row) => (
              <tr key={row.topicId} className="hover:bg-slate-50/80 transition-colors">
                <th scope="row" className="max-w-[300px] px-5 py-3.5 font-bold text-slate-900">
                  {row.title}
                </th>
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3.5 text-center">
                    <EvidenceCell status={row[column.key] as ReadinessStatus} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
